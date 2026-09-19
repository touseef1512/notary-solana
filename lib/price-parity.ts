import { KNOWN_ASSETS } from './known-assets';
import { getStockPrice } from './market-data';

// best-effort per server instance
const jupiterCache = new Map<string, { data: JupiterPriceResult | null; expiresAt: number }>();

export interface JupiterPriceResult {
  usdPrice: number;
  usdPricePrescaled: number | null;
  hasScaledUi: boolean;
  liquidity: number | null;
}

export async function getJupiterPrices(mints: string[]): Promise<Record<string, JupiterPriceResult | null>> {
  const result: Record<string, JupiterPriceResult | null> = {};
  const now = Date.now();
  const toFetch: string[] = [];

  mints.forEach((mint) => {
    const cached = jupiterCache.get(mint);
    if (cached && now < cached.expiresAt) {
      result[mint] = cached.data;
    } else {
      toFetch.push(mint);
    }
  });

  if (toFetch.length === 0) {
    return result;
  }

  for (let i = 0; i < toFetch.length; i += 50) {
    const batch = toFetch.slice(i, i + 50);
    const url = `https://api.jup.ag/price/v3?ids=${batch.join(',')}`;
    const headers: Record<string, string> = {};
    if (process.env.JUPITER_API_KEY) {
      headers['x-api-key'] = process.env.JUPITER_API_KEY;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Jupiter API error: ${res.status}`);
      }

      const json = await res.json() as Record<string, unknown>;
      batch.forEach((mint) => {
        let mintResult: JupiterPriceResult | null = null;
        if (json && typeof json === 'object' && mint in json) {
          const mintData = json[mint];
          if (mintData && typeof mintData === 'object') {
            const md = mintData as Record<string, unknown>;
            const usdPrice = md.usdPrice != null ? Number(md.usdPrice) : NaN;
            
            if (Number.isFinite(usdPrice) && usdPrice !== 0) {
              let liquidity: number | null = null;
              if (md.liquidity != null && Number.isFinite(Number(md.liquidity)) && Number(md.liquidity) !== 0) {
                liquidity = Number(md.liquidity);
              }
              
              let usdPricePrescaledRaw: unknown = null;
              let hasScaledUi = false;
              if (md.scaledUiConfig && typeof md.scaledUiConfig === 'object') {
                hasScaledUi = true;
                usdPricePrescaledRaw = (md.scaledUiConfig as Record<string, unknown>).usdPricePrescaled;
              }

              let usdPricePrescaled: number | null = null;
              if (usdPricePrescaledRaw != null && Number.isFinite(Number(usdPricePrescaledRaw)) && Number(usdPricePrescaledRaw) !== 0) {
                usdPricePrescaled = Number(usdPricePrescaledRaw);
              }

              mintResult = {
                usdPrice,
                usdPricePrescaled,
                hasScaledUi,
                liquidity
              };
            }
          }
        }
        result[mint] = mintResult;
        jupiterCache.set(mint, { data: mintResult, expiresAt: now + 60000 });
      });
    } catch {
      clearTimeout(timeoutId);
      batch.forEach(mint => {
        result[mint] = null;
      });
    }
  }

  return result;
}

export interface PriceParityResult {
  symbol: string;
  mint: string;
  issuer: string;
  dexPrice: number | null;
  rawUsdPrice: number | null;
  hasScaledUi: boolean;
  liquidity: number | null;
  underlyingClose: number | null;
  closeDate: string | null;
  gapPercent: number | null;
  fetchedAt: string;
  status: "ok" | "Insufficient Data";
  reason?: string;
}

export async function buildPriceParity(): Promise<PriceParityResult[]> {
  const assets = KNOWN_ASSETS.filter(a => a.mintAddress && a.underlyingTicker);
  const mints = assets.map(a => a.mintAddress);
  const jupPrices = await getJupiterPrices(mints);

  const results: PriceParityResult[] = [];
  const fetchedAt = new Date().toISOString();

  // Call getStockPrice sequentially
  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    let underlyingClose: number | null = null;
    let closeDate: string | null = null;
    let underlyingError = false;

    try {
      const priceData = await getStockPrice(asset.underlyingTicker);
      if (priceData && priceData.price !== 0 && Number.isFinite(priceData.price)) {
        underlyingClose = priceData.price;
        closeDate = priceData.date;
      } else {
        underlyingError = true;
      }
    } catch {
      underlyingError = true;
    }

    const jupData = jupPrices[asset.mintAddress];
    
    let dexPrice: number | null = null;
    let rawUsdPrice: number | null = null;
    let hasScaledUi = false;
    let liquidity: number | null = null;

    if (jupData) {
      rawUsdPrice = jupData.usdPrice;
      hasScaledUi = jupData.hasScaledUi;
      liquidity = jupData.liquidity;
      if (jupData.usdPrice !== 0) {
        dexPrice = jupData.usdPrice;
      }
    }

    let gapPercent: number | null = null;
    let status: "ok" | "Insufficient Data" = "ok";
    let reason: string | undefined;

    if (!jupData || dexPrice === null) {
      status = "Insufficient Data";
      reason = "no DEX price";
    } else if (underlyingError || underlyingClose === null) {
      status = "Insufficient Data";
      reason = "no underlying close";
    } else {
      gapPercent = (dexPrice / underlyingClose - 1) * 100;
      if (!Number.isFinite(gapPercent)) {
        status = "Insufficient Data";
        reason = "non-finite calculation";
        gapPercent = null;
      }
    }

    results.push({
      symbol: asset.symbol,
      mint: asset.mintAddress,
      issuer: asset.issuer,
      dexPrice,
      rawUsdPrice,
      hasScaledUi,
      liquidity,
      underlyingClose,
      closeDate,
      gapPercent,
      fetchedAt,
      status,
      reason
    });
  }

  return results;
}
