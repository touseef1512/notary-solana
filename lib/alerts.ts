import { KnownAsset } from './known-assets';
import { getDividendHistory, DividendRecord } from './market-data';

export interface AlertResult {
  asset: KnownAsset;
  nextEventDate: string | null;
  confidenceLevel: "confirmed" | "estimated" | "no-data";
  daysUntil: number | null;
  note: string;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let alertsCache: { timestamp: number, data: AlertResult[] } | null = null;

export async function getAllUpcomingAlerts(): Promise<AlertResult[]> {
  const { getParityAssets } = await import('@/lib/parity-assets');
  const now = Date.now();
  
  if (alertsCache && (now - alertsCache.timestamp < CACHE_TTL)) {
    return alertsCache.data;
  }
  
  const data: AlertResult[] = [];
  for (const asset of getParityAssets()) {
    data.push(await getUpcomingAlerts(asset));
  }
  alertsCache = { timestamp: now, data };
  return data;
}

export async function getUpcomingAlerts(asset: KnownAsset): Promise<AlertResult> {
  const PAUSE_NOTE = "Expect a brief trading pause (~20 minutes) around this date due to the corporate action (pausableConfig).";
  const NO_DATA_NOTE = "No dividend history to project from.";

  let history: DividendRecord[] = [];
  try {
    history = await getDividendHistory(asset.underlyingTicker);
  } catch {
    // If API fails or no data
  }

  if (!history || history.length === 0) {
    return {
      asset,
      nextEventDate: null,
      confidenceLevel: "no-data",
      daysUntil: null,
      note: NO_DATA_NOTE
    };
  }

  // Ensure descending sort (newest first)
  const sorted = [...history].sort(
    (a, b) => new Date(b.ex_dividend_date).getTime() - new Date(a.ex_dividend_date).getTime()
  );

  const getTodayTime = () => {
    const now = new Date();
    return new Date(now.toISOString().split('T')[0]).getTime();
  };
  
  const todayTime = getTodayTime();
  
  const newestEventDateStr = sorted[0].ex_dividend_date;
  const newestEventTime = new Date(newestEventDateStr).getTime();
  
  // Confirmed if newest event is strictly in the future
  if (newestEventTime > todayTime) {
    const freshTodayTime = getTodayTime();
    const daysUntil = Math.ceil((newestEventTime - freshTodayTime) / (1000 * 60 * 60 * 24));
    return {
      asset,
      nextEventDate: newestEventDateStr,
      confidenceLevel: "confirmed",
      daysUntil,
      note: `Confirmed declaration. ${PAUSE_NOTE}`
    };
  }

  // Need to estimate
  if (sorted.length < 2) {
    return {
      asset,
      nextEventDate: null,
      confidenceLevel: "no-data",
      daysUntil: null,
      note: NO_DATA_NOTE
    };
  }

  // Calculate average gap between the most recent up to 4 events (which gives up to 3 gaps)
  const limit = Math.min(sorted.length, 4);
  const datesToUse = sorted.slice(0, limit).map(d => new Date(d.ex_dividend_date).getTime());
  
  let totalGap = 0;
  for (let i = 0; i < datesToUse.length - 1; i++) {
    totalGap += (datesToUse[i] - datesToUse[i + 1]);
  }
  const avgGapMs = totalGap / (datesToUse.length - 1);
  
  const estimatedTime = newestEventTime + avgGapMs;
  
  // If the estimated time is somehow in the past (e.g. they skipped a dividend),
  // we could loop adding avgGap until it's in the future.
  let projectedTime = estimatedTime;
  while (projectedTime <= todayTime) {
    projectedTime += avgGapMs;
  }
  
  const estimatedDateObj = new Date(projectedTime);
  const estimatedDateStr = estimatedDateObj.toISOString().split('T')[0];
  
  // Normalize target date to midnight UTC and fetch fresh today time
  const targetTime = new Date(estimatedDateStr).getTime();
  const freshTodayTime = getTodayTime();
  const daysUntil = Math.ceil((targetTime - freshTodayTime) / (1000 * 60 * 60 * 24));

  return {
    asset,
    nextEventDate: estimatedDateStr,
    confidenceLevel: "estimated",
    daysUntil,
    note: `Projected from historical cadence. Not a confirmed declaration. ${PAUSE_NOTE}`
  };
}
