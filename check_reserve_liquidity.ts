import { Connection, PublicKey } from '@solana/web3.js';
import { struct, u64, u8, publicKey, u128, array, u32 } from '@coral-xyz/borsh';
import BN from 'bn.js';


import bs58 from 'bs58';

const KLEND_PROGRAM_ID = new PublicKey('KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD');
const XSTOCKS_MARKET = new PublicKey('5wJeMrUYECGq41fxRESKALVcHnNX26TAWy4W98yULsua');
const SF_BASE = new BN(2).pow(new BN(60));

function sfToReal(sfValue: BN): number {
  if (!sfValue) return 0;
  return Number(sfValue.toString()) / Number(SF_BASE.toString());
}

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

async function main() {
  const connection = new Connection(process.env.MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com');
  const discriminator = Buffer.from([168, 206, 141, 106, 88, 76, 172, 167]);

  const accounts = await connection.getProgramAccounts(KLEND_PROGRAM_ID, {
    filters: [
      { memcmp: { offset: 0, bytes: bs58.encode(discriminator) } },
      { memcmp: { offset: 32, bytes: XSTOCKS_MARKET.toBase58() } }
    ],
  });

  const uniqueReserves = new Set<string>();
  const activeObligations = [];

  for (const account of accounts) {
    try {
      const decoded = OBLIGATION_LAYOUT.decode(account.account.data.slice(8));
      if (decoded.lastUpdate.timestamp !== 0) {
        activeObligations.push({ pubkey: account.pubkey.toBase58(), data: account.account.data, decoded });
        for (const borrow of decoded.borrows) {
          const reservePubkey = borrow.borrowReserve.toBase58();
          if (reservePubkey !== '11111111111111111111111111111111') {
            uniqueReserves.add(reservePubkey);
          }
        }
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }

  console.log(`Found ${uniqueReserves.size} unique borrow reserves across active obligations.`);
  
  for (const reservePubkey of Array.from(uniqueReserves)) {
    console.log(`\n--- Fetching Reserve: ${reservePubkey} ---`);
    const accountInfo = await connection.getAccountInfo(new PublicKey(reservePubkey));
    if (!accountInfo) {
      console.log(`Failed to fetch reserve ${reservePubkey}`);
      continue;
    }
    
    // offset 224: totalAvailableAmount (u64)
    // offset 232: borrowedAmountSf (u128)
    // offset 272: mintDecimals (u64)
    const availableAmountRaw = accountInfo.data.readBigUInt64LE(224);
    const borrowedAmountSf = new BN(accountInfo.data.subarray(232, 248), 'le');
    const decimals = Number(accountInfo.data.readBigUInt64LE(272));
    
    const borrowedAmountHuman = sfToReal(borrowedAmountSf) / Math.pow(10, decimals);
    const availableAmountHuman = Number(availableAmountRaw) / Math.pow(10, decimals);
    
    console.log(`availableAmount (raw u64): ${availableAmountRaw}`);
    console.log(`borrowedAmountSf (raw u128 hex): ${borrowedAmountSf.toString('hex')}`);
    console.log(`mintDecimals: ${decimals}`);
    console.log(`\nHuman-readable terms (assuming 1 unit = $1 for USDC):`);
    console.log(`Available Liquidity on Reserve: $${availableAmountHuman.toFixed(2)}`);
    console.log(`Total Borrowed from Reserve:    $${borrowedAmountHuman.toFixed(2)}`);
  }

  console.log(`\n--- Double Check: borrowedAmountSf Byte Inspection ---`);
  
  // Find 3 obligations that actually have borrows
  const sampleObligations = activeObligations.filter(o => 
    o.decoded.borrows.some((b: any) => b.borrowReserve.toBase58() !== '11111111111111111111111111111111' && b.borrowedAmountSf.gt(new BN(0)))
  ).slice(0, 3);
  
  for (let i = 0; i < sampleObligations.length; i++) {
    const ob = sampleObligations[i];
    
    // Find the first active borrow index
    const activeBorrowIdx = ob.decoded.borrows.findIndex((b: any) => b.borrowReserve.toBase58() !== '11111111111111111111111111111111');
    if (activeBorrowIdx === -1) continue;
    
    const borrowOffset = 8 + 1200 + (activeBorrowIdx * 136); // 8(tag) + 1200(borrows array start)
    const borrowedAmountSfOffset = borrowOffset + 72; // 32(reserve) + 32(cumul) + 8(timestamp)
    
    const rawBytesHex = ob.data.subarray(borrowedAmountSfOffset, borrowedAmountSfOffset + 16).toString('hex');
    const decodedValue = ob.decoded.borrows[activeBorrowIdx].borrowedAmountSf;
    const parsedValueHuman = sfToReal(decodedValue) / Math.pow(10, 6); // Assuming USDC
    
    console.log(`Obligation ${i + 1} (${ob.pubkey})`);
    console.log(`  Byte offset: ${borrowedAmountSfOffset}`);
    console.log(`  Raw hex:     ${rawBytesHex}`);
    console.log(`  Parsed val:  ${decodedValue.toString(10)} (approx $${parsedValueHuman.toFixed(2)})`);
  }
}

main().catch(console.error);
