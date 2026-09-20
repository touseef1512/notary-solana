import { buildDigestFacts, buildTemplateDigest, isEchoOfFacts, DigestInput } from "../lib/wallet-digest";

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
const template = buildTemplateDigest(facts);

check("(1) the template itself counts as an echo", isEchoOfFacts(template, facts));
check("(2) the template on one line counts as an echo", isEchoOfFacts(template.replace(/\n+/g, " "), facts));

const rewrite = "You hold a tiny amount of NVDAx, worth less than $0.01. Your loan 7BAC...UYmV has $363.30 deposited and $109.53 borrowed, with a health factor of 1.33. Even after the weekend price gap we last observed, it stays at 1.31, above the 1.20 warning level. A public record of this check was written on Solana devnet about 4.4 hours ago. This is a point-in-time snapshot and not investment, legal or tax advice.";
check("(3) a genuine rewrite is not an echo", !isEchoOfFacts(rewrite, facts));
check("(4) empty text is not an echo", !isEchoOfFacts("", facts));

if (failed) process.exitCode = 1;
