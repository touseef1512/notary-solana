import { createHash } from 'crypto';
import { ProofInput, buildPortfolioProofObject } from './portfolio-proof';
import { getParityAssets } from './parity-assets';
import { generateTaxCsv } from './tax-export';

export interface TaxEntryInput {
  assetMintAddress: string;
  purchaseDate: string;
  purchasePrice: number;
  shares: number;
}

export interface StatementInput extends ProofInput {
  taxEntries?: TaxEntryInput[];
}

export function buildPlainLanguageSummary(input: StatementInput, totalNetDividends: number | null): string {
  let totalValue = 0;
  let hasValidValue = false;
  const assetSet = new Set<string>();

  for (let i = 0; i < input.holdings.length; i++) {
    const h = input.holdings[i];
    assetSet.add(h.mintAddress);
    if (typeof h.value === 'number') {
      totalValue += h.value;
      hasValidValue = true;
    }
  }

  const lines: string[] = [];
  const valueStr = hasValidValue ? `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Insufficient Data';
  lines.push(`This portfolio contains ${assetSet.size} distinct tokenized assets with an estimated total value of ${valueStr}.`);

  if (input.kaminoStatus === "ok") {
    for (let i = 0; i < input.obligations.length; i++) {
      const ob = input.obligations[i];
      if (typeof ob.gapStressedHealthFactor === 'number') {
        let statusWord = "";
        if (ob.gapStressedHealthFactor >= 1.5) {
          statusWord = "healthy";
        } else if (ob.gapStressedHealthFactor >= 1.2) {
          statusWord = "worth watching";
        } else if (ob.gapStressedHealthFactor >= 1.0) {
          statusWord = "warning";
        } else {
          statusWord = "critical";
        }
        const assetName = ob.worstAssetSymbol ?? "obligation";
        lines.push(`${assetName} loan position: gap-stressed health ${ob.gapStressedHealthFactor.toFixed(2)} \u2014 ${statusWord}.`);
      }
    }
  }

  if (input.taxEntries && input.taxEntries.length > 0) {
    const totalNet = totalNetDividends ?? 0;
    lines.push(`Tax details are included, with an estimated $${totalNet.toFixed(2)} in total net dividends received across these holdings.`);
  } else {
    lines.push("Add your purchase price and share count for each holding to include tax details in a future statement.");
  }

  return lines.join(" ");
}

export async function buildUnifiedStatement(input: StatementInput, generatedAt: Date): Promise<{ filename: string; content: string; sha256: string }> {
  const taxSummary: { status: string; items: { assetSymbol: string; csv?: string; error?: string }[] } = {
    status: (input.taxEntries && input.taxEntries.length > 0) ? "provided" : "not provided",
    items: []
  };

  let computedTotalNet = 0;

  if (input.taxEntries && input.taxEntries.length > 0) {
    for (let i = 0; i < input.taxEntries.length; i++) {
      const entry = input.taxEntries[i];
      const asset = getParityAssets().find((a) => a.mintAddress === entry.assetMintAddress);
      if (!asset) {
        taxSummary.items.push({ assetSymbol: "Unknown", error: "Insufficient Data" });
        continue;
      }

      try {
        const csv = await generateTaxCsv(asset, { purchaseDate: entry.purchaseDate, purchasePrice: entry.purchasePrice, shares: entry.shares });
        taxSummary.items.push({ assetSymbol: asset.symbol, csv });
        
        const lines = csv.split('\n');
        for (let j = 0; j < lines.length; j++) {
          if (lines[j].startsWith('Total,')) {
            const parts = lines[j].split(',');
            if (parts.length > 4) {
              const net = parseFloat(parts[4]);
              if (!isNaN(net)) computedTotalNet += net;
            }
            break;
          }
        }
      } catch {
        taxSummary.items.push({ assetSymbol: asset.symbol, error: "Insufficient Data" });
      }
    }
  }

  const baseObject = buildPortfolioProofObject(input, generatedAt);
  const plainLanguageSummary = buildPlainLanguageSummary(input, input.taxEntries?.length ? computedTotalNet : null);

  const combinedObject = {
    plainLanguageSummary,
    ...baseObject,
    taxSummary
  };

  const content = JSON.stringify(combinedObject, null, 2) + "\n";
  const sha256 = createHash("sha256").update(content, "utf8").digest("hex");
  
  const iso = generatedAt.toISOString();
  const dateStr = iso.substring(0, 10).replace(/-/g, "");
  const filename = "notary-statement-" + input.walletAddress.substring(0, 8) + "-" + dateStr + ".json";

  return { filename, content, sha256 };
}
