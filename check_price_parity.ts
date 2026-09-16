import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import BN from 'bn.js';
import fs from 'fs';
import crypto from 'crypto';
import { getStockPrice } from './lib/market-data.js';

const envContent = fs.readFileSync('.env.local', 'utf8');
const rpcMatch = envContent.match(/MAINNET_RPC_URL=(.*)/);
if (rpcMatch) {
  process.env.MAINNET_RPC_URL = rpcMatch[1].trim().replace(/^"|"$/g, '');
}
const tiingoMatch = envContent.match(/TIINGO_API_KEY=(.*)/);
if (tiingoMatch) {
  process.env.TIINGO_API_KEY = tiingoMatch[1].trim().replace(/^"|"$/g, '');
}

const KLEND_PROGRAM_ID = new PublicKey('KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD');
const XSTOCKS_MARKET = new PublicKey('5wJeMrUYECGq41fxRESKALVcHnNX26TAWy4W98yULsua');
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const SF_BASE = new BN(2).pow(new BN(60));

function sfToReal(sfValue: BN): number {
  if (!sfValue) return 0;
  return Number(sfValue.toString()) / Number(SF_BASE.toString());
}

function getReserveDiscriminator(): Buffer {
  return crypto.createHash('sha256').update('account:Reserve').digest().subarray(0, 8);
}

async function getReserveSymbol(connection: Connection, accountInfo: any): Promise<string | null> {
  const mintPubkey = new PublicKey(accountInfo.data.subarray(128, 160));
  
  const [metadataPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mintPubkey.toBuffer()],
    TOKEN_METADATA_PROGRAM_ID
  );
  const metadataAccountInfo = await connection.getAccountInfo(metadataPda);
  if (metadataAccountInfo) {
    const data = metadataAccountInfo.data;
    const nameLen = data.readUInt32LE(65);
    const symbolOffset = 69 + nameLen;
    const symbolLen = data.readUInt32LE(symbolOffset);
    const symbolBytes = data.subarray(symbolOffset + 4, symbolOffset + 4 + symbolLen);
    return symbolBytes.toString('utf8').replace(/\0/g, '').trim();
  }
  
  const mintAccountInfo = await connection.getAccountInfo(mintPubkey);
  if (mintAccountInfo && mintAccountInfo.data.length > 82) {
    const extBytes = Buffer.from([19, 0]);
    let index = mintAccountInfo.data.indexOf(extBytes, 82);
    while (index !== -1) {
      const len = mintAccountInfo.data.readUInt16LE(index + 2);
      if (index + 4 + len <= mintAccountInfo.data.length) {
        try {
          let ptr = index + 4 + 32 + 32;
          const nameLen = mintAccountInfo.data.readUInt32LE(ptr); ptr += 4;
          ptr += nameLen;
          const symLen = mintAccountInfo.data.readUInt32LE(ptr); ptr += 4;
          const sym = mintAccountInfo.data.subarray(ptr, ptr + symLen).toString('utf8').replace(/\0/g, '').trim();
          if (sym.length > 0 && sym.length < 20) return sym;
        } catch (e) {}
      }
      index = mintAccountInfo.data.indexOf(extBytes, index + 1);
    }
  }
  return null;
}

function isNyseOpen(): boolean {
  const now = new Date();
  // Get time in EST/EDT
  const estDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = estDate.getDay();
  const hours = estDate.getHours();
  const minutes = estDate.getMinutes();

  if (day === 0 || day === 6) return false; // Weekend
  
  const timeInMinutes = hours * 60 + minutes;
  // 9:30 AM = 570, 4:00 PM = 960
  if (timeInMinutes >= 570 && timeInMinutes < 960) {
    return true;
  }
  return false;
}

async function main() {
  const connection = new Connection(process.env.SOLANA_RPC_URL || process.env.MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com');
  const reserveDiscriminator = getReserveDiscriminator();

  const accounts = await connection.getProgramAccounts(KLEND_PROGRAM_ID, {
    filters: [
      { memcmp: { offset: 0, bytes: anchor.utils.bytes.bs58.encode(reserveDiscriminator) } },
      { memcmp: { offset: 32, bytes: XSTOCKS_MARKET.toBase58() } },
    ],
  });

  const simulateGap = process.argv.includes('--simulate-gap');
  let targetDate: string | undefined = undefined;
  if (simulateGap) {
    let d = new Date();
    while (d.getDay() !== 5) {
      d.setDate(d.getDate() - 1);
    }
    if (d.toDateString() === new Date().toDateString()) {
       d.setDate(d.getDate() - 7);
    }
    targetDate = d.toISOString().split('T')[0];
  }

  console.log(`Found ${accounts.length} reserves in XSTOCKS_MARKET\n`);

  const nyseOpen = isNyseOpen();
  console.log(`Market Status: US Markets are currently ${nyseOpen ? 'OPEN' : 'CLOSED'}`);
  if (simulateGap) {
    console.log(`Weekend Gap Check (Fri close vs. now) - Target Date: ${targetDate}`);
  }
  console.log(`---------------------------------------------------------`);

  for (const acc of accounts) {
    const symbol = await getReserveSymbol(connection, acc.account);
    if (!symbol || !symbol.endsWith('x')) continue; // Skip USDC or unknown

    const underlying = symbol.slice(0, -1);
    
    console.log(`[${symbol}] (Reserve: ${acc.pubkey.toBase58()}) Underlying: ${underlying}`);
    console.log(`  Source: Tiingo API`);
    
    let tiingoPrice: number;
    let tiingoTs: string;
    try {
      const res = await getStockPrice(underlying, targetDate);
      if (!res) {
        console.log(`  Tiingo API error: No data returned`);
        console.log(`---------------------------------------------------------`);
        continue;
      }
      tiingoPrice = res.price;
      tiingoTs = res.date;
    } catch (e: any) {
      console.log(`  Tiingo API error: ${e.message}`);
      console.log(`---------------------------------------------------------`);
      continue;
    }
    
    // Fetch Kamino price
    const priceSf = new BN(acc.account.data.subarray(248, 264), 'le');
    const kaminoPrice = sfToReal(priceSf);
    const lastUpdateTs = Number(acc.account.data.readBigUInt64LE(264));
    const kaminoTs = new Date(lastUpdateTs * 1000).toISOString();
    
    const diff = kaminoPrice - tiingoPrice;
    const devPct = (diff / tiingoPrice) * 100;
    
    console.log(`  Kamino Price: $${kaminoPrice.toFixed(4)} (Ts: ${kaminoTs})`);
    console.log(`  Tiingo Price: $${tiingoPrice.toFixed(4)} (Ts: ${tiingoTs})`);
    console.log(`  Difference:   $${Math.abs(diff).toFixed(4)} (${devPct > 0 ? '+' : ''}${devPct.toFixed(2)}%)`);
    console.log(`---------------------------------------------------------`);
    
    // Throttle sequential fetch just like lib/alerts.ts handles rate limits
    await new Promise(r => setTimeout(r, 1000));
  }
}

main().catch(console.error);
