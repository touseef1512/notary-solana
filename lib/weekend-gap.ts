import { Redis } from '@upstash/redis';
import { KNOWN_ASSETS } from './known-assets';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export interface WeekendGapResult {
  percent: number;
  asOfDate: string;
  computedAt: number;
}

export async function getMeasuredWeekendGap(symbol: string): Promise<WeekendGapResult | "Insufficient Data"> {
  const cacheKey = `notary:gap:${symbol}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    if (cached === "Insufficient Data") return "Insufficient Data";
    return typeof cached === 'string' ? JSON.parse(cached) : cached as WeekendGapResult;
  }

  const asset = KNOWN_ASSETS.find((a) => a.symbol === symbol);
  if (!asset) {
    return "Insufficient Data";
  }
  const ticker = asset.underlyingTicker;

  const apiKey = process.env.TIINGO_API_KEY;
  if (!apiKey) {
    throw new Error('TIINGO_API_KEY is not configured in .env.local');
  }

  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  const startDateStr = start.toISOString().split('T')[0];

  const url = `https://api.tiingo.com/tiingo/daily/${ticker.toLowerCase()}/prices?token=${apiKey}&startDate=${startDateStr}`;
  
  try {
    const response = await fetch(url, { next: { revalidate: 86400 } });
    if (!response.ok) {
      throw new Error(`Tiingo API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as Array<{ date: string; open: number; close: number }>;
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`Tiingo API error: No pricing data found for ${ticker}`);
    }

    let worstPercent = 0;
    let worstDate = "";
    let gapCount = 0;

    for (let i = 1; i < data.length; i++) {
      const prev = data[i - 1];
      const curr = data[i];

      const prevDate = new Date(prev.date);
      const currDate = new Date(curr.date);
      const diffTime = Math.abs(currDate.getTime() - prevDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 1) {
        gapCount++;
        const prevClose = prev.close;
        const currOpen = curr.open;

        if (typeof prevClose === 'number' && typeof currOpen === 'number' && prevClose > 0) {
          const percent = ((currOpen - prevClose) / prevClose) * 100;
          if (worstDate === "" || percent < worstPercent) {
            worstPercent = percent;
            worstDate = curr.date.split('T')[0];
          }
        }
      }
    }

    if (gapCount < 8) {
      await redis.set(cacheKey, "Insufficient Data", { ex: 86400 });
      return "Insufficient Data";
    }

    const result: WeekendGapResult = {
      percent: worstPercent,
      asOfDate: worstDate,
      computedAt: Math.floor(Date.now() / 1000)
    };

    await redis.set(cacheKey, JSON.stringify(result), { ex: 86400 });
    return result;

  } catch {
    await redis.set(cacheKey, "Insufficient Data", { ex: 86400 });
    return "Insufficient Data";
  }
}

export async function getAllMeasuredWeekendGaps(): Promise<Record<string, WeekendGapResult>> {
  const result: Record<string, WeekendGapResult> = {};
  for (const asset of KNOWN_ASSETS) {
    const gap = await getMeasuredWeekendGap(asset.symbol);
    if (gap !== "Insufficient Data") {
      result[asset.symbol] = gap;
    }
  }
  return result;
}
