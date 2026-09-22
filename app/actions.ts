"use server";

import { getAllMeasuredWeekendGaps } from '@/lib/weekend-gap';
import { getTokenizedStockHoldings as fetchHoldings } from "@/lib/solana";
import { TokenHolding } from "@/lib/solana";
import type { TokenHolding as AskNotaryTokenHolding } from "@/lib/ask-notary";
import type { AssetSnapshot } from '@/lib/history-types';
import type { ProofObligationInput } from '@/lib/portfolio-proof';
import type { DigestHolding, DigestObligation } from '@/lib/wallet-digest';
import type { TradeCostResult } from '@/lib/trade-cost';
import type { MarketWatchResult } from '@/lib/market-watch-core';

export async function getTokenizedStockHoldings(walletAddress: string): Promise<TokenHolding[]> {
  return await fetchHoldings(walletAddress);
}

export type TokenHoldingWithPrice = TokenHolding & {
  currentPrice: number | null;
  totalValue: number | null;
};

export async function getHoldingsWithPrices(walletAddress: string): Promise<TokenHoldingWithPrice[]> {
  const { getStockPrice } = await import('@/lib/market-data');
  const holdings = await fetchHoldings(walletAddress);
  
  const enrichedHoldings = await Promise.all(holdings.map(async (holding) => {
    try {
      const priceData = await getStockPrice(holding.underlyingTicker);
      const currentPrice = priceData ? priceData.price : null;
      const totalValue = currentPrice !== null ? currentPrice * holding.balance : null;
      
      return {
        ...holding,
        currentPrice,
        totalValue
      };
    } catch (e) {
      console.warn(`Could not fetch price for ${holding.underlyingTicker}:`, e);
      return {
        ...holding,
        currentPrice: null,
        totalValue: null
      };
    }
  }));
  
  return enrichedHoldings;
}

export type VerificationStatusResult = {
  status: 'verified' | 'anomaly' | 'no_events' | 'error';
  narration?: string;
  error?: string;
};

export async function verifyAssetHolding(mintAddress: string): Promise<VerificationStatusResult> {
  const { KNOWN_ASSETS_MAP } = await import('@/lib/known-assets');
  const { getDividendHistory, getStockPrice } = await import('@/lib/market-data');
  const { verifyDividendEvent, getDiscrepancyBucket } = await import('@/lib/verification');
  const { narrateVerificationResult } = await import('@/lib/narration');

  try {
    const asset = KNOWN_ASSETS_MAP[mintAddress];
    if (!asset) {
      return { status: 'error', error: 'Asset not found' };
    }

    const dividends = await getDividendHistory(asset.underlyingTicker);
    if (dividends.length === 0) {
      return { status: 'no_events' };
    }

    const latestDividend = dividends[0];
    const d = new Date(latestDividend.ex_dividend_date);
    d.setDate(d.getDate() - 1);
    const refDate = d.toISOString().split('T')[0];
    const priceData = await getStockPrice(asset.underlyingTicker, refDate);
    if (!priceData) {
      return { status: 'error', error: 'Could not fetch historical price' };
    }

    const result = await verifyDividendEvent(asset, priceData.price, priceData.date, latestDividend);
    if (!result) {
      // Typically means multiplier === newMultiplier, indicating processing is done but we can't 'verify' from live state
      // Actually, if it's done, we shouldn't necessarily call it error. Let's just say NO_EVENTS or ERROR? 
      // The user asked for "NO EVENTS" when there is no recent corporate action to verify yet. 
      return { status: 'no_events' };
    }

    const bucket = getDiscrepancyBucket(result.verdict);
    const status = (bucket === 'explained-no-tax' || bucket === 'explained-withholding-tax') ? 'verified' : 'anomaly';
    
    let narration: string | undefined;
    try {
      narration = await narrateVerificationResult(result, asset);
    } catch (e) {
      console.warn("Narration failed", e);
    }

    return { status, narration };
  } catch (error) {
    console.error(`Error verifying holding ${mintAddress}:`, error);
    return { status: 'error', error: (error as Error).message };
  }
}

export async function verifyAllHoldings(mintAddresses: string[]): Promise<Record<string, VerificationStatusResult>> {
  const results: Record<string, VerificationStatusResult> = {};
  for (const mint of mintAddresses) {
    results[mint] = await verifyAssetHolding(mint);
  }
  return results;
}

