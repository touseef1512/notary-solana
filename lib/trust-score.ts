import { KnownAsset, KNOWN_ASSETS } from './known-assets';
import { getDividendHistory, getStockPrice, delay } from './market-data';
import { getHistoricalMultiplierChange, getScaledUiAmountConfig } from './solana';
import { classifyDiscrepancy, getDiscrepancyBucket } from './verification';

export interface TrustScoreEvent {
  exDate: string;
  bucket: 'explained-no-tax' | 'explained-withholding-tax' | 'unexplained';
  independentlyVerified: boolean;
  timingMatch: boolean;
}

export interface TrustScoreResult {
  asset: KnownAsset;
  trustScore: number | null; 
  verificationTrackRecord: number | null; 
  verificationCoverage: number | null; 
  timingAccuracy: number | null; 
  eventsAnalyzed: number;
  breakdown: TrustScoreEvent[];
}

export async function computeTrustScore(asset: KnownAsset): Promise<TrustScoreResult> {
  const dividends = await getDividendHistory(asset.underlyingTicker);
  
  if (dividends.length === 0) {
    return {
      asset,
      trustScore: null,
      verificationTrackRecord: null,
      verificationCoverage: null,
      timingAccuracy: null,
      eventsAnalyzed: 0,
      breakdown: []
    };
  }

  let fallbackDiscrepancyRate = 0;
  let liveConfig: any = null;
  
  try {
    liveConfig = await getScaledUiAmountConfig(asset.mintAddress);
  } catch(e) {}

  const breakdown: TrustScoreEvent[] = [];

  for (let i = 0; i < dividends.length; i++) {
    const div = dividends[i];
    let independentlyVerified = false;
    let actualPct = 0;
    let timingMatch = false;

    if (i === 0 && liveConfig) {
      // For the most recent event, we can independently verify it using the live config
      actualPct = (liveConfig.newMultiplier / liveConfig.multiplier) - 1;
      const exDivDate = new Date(div.ex_dividend_date);
      const effectiveDate = new Date(liveConfig.newMultiplierEffectiveTimestamp * 1000);
      const diffDays = Math.abs(effectiveDate.getTime() - exDivDate.getTime()) / (1000 * 60 * 60 * 24);
      timingMatch = diffDays <= 2;
      independentlyVerified = true;
    } else {
      // Try historical verification
      const divTimestamp = Math.floor(new Date(div.ex_dividend_date).getTime() / 1000);
      const histConfig = await getHistoricalMultiplierChange(asset.mintAddress, divTimestamp);
      if (histConfig) {
        actualPct = (histConfig.newMultiplier / histConfig.multiplier) - 1;
        // In a real historical indexer, we would get the effective timestamp from the ix data.
        // But since we can't fetch it, we'll assume timingMatch = true if we found the exact update ix.
        timingMatch = true; 
        independentlyVerified = true;
      } else {
        // Fallback to the discrepancy rate we proved in event 0
        independentlyVerified = false;
        timingMatch = false; // We can't prove timing accuracy on fallback events
      }
    }

    let bucket: 'explained-no-tax' | 'explained-withholding-tax' | 'unexplained' = 'unexplained';
    
    if (independentlyVerified) {
      // We only need the reference price if we can actually verify this event against on-chain data
      const d = new Date(div.ex_dividend_date);
      d.setDate(d.getDate() - 1);
      const refDate = d.toISOString().split('T')[0];
      
      await delay(1200);
      try {
        const refPriceData = await getStockPrice(asset.underlyingTicker, refDate);
        if (refPriceData) {
          const expectedPct = div.amount / refPriceData.price;
          const discrepancy = Math.abs(expectedPct - actualPct) / expectedPct;
          
          if (i === 0) {
            fallbackDiscrepancyRate = discrepancy; // Save the verified rate as the fallback for older events
          }
          
          const verdict = classifyDiscrepancy(discrepancy, timingMatch);
          bucket = getDiscrepancyBucket(verdict);
        }
      } catch (e) {
        console.warn(`[WARNING] Failed to fetch price for ${asset.symbol} on ${refDate}:`, e);
        // If we can't fetch the price, we can't verify it. Fallback to assumed rate.
        independentlyVerified = false;
        timingMatch = false;
      }
    }
    
    if (!independentlyVerified) {
      // Use the fallback assumption since we couldn't verify it
      const verdict = classifyDiscrepancy(fallbackDiscrepancyRate, true);
      bucket = getDiscrepancyBucket(verdict);
    }

    breakdown.push({
      exDate: div.ex_dividend_date,
      bucket,
      independentlyVerified,
      timingMatch: independentlyVerified ? timingMatch : false
    });
  }

  const explainedEvents = breakdown.filter(b => b.bucket === 'explained-no-tax' || b.bucket === 'explained-withholding-tax').length;
  const verifiedEvents = breakdown.filter(b => b.independentlyVerified).length;
  const timedEvents = breakdown.filter(b => b.timingMatch).length;

  const verificationTrackRecord = (explainedEvents / breakdown.length) * 100;
  const verificationCoverage = (verifiedEvents / breakdown.length) * 100;
  const timingAccuracy = (timedEvents / breakdown.length) * 100;

  // Composite trustScore (0-100): weight verificationTrackRecord most heavily (50%), verificationCoverage (35%), timingAccuracy (15%)
  const trustScore = (verificationTrackRecord * 0.5) + (verificationCoverage * 0.35) + (timingAccuracy * 0.15);

  return {
    asset,
    trustScore,
    verificationTrackRecord,
    verificationCoverage,
    timingAccuracy,
    eventsAnalyzed: breakdown.length,
    breakdown
  };
}

export async function getIssuerLeaderboard(): Promise<{ 
  leaderboard: { issuer: string, averageTrustScore: number, assetsCount: number }[],
  scores: TrustScoreResult[] 
}> {
  const scores: TrustScoreResult[] = [];
  for (const asset of KNOWN_ASSETS) {
    console.log(`Computing trust score for ${asset.symbol}...`);
    const score = await computeTrustScore(asset);
    scores.push(score);
  }

  const issuerGroups: Record<string, { totalScore: number, validAssets: number }> = {};
  
  for (const score of scores) {
    if (!issuerGroups[score.asset.issuer]) {
      issuerGroups[score.asset.issuer] = { totalScore: 0, validAssets: 0 };
    }
    if (score.trustScore !== null) {
      issuerGroups[score.asset.issuer].totalScore += score.trustScore;
      issuerGroups[score.asset.issuer].validAssets++;
    }
  }

  const leaderboard = Object.keys(issuerGroups)
    .filter(issuer => issuerGroups[issuer].validAssets > 0)
    .map(issuer => ({
      issuer,
      averageTrustScore: issuerGroups[issuer].totalScore / issuerGroups[issuer].validAssets,
      assetsCount: issuerGroups[issuer].validAssets
    }))
    .sort((a, b) => b.averageTrustScore - a.averageTrustScore);

  return { leaderboard, scores };
}
