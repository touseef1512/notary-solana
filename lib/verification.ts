import { KnownAsset } from './known-assets';
import { DividendRecord } from './market-data';
import { getScaledUiAmountConfig } from './solana';

export interface VerificationResult {
  timingMatch: boolean;
  expectedPct: number;
  actualPct: number;
  discrepancy: number;
  verdict: string;
  raw: {
    dividendAmount: number;
    exDividendDate: string;
    referencePrice: number;
    referenceDate: string;
    multiplier: number;
    newMultiplier: number;
    effectiveTimestamp: number;
  };
}

export function classifyDiscrepancy(discrepancy: number, timingMatch: boolean): string {
  if (!timingMatch) {
    return 'Timing Mismatch';
  }
  if (discrepancy >= 0 && discrepancy <= 0.05) {
    return 'matches expected yield, no withholding signal detected';
  } else if (discrepancy >= 0.25 && discrepancy <= 0.35) {
    return 'consistent with US 30% withholding tax on dividend';
  }
  return 'unexplained discrepancy — flag for review';
}

export function getDiscrepancyBucket(verdict: string): 'explained-no-tax' | 'explained-withholding-tax' | 'unexplained' {
  if (verdict === 'matches expected yield, no withholding signal detected') return 'explained-no-tax';
  if (verdict === 'consistent with US 30% withholding tax on dividend') return 'explained-withholding-tax';
  return 'unexplained';
}

export async function verifyDividendEvent(
  asset: KnownAsset, 
  referencePrice: number,
  referenceDate: string,
  latestDividend: DividendRecord
): Promise<VerificationResult | null> {
  // Pull scaled config
  const config = await getScaledUiAmountConfig(asset.mintAddress);
  if (!config) {
    throw new Error(`Asset ${asset.symbol} is missing scaledUiAmountConfig`);
  }

  if (config.multiplier === config.newMultiplier) {
    console.warn(`[WARNING] Cannot verify ${asset.symbol} from live state: config already settled (multiplier === newMultiplier).`);
    return null;
  }

  // Timing check
  const exDivDate = new Date(latestDividend.ex_dividend_date);
  const effectiveDate = new Date(config.newMultiplierEffectiveTimestamp * 1000);
  
  const diffTime = Math.abs(effectiveDate.getTime() - exDivDate.getTime());
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  const timingMatch = diffDays <= 2; // Allow +/- 2 days

  // Magnitude check
  const actualPct = (config.newMultiplier / config.multiplier) - 1;
  const expectedPct = latestDividend.amount / referencePrice;
  
  const discrepancy = Math.abs(expectedPct - actualPct) / expectedPct;
  
  const verdict = classifyDiscrepancy(discrepancy, timingMatch);

  return {
    timingMatch,
    expectedPct,
    actualPct,
    discrepancy,
    verdict,
    raw: {
      dividendAmount: latestDividend.amount,
      exDividendDate: latestDividend.ex_dividend_date,
      referencePrice,
      referenceDate,
      multiplier: config.multiplier,
      newMultiplier: config.newMultiplier,
      effectiveTimestamp: config.newMultiplierEffectiveTimestamp
    }
  };
}
