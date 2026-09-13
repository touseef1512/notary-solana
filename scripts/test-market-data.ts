import { loadEnvConfig } from '@next/env';
import { resolve } from 'path';

// Load .env.local variables
const projectDir = resolve(process.cwd());
loadEnvConfig(projectDir);

import { getMarketData, delay } from '../lib/market-data';

async function main() {
  const tickers = ['AAPL', 'TSLA', 'NVDA'];
  
  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    console.log(`\nFetching market data for ${ticker}...`);
    try {
      const { dividends, splits } = await getMarketData(ticker);
      console.log(`Dividends (${dividends.length} records):`);
      console.log(dividends.slice(0, 3)); // show first 3
      
      console.log(`Splits (${splits.length} records):`);
      console.log(splits.slice(0, 3)); // show first 3
    } catch (error) {
      console.error(`Failed to fetch data for ${ticker}:`, (error as Error).message);
    }

    if (i < tickers.length - 1) {
      await delay(1200);
    }
  }
}

main().catch(console.error);
