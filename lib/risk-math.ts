import { KaminoObligationData } from './kamino';

/**
 * computeSurvivableDrawdown
 * 
 * Derivation of Portfolio Survivable Drawdown:
 * Let D = total deposited value, B = total borrowed value, T = liquidation threshold.
 * At liquidation, the new deposit value D' satisfies B / D' = T => D' = B / T.
 * The entire portfolio must drop by a fraction X such that D' = D * (1 - X).
 * Therefore, D * (1 - X) = B / T 
 * 1 - X = (B / T) / D 
 * X = 1 - (B / T) / D
 * 
 * To find the % price drop X_i for a specific asset i (with deposited value D_i) 
 * holding all other assets constant, its value must drop by the exact same absolute dollar amount 
 * as the entire portfolio would. 
 * Absolute drop required = D - D' = D - B / T.
 * So X_i = (D - B / T) / D_i.
 * 
 * We use the base formula `1 - (B / T) / D` for the portfolio, and scale it by (D / D_i) for each asset.
 */
export function computeSurvivableDrawdown(obligation: KaminoObligationData): Record<string, number | "Insufficient Data"> {
  const D = obligation.depositedValue;
  const B = obligation.borrowedValue;
  const T = obligation.liquidationLtvThreshold;

  const result: Record<string, number | "Insufficient Data"> = {};

  if (D === undefined || B === undefined || T === undefined || T === 0) {
    obligation.positions.filter(p => p.type === 'deposit').forEach(p => {
      result[p.symbol] = "Insufficient Data";
    });
    return result;
  }
  
  if (D === 0) {
    obligation.positions.filter(p => p.type === 'deposit').forEach(p => {
      result[p.symbol] = "Insufficient Data";
    });
    return result;
  }

  for (const pos of obligation.positions) {
    if (pos.type === 'deposit') {
      result[pos.symbol] = (D - B / T) / pos.valueUsd;
    }
  }

  return result;
}

export function computeGapStressedHealthFactor(
  obligation: KaminoObligationData,
  gapPercentages: Record<string, number>
): number | "Insufficient Data" {
  const D = obligation.depositedValue;
  const B = obligation.borrowedValue;
  const T = obligation.liquidationLtvThreshold;

  if (D === undefined || B === undefined || T === undefined || T === 0) {
    return "Insufficient Data";
  }

  let newD = 0;
  let newB = 0;

  for (const pos of obligation.positions) {
    const gap = gapPercentages[pos.symbol] || 0;
    if (pos.type === 'deposit') {
      newD += pos.valueUsd * (1 + gap / 100);
    } else if (pos.type === 'borrow') {
      newB += pos.valueUsd * (1 + gap / 100);
    }
  }

  if (newB === 0) return "Insufficient Data";

  const newHealthFactor = (newD * T) / newB;
  return newHealthFactor;
}
