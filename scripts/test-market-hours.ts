import { getMarketStatus } from "../lib/market-hours";

const cases = [
  { time: "2026-09-19T14:00:00Z", open: false, mins: 2850 },
  { time: "2026-09-21T14:00:00Z", open: true, mins: 360 },
  { time: "2026-09-18T21:00:00Z", open: false, mins: 3870 },
  { time: "2026-09-18T19:59:00Z", open: true, mins: 1 },
  { time: "2026-09-18T20:00:00Z", open: false, mins: undefined }
];

let failed = false;

for (let i = 0; i < cases.length; i++) {
  const c = cases[i];
  const d = new Date(c.time);
  const res = getMarketStatus(d);
  
  if (res.isOpen !== c.open) {
    console.error(`FAIL: ${c.time} expected open ${c.open}, got ${res.isOpen}`);
    failed = true;
  } else if (c.mins !== undefined && res.minutesUntilChange !== c.mins) {
    console.error(`FAIL: ${c.time} expected mins ${c.mins}, got ${res.minutesUntilChange}`);
    failed = true;
  } else {
    console.log(`PASS: ${c.time}`);
  }
}

if (failed) {
  process.exit(1);
}
