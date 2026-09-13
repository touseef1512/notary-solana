import { Connection, PublicKey } from '@solana/web3.js';
async function main() {
  const connection = new Connection('https://api.mainnet-beta.solana.com');
  const info = await connection.getParsedAccountInfo(new PublicKey('Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh'));
  console.log(JSON.stringify((info.value?.data as any).parsed.info.extensions, null, 2));
}
main();