export async function getTrustLeaderboardAction() {
  const { getIssuerLeaderboard } = await import('@/lib/trust-score');
  try {
    return await getIssuerLeaderboard();
  } catch (error) {
    console.error(`Error getting trust leaderboard:`, error);
    throw new Error('Failed to load trust leaderboard');
  }
}

export async function getReserveAttestationsAction() {
  const { KNOWN_ASSETS } = await import('@/lib/known-assets');
  const { getReserveAttestation } = await import('@/lib/attestation');
  
  try {
    const attestations = await Promise.all(KNOWN_ASSETS.map(asset => getReserveAttestation(asset)));
    return attestations;
  } catch (error) {
    console.error(`Error getting reserve attestations:`, error);
    throw new Error('Failed to load reserve attestations');
  }
}

export async function getAssetTrustRiskProfilesAction() {
  const { KNOWN_ASSETS } = await import('@/lib/known-assets');
  const { buildAssetTrustRiskProfile } = await import('@/lib/trust-risk-profile');
  try {
    const profiles = await Promise.all(KNOWN_ASSETS.map(asset => buildAssetTrustRiskProfile(asset)));
    try {
      const { recordAssetSnapshot } = await import('@/lib/history');
      await Promise.all(profiles.map(p => recordAssetSnapshot(p)));
    } catch {
    }
    return profiles;
  } catch (error) {
    console.error('Error building trust risk profiles:', error);
    throw new Error('Failed to load trust risk profiles');
  }
}

export async function getAssetHistoryAction(): Promise<Record<string, AssetSnapshot[]>> {
  try {
    const { KNOWN_ASSETS } = await import('@/lib/known-assets');
    const { getAssetHistory } = await import('@/lib/history');
    
    const results = await Promise.all(KNOWN_ASSETS.map(asset => getAssetHistory(asset.symbol, 60)));
    const record: Record<string, AssetSnapshot[]> = {};
    KNOWN_ASSETS.forEach((asset, index) => {
      record[asset.symbol] = results[index];
    });
    return record;
  } catch {
    return {};
  }
}

export async function getUpcomingAlertsAction() {
  const { getAllUpcomingAlerts } = await import('@/lib/alerts');
  try {
    return await getAllUpcomingAlerts();
  } catch (error) {
    console.error(`Error getting upcoming alerts:`, error);
    throw new Error('Failed to load upcoming alerts');
  }
}

export async function getNotaryAlertsAction(walletAddress?: string) {
  const { getAllNotaryAlerts } = await import('@/lib/alert-engine');
  try {
    return await getAllNotaryAlerts(walletAddress);
  } catch (error) {
    console.error('Error getting Notary alerts:', error);
    throw new Error('Failed to load alerts');
  }
}

export async function generateTaxCsvAction(assetMintAddress: string, purchaseDate: string, purchasePrice: number, shares: number) {
  const { generateTaxCsv } = await import('@/lib/tax-export');
  const { KNOWN_ASSETS_MAP } = await import('@/lib/known-assets');
  
  const asset = KNOWN_ASSETS_MAP[assetMintAddress];
  if (!asset) throw new Error("Asset not found");
  
  const holdings = { purchaseDate, purchasePrice, shares };
  
  try {
    return await generateTaxCsv(asset, holdings);
  } catch (error) {
    console.error(`Error generating tax CSV:`, error);
    throw new Error('Failed to generate tax CSV');
  }
}

export async function askNotaryAction(question: string, walletAddress?: string, assetMintAddress?: string | null) {
  const { askNotary } = await import('@/lib/ask-notary');
  const { KNOWN_ASSETS_MAP } = await import('@/lib/known-assets');
  
  let holdings: AskNotaryTokenHolding[] = [];
  if (walletAddress) {
    try {
      const rawHoldings = await fetchHoldings(walletAddress);
      holdings = rawHoldings.map(h => ({
        mintAddress: h.mintAddress,
        shares: h.balance
      }));
    } catch (e) {
      console.warn("Could not fetch holdings for askNotary", e);
    }
  }

  const asset = assetMintAddress ? KNOWN_ASSETS_MAP[assetMintAddress] : undefined;

  try {
    return await askNotary(question, { holdings, asset });
  } catch (error) {
    console.error(`Error in askNotaryAction:`, error);
    throw new Error('Failed to communicate with Notary');
  }
}

