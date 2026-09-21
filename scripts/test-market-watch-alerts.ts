import { buildMarketWatchAlerts } from '../lib/market-watch-alerts';
import type { WatchEntry } from '../lib/market-watch-core';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean): void {
  if (ok) {
    passed++;
    console.log('PASS ' + name);
  } else {
    failed++;
    console.log('FAIL ' + name);
  }
}

const DAY = 86400;
const NOW = 2000000000;

function entry(symbol: string, firstSeenTs: number, added: boolean, removedTs: number | null): WatchEntry {
  return { mint: 'Mint' + symbol, symbol, firstSeenTs, addedAfterBaseline: added, removedTs };
}

check('empty input gives no alerts', buildMarketWatchAlerts([], NOW).length === 0);
check('baseline entries give no alerts', buildMarketWatchAlerts([entry('BASE', NOW - 30 * DAY, false, null)], NOW).length === 0);

const added = buildMarketWatchAlerts([entry('NEWX', NOW - 2 * DAY, true, null)], NOW);
check('recent addition gives one alert', added.length === 1);
check('addition alert fields', added.length === 1 && added[0].kind === 'market-watch' && added[0].severity === 'info' && added[0].title === 'New Kamino listing: NEWX' && added[0].assetSymbol === 'NEWX' && added[0].daysUntil === null);
const expectedDate = new Date((NOW - 2 * DAY) * 1000).toISOString().slice(0, 10);
check('addition note contains the date', added.length === 1 && added[0].note.indexOf(expectedDate) !== -1);

check('old addition gives no alert', buildMarketWatchAlerts([entry('OLDX', NOW - 20 * DAY, true, null)], NOW).length === 0);

const removed = buildMarketWatchAlerts([entry('GONE', NOW - 40 * DAY, false, NOW - 1 * DAY)], NOW);
check('recent removal gives one alert', removed.length === 1);
check('removal alert fields', removed.length === 1 && removed[0].kind === 'market-watch' && removed[0].severity === 'warning' && removed[0].title === 'Kamino listing removed: GONE' && removed[0].assetSymbol === 'GONE' && removed[0].daysUntil === null);

check('old removal gives no alert', buildMarketWatchAlerts([entry('GONE', NOW - 90 * DAY, false, NOW - 30 * DAY)], NOW).length === 0);

const both = buildMarketWatchAlerts([entry('FLIP', NOW - 3 * DAY, true, NOW - 1 * DAY)], NOW);
check('added then removed gives exactly one alert, the removal', both.length === 1 && both[0].title === 'Kamino listing removed: FLIP');

check('relisted old entry gives no alert', buildMarketWatchAlerts([entry('BACK', NOW - 30 * DAY, true, null)], NOW).length === 0);

const two = buildMarketWatchAlerts([entry('EARLY', NOW - 5 * DAY, true, null), entry('LATE', NOW - 40 * DAY, false, NOW - 1 * DAY)], NOW);
check('alerts are newest first', two.length === 2 && two[0].assetSymbol === 'LATE' && two[1].assetSymbol === 'EARLY');

check('exactly 14 days old is included', buildMarketWatchAlerts([entry('EDGE', NOW - 14 * DAY, true, null)], NOW).length === 1);
check('14 days and 1 second is excluded', buildMarketWatchAlerts([entry('EDGE', NOW - 14 * DAY - 1, true, null)], NOW).length === 0);

const input: WatchEntry[] = [entry('AAA', NOW - 1 * DAY, true, null), entry('BBB', NOW - 40 * DAY, false, NOW - 2 * DAY)];
const before = JSON.stringify(input);
buildMarketWatchAlerts(input, NOW);
check('input is not mutated', JSON.stringify(input) === before);

console.log('');
console.log(passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exitCode = 1;
