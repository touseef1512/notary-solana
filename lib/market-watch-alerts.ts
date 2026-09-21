import type { WatchEntry } from './market-watch-core';
import type { NotaryAlert } from './alert-engine';

const RECENT_WINDOW_SECONDS = 14 * 86400;

export function buildMarketWatchAlerts(entries: WatchEntry[], nowTs: number): NotaryAlert[] {
  const alertsWithTime: { alert: NotaryAlert; eventTs: number }[] = [];
  
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    
    if (entry.removedTs !== null) {
      if (nowTs - entry.removedTs <= RECENT_WINDOW_SECONDS) {
        const date = new Date(entry.removedTs * 1000).toISOString().slice(0, 10) + ' UTC';
        alertsWithTime.push({
          alert: {
            kind: 'market-watch',
            severity: 'warning',
            title: 'Kamino listing removed: ' + entry.symbol,
            daysUntil: null,
            assetSymbol: entry.symbol,
            note: 'Notary saw ' + entry.symbol + ' missing from the Kamino xStocks market on ' + date + '. This is a record, not advice.'
          },
          eventTs: entry.removedTs
        });
      }
    } else if (entry.addedAfterBaseline === true) {
      if (nowTs - entry.firstSeenTs <= RECENT_WINDOW_SECONDS) {
        const date = new Date(entry.firstSeenTs * 1000).toISOString().slice(0, 10) + ' UTC';
        alertsWithTime.push({
          alert: {
            kind: 'market-watch',
            severity: 'info',
            title: 'New Kamino listing: ' + entry.symbol,
            daysUntil: null,
            assetSymbol: entry.symbol,
            note: 'First seen by Notary on ' + date + '. Being listed is not a recommendation.'
          },
          eventTs: entry.firstSeenTs
        });
      }
    }
  }
  
  alertsWithTime.sort((a, b) => b.eventTs - a.eventTs);
  
  const results: NotaryAlert[] = [];
  for (let i = 0; i < alertsWithTime.length; i++) {
    results.push(alertsWithTime[i].alert);
  }
  
  return results;
}
