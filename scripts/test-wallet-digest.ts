import { buildDigestFacts, isDigestTextSafe, stripThinking } from "../lib/wallet-digest";

let failed = false;

function assert(condition: boolean, caseName: string) {
  if (condition) {
    console.log(`PASS: ${caseName}`);
  } else {
    console.error(`FAIL: ${caseName}`);
    failed = true;
  }
}

function checkBannedWords(facts: string[]): boolean {
  return !facts.some(f => /\b(buy|sell|invest|invests|investing|recommend|recommends|should)\b/i.test(f));
}

// Case 1
const facts1 = buildDigestFacts({ holdings: [], kaminoStatus: "unavailable", obligations: [] });
assert(
  facts1.some(f => f.includes("could not be checked right now, so nothing is said here about loans")) &&
  !facts1.some(f => f.includes("No Kamino loans")),
  "Case 1: no holdings and kaminoStatus unavailable"
);
assert(checkBannedWords(facts1), "Case 6 (in Case 1)");

// Case 2
const facts2 = buildDigestFacts({ holdings: [], kaminoStatus: "ok", obligations: [] });
assert(
  facts2.some(f => f.includes("No Kamino loans were found")),
  "Case 2: kaminoStatus ok with zero obligations"
);
assert(checkBannedWords(facts2), "Case 6 (in Case 2)");

// Case 3
const obBase = {
  obligationPubkey: "1111111111111111",
  depositedValueUsd: 100,
  borrowedValueUsd: 50,
  currentHealthFactor: 2.0,
  gapStressedHealthFactor: null,
  worstAssetSymbol: null,
  attestationExists: null,
  attestationAgeHours: null,
};
const facts3a = buildDigestFacts({ holdings: [], kaminoStatus: "ok", obligations: [{ ...obBase, gapStressedHealthFactor: 0.95 }] });
const facts3b = buildDigestFacts({ holdings: [], kaminoStatus: "ok", obligations: [{ ...obBase, gapStressedHealthFactor: 1.10 }] });
const facts3c = buildDigestFacts({ holdings: [], kaminoStatus: "ok", obligations: [{ ...obBase, gapStressedHealthFactor: 1.31 }] });
assert(facts3a.some(f => f.includes("past its liquidation line")), "Case 3a: gap 0.95");
assert(facts3b.some(f => f.includes("close to its liquidation line")), "Case 3b: gap 1.10");
assert(facts3c.some(f => f.includes("stays above 1.20")), "Case 3c: gap 1.31");
assert(checkBannedWords(facts3a) && checkBannedWords(facts3b) && checkBannedWords(facts3c), "Case 6 (in Case 3)");

// Case 4
const facts4a = buildDigestFacts({ holdings: [], kaminoStatus: "ok", obligations: [{ ...obBase, gapStressedHealthFactor: 2, attestationExists: null }] });
const facts4b = buildDigestFacts({ holdings: [], kaminoStatus: "ok", obligations: [{ ...obBase, gapStressedHealthFactor: 2, attestationExists: false }] });
const facts4c = buildDigestFacts({ holdings: [], kaminoStatus: "ok", obligations: [{ ...obBase, gapStressedHealthFactor: 2, attestationExists: true, attestationAgeHours: 30 }] });
assert(facts4a.some(f => f.includes("could not be checked right now")), "Case 4a: attestationExists null");
assert(facts4b.some(f => f.includes("No public on-chain record")), "Case 4b: attestationExists false");
assert(facts4c.some(f => f.includes("older than 24 hours")), "Case 4c: attestationExists true age 30");
assert(checkBannedWords(facts4a) && checkBannedWords(facts4b) && checkBannedWords(facts4c), "Case 6 (in Case 4)");

// Case 5
const facts5 = buildDigestFacts({
  holdings: [{ symbol: "TEST", balance: 1e-8, value: null }],
  kaminoStatus: "ok",
  obligations: []
});
assert(
  facts5.some(f => f.includes("could not be priced")) &&
  !facts5.some(f => f.includes("$0.00")) &&
  facts5.some(f => f.includes("less than 0.0001")),
  "Case 5: holding value null, balance 1e-8"
);
assert(checkBannedWords(facts5), "Case 6 (in Case 5)");

// Case 7
const testFacts = ["The balance is 1234.50 and another is 1000000."];
assert(isDigestTextSafe("I have 1234.50 and 1,000,000 in my wallet.", testFacts), "Case 7a: safe text with reused numbers and commas");
assert(!isDigestTextSafe("I have 1234.51.", testFacts), "Case 7b: unsafe number");
assert(!isDigestTextSafe("you should buy 1234.50.", testFacts), "Case 7c: contains should/buy");
assert(!isDigestTextSafe("", testFacts), "Case 7d: empty text");
assert(!isDigestTextSafe("   ", testFacts), "Case 7e: whitespace only");

// Case 8
assert(stripThinking("<think>abc\ndef</think>final text") === "final text", "Case 8a: closed think block");
assert(stripThinking("start<think>abc\ndef</think>final text") === "startfinal text", "Case 8b: closed think block inside");
assert(stripThinking("start<think>abc") === "start", "Case 8c: unclosed think block");
assert(stripThinking("<think>abc") === "", "Case 8d: unclosed think block at start");

if (failed) {
  process.exitCode = 1;
}
