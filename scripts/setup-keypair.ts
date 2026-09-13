import { loadEnvConfig } from '@next/env';
import { resolve } from 'path';
import { Keypair, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fs from 'fs';

const projectDir = resolve(process.cwd());
loadEnvConfig(projectDir);

async function main() {
  console.log('Generating new keypair...');
  const keypair = Keypair.generate();
  
  const envPath = resolve(projectDir, '.env.local');
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
  
  const keypairString = `[${keypair.secretKey.toString()}]`;
  
  if (envContent.includes('NOTARY_KEYPAIR=')) {
    envContent = envContent.replace(/NOTARY_KEYPAIR=.*/g, `NOTARY_KEYPAIR="${keypairString}"`);
  } else {
    envContent += `\nNOTARY_KEYPAIR="${keypairString}"\n`;
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log(`Saved NOTARY_KEYPAIR to .env.local`);
  console.log(`Public Key: ${keypair.publicKey.toBase58()}`);

  console.log('Requesting airdrop on devnet...');
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  try {
    const signature = await connection.requestAirdrop(keypair.publicKey, 1 * LAMPORTS_PER_SOL);
    console.log(`Airdrop requested. Signature: ${signature}`);
    
    const latestBlockHash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: signature,
    });
    console.log('Airdrop confirmed!');
  } catch (error) {
    console.error('Airdrop failed. (Note: Devnet faucet can be rate-limited)', (error as Error).message);
  }
}

main().catch(console.error);
