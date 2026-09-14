import { generateTaxCsv } from '../lib/tax-export';
import { KNOWN_ASSETS } from '../lib/known-assets';
import * as fs from 'fs';

async function run() {
  const asset = KNOWN_ASSETS.find(a => a.symbol === 'NVDAx');
  if (!asset) throw new Error("NVDAx not found");
  
  const holdings = {
    purchaseDate: '2025-08-29',
    shares: 100,
    purchasePrice: 174.18
  };
  
  console.log("Generating tax CSV export for NVDAx...");
  const csv = await generateTaxCsv(asset, holdings);
  
  console.log("\n=== CSV OUTPUT ===");
  console.log(csv);
  
  fs.writeFileSync('test-export.csv', csv);
  console.log("\nWrote test-export.csv");
}

run().catch(console.error);
