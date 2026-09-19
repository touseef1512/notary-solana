export interface AssetSnapshot {
  ts: number;
  trustScore: number | null;
  backingRatio: number | null;
}

export interface HistorySummary {
  count: number;
  firstTs: number | null;
  lastTs: number | null;
  trustScoreChange: number | null;
  backingRatioChangePoints: number | null;
}

export function summarizeHistory(snapshots: AssetSnapshot[]): HistorySummary {
  const count = snapshots.length;
  if (count === 0) {
    return {
      count: 0,
      firstTs: null,
      lastTs: null,
      trustScoreChange: null,
      backingRatioChangePoints: null
    };
  }

  const firstTs = snapshots[0].ts;
  const lastTs = snapshots[count - 1].ts;

  let firstTrustScore: number | null = null;
  let lastTrustScore: number | null = null;
  let trustScoreCount = 0;

  let firstBackingRatio: number | null = null;
  let lastBackingRatio: number | null = null;
  let backingRatioCount = 0;

  for (let i = 0; i < count; i++) {
    const s = snapshots[i];
    if (s.trustScore !== null && Number.isFinite(s.trustScore)) {
      if (firstTrustScore === null) firstTrustScore = s.trustScore;
      lastTrustScore = s.trustScore;
      trustScoreCount++;
    }
    if (s.backingRatio !== null && Number.isFinite(s.backingRatio)) {
      if (firstBackingRatio === null) firstBackingRatio = s.backingRatio;
      lastBackingRatio = s.backingRatio;
      backingRatioCount++;
    }
  }

  let trustScoreChange: number | null = null;
  if (trustScoreCount >= 2 && firstTrustScore !== null && lastTrustScore !== null) {
    trustScoreChange = lastTrustScore - firstTrustScore;
  }

  let backingRatioChangePoints: number | null = null;
  if (backingRatioCount >= 2 && firstBackingRatio !== null && lastBackingRatio !== null) {
    backingRatioChangePoints = (lastBackingRatio - firstBackingRatio) * 100;
  }

  return {
    count,
    firstTs,
    lastTs,
    trustScoreChange,
    backingRatioChangePoints
  };
}
