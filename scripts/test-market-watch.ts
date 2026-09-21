import { findNewMints, mergeWatchState, isWatchState } from '../lib/market-watch-core';
import type { WatchState, WatchEntry } from '../lib/market-watch-core';

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
function entry(s: WatchState, mint: string): WatchEntry | undefined {
  return s.entries.find((e) => e.mint === mint);
}

const A = { mint: 'MintAAAA', symbol: 'AAA' };
const B = { mint: 'MintBBBB', symbol: 'BBB' };
const C = { mint: 'MintCCCC', symbol: 'CCC' };
const D = { mint: 'MintDDDD', symbol: 'DDD' };
const E = { mint: 'MintEEEE', symbol: 'EEE' };

const s1 = mergeWatchState(null, [A, B, C], 1000);
check('baseline has 3 entries', s1.entries.length === 3);
check('baseline timestamps', s1.baselineTs === 1000 && s1.lastCheckedTs === 1000);
check('baseline entries are not new and not removed', s1.entries.every((e) => e.firstSeenTs === 1000 && e.addedAfterBaseline === false && e.removedTs === null));

const s2 = mergeWatchState(s1, [A, B, C], 2000);
check('no change keeps 3 entries', s2.entries.length === 3);
check('no change keeps baselineTs, moves lastCheckedTs', s2.baselineTs === 1000 && s2.lastCheckedTs === 2000);
check('no change sets no flags', s2.entries.every((e) => e.addedAfterBaseline === false && e.removedTs === null));
check('previous state is not mutated by a merge', s1.lastCheckedTs === 1000);

const s3 = mergeWatchState(s2, [A, B, C, D], 3000);
check('addition makes 4 entries', s3.entries.length === 4);
const d3 = entry(s3, D.mint);
check('added entry fields', d3 !== undefined && d3.firstSeenTs === 3000 && d3.addedAfterBaseline === true && d3.removedTs === null && d3.symbol === 'DDD');
const a3 = entry(s3, A.mint);
check('existing entry unchanged by addition', a3 !== undefined && a3.firstSeenTs === 1000 && a3.addedAfterBaseline === false);

const s4 = mergeWatchState(s3, [A, C, D], 4000);
const b4 = entry(s4, B.mint);
check('removal sets removedTs', b4 !== undefined && b4.removedTs === 4000);
check('removed entry is kept, others stay listed', s4.entries.length === 4 && entry(s4, A.mint)?.removedTs === null);

const s5 = mergeWatchState(s4, [A, C, D], 5000);
check('still missing keeps the first removedTs', entry(s5, B.mint)?.removedTs === 4000);
check('still missing updates lastCheckedTs', s5.lastCheckedTs === 5000);

const s6 = mergeWatchState(s5, [A, { mint: B.mint, symbol: 'CHANGED' }, C, D], 6000);
check('relisted entry is active again', entry(s6, B.mint)?.removedTs === null);
check('relisted entry keeps firstSeenTs and symbol', entry(s6, B.mint)?.firstSeenTs === 1000 && entry(s6, B.mint)?.symbol === 'BBB');
check('relisting adds no duplicate', s6.entries.length === 4);

const before = JSON.stringify(s3);
mergeWatchState(s3, [A], 9000);
check('merge does not mutate its input', JSON.stringify(s3) === before);

check('baseline removes duplicate mints', mergeWatchState(null, [A, A, B], 10).entries.length === 2);
check('baseline of an empty list is empty', mergeWatchState(null, [], 10).entries.length === 0);

const s7 = mergeWatchState(s3, [A, E], 7000);
check('several changes at once: 5 entries', s7.entries.length === 5);
check('several changes at once: B, C, D removed and E added', entry(s7, B.mint)?.removedTs === 7000 && entry(s7, C.mint)?.removedTs === 7000 && entry(s7, D.mint)?.removedTs === 7000 && entry(s7, E.mint)?.firstSeenTs === 7000 && entry(s7, E.mint)?.addedAfterBaseline === true);

check('findNewMints with no state returns all', JSON.stringify(findNewMints(null, [A.mint, B.mint])) === JSON.stringify([A.mint, B.mint]));
check('findNewMints returns only unknown mints', JSON.stringify(findNewMints(s3, [A.mint, 'MintXXXX'])) === JSON.stringify(['MintXXXX']));
check('findNewMints treats removed entries as known', findNewMints(s4, [B.mint]).length === 0);
check('findNewMints removes duplicates', JSON.stringify(findNewMints(null, ['m1', 'm1', 'm2'])) === JSON.stringify(['m1', 'm2']));

check('isWatchState accepts a real state', isWatchState(s3));
check('isWatchState accepts a JSON round trip', isWatchState(JSON.parse(JSON.stringify(s4))));
check('isWatchState accepts an empty entries list', isWatchState({ baselineTs: 1, lastCheckedTs: 2, entries: [] }));
check('isWatchState rejects null', !isWatchState(null));
check('isWatchState rejects a string', !isWatchState('x'));
check('isWatchState rejects an empty object', !isWatchState({}));
check('isWatchState rejects entries that are not an array', !isWatchState({ baselineTs: 1, lastCheckedTs: 2, entries: 'nope' }));
check('isWatchState rejects an entry missing removedTs', !isWatchState({ baselineTs: 1, lastCheckedTs: 2, entries: [{ mint: 'm', symbol: 's', firstSeenTs: 1, addedAfterBaseline: false }] }));
check('isWatchState rejects a NaN timestamp', !isWatchState({ baselineTs: 1, lastCheckedTs: NaN, entries: [] }));
check('isWatchState rejects a non-boolean flag', !isWatchState({ baselineTs: 1, lastCheckedTs: 2, entries: [{ mint: 'm', symbol: 's', firstSeenTs: 1, addedAfterBaseline: 'yes', removedTs: null }] }));

console.log('');
console.log(passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exitCode = 1;
