import groq from './llm';
import { KnownAsset, KNOWN_ASSETS } from './known-assets';
import { computeTrustScore, getIssuerLeaderboard, TrustScoreResult } from './trust-score';
import type { getKaminoRiskData } from './kamino-risk';
type LoanRisk = Awaited<ReturnType<typeof getKaminoRiskData>>;
import { getReserveAttestation } from './attestation';
import { computeTrueTotalReturn } from './total-return';
import { getStockPrice } from './market-data';

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const trustScoreCache = new Map<string, { timestamp: number, data: TrustScoreResult }>();

type LeaderboardData = Awaited<ReturnType<typeof getIssuerLeaderboard>>;
let leaderboardCache: { timestamp: number, data: LeaderboardData } | null = null;

async function getCachedTrustScore(asset: KnownAsset) {
  const now = Date.now();
  const cached = trustScoreCache.get(asset.symbol);
  if (cached && (now - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }
  const data = await computeTrustScore(asset);
  trustScoreCache.set(asset.symbol, { timestamp: now, data });
  return data;
}

async function getCachedIssuerLeaderboard() {
  const now = Date.now();
  if (leaderboardCache && (now - leaderboardCache.timestamp < CACHE_TTL)) {
    return leaderboardCache.data;
  }
  const data = await getIssuerLeaderboard();
  leaderboardCache = { timestamp: now, data };
  return data;
}

export interface TokenHolding {
  mintAddress: string;
  shares: number;
  purchaseDate?: string;
  purchasePrice?: number;
}

export async function askNotary(
  question: string,
  context: { holdings?: TokenHolding[]; asset?: KnownAsset; loanRisk?: LoanRisk }
) {
  const gatheredData: Record<string, unknown> = {};
  const q = question.toLowerCase();

  // 0. Ticker detection fallback
  if (!context.asset) {
    const matchedAsset = KNOWN_ASSETS.find(a => q.includes(a.symbol.toLowerCase()));
    if (matchedAsset) {
      context.asset = matchedAsset;
    }
  }

  try {
    // 1. Return / Yield
    if (q.includes('return') || q.includes('yield') || q.includes('profit') || q.includes('loss')) {
      if (context.asset && context.holdings) {
        const holding = context.holdings.find(
          (h) => h.mintAddress === context.asset!.mintAddress
        );
        if (holding && holding.purchaseDate && holding.purchasePrice) {
          const priceData = await getStockPrice(context.asset.underlyingTicker);
          if (priceData) {
            const returnData = await computeTrueTotalReturn(
              context.asset,
              {
                purchaseDate: holding.purchaseDate,
                shares: holding.shares,
                purchasePrice: holding.purchasePrice,
              },
              priceData.price
            );
            gatheredData.totalReturn = returnData;
          }
        } else {
          gatheredData.totalReturn = "No holding data available to calculate return.";
        }
      }
    }

    // 2. Dividend / Legit / Verified
    if (q.includes('dividend') || q.includes('legit') || q.includes('verified')) {
      if (context.asset) {
        const score = await getCachedTrustScore(context.asset);
        gatheredData.trustScore = score;
      }
    }

    // 3. Trust / Compared / Leaderboard
    if (q.includes('trust') || q.includes('compared') || q.includes('trustworthy') || q.includes('safe') || q.includes('better')) {
      const { leaderboard, scores } = await getCachedIssuerLeaderboard();
      gatheredData.issuerLeaderboard = leaderboard;
      if (context.asset) {
        gatheredData.trustScore =
          scores.find((s) => s.asset.mintAddress === context.asset!.mintAddress) || null;
      }
    }

    // 4. Reserve / Backing / Attestation
    if (q.includes('reserve') || q.includes('backed') || q.includes('attestation') || q.includes('backing')) {
      if (context.asset) {
        const attestation = await getReserveAttestation(context.asset);
        gatheredData.reserveAttestation = attestation;
      }
    }

    // 5. Loan / Margin / Kamino Risk
    if (q.includes('loan') || q.includes('margin') || q.includes('liquidat') || q.includes('collateral') || q.includes('health factor') || q.includes('borrow')) {
      if (context.loanRisk) {
        if (context.loanRisk.length === 0) {
          gatheredData.loanRisk = "No active Kamino loan positions found for this wallet.";
        } else {
          gatheredData.loanRisk = context.loanRisk.map(o => ({
            depositedValueUsd: o.depositedValue,
            borrowedValueUsd: o.borrowedValue,
            currentHealthFactor: o.currentHealth,
            gapStressedHealthFactor: o.gapStressedHealth,
            worstAssetSymbol: o.worstAssetSymbol,
            worstDrawdownValue: o.worstDrawdownValue,
          }));
        }
      } else {
        gatheredData.loanRisk = "Loan/risk data was not available for this request.";
      }
    }

    // Check if we gathered literally nothing, but user provided an asset - just fetch trust score to have something
    if (Object.keys(gatheredData).length === 0 && context.asset) {
      gatheredData.trustScore = await getCachedTrustScore(context.asset);
    }
  } catch (_err: unknown) {
    const errorMsg = _err instanceof Error ? _err.message : String(_err);
    console.error("Error gathering data:", errorMsg);
    gatheredData.error = "An error occurred while gathering on-chain data: " + errorMsg;
  }

  // Pre-calculate dividend contribution if totalReturn exists
  if (gatheredData.totalReturn && typeof gatheredData.totalReturn === 'object') {
    const totalReturnObj = gatheredData.totalReturn as Record<string, unknown>;
    if (typeof totalReturnObj.expectedTotalReturnPct === 'number' && typeof totalReturnObj.naivePriceReturnPct === 'number') {
      totalReturnObj.dividendContributionPct = totalReturnObj.expectedTotalReturnPct - totalReturnObj.naivePriceReturnPct;
    }
    
    // Summarize totalReturn events if array is too large
    if (Array.isArray(totalReturnObj.events) && totalReturnObj.events.length > 5) {
      const events = totalReturnObj.events;
      const verifiedCount = events.filter((e: { independentlyVerified: boolean }) => e.independentlyVerified).length;
      const recentEvents = events.slice(0, 3);
      
      const newTr = { ...totalReturnObj };
      delete newTr.events;
      newTr.totalEvents = events.length;
      newTr.verifiedEvents = verifiedCount;
      newTr.recentEvents = recentEvents;
      gatheredData.totalReturn = newTr;
    }
  }

  // Summarize trustScore breakdown if present
  const tsTemp = gatheredData.trustScore as TrustScoreResult;
  if (tsTemp && Array.isArray(tsTemp.breakdown)) {
    const ts = tsTemp;
    const bucketCounts: Record<string, number> = {
      "explained-no-tax": 0,
      "explained-withholding-tax": 0,
      "unverifiable": 0,
      "unexplained": 0
    };
    
    let mostRecentVerifiedEvent = null;
    
    for (const event of ts.breakdown) {
      bucketCounts[event.bucket] = (bucketCounts[event.bucket] || 0) + 1;
      
      if (event.independentlyVerified) {
        if (!mostRecentVerifiedEvent || new Date(event.exDate) > new Date(mostRecentVerifiedEvent.exDate)) {
          mostRecentVerifiedEvent = event;
        }
      }
    }
    
    gatheredData.trustScore = {
      asset: ts.asset,
      trustScore: ts.trustScore,
      confidenceLevel: ts.confidenceLevel,
      eventsAnalyzed: ts.eventsAnalyzed,
      bucketCounts,
      mostRecentVerifiedEvent
    };
  }

  // Sanitize null trust scores so the LLM doesn't misinterpret them as 0
  const INSUFFICIENT_DATA_MSG = "INSUFFICIENT_DATA_NOT_ZERO: no independently verified events exist for this issuer yet";
  
  if (gatheredData.trustScore && typeof gatheredData.trustScore === 'object') {
    const tsObj = gatheredData.trustScore as Record<string, unknown>;
    if (tsObj.trustScore === null) {
      tsObj.trustScore = INSUFFICIENT_DATA_MSG;
    }
  }
  
  if (Array.isArray(gatheredData.issuerLeaderboard)) {
    gatheredData.issuerLeaderboard.forEach((entry: { averageTrustScore: string | number | null }) => {
      if (entry.averageTrustScore === null || entry.averageTrustScore === undefined) {
        entry.averageTrustScore = INSUFFICIENT_DATA_MSG;
      }
    });
  }

  const prompt = `You are "Notary", an AI assistant for a tokenized real-world asset tracking platform.
A user is asking: "${question}"

Here is the real, verified data gathered from the blockchain and APIs to answer this question:
${JSON.stringify(gatheredData, null, 2)}

Instructions:
1. Answer ONLY using the numbers provided in the JSON data above.
2. If the question asks about something not covered by this data (like whether to buy/sell), say so explicitly rather than guessing (e.g., "I cannot provide financial advice" or "I don't have the data to answer that").
3. Never state a number that isn't in the provided context.
4. If there is an asymmetry or missing data (e.g. an issuer has no verified events or live attestation), state it honestly as an objective fact, just like the data shows.
5. The dividendContributionPct field is already calculated for you — state it directly, do not attempt to recompute or re-derive it yourself.
6. A score of null/INSUFFICIENT_DATA_NOT_ZERO means no data exists yet — this is NOT the same as a score of 0, and must never be described as a low, bad, or failing score. State plainly that insufficient data exists.
7. Do not reference any real-world knowledge about these companies, tickers, or products beyond what is in the JSON context above. If a name or fact isn't in the JSON, do not state it.
8. Keep your answer concise and easy to read.`;

  if (!groq) {
    return {
      answer: "Groq API key not configured. Cannot process question.",
      rawContext: gatheredData,
    };
  }

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'qwen/qwen3.8-27b',
      max_tokens: 400,
    });

    return {
      answer: completion.choices[0]?.message?.content || "No answer generated.",
      rawContext: gatheredData,
    };
  } catch (_err: unknown) {
    const errorMsg = _err instanceof Error ? _err.message : String(_err);
    return {
      answer: `Error communicating with LLM: ${errorMsg}`,
      rawContext: gatheredData,
    };
  }
}
