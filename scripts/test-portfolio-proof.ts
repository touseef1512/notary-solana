import { createHash } from "crypto";
import { buildPortfolioProof, numberOrNull, ProofInput } from "../lib/portfolio-proof";

let failed = false;
function check(name: string, ok: boolean) {
  console.log((ok ? "PASS" : "FAIL") + ": " + name);
  if (!ok) failed = true;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getPath(root: unknown, keys: string[]): unknown {
  let cur: unknown = root;
  for (let i = 0; i < keys.length; i++) {
    if (Array.isArray(cur)) {
      cur = cur[Number(keys[i])];
    } else if (isRecord(cur)) {
      cur = cur[keys[i]];
    } else {
      return undefined;
    }
  }
  return cur;
}

const when = new Date("2026-09-19T12:00:00Z");

const baseInput: ProofInput = {
  walletAddress: "Fa7LNzj3SCV364hya9dx9evL29pC1awx24iHeCEwX6vU",
  holdings: [
    { symbol: "AAPLx", name: "Apple xStock", issuer: "xStocks", mintAddress: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp", underlyingTicker: "AAPL", balance: 2.5, price: null, value: null },
  ],
  exposure: [
    { ticker: "AAPL", heldVia: ["AAPLx"], issuerCount: 1, combinedBalance: 2.5, combinedValue: null },
  ],
  kaminoStatus: "ok",
  obligations: [
    { obligationPubkey: "7BACsXdze3FporEnXEbuSHStPPQ58tpZuWb7jgsUYmV", depositedValueUsd: 300, borrowedValueUsd: 100, currentHealthFactor: 1.3, gapStressedHealthFactor: 1.2, worstAssetSymbol: "NVDAx", attestation: { exists: true, attestationPda: "BsBAVg1C8hFfGjz7NxgrCBZAUNzmFkoGd7M4v71FsFSq", computedAtUnixTs: 1789800000, gapStressedHealthFactorBps: 12000 } },
    { obligationPubkey: "7CVz2GhYLE7U568LrY4pyFocmnLpSwScBQGXmNrpbzH8", depositedValueUsd: 1300, borrowedValueUsd: 250, currentHealthFactor: 3.9, gapStressedHealthFactor: 3.9, worstAssetSymbol: "SPYx", attestation: { exists: false, attestationPda: null, computedAtUnixTs: null, gapStressedHealthFactorBps: null } },
    { obligationPubkey: "A2bA2dPZkSBHjZsBT4CiKTnnTpNZvmQypgQYUiMbDQ2A", depositedValueUsd: null, borrowedValueUsd: null, currentHealthFactor: null, gapStressedHealthFactor: null, worstAssetSymbol: null, attestation: { exists: null, attestationPda: null, computedAtUnixTs: null, gapStressedHealthFactorBps: null } },
  ],
};

// (1) numberOrNull
check("(1) numberOrNull", numberOrNull(5) === 5 && numberOrNull("12") === 12 && numberOrNull("Insufficient Data") === null && numberOrNull(NaN) === null && numberOrNull(undefined) === null && numberOrNull("") === null);

// (2) determinism
const r1 = buildPortfolioProof(baseInput, when);
const r2 = buildPortfolioProof(baseInput, when);
check("(2) same input gives identical content and sha256", r1.content === r2.content && r1.sha256 === r2.sha256);
check("(2b) sha256 matches an independent hash of the content", r1.sha256 === createHash("sha256").update(r1.content, "utf8").digest("hex"));

// (3) changed balance changes the hash
const changed: ProofInput = { ...baseInput, holdings: [{ ...baseInput.holdings[0], balance: 2.6 }] };
check("(3) changing a balance changes the sha256", buildPortfolioProof(changed, when).sha256 !== r1.sha256);

// (4) valid JSON, trailing newline
const parsed: unknown = JSON.parse(r1.content);
check("(4) content is valid JSON ending with a newline", isRecord(parsed) && r1.content.endsWith("\n"));

// (5) null price and value stay null
check("(5) null price and value stay null (never 0)", getPath(parsed, ["tokenizedStockHoldings", "items", "0", "price"]) === null && getPath(parsed, ["tokenizedStockHoldings", "items", "0", "value"]) === null);

// (6) unavailable Kamino status
const unavailableInput: ProofInput = { ...baseInput, kaminoStatus: "unavailable" };
const unavailable: unknown = JSON.parse(buildPortfolioProof(unavailableInput, when).content);
const unavailItems = getPath(unavailable, ["kaminoObligations", "items"]);
check("(6) unavailable status gives empty items and status unavailable", getPath(unavailable, ["kaminoObligations", "status"]) === "unavailable" && Array.isArray(unavailItems) && unavailItems.length === 0);

// (7) no attestation
check("(7) obligation without attestation has explorerUrl null and a publicApiUrl ending with its pubkey", getPath(parsed, ["kaminoObligations", "items", "1", "attestation", "explorerUrl"]) === null && String(getPath(parsed, ["kaminoObligations", "items", "1", "attestation", "publicApiUrl"])).endsWith("7CVz2GhYLE7U568LrY4pyFocmnLpSwScBQGXmNrpbzH8"));

// (8) filename
check("(8) filename format", /^notary-portfolio-proof-[A-Za-z0-9]{8}-\d{8}\.json$/.test(r1.filename));

// (9) lookup failure stays null, not false
check("(9) failed attestation lookup keeps exists null", getPath(parsed, ["kaminoObligations", "items", "2", "attestation", "exists"]) === null);

// (10) age computed
check("(10) age at generation is a number for the attested obligation", typeof getPath(parsed, ["kaminoObligations", "items", "0", "attestation", "ageHoursAtGeneration"]) === "number");

if (failed) process.exitCode = 1;
