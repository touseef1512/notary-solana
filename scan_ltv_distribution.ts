import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { struct, u64, u8, publicKey, u128, array, u32 } from '@coral-xyz/borsh';
import BN from 'bn.js';

const KLEND_PROGRAM_ID = new PublicKey('KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD');
const XSTOCKS_MARKET = new PublicKey('5wJeMrUYECGq41fxRESKALVcHnNX26TAWy4W98yULsua');
const SF_BASE = new BN(2).pow(new BN(60));

function sfToReal(sfValue: BN | number | string): number {
  if (!sfValue) return 0;
  const val = new BN(sfValue.toString());
  return Number(val.toString()) / Number(SF_BASE.toString());
}

interface ReserveData {
  decimals: number;
  price: number;
}

const OBLIGATION_LAYOUT = struct([
  u64('tag'),
  struct([u64('slot'), u8('stale'), u8('priceStatus'), array(u8(), 2, 'pad'), u32('timestamp')], 'lastUpdate'),
  publicKey('lendingMarket'),
  publicKey('owner'),
  array(struct([publicKey('depositReserve'), u64('depositedAmount'), u128('marketValueSf'), u64('borrowedAmountAgainstThisCollateralInElevationGroup'), array(u64(), 9, 'padding')]), 8, 'deposits'),
  u64('lowestReserveDepositLiquidationLtv'),
  u128('depositedValueSf'),
  array(struct([publicKey('borrowReserve'), struct([array(u64(), 4, 'value'), array(u64(), 2, 'padding')], 'cumulativeBorrowRateBsf'), u64('lastBorrowedAtTimestamp'), u128('borrowedAmountSf'), u128('marketValueSf'), u128('borrowFactorAdjustedMarketValueSf'), u64('borrowedAmountOutsideElevationGroups'), struct([u8('autoRolloverEnabled'), u8('openTermAllowed'), u8('migrationToFixedEnabled'), u8('fixedTermRolloverWindowDurationDays'), u32('maxBorrowRateBps'), u64('minDebtTermSeconds')], 'fixedTermBorrowRolloverConfig'), u64('borrowedAmountAtExpiration'), array(u64(), 4, 'padding2')]), 5, 'borrows'),
  u128('borrowFactorAdjustedDebtValueSf'),
  u128('borrowedAssetsMarketValueSf'),
  u128('allowedBorrowValueSf'),
  u128('unhealthyBorrowValueSf'),
  array(u8(), 13, 'paddingDeprecatedAssetTiers'),
  u8('elevationGroup')
]);

async function getReserveData(connection: Connection, reservePubkey: PublicKey): Promise<ReserveData> {
  const fallback = { decimals: 0, price: 0 };
  try {
    const accountInfo = await connection.getAccountInfo(reservePubkey);
    if (!accountInfo) return fallback;
    const priceSf = new BN(accountInfo.data.subarray(248, 264), 'le');
    const price = sfToReal(priceSf);
    const decimals = Number(accountInfo.data.readBigUInt64LE(272));
    return { decimals, price };
  } catch (err) {
    return fallback;
  }
}

async function run() {
  const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
  const discriminator = Buffer.from([168, 206, 141, 106, 88, 76, 172, 167]);

  const accounts = await connection.getProgramAccounts(KLEND_PROGRAM_ID, {
    filters: [
      { memcmp: { offset: 0, bytes: anchor.utils.bytes.bs58.encode(discriminator) } },
      { memcmp: { offset: 32, bytes: XSTOCKS_MARKET.toBase58() } },
    ],
  });

  let scanned = 0;
  let active = 0;
  const ltvRatios: number[] = [];
  const reserveCache = new Map<string, ReserveData>();

  const resolveReserve = async (reserve: PublicKey) => {
    const key = reserve.toBase58();
    if (reserveCache.has(key)) return reserveCache.get(key)!;
    const data = await getReserveData(connection, reserve);
    reserveCache.set(key, data);
    return data;
  };

  for (const acc of accounts) {
    const data = OBLIGATION_LAYOUT.decode(acc.account.data.subarray(8));
    if (data.lastUpdate.timestamp === 0) continue;
    scanned++;

    let liveDepositedValue = 0;
    let liveBorrowedValue = 0;
    let hasNonZeroDeposit = false;
    let hasNonZeroBorrow = false;

    for (const d of data.deposits) {
      const p = d.depositReserve.toBase58();
      if (d.depositReserve.equals(PublicKey.default) || p.startsWith('111111111111111111111111')) continue;
      const rawAmount = Number(d.depositedAmount.toString());
      if (rawAmount > 0) {
        hasNonZeroDeposit = true;
        const rData = await resolveReserve(d.depositReserve);
        const amount = rawAmount / Math.pow(10, rData.decimals);
        liveDepositedValue += amount * rData.price;
      }
    }

    for (const b of data.borrows) {
      const p = b.borrowReserve.toBase58();
      if (b.borrowReserve.equals(PublicKey.default) || p.startsWith('111111111111111111111111')) continue;
      const rawAtomicAmount = sfToReal(b.borrowedAmountSf);
      if (rawAtomicAmount > 0) {
        hasNonZeroBorrow = true;
        const rData = await resolveReserve(b.borrowReserve);
        const amount = rawAtomicAmount / Math.pow(10, rData.decimals);
        liveBorrowedValue += amount * rData.price;
      }
    }

    if (hasNonZeroDeposit && hasNonZeroBorrow) {
      active++;
      const currentLtv = liveDepositedValue > 0 ? liveBorrowedValue / liveDepositedValue : Infinity;
      ltvRatios.push(currentLtv);
      const liqThreshold = Number(data.lowestReserveDepositLiquidationLtv.toString()) / 100;
      console.log(
        `pubkey: ${acc.pubkey.toBase58()} | owner: ${data.owner.toBase58()} | ts: ${new Date(data.lastUpdate.timestamp * 1000).toISOString()} | ` +
        `dep: $${liveDepositedValue.toFixed(2)} | bor: $${liveBorrowedValue.toFixed(2)} | LTV: ${currentLtv.toFixed(4)} | liqThresh: ${liqThreshold.toFixed(4)} | elevationGroup: ${data.elevationGroup}`
      );
    }
  }

  console.log(`\n--- SUMMARY ---`);
  console.log(`Total active obligations scanned (ts !== 0): ${scanned}`);
  console.log(`Obligations with both active deposits and borrows: ${active}`);

  if (active > 0) {
    ltvRatios.sort((a, b) => a - b);
    const minLtv = ltvRatios[0];
    const maxLtv = ltvRatios[ltvRatios.length - 1];
    const mid = Math.floor(ltvRatios.length / 2);
    const medianLtv = ltvRatios.length % 2 !== 0 ? ltvRatios[mid] : (ltvRatios[mid - 1] + ltvRatios[mid]) / 2;
    console.log(`Min LTV: ${minLtv.toFixed(4)}`);
    console.log(`Median LTV: ${medianLtv.toFixed(4)}`);
    console.log(`Max LTV: ${maxLtv.toFixed(4)}`);
  }
}

run().catch(console.error);
