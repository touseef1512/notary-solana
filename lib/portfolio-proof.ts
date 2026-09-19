import { createHash } from 'crypto';

export const PROOF_BASE_URL = "https://notary-solana.vercel.app";

export function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export interface ProofHoldingInput {
  symbol: string;
  name: string;
  issuer: string;
  mintAddress: string;
  underlyingTicker: string;
  balance: number;
  price: number | null;
  value: number | null;
}

export interface ProofExposureInput {
  ticker: string;
  heldVia: string[];
  issuerCount: number;
  combinedBalance: number;
  combinedValue: number | null;
}

export interface ProofObligationInput {
  obligationPubkey: string;
  depositedValueUsd: number | null;
  borrowedValueUsd: number | null;
  currentHealthFactor: number | null;
  gapStressedHealthFactor: number | null;
  worstAssetSymbol: string | null;
  attestation: {
    exists: boolean | null;
    attestationPda: string | null;
    computedAtUnixTs: number | null;
    gapStressedHealthFactorBps: number | null;
  };
}

export interface ProofInput {
  walletAddress: string;
  holdings: ProofHoldingInput[];
  exposure: ProofExposureInput[];
  kaminoStatus: "ok" | "unavailable";
  obligations: ProofObligationInput[];
}

export function buildPortfolioProof(input: ProofInput, generatedAt: Date): { filename: string; content: string; sha256: string } {
  const statement = {
    statementVersion: 1,
    generatedAt: generatedAt.toISOString(),
    subject: {
      walletAddress: input.walletAddress,
    },
    verification: {
      publicApi: PROOF_BASE_URL + "/api/v1/attestation/<obligation> returns the current on-chain attestation for any obligation listed below",
      registry: PROOF_BASE_URL + "/api/v1/registry",
      howToCheck: [
        "compare each attestationPda on the Solana explorer (devnet)",
        "compare each obligation against the public API",
        "compare the SHA-256 shown next to the download with the output of sha256sum on this file"
      ]
    },
    tokenizedStockHoldings: {
      source: "Solana mainnet token accounts; prices from Notary market data at generation time",
      items: input.holdings
    },
    exposureByCompany: input.exposure,
    kaminoObligations: {
      status: input.kaminoStatus,
      items: input.kaminoStatus === "unavailable" ? [] : input.obligations.map(ob => {
        let ageHoursAtGeneration: number | null = null;
        let computedAtStr: string | null = null;
        if (ob.attestation.computedAtUnixTs !== null) {
          computedAtStr = new Date(ob.attestation.computedAtUnixTs * 1000).toISOString();
          ageHoursAtGeneration = Math.round(((generatedAt.getTime() / 1000) - ob.attestation.computedAtUnixTs) / 3600 * 10) / 10;
        }

        return {
          obligationPubkey: ob.obligationPubkey,
          depositedValueUsd: ob.depositedValueUsd,
          borrowedValueUsd: ob.borrowedValueUsd,
          currentHealthFactor: ob.currentHealthFactor,
          gapStressedHealthFactor: ob.gapStressedHealthFactor,
          worstAssetSymbol: ob.worstAssetSymbol,
          attestation: {
            exists: ob.attestation.exists,
            attestationPda: ob.attestation.attestationPda,
            explorerUrl: ob.attestation.attestationPda ? "https://explorer.solana.com/address/" + ob.attestation.attestationPda + "?cluster=devnet" : null,
            publicApiUrl: PROOF_BASE_URL + "/api/v1/attestation/" + ob.obligationPubkey,
            computedAt: computedAtStr,
            ageHoursAtGeneration,
            gapStressedHealthFactorBps: ob.attestation.gapStressedHealthFactorBps
          }
        };
      })
    },
    integrity: {
      algorithm: "SHA-256",
      note: "The fingerprint is shown in the app beside the download, not inside this file. It detects later edits to the file. It is not a digital signature and does not prove that Notary issued the file."
    },
    caveats: [
      "Point-in-time snapshot; values change.",
      "Gap-stressed health factors use a fixed per-symbol shock table, not live weekend-gap data.",
      "Attestations are on Solana devnet; holdings and Kamino positions are read from mainnet.",
      "Not investment, legal or tax advice."
    ]
  };

  const content = JSON.stringify(statement, null, 2) + "\n";
  const sha256 = createHash("sha256").update(content, "utf8").digest("hex");
  
  const iso = generatedAt.toISOString();
  const dateStr = iso.substring(0, 10).replace(/-/g, "");
  
  const filename = "notary-portfolio-proof-" + input.walletAddress.substring(0, 8) + "-" + dateStr + ".json";

  return { filename, content, sha256 };
}
