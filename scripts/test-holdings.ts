import { loadEnvConfig } from '@next/env';
import { resolve } from 'path';

// Load .env.local variables
const projectDir = resolve(process.cwd());
loadEnvConfig(projectDir);

import { getTokenizedStockHoldings } from '../lib/solana';

async function main() {
  const testWallet = "S7vYFFWH6BjJyEsdrPQpqpYTqLTrPRK6KW3VwsJuRaS";
  console.log(`Testing getTokenizedStockHoldings for wallet: ${testWallet}`);
  
  try {
    const holdings = await getTokenizedStockHoldings(testWallet);
    console.log("Result:", JSON.stringify(holdings, null, 2));
  } catch (error) {
    console.error("Error during test:", error);
  }
}

main();
