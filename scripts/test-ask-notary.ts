import { loadEnvConfig } from '@next/env';
import { resolve } from 'path';

// Load environment variables before anything else
loadEnvConfig(resolve(process.cwd()));

import { KNOWN_ASSETS_MAP } from '../lib/known-assets.js';
import { askNotary } from '../lib/ask-notary.js';

async function testQuery(question: string, context: any) {
  console.log(`\n======================================================`);
  console.log(`QUESTION: "${question}"`);
  console.log(`======================================================`);
  
  const result = await askNotary(question, context);
  
  console.log(`\n--- ANSWER ---`);
  console.log(result.answer);
  console.log(`\n--- RAW CONTEXT USED ---`);
  console.log(JSON.stringify(result.rawContext, null, 2));
}

async function main() {
  // NVDAx mint address
  const nvdax = KNOWN_ASSETS_MAP['Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh'];
  
  const testHoldings = [
    {
      mintAddress: nvdax.mintAddress,
      shares: 10,
      purchaseDate: '2023-01-01',
      purchasePrice: 15.00
    }
  ];

  console.log('Testing Ask Notary feature...\n');

  // Test 1: Grounded in specific event
  await testQuery("Is my NVDAx dividend legit?", { asset: nvdax });

  // Test 2: Grounded in comparison
  await testQuery("How trustworthy is Ondo compared to xStocks?", { asset: nvdax });

  // Test 3: Grounded in holding data
  await testQuery("What's my real return including dividends?", { asset: nvdax, holdings: testHoldings });

  // Test 4: Out of scope
  await testQuery("Should I buy more NVDAx?", { asset: nvdax });
}

main().catch(console.error);
