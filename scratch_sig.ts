import { Connection, PublicKey } from '@solana/web3.js';
async function run() {
  const conn = new Connection('https://api.mainnet-beta.solana.com');
  const sigs = await conn.getSignaturesForAddress(new PublicKey('Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh'), { limit: 10 });
  console.log(sigs.map(s => ({ sig: s.signature, time: new Date((s.blockTime || 0) * 1000).toISOString() })));
}
run();
