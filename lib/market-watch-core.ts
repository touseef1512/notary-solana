export interface WatchEntry {
  mint: string;
  symbol: string;
  firstSeenTs: number;
  addedAfterBaseline: boolean;
  removedTs: number | null;
}

export interface WatchState {
  baselineTs: number;
  lastCheckedTs: number;
  entries: WatchEntry[];
}

export interface CurrentMint {
  mint: string;
  symbol: string;
}

export interface MarketWatchResult {
  status: 'ok' | 'unavailable';
  reason: string | null;
  checkedNow: boolean;
  baselineTs: number | null;
  lastCheckedTs: number | null;
  entries: WatchEntry[];
}

export function findNewMints(previous: WatchState | null, currentMints: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < currentMints.length; i++) {
    const mint = currentMints[i];
    if (result.indexOf(mint) !== -1) continue;
    if (!previous) {
      result.push(mint);
      continue;
    }
    let found = false;
    for (let j = 0; j < previous.entries.length; j++) {
      if (previous.entries[j].mint === mint) {
        found = true;
        break;
      }
    }
    if (!found) {
      result.push(mint);
    }
  }
  return result;
}

export function mergeWatchState(previous: WatchState | null, current: CurrentMint[], nowTs: number): WatchState {
  if (!previous) {
    const entries: WatchEntry[] = [];
    for (let i = 0; i < current.length; i++) {
      const item = current[i];
      let duplicate = false;
      for (let j = 0; j < entries.length; j++) {
        if (entries[j].mint === item.mint) {
          duplicate = true;
          break;
        }
      }
      if (!duplicate) {
        entries.push({
          mint: item.mint,
          symbol: item.symbol,
          firstSeenTs: nowTs,
          addedAfterBaseline: false,
          removedTs: null
        });
      }
    }
    return {
      baselineTs: nowTs,
      lastCheckedTs: nowTs,
      entries
    };
  }

  const newEntries: WatchEntry[] = [];
  for (let i = 0; i < previous.entries.length; i++) {
    const entry = previous.entries[i];
    let foundInCurrent = false;
    for (let j = 0; j < current.length; j++) {
      if (current[j].mint === entry.mint) {
        foundInCurrent = true;
        break;
      }
    }

    if (foundInCurrent) {
      newEntries.push({
        mint: entry.mint,
        symbol: entry.symbol,
        firstSeenTs: entry.firstSeenTs,
        addedAfterBaseline: entry.addedAfterBaseline,
        removedTs: null
      });
    } else {
      newEntries.push({
        mint: entry.mint,
        symbol: entry.symbol,
        firstSeenTs: entry.firstSeenTs,
        addedAfterBaseline: entry.addedAfterBaseline,
        removedTs: entry.removedTs === null ? nowTs : entry.removedTs
      });
    }
  }

  for (let i = 0; i < current.length; i++) {
    const item = current[i];
    let foundInNewEntries = false;
    for (let j = 0; j < newEntries.length; j++) {
      if (newEntries[j].mint === item.mint) {
        foundInNewEntries = true;
        break;
      }
    }
    if (!foundInNewEntries) {
      newEntries.push({
        mint: item.mint,
        symbol: item.symbol,
        firstSeenTs: nowTs,
        addedAfterBaseline: true,
        removedTs: null
      });
    }
  }

  return {
    baselineTs: previous.baselineTs,
    lastCheckedTs: nowTs,
    entries: newEntries
  };
}

export function isWatchState(value: unknown): value is WatchState {
  if (typeof value !== 'object' || value === null) return false;
  if (!('baselineTs' in value) || !('lastCheckedTs' in value) || !('entries' in value)) return false;
  
  const v = value;
  
  if (typeof v.baselineTs !== 'number' || !Number.isFinite(v.baselineTs)) return false;
  if (typeof v.lastCheckedTs !== 'number' || !Number.isFinite(v.lastCheckedTs)) return false;
  
  const entries: unknown = v.entries;
  if (!Array.isArray(entries)) return false;
  
  for (let i = 0; i < entries.length; i++) {
    const item: unknown = entries[i];
    if (typeof item !== 'object' || item === null) return false;
    if (!('mint' in item) || !('symbol' in item) || !('firstSeenTs' in item) || !('addedAfterBaseline' in item) || !('removedTs' in item)) return false;
    
    if (typeof item.mint !== 'string' || item.mint.length === 0) return false;
    if (typeof item.symbol !== 'string') return false;
    if (typeof item.firstSeenTs !== 'number' || !Number.isFinite(item.firstSeenTs)) return false;
    if (typeof item.addedAfterBaseline !== 'boolean') return false;
    if (item.removedTs !== null && (typeof item.removedTs !== 'number' || !Number.isFinite(item.removedTs))) return false;
  }
  
  return true;
}
