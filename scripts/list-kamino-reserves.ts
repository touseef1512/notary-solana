import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { KNOWN_ASSETS } from '../lib/known-assets';

const KLEND_PROGRAM_ID = new PublicKey('KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD');
const XSTOCKS_MARKET = new PublicKey('5wJeMrUYECGq41fxRESKALVcHnNX26TAWy4W98yULsua');
const METAPLEX_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const SPYX_CANDIDATE = 'XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^([^=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
    }
  }
}

function readString(data: Buffer, ptr: number): { text: string; next: number } | null {
  if (ptr + 4 > data.length) return null;
  const len = data.readUInt32LE(ptr);
  const start = ptr + 4;
  if (len > 200 || start + len > data.length) return null;
  return { text: data.subarray(start, start + len).toString('utf8').replace(/\0/g, '').trim(), next: start + len };
}

function token2022Metadata(data: Buffer): { name: string; symbol: string } | null {
  if (data.length <= 166) return null;
  let ptr = 166;
  while (ptr + 4 <= data.length) {
    const type = data.readUInt16LE(ptr);
    const len = data.readUInt16LE(ptr + 2);
    const start = ptr + 4;
    if (start + len > data.length) return null;
    if (type === 19) {
      const name = readString(data, start + 64);
      if (!name) return null;
      const symbol = readString(data, name.next);
      if (!symbol) return null;
      return { name: name.text, symbol: symbol.text };
    }
    ptr = start + len;
  }
  return null;
}

function metaplexMetadata(data: Buffer): { name: string; symbol: string } | null {
  const name = readString(data, 65);
  if (!name) return null;
  const symbol = readString(data, name.next);
  if (!symbol) return null;
  return { name: name.text, symbol: symbol.text };
}

interface Row { symbol: string; name: string; mint: string; program: string; decimals: number | string; reserve: string; source: string }

async function main() {
  loadEnv();
  const rpc = process.env.SOLANA_RPC_URL || process.env.MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpc);
  const discriminator = createHash('sha256').update('account:Reserve').digest().subarray(0, 8);

  const accounts = await connection.getProgramAccounts(KLEND_PROGRAM_ID, {
    dataSlice: { offset: 128, length: 32 },
    filters: [
      { memcmp: { offset: 0, bytes: anchor.utils.bytes.bs58.encode(discriminator) } },
      { memcmp: { offset: 32, bytes: XSTOCKS_MARKET.toBase58() } },
    ],
  });

  console.log('Reserves found in the xStocks market: ' + accounts.length);
  if (accounts.length === 0) {
    console.log('Nothing found. The reserve discriminator or market filter did not match; do not guess, paste this output.');
    return;
  }

  const rows: Row[] = [];
  for (let i = 0; i < accounts.length; i++) {
    const reserve = accounts[i].pubkey.toBase58();
    const mint = new PublicKey(accounts[i].account.data);
    const info = await connection.getAccountInfo(mint);
    if (!info) {
      rows.push({ symbol: '(mint not found)', name: '', mint: mint.toBase58(), program: '', decimals: '', reserve, source: '' });
      continue;
    }
    const program = info.owner.toBase58() === TOKEN_2022_PROGRAM ? 'Token-2022' : info.owner.toBase58() === TOKEN_PROGRAM ? 'Token' : info.owner.toBase58();
    const decimals = info.data.length > 44 ? info.data[44] : '';
    let meta = program === 'Token-2022' ? token2022Metadata(info.data) : null;
    let source = meta ? 'token2022-ext' : '';
    if (!meta) {
      const [pda] = PublicKey.findProgramAddressSync([Buffer.from('metadata'), METAPLEX_PROGRAM_ID.toBuffer(), mint.toBuffer()], METAPLEX_PROGRAM_ID);
      const mdInfo = await connection.getAccountInfo(pda);
      if (mdInfo) {
        meta = metaplexMetadata(mdInfo.data);
        if (meta) source = 'metaplex';
      }
    }
    rows.push({ symbol: meta ? meta.symbol : '(no metadata)', name: meta ? meta.name : '', mint: mint.toBase58(), program, decimals, reserve, source });
  }

  rows.sort((a, b) => a.symbol.localeCompare(b.symbol));
  console.log('');
  console.log('SYMBOL'.padEnd(14) + 'MINT'.padEnd(46) + 'PROGRAM'.padEnd(12) + 'DEC'.padEnd(5) + 'SOURCE'.padEnd(15) + 'NAME');
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    console.log(r.symbol.padEnd(14) + r.mint.padEnd(46) + r.program.padEnd(12) + String(r.decimals).padEnd(5) + r.source.padEnd(15) + r.name);
  }

  console.log('');
  console.log('Cross-check against lib/known-assets.ts (must all say MATCH):');
  for (let i = 0; i < KNOWN_ASSETS.length; i++) {
    const a = KNOWN_ASSETS[i];
    const found = rows.find((r) => r.symbol === a.symbol);
    if (!found) {
      console.log('  ' + a.symbol + ': not a reserve in this market (expected for the Ondo tokens)');
    } else {
      console.log('  ' + a.symbol + ': ' + (found.mint === a.mintAddress ? 'MATCH' : 'MISMATCH (chain ' + found.mint + ' vs known-assets ' + a.mintAddress + ')'));
    }
  }
  const spy = rows.find((r) => r.mint === SPYX_CANDIDATE);
  console.log('  Third-party SPYx candidate ' + SPYX_CANDIDATE + ': ' + (spy ? 'found on chain as ' + spy.symbol : 'NOT in this market'));
}

main().catch((e) => {
  console.error('Script failed:', e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
