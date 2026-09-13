import { loadEnvConfig } from '@next/env';
import { resolve } from 'path';

const projectDir = resolve(process.cwd());
loadEnvConfig(projectDir);

import { computeTrueTotalReturn, HoldingData } from '../lib/total-return';
import { KNOWN_ASSETS } from '../lib/known-assets';
import { getStockPrice, delay } from '../lib/market-data';

async function main() {
  const asset = KNOWN_ASSETS.find(a => a.symbol === 'NVDAx');
  if (!asset) {
    console.error('NVDAx not found');
    return;
  }

  // Simulate a realistic holding period (~1 year ago)
  // NVDA split 10-for-1 on June 10, 2024. For a clean test, let's pick a post-split date or pre-split date.
  // Note: Alpha Vantage free tier limits to 100 trading days, but Stooq allows full history. 
  // Let's use 2025-09-01 to capture a full 1-year holding period.
  const purchaseDate = '2025-09-01'; 
  
  console.log(`Fetching historical purchase price for ${asset.underlyingTicker} around ${purchaseDate}...`);
  const purchasePriceData = await getStockPrice(asset.underlyingTicker, purchaseDate);
  if (!purchasePriceData) {
    console.error('Could not fetch purchase price');
    return;
  }

  await delay(1200);

  // Use today's date for current price
  console.log(`Fetching current price for ${asset.underlyingTicker}...`);
  const currentPriceData = await getStockPrice(asset.underlyingTicker); // latest available
  if (!currentPriceData) {
    console.error('Could not fetch current price');
    return;
  }
  
  const holdings: HoldingData = {
    purchaseDate: purchasePriceData.date, // Actual available trading date
    shares: 100, // E.g., 100 shares
    purchasePrice: purchasePriceData.price
  };

  console.log(`\n--- True Total Return Analysis for ${asset.symbol} ---`);
  console.log(`Purchase Date: ${holdings.purchaseDate}`);
  console.log(`Purchase Price: $${holdings.purchasePrice}`);
  console.log(`Shares: ${holdings.shares}`);
  console.log(`Current Price (as of ${currentPriceData.date}): $${currentPriceData.price}`);
  console.log(`\nComputing...`);
  
  const result = await computeTrueTotalReturn(asset, holdings, currentPriceData.price);

  console.log(`\n=== RESULTS ===`);
  console.log(`Naive Price Return: ${(result.naivePriceReturnPct * 100).toFixed(2)}%`);
  console.log(`Expected Total Return (with gross dividends): ${(result.expectedTotalReturnPct * 100).toFixed(2)}%`);
  console.log(`True Total Return (with on-chain taxed dividends): ${(result.trueTotalReturnPct * 100).toFixed(2)}%`);
  
  console.log(`\n=== THE GAP ===`);
  console.log(`Missing Yield: ${(result.missingYieldPct * 100).toFixed(2)}%`);
  console.log(`Missing Dollar Amount: $${result.missingDollarAmount.toFixed(2)}`);
  
  console.log(`\n=== DIVIDEND EVENTS DURING HOLDING PERIOD ===`);
  console.log(`Total events found: ${result.totalEventCount}`);
  console.log(`${result.verifiedEventCount} of ${result.totalEventCount} dividend events independently verified on-chain; remaining ${result.totalEventCount - result.verifiedEventCount} assume the same ${(result.verifiedDiscrepancyRate! * 100).toFixed(0)}% rate.`);
  result.events.forEach((event, i) => {
    console.log(`  ${i+1}. Ex-Date: ${event.exDate} | Gross: $${event.grossAmount.toFixed(2)} | Actual Received: $${event.actualReceived.toFixed(2)}`);
  });

  console.log(`\n=== RAW DATA ===`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
