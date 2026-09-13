import { loadEnvConfig } from '@next/env';
import { resolve } from 'path';
loadEnvConfig(resolve(process.cwd()));
import { getSolanaConnection, getScaledUiAmountConfig } from './lib/solana';
import { PublicKey } from '@solana/web3.js';
async function test() {
  const conn = getSolanaConnection('mainnet');
  const mint = 'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh'; // NVDAx
  const config = await getScaledUiAmountConfig(mint);
  if (config?.authority) {
    const sigs = await conn.getSignaturesForAddress(new PublicKey(config.authority), { limit: 1000 });
    const oldest = sigs[sigs.length - 1];
    console.log('Oldest in 1000:', new Date((oldest.blockTime || 0) * 1000).toISOString());
  }
}
test();