export async function getKaminoRiskAction(walletAddress: string) {
  const { getKaminoPositions } = await import('@/lib/kamino');
  const { computeSurvivableDrawdown, computeGapStressedHealthFactor } = await import('@/lib/risk-math');
  const { getAttestationStatus } = await import('@/lib/sas-attestation');
  const { buildLendingRiskProfile } = await import('@/lib/trust-risk-profile');

  try {
    const obligations = await getKaminoPositions(walletAddress);
    
    const gapData = await getAllMeasuredWeekendGaps();
    const gapPercentages = Object.fromEntries(Object.entries(gapData).map(([k, v]) => [k, v.percent]));

    return await Promise.all(obligations.map(async (obligation) => {
      let currentHealth: number | "Insufficient Data" = "Insufficient Data";
      if (obligation.borrowedValue > 0) {
        currentHealth = (obligation.depositedValue * obligation.liquidationLtvThreshold) / obligation.borrowedValue;
      }

      const drawdowns = computeSurvivableDrawdown(obligation);
      
      let worstAssetSymbol: string | null = null;
      let worstDrawdownValue: number | null = null;
      
      for (const [symbol, dd] of Object.entries(drawdowns)) {
        if (typeof dd === 'number') {
          if (worstDrawdownValue === null || dd < worstDrawdownValue) {
            worstDrawdownValue = dd;
            worstAssetSymbol = symbol;
          }
        }
      }

      const gapStressedHealth = computeGapStressedHealthFactor(obligation, gapPercentages);

      let attestationStatus = null;
      try {
        attestationStatus = await getAttestationStatus(obligation.obligationPubkey);
      } catch (e) {
        console.warn(`Failed to get attestation status for obligation ${obligation.obligationPubkey}:`, e);
      }

      return {
        ...obligation,
        currentHealth,
        drawdowns,
        worstAssetSymbol,
        worstDrawdownValue,
        gapStressedHealth,
        worstAssetGapDate: worstAssetSymbol && gapData[worstAssetSymbol] ? gapData[worstAssetSymbol].asOfDate : null,
        attestationStatus,
        profile: buildLendingRiskProfile({
          obligationPubkey: obligation.obligationPubkey,
          positions: obligation.positions,
          depositedValue: obligation.depositedValue,
          borrowedValue: obligation.borrowedValue,
          currentLtv: obligation.currentLtv,
          liquidationLtvThreshold: obligation.liquidationLtvThreshold,
          currentHealth,
          drawdowns,
          worstAssetSymbol,
          worstDrawdownValue,
          gapStressedHealth,
        }),
      };
    }));
  } catch (error) {
    console.error('Error getting Kamino risk data:', error);
    throw new Error('Failed to load Kamino risk data');
  }
}

export async function publishAttestationAction(obligationPubkey: string, walletAddress: string) {
  const { getKaminoPositions } = await import('@/lib/kamino');
  const { computeSurvivableDrawdown, computeGapStressedHealthFactor } = await import('@/lib/risk-math');
  const { publishRiskAttestation } = await import('@/lib/sas-attestation');

  try {
    const obligations = await getKaminoPositions(walletAddress);
    const obligation = obligations.find(o => o.obligationPubkey === obligationPubkey);
    
    if (!obligation) {
      throw new Error(`Obligation not found for pubkey ${obligationPubkey}`);
    }

    const drawdowns = computeSurvivableDrawdown(obligation);
    
    let worstAssetSymbol: string | null = null;
    let worstDrawdownValue: number | null = null;
    
    for (const [symbol, dd] of Object.entries(drawdowns)) {
      if (typeof dd === 'number') {
        if (worstDrawdownValue === null || dd < worstDrawdownValue) {
          worstDrawdownValue = dd;
          worstAssetSymbol = symbol;
        }
      }
    }

    const gapData = await getAllMeasuredWeekendGaps();
    const gapPercentages = Object.fromEntries(Object.entries(gapData).map(([k, v]) => [k, v.percent]));
    const gapStressedHealth = computeGapStressedHealthFactor(obligation, gapPercentages);

    if (worstAssetSymbol === null || worstDrawdownValue === null || typeof gapStressedHealth !== 'number') {
      throw new Error("Insufficient data to publish attestation: missing worst asset drawdown or gap-stressed health");
    }

    return await publishRiskAttestation(obligation, drawdowns, worstAssetSymbol, worstDrawdownValue, gapStressedHealth);
  } catch (error) {
    console.error('Error publishing attestation:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to publish attestation');
  }
}

