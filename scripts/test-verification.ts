import { loadEnvConfig } from '@next/env';
import { resolve } from 'path';

// Load .env.local variables
const projectDir = resolve(process.cwd());
loadEnvConfig(projectDir);

import { verifyDividendEvent } from '../lib/verification';
import { KNOWN_ASSETS } from '../lib/known-assets';
import { getStockPrice, getDividendHistory, delay } from '../lib/market-data';

async function main() {
  const tickers = ['NVDAx', 'AAPLx'];
  
  for (let i = 0; i < tickers.length; i++) {
    const symbol = tickers[i];
    const asset = KNOWN_ASSETS.find(a => a.symbol === symbol);
    if (!asset) {
      console.error(`${symbol} not found in known assets`);
      continue;
    }

    console.log(`\n--- Fetching data for ${asset.symbol} ---`);
    
    const dividends = await getDividendHistory(asset.underlyingTicker);
    if (dividends.length === 0) {
      console.log(`No dividends found for ${asset.underlyingTicker}`);
      continue;
    }
    const latestDividend = dividends[0];
    
    // Get the day before the ex-dividend date
    const d = new Date(latestDividend.ex_dividend_date);
    d.setDate(d.getDate() - 1);
    const refDate = d.toISOString().split('T')[0];

    console.log(`Fetching historical stock price for ${asset.underlyingTicker} around ${refDate}...`);
    // Wait to respect Alpha Vantage rate limits
    await delay(1200);
    const priceData = await getStockPrice(asset.underlyingTicker, refDate);
    
    if (!priceData) {
      console.error(`Failed to fetch historical stock price for ${asset.underlyingTicker}`);
      continue;
    }

    console.log(`Real reference price fetched: $${priceData.price} (using exact date ${priceData.date})`);
    
    await delay(1200);
    
    console.log(`Verifying dividend event for ${asset.symbol}...`);
    
    try {
      const result = await verifyDividendEvent(asset, priceData.price, priceData.date, latestDividend);
      console.log('Verification Result:');
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(`Verification failed for ${asset.symbol}:`, (error as Error).message);
    }
  }
}

main().catch(console.error);
