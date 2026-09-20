import { buildDigestFacts, isDigestTextSafe, DigestInput } from "../lib/wallet-digest";

let failed = false;
function check(name: string, ok: boolean) {
  console.log((ok ? "PASS" : "FAIL") + ": " + name);
  if (!ok) failed = true;
}

const input: DigestInput = {
  holdings: [{ symbol: "NVDAx", balance: 0.00000001, value: 0.0000022 }],
  kaminoStatus: "ok",
  obligations: [
    { obligationPubkey: "7BACsXdze3FporEnXEbuSHStPPQ58tpZuWb7jgsUYmV", depositedValueUsd: 363.3, borrowedValueUsd: 109.53, currentHealthFactor: 1.3267, gapStressedHealthFactor: 1.3111, worstAssetSymbol: "NVDAx", attestationExists: true, attestationAgeHours: 4.4 },
  ],
};

const facts = buildDigestFacts(input);
const clean = "Loan 7BAC...UYmV has $363.30 deposited and $109.53 borrowed, and its health factor is 1.33.";

check("(1) a clean sentence using only fact numbers is accepted", isDigestTextSafe(clean, facts));
check("(2) saying the loan remains safe is rejected", !isDigestTextSafe(clean + " The loan remains safe.", facts));
check("(3) saying safely is rejected", !isDigestTextSafe("The loan is holding up safely with a health factor of 1.33.", facts));
check("(4) saying risk-free is rejected", !isDigestTextSafe(clean + " It is risk-free.", facts));
check("(5) the collateral sentence names its loan", facts.some((f) => f.indexOf("least room in loan 7BAC...UYmV") !== -1));

if (failed) process.exitCode = 1;
