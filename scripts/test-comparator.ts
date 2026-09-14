import { generateSettlementComparison } from '../lib/comparator';

function run() {
  // Test 1: Normal weekday event
  // 2026-09-09 is a Wednesday. Should settle Friday 2026-09-11
  console.log("=== TEST 1: Normal Weekday ===");
  const test1 = generateSettlementComparison("2026-09-09", "dividend");
  console.log(JSON.stringify(test1, null, 2));
  
  // Test 2: Weekend event before a holiday
  // 2026-09-05 is a Saturday.
  // Next Monday (2026-09-07) is Labor Day (US market holiday).
  // Next business day is Tuesday (2026-09-08), which becomes T+0.
  // T+1 is Wed (09-09), T+2 is Thu (09-10).
  console.log("\n=== TEST 2: Weekend / Holiday Skip ===");
  const test2 = generateSettlementComparison("2026-09-05", "split");
  console.log(JSON.stringify(test2, null, 2));

  // Test 3: Event exactly on a holiday
  // 2026-11-26 is Thanksgiving Thursday
  // Next business day is Friday (11-27) T+0.
  // T+1 is Monday (11-30).
  // T+2 is Tuesday (12-01).
  console.log("\n=== TEST 3: Holiday Event ===");
  const test3 = generateSettlementComparison("2026-11-26", "dividend");
  console.log(JSON.stringify(test3, null, 2));
}

run();
