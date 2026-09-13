import { KnownAsset } from './known-assets';
import { getDividendHistory } from './market-data';
import { verifyDividendEvent } from './verification';
import { getHistoricalMultiplierChange } from './solana';
import { getStockPrice, delay } from './market-data';

export interface HoldingData {
  purchaseDate: string; // YYYY-MM-DD
  shares: number;
  purchasePrice: number;
}

export interface DividendEventDetail {
  exDate: string;
  grossAmount: number;
  actualReceived: number;
  referencePrice: number;
  independentlyVerified: boolean;
}

export interface TotalReturnResult {
  naivePriceReturnPct: number;
  expectedTotalReturnPct: number;
  trueTotalReturnPct: number;
  missingYieldPct: number;
  missingDollarAmount: number;
  verifiedDiscrepancyRate: number | null;
  events: DividendEventDetail[];
  verifiedEventCount: number;
  totalEventCount: number;
}

export async function computeTrueTotalReturn(
  asset: KnownAsset,
  holdings: HoldingData,
  currentPrice: number
): Promise<TotalReturnResult> {
  // 1. Calculate naive price return
  const naivePriceReturnPct = (currentPrice - holdings.purchasePrice) / holdings.purchasePrice;
  
  // 2. Fetch all dividends
  const dividends = await getDividendHistory(asset.underlyingTicker);
  
  // Filter for dividends within holding period
  const holdingDividends = dividends.filter(d => d.ex_dividend_date > holdings.purchaseDate);
  
  let verifiedDiscrepancyRate = 0;
  let latestReferencePrice = 0;
  
  // 3. Find the discrepancy rate mathematically using the latest dividend event (Fallback)
  if (dividends.length > 0) {
    const latest = dividends[0];
    const d = new Date(latest.ex_dividend_date);
    d.setDate(d.getDate() - 1);
    const refDate = d.toISOString().split('T')[0];
    
    // We need the reference price for the latest dividend to verify it
    // Wait to respect API free tier limits
    await delay(1200);
    const refPriceData = await getStockPrice(asset.underlyingTicker, refDate);
    if (refPriceData) {
      latestReferencePrice = refPriceData.price;
      try {
        const verification = await verifyDividendEvent(asset, refPriceData.price, refPriceData.date, latest);
        if (verification) {
          verifiedDiscrepancyRate = verification.discrepancy;
        }
      } catch (e) {
        console.warn(`Could not verify discrepancy rate for ${asset.symbol}:`, e);
      }
    }
  }

  // 4. Calculate actual dividends received over holding period
  let totalGrossDividends = 0;
  let totalActualDividendsReceived = 0;
  const events: DividendEventDetail[] = [];
  let verifiedEventCount = 0;

  for (let i = 0; i < holdingDividends.length; i++) {
    const div = holdingDividends[i];
    const grossTotal = div.amount * holdings.shares;
    
    let eventDiscrepancyRate = verifiedDiscrepancyRate;
    let independentlyVerified = false;
    let eventReferencePrice = 0;

    if (i === 0) {
      // 1. Most recent event: proven by step 3 verification
      eventDiscrepancyRate = verifiedDiscrepancyRate;
      eventReferencePrice = latestReferencePrice;
      independentlyVerified = true;
    } else {
      // 2. Older events: try getHistoricalMultiplierChange
      const divTimestamp = Math.floor(new Date(div.ex_dividend_date).getTime() / 1000);
      const histConfig = await getHistoricalMultiplierChange(asset.mintAddress, divTimestamp);
      
      if (histConfig) {
        const actualPct = (histConfig.newMultiplier / histConfig.multiplier) - 1;
        
        const d = new Date(div.ex_dividend_date);
        d.setDate(d.getDate() - 1);
        const refDate = d.toISOString().split('T')[0];
        
        await delay(1200);
        const refPriceData = await getStockPrice(asset.underlyingTicker, refDate);
        
        if (refPriceData) {
          eventReferencePrice = refPriceData.price;
          const expectedPct = div.amount / refPriceData.price;
          eventDiscrepancyRate = Math.abs(expectedPct - actualPct) / expectedPct;
          independentlyVerified = true;
        }
      } else {
        console.warn(`[WARNING] Independent on-chain verification for ${asset.symbol} dividend on ${div.ex_dividend_date} failed. Falling back to latest verified rate.`);
        independentlyVerified = false;
      }
    }
    
    if (independentlyVerified) {
      verifiedEventCount++;
    }
    
    // Apply the verified haircut (e.g. 30% tax)
    const actualReceived = grossTotal * (1 - eventDiscrepancyRate);
    totalGrossDividends += grossTotal;
    totalActualDividendsReceived += actualReceived;
    
    events.push({
      exDate: div.ex_dividend_date,
      grossAmount: grossTotal,
      actualReceived: actualReceived,
      referencePrice: eventReferencePrice,
      independentlyVerified
    });
  }

  // 5. Calculate True vs Expected Return
  const totalInvested = holdings.shares * holdings.purchasePrice;
  
  const expectedTotalValue = (holdings.shares * currentPrice) + totalGrossDividends;
  const expectedTotalReturnPct = (expectedTotalValue - totalInvested) / totalInvested;

  const actualTotalValue = (holdings.shares * currentPrice) + totalActualDividendsReceived;
  const trueTotalReturnPct = (actualTotalValue - totalInvested) / totalInvested;

  const missingDollarAmount = totalGrossDividends - totalActualDividendsReceived;
  const missingYieldPct = expectedTotalReturnPct - trueTotalReturnPct;
  
  return {
    naivePriceReturnPct,
    expectedTotalReturnPct,
    trueTotalReturnPct,
    missingYieldPct,
    missingDollarAmount,
    verifiedDiscrepancyRate,
    events,
    verifiedEventCount,
    totalEventCount: holdingDividends.length
  };
}