export async function simulateLoanAction(input: { depositSymbol: string, depositUsd: number, borrowUsd: number, liquidationLtvThreshold: number }) {
  const { simulateHypotheticalLoan } = await import('@/lib/what-if');
  return simulateHypotheticalLoan(input);
}

export async function getGapSymbolsAction() {
  const gapData = await getAllMeasuredWeekendGaps();
  return Object.keys(gapData);
}

export async function getPriceParityAction() {
  const { buildPriceParity } = await import('@/lib/price-parity');
  try {
    return await buildPriceParity();
  } catch (error) {
    console.error('Error getting price parity:', error);
    throw new Error('Failed to load price parity');
  }
}

export async function generatePortfolioProofAction(walletAddress: string): Promise<{ filename: string; content: string; sha256: string }> {
  try {
    const { PublicKey } = await import('@solana/web3.js');
    try {
      new PublicKey(walletAddress);
    } catch {
      throw new Error("Invalid wallet address");
    }
    
    let enrichedHoldings: TokenHoldingWithPrice[];
    try {
      enrichedHoldings = await getHoldingsWithPrices(walletAddress);
    } catch (e) {
      console.error(e);
      throw new Error("Failed to build portfolio proof");
    }

    const { numberOrNull, buildPortfolioProof } = await import('@/lib/portfolio-proof');
    const { groupExposure } = await import('@/lib/exposure');

    const holdings = enrichedHoldings.map(h => ({
      symbol: h.symbol,
      name: h.name,
      issuer: h.issuer,
      mintAddress: h.mintAddress,
      underlyingTicker: h.underlyingTicker,
      balance: h.balance,
      price: h.currentPrice,
      value: h.totalValue
    }));

    const exposureGroups = groupExposure(enrichedHoldings.map(h => ({
      symbol: h.symbol,
      issuer: h.issuer,
      underlyingTicker: h.underlyingTicker,
      balance: h.balance,
      totalValue: h.totalValue
    })));
    const exposure = exposureGroups.map(group => ({
      ticker: group.ticker,
      heldVia: group.legs.map(l => l.symbol),
      issuerCount: group.issuerCount,
      combinedBalance: group.combinedBalance,
      combinedValue: group.combinedValue
    }));

    let kaminoStatus: "ok" | "unavailable" = "ok";
    let obligations: ProofObligationInput[] = [];

    try {
      const risk = await getKaminoRiskAction(walletAddress);
      obligations = risk.map((o): ProofObligationInput => ({
        obligationPubkey: o.obligationPubkey,
        depositedValueUsd: numberOrNull(o.depositedValue),
        borrowedValueUsd: numberOrNull(o.borrowedValue),
        currentHealthFactor: numberOrNull(o.currentHealth),
        gapStressedHealthFactor: numberOrNull(o.gapStressedHealth),
        worstAssetSymbol: typeof o.worstAssetSymbol === 'string' ? o.worstAssetSymbol : null,
        attestation: {
          exists: o.attestationStatus ? o.attestationStatus.exists : null,
          attestationPda: typeof o.attestationStatus?.attestationPda === 'string' ? o.attestationStatus.attestationPda : null,
          computedAtUnixTs: o.attestationStatus?.decoded ? numberOrNull(o.attestationStatus.decoded.computedAtUnixTs) : null,
          gapStressedHealthFactorBps: o.attestationStatus?.decoded ? numberOrNull(o.attestationStatus.decoded.gapStressedHealthFactorBps) : null
        }
      }));
    } catch {
      kaminoStatus = "unavailable";
    }

    return buildPortfolioProof({ walletAddress, holdings, exposure, kaminoStatus, obligations }, new Date());
  } catch (e) {
    console.error(e);
    if (e instanceof Error && e.message === "Invalid wallet address") throw e;
    throw new Error("Failed to build portfolio proof");
  }
}

