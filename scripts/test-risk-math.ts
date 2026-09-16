import { getKaminoPositions } from '../lib/kamino.js';
import { computeSurvivableDrawdown, computeGapStressedHealthFactor } from '../lib/risk-math.js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const rpcMatch = envContent.match(/MAINNET_RPC_URL=(.*)/);
if (rpcMatch) {
  process.env.MAINNET_RPC_URL = rpcMatch[1].trim().replace(/^"|"$/g, '');
}

async function main() {
  const WALLETS = [
    'Fa7LNzj3SCV364hya9dx9evL29pC1awx24iHeCEwX6vU',
    'QqxKVDPcxMLQ8UL8wet8RTLuwtpjLH8841pcNYTNBYK'
  ];

  for (const wallet of WALLETS) {
    console.log(`\nFetching Kamino positions for demo wallet: ${wallet}`);
    const obligations = await getKaminoPositions(wallet);
    
    if (obligations.length === 0) {
      console.log('No obligations found.');
      continue;
    }
  
  const gapPercentages = {
    'CRCLx': -4.71,
    'METAx': 3.67,
    'TSLAx': -2.39,
    'NVDAx': -2.64,
    'HOODx': -1.89,
    'QQQx': -1.17,
    'MSTRx': -1.01,
    'SPYx': -0.36,
    'AAPLx': 0.03,
    'GOOGLx': 2.16
  };

  for (const obs of obligations) {
    console.log(`\nObligation: ${obs.obligationPubkey}`);
    console.log(`Deposited: $${obs.depositedValue.toFixed(4)}, Borrowed: $${obs.borrowedValue.toFixed(4)}`);
    console.log(`Liquidation Threshold: ${obs.liquidationLtvThreshold * 100}%`);
    const currentHealth = (obs.depositedValue * obs.liquidationLtvThreshold) / obs.borrowedValue;
    console.log(`Current Health Factor: ${currentHealth.toFixed(4)}`);
    
    const drawdowns = computeSurvivableDrawdown(obs);
    console.log('\nSurvivable Drawdown:');
    for (const [symbol, dd] of Object.entries(drawdowns)) {
      if (typeof dd === 'number') {
        console.log(`  ${symbol}: ${(dd * 100).toFixed(2)}% drop`);
      } else {
        console.log(`  ${symbol}: ${dd}`);
      }
    }
    
    const stressedHealth = computeGapStressedHealthFactor(obs, gapPercentages);
    console.log('\nGap-Stressed Health Factor (Fri close vs. now):');
    if (typeof stressedHealth === 'number') {
      console.log(`  ${stressedHealth.toFixed(4)}`);
      if (stressedHealth < 1) {
        console.log('  WARNING: Position is underwater under stress!');
      }
    } else {
      console.log(`  ${stressedHealth}`);
    }
    console.log('--------------------------------------------------');
  }
  }
}

main().catch(console.error);
