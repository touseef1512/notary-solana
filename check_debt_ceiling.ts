import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import fs from 'fs';

async function main() {
  const connection = new Connection('https://api.mainnet-beta.solana.com');
  const programId = new PublicKey('KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD');
  const marketId = new PublicKey('5wJeMrUYECGq41fxRESKALVcHnNX26TAWy4W98yULsua');
  
  const accountInfo = await connection.getAccountInfo(marketId);
  if (!accountInfo) throw new Error("Market not found");
  
  // globalAllowedBorrowValue is at offset: 8(tag)+8+8+32+32+32+2+1+1+1+1+1+1+8+8+8+8+32 = wait let's calculate
  // version(8) + bumpSeed(8) + lendingMarketOwner(32) + lendingMarketOwnerCached(32) + quoteCurrency(32) 
  // + referralFeeBps(2) + emergencyMode(1) + autodeleverageEnabled(1) + borrowDisabled(1) 
  // + priceRefreshTriggerToMaxAgePct(1) + liquidationMaxDebtCloseFactorPct(1) + insolvencyRiskUnhealthyLtvPct(1) 
  // + minFullLiquidationValueThreshold(8) + maxLiquidatableDebtMarketValueAtOnce(8) + reserved0(8)
  // = 8+8+8+32+32+32+2+1+1+1+1+1+1+8+8+8 = 152
  // globalAllowedBorrowValue(8) at 152
  // emergencyCouncil(32) at 160
  // reserved1(8) at 192
  // elevationGroups at 200. Each is: maxLiquidationBonusBps(2)+id(1)+ltvPct(1)+liquidationThresholdPct(1)+allowNewLoans(1)+maxReservesAsCollateral(1)+padding0(1)+debtReserve(32)+padding1(32) = 72 bytes. Total 32 items = 2304 bytes.

  const data = accountInfo.data;
  const globalAllowedBorrowValue = data.readBigUInt64LE(152);
  const maxLiquidatableDebtMarketValueAtOnce = data.readBigUInt64LE(136);

  console.log("--- LendingMarket Debt & Borrow Limits ---");
  console.log(`globalAllowedBorrowValue: ${globalAllowedBorrowValue.toString()} (Raw) -> $${(Number(globalAllowedBorrowValue) / 1e6).toFixed(2)} (assuming USDC/6 decimals)`);
  console.log(`maxLiquidatableDebtMarketValueAtOnce: ${maxLiquidatableDebtMarketValueAtOnce.toString()}`);
  
  console.log("\\n--- Elevation Groups ---");
  for (let i = 0; i < 32; i++) {
    const egOffset = 200 + i * 72;
    const maxLiquidationBonusBps = data.readUInt16LE(egOffset);
    const id = data.readUInt8(egOffset + 2);
    const ltvPct = data.readUInt8(egOffset + 3);
    const liquidationThresholdPct = data.readUInt8(egOffset + 4);
    const allowNewLoans = data.readUInt8(egOffset + 5);
    const maxReservesAsCollateral = data.readUInt8(egOffset + 6);
    const debtReserve = new PublicKey(data.subarray(egOffset + 8, egOffset + 40));

    if (id !== 0 || ltvPct !== 0) {
      console.log(`Elevation Group ID: ${id}`);
      console.log(`  maxLiquidationBonusBps: ${maxLiquidationBonusBps}`);
      console.log(`  ltvPct: ${ltvPct}%`);
      console.log(`  liquidationThresholdPct: ${liquidationThresholdPct}%`);
      console.log(`  allowNewLoans: ${allowNewLoans}`);
      console.log(`  maxReservesAsCollateral: ${maxReservesAsCollateral}`);
      console.log(`  debtReserve: ${debtReserve.toBase58()}`);
    }
  }
}

main().catch(console.error);
