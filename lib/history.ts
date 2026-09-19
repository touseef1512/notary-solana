import { Redis } from '@upstash/redis';
import type { TrustRiskProfile } from './trust-risk-profile';
import { AssetSnapshot } from './history-types';

const PREFIX = 'notary:hist:';
const MAX_SNAPSHOTS = 200;
const MIN_INTERVAL_SECONDS = 3600;
const REDIS_TIMEOUT_MS = 2000;

let redisClient: Redis | null = null;
if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
  redisClient = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Redis timeout')), REDIS_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function recordAssetSnapshot(profile: TrustRiskProfile): Promise<void> {
  try {
    if (!redisClient) return;
    if (profile.kind !== 'reserve-trust' || !profile.asset) return;

    const ts = Math.floor(Date.now() / 1000);
    const trustScore = typeof profile.trustScore === 'number' && Number.isFinite(profile.trustScore) ? profile.trustScore : null;
    const backingRatio = typeof profile.backingRatio === 'number' && Number.isFinite(profile.backingRatio) ? profile.backingRatio : null;

    if (trustScore === null && backingRatio === null) return;

    const symbol = profile.asset.symbol;
    const gateKey = `${PREFIX}gate:${symbol}`;
    const assetKey = `${PREFIX}asset:${symbol}`;

    const acquired = await withTimeout(redisClient.set(gateKey, '1', { nx: true, ex: MIN_INTERVAL_SECONDS }));
    if (acquired) {
      const snapshot: AssetSnapshot = { ts, trustScore, backingRatio };
      await withTimeout(redisClient.lpush(assetKey, JSON.stringify(snapshot)));
      await withTimeout(redisClient.ltrim(assetKey, 0, MAX_SNAPSHOTS - 1));
    }
  } catch {
    // Silently ignore errors
  }
}

function isAssetSnapshot(value: unknown): value is AssetSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  if (!('ts' in value) || !('trustScore' in value) || !('backingRatio' in value)) return false;
  const v = value;
  
  if (typeof v.ts !== 'number' || !Number.isFinite(v.ts)) return false;
  
  if (v.trustScore !== null && (typeof v.trustScore !== 'number' || !Number.isFinite(v.trustScore))) return false;
  if (v.backingRatio !== null && (typeof v.backingRatio !== 'number' || !Number.isFinite(v.backingRatio))) return false;

  return true;
}

export async function getAssetHistory(symbol: string, limit: number): Promise<AssetSnapshot[]> {
  try {
    if (!redisClient) return [];
    const assetKey = `${PREFIX}asset:${symbol}`;
    const entries = await withTimeout(redisClient.lrange(assetKey, 0, limit - 1));
    
    const snapshots: AssetSnapshot[] = [];
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      const parsed = typeof entry === 'string' ? JSON.parse(entry) : entry;
      if (isAssetSnapshot(parsed)) {
        snapshots.push(parsed);
      }
    }
    return snapshots;
  } catch {
    return [];
  }
}
