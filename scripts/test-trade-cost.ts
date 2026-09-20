import { parseQuote, getTradeCost, ALLOWED_USD_SIZES } from "../lib/trade-cost";

async function runTests() {
  let failed = false;

  const expectEqual = (name: string, actual: unknown, expected: unknown) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      console.error(`FAIL: ${name} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
      failed = true;
    } else {
      console.log(`PASS: ${name}`);
    }
  };

  const expectApprox = (name: string, actual: number | null, expected: number, tolerance: number = 0.00001) => {
    if (actual === null || Math.abs(actual - expected) > tolerance) {
      console.error(`FAIL: ${name} (expected ${expected}, got ${actual})`);
      failed = true;
    } else {
      console.log(`PASS: ${name}`);
    }
  };

  const f = "2023-01-01T00:00:00.000Z";

  // Case 1
  const r1 = parseQuote(200, { priceImpactPct: "0.0006008", routePlan: [{swapInfo: {label: "Raydium CLMM"}}, {swapInfo: {label: "Byreal"}}, {swapInfo: {label: "Raydium CLMM"}}] }, 100, f);
  expectEqual("case 1 status", r1.status, "ok");
  expectApprox("case 1 impact", r1.impactPercent, 0.06008);
  expectEqual("case 1 venues", r1.venues, ["Raydium CLMM", "Byreal"]);

  // Case 2
  const r2 = parseQuote(200, { priceImpactPct: "0.0451", routePlan: [] }, 100, f);
  expectApprox("case 2 impact", r2.impactPercent, 4.51);

  // Case 3
  const r3 = parseQuote(400, { error: "No routes found" }, 100, f);
  expectEqual("case 3 status", r3.status, "no_route");

  // Case 4
  const r4 = parseQuote(429, {}, 100, f);
  expectEqual("case 4 status", r4.status, "rate_limited");

  // Case 5
  const r5 = parseQuote(200, { routePlan: [] }, 100, f);
  expectEqual("case 5 status", r5.status, "unavailable");

  // Case 6
  const r6 = parseQuote(500, null, 100, f);
  expectEqual("case 6 status", r6.status, "unavailable");

  // Case 7
  const r7a = parseQuote(200, "hello", 100, f);
  expectEqual("case 7a status", r7a.status, "unavailable");
  const r7b = parseQuote(200, null, 100, f);
  expectEqual("case 7b status", r7b.status, "unavailable");

  // Case 8
  const r8 = parseQuote(200, { priceImpactPct: 0.01, routePlan: [{swapInfo: {label: "A"}}, {swapInfo: {}}, {swapInfo: {label: "B"}}] }, 100, f);
  expectEqual("case 8 venues", r8.venues, ["A", "B"]);

  // Case 9
  try {
    await getTradeCost("XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp", 555);
    console.error("FAIL: case 9 (should have thrown)");
    failed = true;
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "Unsupported trade size") {
      console.log("PASS: case 9");
    } else {
      console.error("FAIL: case 9 (wrong error)");
      failed = true;
    }
  }

  // Case 10
  expectEqual("case 10 ALLOWED_USD_SIZES", ALLOWED_USD_SIZES, [100, 1000, 10000]);

  if (failed) {
    process.exitCode = 1;
  }
}

runTests();
