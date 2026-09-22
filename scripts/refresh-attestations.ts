import fs from 'fs';
import path from 'path';

function loadEnv(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const m = line.match(/^([^=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
    }
  }
  return process.env as Record<string, string>;
}
loadEnv();

import { getKaminoPositions } from '../lib/kamino';
import { computeSurvivableDrawdown, computeGapStressedHealthFactor } from '../lib/risk-math';
import { getAttestationStatus, refreshRiskAttestation } from '../lib/sas-attestation';
import { getAllMeasuredWeekendGaps } from '../lib/weekend-gap';

const PAIRS = [
  { wallet: 'Fa7LNzj3SCV364hya9dx9evL29pC1awx24iHeCEwX6vU', obligation: '7BACsXdze3FporEnXEbuSHStPPQ58tpZuWb7jgsUYmV' },
  { wallet: 'QqxKVDPcxMLQ8UL8wet8RTLuwtpjLH8841pcNYTNBYK', obligation: '7CVz2GhYLE7U568LrY4pyFocmnLpSwScBQGXmNrpbzH8' },
];

async function run() {
  const isSend = process.argv.includes('--send');
  let hasError = false;

  const gapData = await getAllMeasuredWeekendGaps();
  const gapPercentages = Object.fromEntries(Object.entries(gapData).map(([k, v]) => [k, v.percent]));

  for (let i = 0; i < PAIRS.length; i++) {
    const pair = PAIRS[i];
    console.log(`\nProcessing Wallet: ${pair.wallet} | Obligation: ${pair.obligation}`);
    try {
      const positions = await getKaminoPositions(pair.wallet);
      const obligation = positions.find(o => o.obligationPubkey === pair.obligation);
      if (!obligation) {
        console.log(`  Skip: Obligation not found.`);
        continue;
      }

      if (obligation.borrowedValue <= 0) {
        console.log(`  Skip: Borrowed value is <= 0.`);
        continue;
      }

      const drawdowns = computeSurvivableDrawdown(obligation);
      
      let worstAssetSymbol: string | null = null;
      let worstDrawdownValue: number | null = null;
      
      for (const [symbol, dd] of Object.entries(drawdowns)) {
        if (typeof dd === 'number') {
          if (worstDrawdownValue === null || dd < worstDrawdownValue) {
            worstDrawdownValue = dd;
            worstAssetSymbol = symbol;
          }
        }
      }

      const gapStressedHealth = computeGapStressedHealthFactor(obligation, gapPercentages);

      if (worstAssetSymbol === null || worstDrawdownValue === null || typeof gapStressedHealth !== 'number' || !Number.isFinite(gapStressedHealth)) {
        console.log("  Skip: missing worst asset drawdown or gap-stressed health");
        continue;
      }

      const status = await getAttestationStatus(pair.obligation);
      
      console.log(`  --- OLD VALUES ---`);
      if (status.exists && status.decoded) {
        const ts = Number(status.decoded.computedAtUnixTs);
        const ageHours = (Date.now() / 1000 - ts) / 3600;
        const dateStr = new Date(ts * 1000).toISOString();
        console.log(`  computedAtUnixTs:           ${ts} (${dateStr}, ${ageHours.toFixed(2)}h old)`);
        console.log(`  currentHealthFactorBps:     ${status.decoded.currentHealthFactorBps}`);
        console.log(`  gapStressedHealthFactorBps: ${status.decoded.gapStressedHealthFactorBps}`);
      } else {
        console.log(`  No existing attestation found.`);
      }

      const currentHealth = (obligation.depositedValue * obligation.liquidationLtvThreshold) / obligation.borrowedValue;
      
      console.log(`  --- NEW VALUES ---`);
      console.log(`  currentHealthFactorBps:     ${Math.round(currentHealth * 10000)}`);
      console.log(`  gapStressedHealthFactorBps: ${Math.round(gapStressedHealth * 10000)}`);
      console.log(`  worstAssetSymbol:           ${worstAssetSymbol}`);
      console.log(`  worstDrawdownBps:           ${Math.round(worstDrawdownValue * 10000)}`);

      if (isSend) {
        const result = await refreshRiskAttestation(obligation, worstAssetSymbol, worstDrawdownValue, gapStressedHealth);
        console.log(`  SUCCESS! Signature: ${result.signature}`);
        console.log(`  Explorer URL: ${result.explorerUrl}`);
      } else {
        console.log(`  DRY RUN, nothing sent`);
      }
    } catch (e) {
      console.error(`  Error processing pair:`, e);
      hasError = true;
    }
  }

  if (hasError) {
    process.exitCode = 1;
  }
}

run().catch(e => {
  console.error("Fatal error in run():", e);
  process.exitCode = 1;
});
