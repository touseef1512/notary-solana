import { loadEnvConfig } from '@next/env';
import { resolve } from 'path';

// Load .env.local variables
const projectDir = resolve(process.cwd());
loadEnvConfig(projectDir);

import { verifyDividendEvent } from '../lib/verification';
import { KNOWN_ASSETS } from '../lib/known-assets';
import { getStockPrice, getDividendHistory, delay } from '../lib/market-data';
import { narrateVerificationResult } from '../lib/narration';

async function main() {
  const tickers = ['NVDAx', 'AAPLx'];
  
  for (let i = 0; i < tickers.length; i++) {
    const symbol = tickers[i];
    const asset = KNOWN_ASSETS.find(a => a.symbol === symbol);
    if (!asset) continue;

    console.log(`\n--- Narration test for ${asset.symbol} ---`);
    
    const dividends = await getDividendHistory(asset.underlyingTicker);
    if (dividends.length === 0) continue;
    const latestDividend = dividends[0];
    
    const d = new Date(latestDividend.ex_dividend_date);
    d.setDate(d.getDate() - 1);
    const refDate = d.toISOString().split('T')[0];

    await delay(1200);
    const priceData = await getStockPrice(asset.underlyingTicker, refDate);
    if (!priceData) continue;
    
    await delay(1200);
    
    try {
      const result = await verifyDividendEvent(asset, priceData.price, priceData.date, latestDividend);
      if (result) {
        console.log(`Generating narration via Groq...`);
        const narration = await narrateVerificationResult(result, asset);
        console.log(`\nNARRATION OUTPUT:\n${narration}\n`);
      }
    } catch (error) {
      console.error(`Verification/Narration failed for ${asset.symbol}:`, (error as Error).message);
    }
  }

  // Add synthetic mock test
  console.log(`\n--- Narration test for MOCK Asset (Unexplained Discrepancy) ---`);
  const mockAsset = { symbol: 'MOCKx', name: 'Mock Asset', underlyingTicker: 'MOCK', mintAddress: '11111111111111111111111111111111' };
  const mockResult = {
    timingMatch: true,
    expectedPct: 0.0010, // 0.10%
    actualPct: 0.00088,  // 0.088%
    discrepancy: 0.12,   // 12%
    verdict: 'unexplained discrepancy — flag for review',
    raw: {
      dividendAmount: 0.50,
      exDividendDate: '2026-09-01',
      referencePrice: 500,
      referenceDate: '2026-08-31',
      multiplier: 1.0,
      newMultiplier: 1.00088,
      effectiveTimestamp: 1788825600
    }
  };
  
  try {
    console.log(`Generating narration via Groq for MOCK...`);
    const narration = await narrateVerificationResult(mockResult as any, mockAsset as any);
    console.log(`\nNARRATION OUTPUT:\n${narration}\n`);
  } catch (error) {
    console.error(`Verification/Narration failed for MOCK:`, (error as Error).message);
  }
}

main().catch(console.error);
