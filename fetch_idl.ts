import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import fs from 'fs';

async function main() {
  const connection = new Connection('https://api.mainnet-beta.solana.com');
  const programId = new PublicKey('KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD');
  
  // Dummy wallet for provider
  const provider = new anchor.AnchorProvider(
    connection,
    { publicKey: PublicKey.default, signTransaction: async (tx) => tx, signAllTransactions: async (txs) => txs },
    {}
  );
  
  console.log("Fetching IDL from chain...");
  const idl = await anchor.Program.fetchIdl(programId, provider);
  if (!idl) {
    console.log("Failed to fetch IDL");
    return;
  }
  
  fs.writeFileSync('fetched_idl.json', JSON.stringify(idl, null, 2));
  console.log("Saved to fetched_idl.json");
}

main().catch(console.error);
