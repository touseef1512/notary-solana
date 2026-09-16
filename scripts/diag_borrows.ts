import { Connection, PublicKey } from '@solana/web3.js';
import { struct, u64, u8, publicKey, u128, array, u32 } from '@coral-xyz/borsh';
import BN from 'bn.js';
import fs from 'fs';

// Load RPC URL from .env.local
let rpcUrl = process.env.SOLANA_RPC_URL || process.env.MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com';
if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const rpcMatch = envContent.match(/MAINNET_RPC_URL=(.*)/);
  if (rpcMatch) {
    rpcUrl = rpcMatch[1].trim().replace(/^"|"$/g, '');
  }
}

const connection = new Connection(rpcUrl, 'confirmed');

const SF_BASE = new BN(2).pow(new BN(60));

function sfToReal(sfValue: any): number {
  if (!sfValue) return 0;
  const val = new BN(sfValue.toString());
  return Number(val.toString()) / Number(SF_BASE.toString());
}

// EXACT SAME OBLIGATION_LAYOUT currently hand-coded in lib/kamino.ts
const OBLIGATION_LAYOUT = struct([
  u64('tag'),
  struct([
    u64('slot'),
    u8('stale'),
    u8('priceStatus'),
    array(u8(), 2, 'alignmentPadding'),
    u32('timestamp'),
  ], 'lastUpdate'),
  publicKey('lendingMarket'),
  publicKey('owner'),
  array(
    struct([
      publicKey('depositReserve'),
      u64('depositedAmount'),
      u128('marketValueSf'),
      u64('borrowedAmountAgainstThisCollateralInElevationGroup'),
      array(u64(), 9, 'padding'),
    ]),
    8,
    'deposits'
  ),
  u64('lowestReserveDepositLiquidationLtv'),
  u128('depositedValueSf'),
  array(
    struct([
      publicKey('borrowReserve'),
      struct([array(u64(), 4, 'value'), array(u64(), 2, 'padding')], 'cumulativeBorrowRateBsf'),
      u64('lastBorrowedAtTimestamp'),
      u128('borrowedAmountSf'),
      u128('marketValueSf'),
      u128('borrowFactorAdjustedMarketValueSf'),
      u64('borrowedAmountOutsideElevationGroups'),
      struct([u8('autoRolloverEnabled'), u8('openTermAllowed'), u8('migrationToFixedEnabled'), u8('fixedTermRolloverWindowDurationDays'), u32('maxBorrowRateBps'), u64('minDebtTermSeconds')], 'fixedTermBorrowRolloverConfig'),
      u64('borrowedAmountAtExpiration'),
      array(u64(), 4, 'padding2'),
    ]),
    5,
    'borrows'
  ),
  u128('borrowFactorAdjustedDebtValueSf')
]);

async function run() {
  const ob1 = new PublicKey('7BACsXdze3FporEnXEbuSHStPPQ58tpZuWb7jgsUYmV');
  const ob2 = new PublicKey('7CVz2GhYLE7U568LrY4pyFocmnLpSwScBQGXmNrpbzH8');

  const acc1 = await connection.getAccountInfo(ob1);
  const acc2 = await connection.getAccountInfo(ob2);

  if (!acc1 || !acc2) {
    console.error('Failed to fetch accounts:', { acc1: !!acc1, acc2: !!acc2 });
    return;
  }

  const dec1 = OBLIGATION_LAYOUT.decode(acc1.data.subarray(8));
  const dec2 = OBLIGATION_LAYOUT.decode(acc2.data.subarray(8));

  const b1 = dec1.borrows[0];
  const b2 = dec2.borrows[0];

  function formatBsf(bsf: any): string {
    if (!bsf || !bsf.value) return 'null';
    const vals = bsf.value.map((v: any) => v.toString());
    // Combine 4 u64s into a 256-bit BN
    let combined = new BN(0);
    for (let i = bsf.value.length - 1; i >= 0; i--) {
      combined = combined.shln(64).add(new BN(bsf.value[i].toString()));
    }
    // Also try sfToReal on the lower 128 bits or 2^60
    return `[${vals.join(', ')}] (256-bit hex: 0x${combined.toString(16)}, sfToReal: ${sfToReal(combined).toFixed(6)})`;
  }

  console.log('='.repeat(100));
  console.log(`FIELD COMPARISON OF FIRST BORROW ENTRY (SAME OBLIGATION_LAYOUT)`);
  console.log('='.repeat(100));

  const rows = [
    ['borrowReserve', b1.borrowReserve.toBase58(), b2.borrowReserve.toBase58()],
    ['cumulativeBorrowRateBsf', formatBsf(b1.cumulativeBorrowRateBsf), formatBsf(b2.cumulativeBorrowRateBsf)],
    ['lastBorrowedAtTimestamp (raw u64)', b1.lastBorrowedAtTimestamp.toString(), b2.lastBorrowedAtTimestamp.toString()],
    ['borrowedAmountSf (raw BN)', b1.borrowedAmountSf.toString(), b2.borrowedAmountSf.toString()],
    ['borrowedAmountSf (sfToReal)', sfToReal(b1.borrowedAmountSf).toString(), sfToReal(b2.borrowedAmountSf).toString()],
    ['marketValueSf (raw BN)', b1.marketValueSf.toString(), b2.marketValueSf.toString()],
    ['marketValueSf (sfToReal)', sfToReal(b1.marketValueSf).toString(), sfToReal(b2.marketValueSf).toString()],
    ['borrowFactorAdjustedMarketValueSf (raw BN)', b1.borrowFactorAdjustedMarketValueSf.toString(), b2.borrowFactorAdjustedMarketValueSf.toString()],
    ['borrowFactorAdjustedMarketValueSf (sfToReal)', sfToReal(b1.borrowFactorAdjustedMarketValueSf).toString(), sfToReal(b2.borrowFactorAdjustedMarketValueSf).toString()],
    ['borrowedAmountOutsideElevationGroups (raw u64)', b1.borrowedAmountOutsideElevationGroups.toString(), b2.borrowedAmountOutsideElevationGroups.toString()],
    ['borrowedAmountAtExpiration (raw u64)', b1.borrowedAmountAtExpiration.toString(), b2.borrowedAmountAtExpiration.toString()],
  ];

  console.log(
    'Field'.padEnd(45) + ' | ' +
    '7BACsXdze3... (Obligation 1)'.padEnd(50) + ' | ' +
    '7CVz2GhYLE... (Obligation 2)'
  );
  console.log('-'.repeat(140));

  for (const [field, v1, v2] of rows) {
    console.log(field.padEnd(45) + ' | ' + (v1 || '').padEnd(50) + ' | ' + (v2 || ''));
  }
}

run().catch(console.error);
