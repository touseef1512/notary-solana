import { loadEnvConfig } from '@next/env';
import { resolve } from 'path';

// Load .env.local variables
const projectDir = resolve(process.cwd());
loadEnvConfig(projectDir);

import { verifyDividendEvent } from '../lib/verification';
import { KNOWN_ASSETS } from '../lib/known-assets';
import { getStockPrice, getDividendHistory, delay } from '../lib/market-data';
import { notarizeVerificationResult } from '../lib/solana';

async function main() {
  const tickers = ['NVDAx', 'AAPLx'];
  
  for (let i = 0; i < tickers.length; i++) {
    const symbol = tickers[i];
    const asset = KNOWN_ASSETS.find(a => a.symbol === symbol);
    if (!asset) continue;

    console.log(`\n--- Notarization test for ${asset.symbol} ---`);
    
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
        console.log(`Generating notarization transaction on Devnet...`);
        const txSignature = await notarizeVerificationResult(result, asset);
        console.log(`\nNOTARIZATION SUCCESSFUL!`);
        console.log(`Transaction Signature: ${txSignature}`);
        console.log(`View on Explorer: https://explorer.solana.com/tx/${txSignature}?cluster=devnet\n`);
      }
    } catch (error) {
      console.error(`Verification/Notarization failed for ${asset.symbol}:`, (error as Error).message);
    }
  }
}

main().catch(console.error);