export async function getWalletDigestAction(walletAddress: string): Promise<{ text: string; mode: "ai" | "template"; generatedAt: string }> {
  const { PublicKey } = await import('@solana/web3.js');
  try {
    new PublicKey(walletAddress);
  } catch {
    throw new Error("Invalid wallet address");
  }

  let enrichedHoldings: TokenHoldingWithPrice[];
  try {
    enrichedHoldings = await getHoldingsWithPrices(walletAddress);
  } catch (e) {
    console.error(e);
    throw new Error("Failed to build wallet digest");
  }

  const holdings: DigestHolding[] = enrichedHoldings.map(h => ({
    symbol: h.symbol,
    balance: h.balance,
    value: h.totalValue
  }));

  let obligations: DigestObligation[] = [];
  let kaminoStatus: "ok" | "unavailable" = "ok";
  const { numberOrNull } = await import('@/lib/portfolio-proof');

  try {
    const risk = await getKaminoRiskAction(walletAddress);
    obligations = risk.map(o => {
      let attestationAgeHours: number | null = null;
      const computedAtUnixTs = o.attestationStatus?.decoded ? numberOrNull(o.attestationStatus.decoded.computedAtUnixTs) : null;
      if (computedAtUnixTs !== null) {
        attestationAgeHours = (Date.now() / 1000 - computedAtUnixTs) / 3600;
      }
      return {
        obligationPubkey: o.obligationPubkey,
        depositedValueUsd: numberOrNull(o.depositedValue),
        borrowedValueUsd: numberOrNull(o.borrowedValue),
        currentHealthFactor: numberOrNull(o.currentHealth),
        gapStressedHealthFactor: numberOrNull(o.gapStressedHealth),
        worstAssetSymbol: typeof o.worstAssetSymbol === 'string' ? o.worstAssetSymbol : null,
        attestationExists: o.attestationStatus ? o.attestationStatus.exists : null,
        attestationAgeHours
      };
    });
  } catch {
    obligations = [];
    kaminoStatus = "unavailable";
  }

  const { buildDigestFacts, buildTemplateDigest, buildDigestPrompt, stripThinking, isDigestTextSafe, isEchoOfFacts } = await import('@/lib/wallet-digest');
  const facts = buildDigestFacts({ holdings, kaminoStatus, obligations });
  const template = buildTemplateDigest(facts);
  const generatedAt = new Date().toISOString();

  try {
    const { default: groq } = await import('@/lib/llm');
    if (groq !== null) {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: 'user',
            content: buildDigestPrompt(facts),
          },
        ],
        model: 'qwen/qwen3.8-27b'
      }, {
        timeout: 6000,
        maxRetries: 0
      });

      let text = completion.choices[0]?.message?.content;
      if (typeof text === 'string') {
        text = stripThinking(text);
        if (isDigestTextSafe(text, facts) && !isEchoOfFacts(text, facts)) {
          return { text, mode: "ai", generatedAt };
        }
      }
    }
  } catch {
  }

  return { text: template, mode: "template", generatedAt };
}

export async function getTradeCostAction(mintAddress: string, usdAmount: number): Promise<TradeCostResult> {
  const { getParityAssets } = await import('@/lib/parity-assets');
  const { getTradeCost, ALLOWED_USD_SIZES } = await import('@/lib/trade-cost');
  
  const assets = getParityAssets();
  const isParityAsset = assets.some(a => a.mintAddress === mintAddress);
  if (!isParityAsset) {
    throw new Error("Unknown asset");
  }
  
  if (!ALLOWED_USD_SIZES.includes(usdAmount)) {
    throw new Error("Unsupported trade size");
  }
  
  try {
    return await getTradeCost(mintAddress, usdAmount);
  } catch (error) {
    console.error("Error in getTradeCostAction:", error);
    throw new Error("Failed to check trade cost");
  }
}

export async function getMarketWatchAction(): Promise<MarketWatchResult> {
  try {
    const { getMarketWatch } = await import('@/lib/market-watch');
    return await getMarketWatch();
  } catch {
    console.error('Error getting market watch');
    return { status: 'unavailable', reason: 'Market watch is unavailable right now. Try again in a moment.', checkedNow: false, baselineTs: null, lastCheckedTs: null, entries: [] };
  }
}
