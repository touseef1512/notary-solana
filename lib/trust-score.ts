import { KnownAsset } from './known-assets';
import { getParityAssets } from './parity-assets';
import { getDividendHistory, getStockPrice, delay } from './market-data';
import { getHistoricalMultiplierChange, getScaledUiAmountConfig, ScaledUiAmountConfig } from './solana';
import { classifyDiscrepancy, getDiscrepancyBucket } from './verification';

export interface TrustScoreEvent {
  exDate: string;
  bucket: 'explained-no-tax' | 'explained-withholding-tax' | 'unexplained' | 'unverifiable';
  independentlyVerified: boolean;
  timingMatch: boolean;
}

export interface TrustScoreResult {
  asset: KnownAsset;
  trustScore: number | null; 
  confidenceLevel: string;
  eventsAnalyzed: number;
  breakdown: TrustScoreEvent[];
}

export async function computeTrustScore(asset: KnownAsset): Promise<TrustScoreResult> {
  const dividends = await getDividendHistory(asset.underlyingTicker);
  
  if (dividends.length === 0) {
    return {
      asset,
      trustScore: null,
      confidenceLevel: '0 of 0 events independently verified on-chain',
      eventsAnalyzed: 0,
      breakdown: []
    };
  }

  let liveConfig: ScaledUiAmountConfig | null = null;
  
  try {
    liveConfig = await getScaledUiAmountConfig(asset.mintAddress);
  } catch {}

  const breakdown: TrustScoreEvent[] = [];

  // Cap historical lookback to events from 2024 onwards, as requested
  const recentDividends = dividends.filter(d => new Date(d.ex_dividend_date).getTime() >= new Date('2024-01-01').getTime());

  let matchedLiveIndex = -1;
  let liveDiffDays = -1;
  if (liveConfig && liveConfig.multiplier !== liveConfig.newMultiplier) {
    const effectiveDate = new Date(liveConfig.newMultiplierEffectiveTimestamp * 1000);
    let closestDiff = Infinity;
    for (let j = 0; j < recentDividends.length; j++) {
      const exDivDate = new Date(recentDividends[j].ex_dividend_date);
      const diffDays = Math.abs(effectiveDate.getTime() - exDivDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays <= 7 && diffDays < closestDiff) {
        closestDiff = diffDays;
        matchedLiveIndex = j;
        liveDiffDays = diffDays;
      }
    }
  }

  for (let i = 0; i < recentDividends.length; i++) {
    const div = recentDividends[i];
    let independentlyVerified = false;
    let actualPct = 0;
    let timingMatch = false;

    if (i === matchedLiveIndex && liveConfig) {
      // For the most recently matched event, we can independently verify it using the live config
      actualPct = (liveConfig.newMultiplier / liveConfig.multiplier) - 1;
      timingMatch = liveDiffDays <= 2;
      independentlyVerified = true;
    } else {
      // Try historical verification
      const divTimestamp = Math.floor(new Date(div.ex_dividend_date).getTime() / 1000);
      let histConfig = null;
      try {
        histConfig = await getHistoricalMultiplierChange(asset.mintAddress, divTimestamp);
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('transaction history too deep')) {
          console.log(`[INFO] Reached RPC limit for ${asset.symbol}. Stopping historical lookback.`);
          break; // Stop checking older dividends for this asset
        }
      }

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

    let bucket: 'explained-no-tax' | 'explained-withholding-tax' | 'unexplained' | 'unverifiable' = 'unverifiable';
    
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
          
          const verdict = classifyDiscrepancy(discrepancy, timingMatch);
          bucket = getDiscrepancyBucket(verdict) as 'explained-no-tax' | 'explained-withholding-tax' | 'unexplained' | 'unverifiable';
        } else {
          // If we can't fetch the price, we can't fully verify it.
          independentlyVerified = false;
          timingMatch = false;
        }
      } catch (e) {
        console.warn(`[WARNING] Failed to fetch price for ${asset.symbol} on ${refDate}:`, e);
        // If we can't fetch the price, we can't verify it.
        independentlyVerified = false;
        timingMatch = false;
      }
    }

    breakdown.push({
      exDate: div.ex_dividend_date,
      bucket,
      independentlyVerified,
      timingMatch: independentlyVerified ? timingMatch : false
    });
  }

  const verifiedEvents = breakdown.filter(b => b.independentlyVerified).length;
  const explainedVerifiedEvents = breakdown.filter(b => b.independentlyVerified && (b.bucket === 'explained-no-tax' || b.bucket === 'explained-withholding-tax')).length;

  const trustScore = verifiedEvents > 0 ? (explainedVerifiedEvents / verifiedEvents) * 100 : null;
  const confidenceLevel = `${verifiedEvents} of ${breakdown.length} events independently verified on-chain`;

  return {
    asset,
    trustScore,
    confidenceLevel,
    eventsAnalyzed: breakdown.length,
    breakdown
  };
}

let cachedLeaderboard: { 
  leaderboard: { issuer: string, averageTrustScore: number | null, assetsCount: number, totalAssetsForIssuer: number }[],
  scores: TrustScoreResult[] 
} | null = null;
let lastLeaderboardFetch = 0;
const LEADERBOARD_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getIssuerLeaderboard(): Promise<{ 
  leaderboard: { issuer: string, averageTrustScore: number | null, assetsCount: number, totalAssetsForIssuer: number }[],
  scores: TrustScoreResult[] 
}> {
  const now = Date.now();
  if (cachedLeaderboard && now - lastLeaderboardFetch < LEADERBOARD_CACHE_TTL_MS) {
    console.log(`[INFO] Returning cached leaderboard data (expires in ${Math.round((LEADERBOARD_CACHE_TTL_MS - (now - lastLeaderboardFetch)) / 1000)}s)`);
    return cachedLeaderboard;
  }

  const scores: TrustScoreResult[] = [];
  for (const asset of getParityAssets()) {
    console.log(`Computing trust score for ${asset.symbol}...`);
    const score = await computeTrustScore(asset);
    scores.push(score);
  }

  const issuerGroups: Record<string, { totalScore: number, validAssets: number, totalAssets: number }> = {};
  
  for (const score of scores) {
    if (!issuerGroups[score.asset.issuer]) {
      issuerGroups[score.asset.issuer] = { totalScore: 0, validAssets: 0, totalAssets: 0 };
    }
    issuerGroups[score.asset.issuer].totalAssets++;
    if (score.trustScore !== null) {
      issuerGroups[score.asset.issuer].totalScore += score.trustScore;
      issuerGroups[score.asset.issuer].validAssets++;
    }
  }

  const leaderboard = Object.keys(issuerGroups)
    .map(issuer => {
      const group = issuerGroups[issuer];
      return {
        issuer,
        averageTrustScore: group.validAssets > 0 ? group.totalScore / group.validAssets : null,
        assetsCount: group.validAssets,
        totalAssetsForIssuer: group.totalAssets
      };
    })
    .sort((a, b) => {
      if (a.averageTrustScore === null && b.averageTrustScore === null) return 0;
      if (a.averageTrustScore === null) return 1;
      if (b.averageTrustScore === null) return -1;
      return b.averageTrustScore - a.averageTrustScore;
    });

  cachedLeaderboard = { leaderboard, scores };
  lastLeaderboardFetch = Date.now();
  
  return cachedLeaderboard;
}
