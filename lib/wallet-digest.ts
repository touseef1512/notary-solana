export interface DigestHolding {
  symbol: string;
  balance: number;
  value: number | null;
}

export interface DigestObligation {
  obligationPubkey: string;
  depositedValueUsd: number | null;
  borrowedValueUsd: number | null;
  currentHealthFactor: number | null;
  gapStressedHealthFactor: number | null;
  worstAssetSymbol: string | null;
  attestationExists: boolean | null;
  attestationAgeHours: number | null;
}

export interface DigestInput {
  holdings: DigestHolding[];
  kaminoStatus: "ok" | "unavailable";
  obligations: DigestObligation[];
}

function formatMoney(value: number | null): string {
  if (value === null) return "could not be read";
  if (value > 0 && value < 0.01) return "less than $0.01";
  return "$" + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatHoldingValue(value: number | null): string {
  if (value === null) return "value could not be priced";
  if (value > 0 && value < 0.01) return "less than $0.01";
  return "$" + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatBalance(value: number): string {
  if (value > 0 && value < 0.0001) return "less than 0.0001";
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function formatRatio(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatHours(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function buildDigestFacts(input: DigestInput): string[] {
  const facts: string[] = [];

  if (input.holdings.length === 0) {
    facts.push("No supported tokenized stocks were found in this wallet.");
  } else {
    const holdingsStr = input.holdings.map(h => `${h.symbol} (balance ${formatBalance(h.balance)}, value ${formatHoldingValue(h.value)})`).join(", ");
    facts.push(`This wallet holds ${input.holdings.length} supported tokenized stock(s): ${holdingsStr}.`);
  }

  if (input.kaminoStatus === "unavailable") {
    facts.push("Loan positions could not be checked right now, so nothing is said here about loans.");
  } else {
    if (input.obligations.length === 0) {
      facts.push("No Kamino loans were found for this wallet.");
    } else {
      for (let i = 0; i < input.obligations.length; i++) {
        const o = input.obligations[i];
        const name = o.obligationPubkey.substring(0, 4) + "..." + o.obligationPubkey.substring(o.obligationPubkey.length - 4);
        
        facts.push(`Loan ${name} has a deposited value of ${formatMoney(o.depositedValueUsd)} and a borrowed value of ${formatMoney(o.borrowedValueUsd)}.`);
        
        if (o.currentHealthFactor === null) {
          facts.push(`For loan ${name}, the current health factor is not available.`);
        } else {
          facts.push(`For loan ${name}, the current health factor is ${formatRatio(o.currentHealthFactor)}. A value above 1.00 means the loan is not currently liquidatable.`);
        }

        if (o.gapStressedHealthFactor === null) {
          facts.push("The stressed check could not be computed.");
        } else if (o.gapStressedHealthFactor < 1.00) {
          facts.push(`After the weekend price gap last observed, this loan would be past its liquidation line (health factor ${formatRatio(o.gapStressedHealthFactor)}).`);
        } else if (o.gapStressedHealthFactor < 1.20) {
          facts.push(`After the weekend price gap last observed, this loan would be close to its liquidation line (health factor ${formatRatio(o.gapStressedHealthFactor)}).`);
        } else {
          facts.push(`After the weekend price gap last observed, this loan stays above 1.20 (health factor ${formatRatio(o.gapStressedHealthFactor)}), so no warning is raised.`);
        }

        if (o.worstAssetSymbol !== null) {
          facts.push(`The collateral asset with the least room is ${o.worstAssetSymbol}.`);
        }

        if (o.attestationExists === true && o.attestationAgeHours !== null) {
          let s = `A public on-chain record of this check exists on Solana devnet and was written about ${formatHours(o.attestationAgeHours)} hours ago.`;
          if (o.attestationAgeHours > 24) {
            s += " That is older than 24 hours.";
          }
          facts.push(s);
        } else if (o.attestationExists === false) {
          facts.push("No public on-chain record has been published for this loan.");
        } else {
          facts.push("Whether a public on-chain record exists could not be checked right now.");
        }
      }
    }
  }

  facts.push("This is a point-in-time snapshot and not investment, legal or tax advice.");

  return facts;
}

export function buildTemplateDigest(facts: string[]): string {
  return facts.join("\n\n");
}

export function buildDigestPrompt(facts: string[]): string {
  const instructions = "Rewrite these facts as a short friendly summary for someone with no technical background, at most 120 words, plain sentences only (no markdown, no bullet points, no numbered lists, no headings), use ONLY information present in the facts, every number must appear exactly as written in the facts, add no advice, no predictions and no opinions, keep the closing not-advice sentence. Do not copy the facts sentence by sentence: combine them into a few flowing sentences in your own words.";
  return instructions + "\n" + facts.join("\n");
}

export function stripThinking(text: string): string {
  let result = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  const unclosed = result.indexOf('<think>');
  if (unclosed !== -1) {
    result = result.substring(0, unclosed);
  }
  return result.trim();
}

export function isDigestTextSafe(candidate: string, facts: string[]): boolean {
  const trimmed = candidate.trim();
  if (trimmed === "" || trimmed.length > 1200) return false;
  if (/\b(buy|sell|invest|invests|investing|recommend|recommends|should)\b/i.test(trimmed)) return false;

  const extractNumbers = (text: string) => {
    const noCommas = text.replace(/,/g, '');
    const matches = noCommas.match(/\d+(?:\.\d+)?/g);
    return matches ? matches.map(Number) : [];
  };

  const candidateNumbers = extractNumbers(candidate);
  const factsText = facts.join(" ");
  const factsNumbers = extractNumbers(factsText);

  for (let i = 0; i < candidateNumbers.length; i++) {
    const num = candidateNumbers[i];
    if (!factsNumbers.includes(num)) {
      return false;
    }
  }

  return true;
}

export function isEchoOfFacts(candidate: string, facts: string[]): boolean {
  const norm = (t: string) => t.replace(/\s+/g, ' ').trim().toLowerCase();
  const text = norm(candidate);
  const body = facts.slice(0, facts.length - 1);
  if (body.length === 0) return false;
  if (text === norm(facts.join(' '))) return true;
  let verbatim = 0;
  for (let i = 0; i < body.length; i++) {
    if (text.includes(norm(body[i]))) verbatim++;
  }
  return verbatim >= Math.ceil(body.length * 0.7);
}
