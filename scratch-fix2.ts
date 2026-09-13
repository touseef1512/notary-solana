import { loadEnvConfig } from '@next/env';
import { resolve } from 'path';
loadEnvConfig(resolve(process.cwd()));
import { getHistoricalMultiplierChange } from './lib/solana';
async function test() {
  const mint = 'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh'; // NVDAx
  const targetDate = Math.floor(new Date('2026-06-04').getTime() / 1000);
  console.log('Testing Fix 2: Independent verification for June 4 dividend...');
  try {
    const res = await getHistoricalMultiplierChange(mint, targetDate);
    console.log('Result:', res);
  } catch (e) {
    console.error(e.message);
  }
}
test();
