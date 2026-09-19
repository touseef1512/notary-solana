import { KnownAsset } from './known-assets';

export interface TrustRiskProfile {
  kind: 'reserve-trust' | 'lending-risk';

  // Carries forward known data-quality caveats (e.g., circulatingSupply is global, not Solana-specific)
  caveats?: string[];

  // Common field shared by AttestationResult and TrustScoreResult
  asset?: KnownAsset;

  // --- Reserve / Trust Data ---
  // Produced by: lib/attestation.ts (getReserveAttestation -> AttestationResult)
  hasLiveAttestation?: boolean;
  classification?: string;
  attestationAgeHours?: number | null;
  backingRatio?: number | null;
  bufferPercent?: number | null;
  disclosure?: string;
  details?: Record<string, unknown> | null;

  // --- Trust Score Data ---
  // Produced by: lib/trust-score.ts (computeTrustScore -> TrustScoreResult)
  trustScore?: number | null;
  confidenceLevel?: string;
  eventsAnalyzed?: number;
  breakdown?: Array<{
    exDate: string;
    bucket: 'explained-no-tax' | 'explained-withholding-tax' | 'unexplained' | 'unverifiable';
    independentlyVerified: boolean;
    timingMatch: boolean;
  }>;

  // --- Lending Obligation Risk ---
  // Produced by: lib/kamino.ts (getKaminoPositions -> KaminoObligationData)
  obligationPubkey?: string;
  positions?: Array<{
    type: 'deposit' | 'borrow';
    reservePubkey: string;
    symbol: string;
    amount: number;
    valueUsd: number;
  }>;
  depositedValue?: number;
  borrowedValue?: number;
  currentLtv?: number;
  liquidationLtvThreshold?: number;
  currentHealth?: number | 'Insufficient Data';
  worstAssetSymbol?: string | null;
  worstDrawdownValue?: number | null;

  // --- Derived Risk Math Metrics ---
  // Produced by: lib/risk-math.ts (computeSurvivableDrawdown)
  survivableDrawdowns?: Record<string, number | "Insufficient Data">;
  // Produced by: lib/risk-math.ts (computeGapStressedHealthFactor)
  gapStressedHealthFactor?: number | "Insufficient Data";
}

export async function buildAssetTrustRiskProfile(asset: KnownAsset): Promise<TrustRiskProfile> {
  const { getReserveAttestation } = await import('./attestation');
  const { computeTrustScore } = await import('./trust-score');

  const [attestation, trustScoreResult] = await Promise.all([
    getReserveAttestation(asset),
    computeTrustScore(asset),
  ]);

  const caveats: string[] = [];
  if (attestation.hasLiveAttestation) {
    caveats.push('Reserve ratio is computed against the issuer\'s GLOBAL circulating supply across all chains, not Solana-specific.');
  }

  return {
    kind: 'reserve-trust',
    asset,
    caveats,
    hasLiveAttestation: attestation.hasLiveAttestation,
    classification: attestation.classification,
    attestationAgeHours: attestation.attestationAgeHours,
    backingRatio: attestation.backingRatio,
    bufferPercent: attestation.bufferPercent,
    disclosure: attestation.disclosure,
    details: attestation.details,
    trustScore: trustScoreResult.trustScore,
    confidenceLevel: trustScoreResult.confidenceLevel,
    eventsAnalyzed: trustScoreResult.eventsAnalyzed,
    breakdown: trustScoreResult.breakdown,
  };
}

export function buildLendingRiskProfile(obligation: {
  obligationPubkey: string;
  positions: Array<{ type: 'deposit' | 'borrow'; reservePubkey: string; symbol: string; amount: number; valueUsd: number }>;
  depositedValue: number;
  borrowedValue: number;
  currentLtv: number;
  liquidationLtvThreshold: number;
  currentHealth: number | 'Insufficient Data';
  drawdowns: Record<string, number | 'Insufficient Data'>;
  worstAssetSymbol: string | null;
  worstDrawdownValue: number | null;
  gapStressedHealth: number | 'Insufficient Data';
}): TrustRiskProfile {
  const caveats: string[] = [
    'Gap-stressed health factor uses a fixed, hardcoded per-symbol shock assumption table, not live or historical weekend-gap data.',
  ];

  return {
    kind: 'lending-risk',
    caveats,
    obligationPubkey: obligation.obligationPubkey,
    positions: obligation.positions,
    depositedValue: obligation.depositedValue,
    borrowedValue: obligation.borrowedValue,
    currentLtv: obligation.currentLtv,
    liquidationLtvThreshold: obligation.liquidationLtvThreshold,
    currentHealth: obligation.currentHealth,
    worstAssetSymbol: obligation.worstAssetSymbol,
    worstDrawdownValue: obligation.worstDrawdownValue,
    survivableDrawdowns: obligation.drawdowns,
    gapStressedHealthFactor: obligation.gapStressedHealth,
  };
}
