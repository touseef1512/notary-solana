// Jupiter priceImpactPct is a fraction (0.01 means 1%); multiply by this to get percent.
export const PRICE_IMPACT_TO_PERCENT = 100;

export const JUPITER_QUOTE_URL = "https://api.jup.ag/swap/v1/quote";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const ALLOWED_USD_SIZES: number[] = [100, 1000, 10000];

export interface TradeCostResult {
  status: "ok" | "no_route" | "rate_limited" | "unavailable";
  usdAmount: number;
  impactPercent: number | null;
  venues: string[];
  fetchedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseQuote(httpStatus: number, body: unknown, usdAmount: number, fetchedAt: string): TradeCostResult {
  if (httpStatus === 429) {
    return { status: "rate_limited", usdAmount, impactPercent: null, venues: [], fetchedAt };
  }

  if (httpStatus !== 200) {
    if (isRecord(body)) {
      const b = body;
      let errStr = "";
      if (typeof b.error === "string") {
        errStr = b.error.toLowerCase();
      } else if (typeof b.errorCode === "string") {
        errStr = b.errorCode.toLowerCase();
      }
      
      if (errStr.includes("no routes found") || errStr.includes("could_not_find_any_route") || errStr.includes("could not find any route")) {
        return { status: "no_route", usdAmount, impactPercent: null, venues: [], fetchedAt };
      }
    }
  } else if (httpStatus === 200 && isRecord(body)) {
    const b = body;
    let impactPercent: number | null = null;
    
    if (typeof b.priceImpactPct === "number" && Number.isFinite(b.priceImpactPct)) {
      impactPercent = b.priceImpactPct * PRICE_IMPACT_TO_PERCENT;
    } else if (typeof b.priceImpactPct === "string") {
      const parsed = Number(b.priceImpactPct);
      if (Number.isFinite(parsed)) {
        impactPercent = parsed * PRICE_IMPACT_TO_PERCENT;
      }
    }
    
    if (impactPercent !== null) {
      const venues: string[] = [];
      const seen = new Set<string>();
      if (Array.isArray(b.routePlan)) {
        for (let i = 0; i < b.routePlan.length; i++) {
          const route: unknown = b.routePlan[i];
          if (isRecord(route) && isRecord(route.swapInfo)) {
            const label = route.swapInfo.label;
            if (typeof label === "string" && !seen.has(label)) {
              seen.add(label);
              venues.push(label);
            }
          }
        }
      }
      return { status: "ok", usdAmount, impactPercent, venues, fetchedAt };
    }
  }
  
  return { status: "unavailable", usdAmount, impactPercent: null, venues: [], fetchedAt };
}

const tradeCostCache = new Map<string, { data: TradeCostResult; expiresAt: number }>();

export async function getTradeCost(mintAddress: string, usdAmount: number): Promise<TradeCostResult> {
  if (!ALLOWED_USD_SIZES.includes(usdAmount)) {
    throw new Error("Unsupported trade size");
  }

  const cacheKey = `${mintAddress}:${usdAmount}`;
  const now = Date.now();
  const cached = tradeCostCache.get(cacheKey);
  if (cached && now < cached.expiresAt) {
    return cached.data;
  }

  const url = `${JUPITER_QUOTE_URL}?inputMint=${USDC_MINT}&outputMint=${mintAddress}&amount=${usdAmount * 1000000}&slippageBps=50`;
  const headers: Record<string, string> = {};
  if (process.env.JUPITER_API_KEY) {
    headers['x-api-key'] = process.env.JUPITER_API_KEY;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  let status = 0;
  let body: unknown = null;
  const fetchedAt = new Date().toISOString();

  try {
    const res = await fetch(url, { headers, signal: controller.signal, cache: 'no-store' });
    status = res.status;
    clearTimeout(timeoutId);
    try {
      body = await res.json();
    } catch {
      body = null;
    }
  } catch {
    clearTimeout(timeoutId);
    return { status: "unavailable", usdAmount, impactPercent: null, venues: [], fetchedAt };
  }

  const result = parseQuote(status, body, usdAmount, fetchedAt);
  if (result.status === "ok" || result.status === "no_route") {
    tradeCostCache.set(cacheKey, { data: result, expiresAt: now + 60000 });
  }

  return result;
}
