import { summarizeHistory } from '../lib/history-types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
    return false;
  }
  return true;
}

const cases = [
  // (1)
  () => {
    const res = summarizeHistory([]);
    let pass = true;
    pass = pass && assert(res.count === 0, 'c1 count');
    pass = pass && assert(res.firstTs === null, 'c1 firstTs');
    pass = pass && assert(res.trustScoreChange === null, 'c1 tsc');
    pass = pass && assert(res.backingRatioChangePoints === null, 'c1 brcp');
    if (pass) console.log('PASS: (1) empty array');
  },
  // (2)
  () => {
    const res = summarizeHistory([{ ts: 100, trustScore: 90, backingRatio: 1 }]);
    let pass = true;
    pass = pass && assert(res.count === 1, 'c2 count');
    pass = pass && assert(res.firstTs === 100, 'c2 firstTs');
    pass = pass && assert(res.trustScoreChange === null, 'c2 tsc');
    pass = pass && assert(res.backingRatioChangePoints === null, 'c2 brcp');
    if (pass) console.log('PASS: (2) one snapshot');
  },
  // (3)
  () => {
    const res = summarizeHistory([
      { ts: 100, trustScore: 90, backingRatio: 1.0000 },
      { ts: 200, trustScore: 92, backingRatio: 1.0003 }
    ]);
    let pass = true;
    pass = pass && assert(res.count === 2, 'c3 count');
    pass = pass && assert(res.trustScoreChange === 2, 'c3 tsc');
    pass = pass && assert(res.backingRatioChangePoints !== null && Math.abs(res.backingRatioChangePoints - 0.03) < 0.0001, 'c3 brcp');
    if (pass) console.log('PASS: (3) two snapshots');
  },
  // (4)
  () => {
    const res = summarizeHistory([
      { ts: 100, trustScore: 80, backingRatio: 0.99 },
      { ts: 200, trustScore: null, backingRatio: null },
      { ts: 300, trustScore: 85, backingRatio: 1.01 }
    ]);
    let pass = true;
    pass = pass && assert(res.count === 3, 'c4 count');
    pass = pass && assert(res.trustScoreChange === 5, 'c4 tsc');
    pass = pass && assert(res.backingRatioChangePoints !== null && Math.abs(res.backingRatioChangePoints - 2) < 0.0001, 'c4 brcp');
    if (pass) console.log('PASS: (4) middle has nulls');
  },
  // (5)
  () => {
    const res = summarizeHistory([
      { ts: 100, trustScore: 80, backingRatio: 1.0 },
      { ts: 200, trustScore: null, backingRatio: 1.01 }
    ]);
    let pass = true;
    pass = pass && assert(res.trustScoreChange === null, 'c5 tsc');
    pass = pass && assert(res.backingRatioChangePoints !== null, 'c5 brcp');
    if (pass) console.log('PASS: (5) only one non-null trustScore');
  },
  // (6)
  () => {
    const res = summarizeHistory([
      { ts: 100, trustScore: NaN, backingRatio: 1.0 },
      { ts: 200, trustScore: 80, backingRatio: 1.01 }
    ]);
    let pass = true;
    pass = pass && assert(res.trustScoreChange === null, 'c6 tsc');
    pass = pass && assert(!Number.isNaN(res.trustScoreChange), 'c6 no NaN tsc');
    if (pass) console.log('PASS: (6) NaN treated as null');
  }
];

cases.forEach(c => c());
