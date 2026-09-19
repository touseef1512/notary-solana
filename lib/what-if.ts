import { KaminoObligationData } from './kamino';
import { computeSurvivableDrawdown, computeGapStressedHealthFactor } from './risk-math';
import { GAP_PERCENTAGES } from './gap-percentages';

export interface WhatIfInput {
  depositSymbol: string;
  depositUsd: number;
  borrowUsd: number;
  liquidationLtvThreshold: number;
}

export interface WhatIfOutput {
  currentHealth: number | "Insufficient Data";
  survivableDrawdown: number | "Insufficient Data";
  gapStressedHealth: number | "Insufficient Data";
  gapPercentageUsed: number;
  status: "already-liquidatable" | "gap-liquidation" | "thin" | "ok" | "no-borrow" | "Insufficient Data";
}

export function simulateHypotheticalLoan(input: WhatIfInput): WhatIfOutput {
  if (
    !Number.isFinite(input.depositUsd) || 
    !Number.isFinite(input.borrowUsd) || 
    !Number.isFinite(input.liquidationLtvThreshold) ||
    input.depositUsd <= 0 ||
    input.borrowUsd < 0 ||
    input.liquidationLtvThreshold <= 0 ||
    input.liquidationLtvThreshold > 1
  ) {
    return {
      currentHealth: "Insufficient Data",
      survivableDrawdown: "Insufficient Data",
      gapStressedHealth: "Insufficient Data",
      gapPercentageUsed: GAP_PERCENTAGES[input.depositSymbol] || 0,
      status: "Insufficient Data"
    };
  }

  const gapUsed = GAP_PERCENTAGES[input.depositSymbol] || 0;

  if (input.borrowUsd === 0) {
    return {
      currentHealth: "Insufficient Data",
      survivableDrawdown: "Insufficient Data",
      gapStressedHealth: "Insufficient Data",
      gapPercentageUsed: gapUsed,
      status: "no-borrow"
    };
  }

  const positions: KaminoObligationData["positions"] = [
    { type: 'deposit', symbol: input.depositSymbol, reservePubkey: 'hypothetical_deposit', amount: 1, valueUsd: input.depositUsd },
    { type: 'borrow', symbol: 'USDC', reservePubkey: 'hypothetical_borrow', amount: 1, valueUsd: input.borrowUsd }
  ];

  const obligation: KaminoObligationData = {
    obligationPubkey: 'hypothetical',
    positions,
    depositedValue: input.depositUsd,
    borrowedValue: input.borrowUsd,
    currentLtv: input.borrowUsd / input.depositUsd,
    liquidationLtvThreshold: input.liquidationLtvThreshold
  };

  const currentHealth = (input.depositUsd * input.liquidationLtvThreshold) / input.borrowUsd;
  
  const drawdowns = computeSurvivableDrawdown(obligation);
  const survivableDrawdown = drawdowns[input.depositSymbol] ?? "Insufficient Data";
  
  const gapStressedHealth = computeGapStressedHealthFactor(obligation, GAP_PERCENTAGES);

  let status: WhatIfOutput["status"] = "ok";
  if (currentHealth < 1) {
    status = "already-liquidatable";
  } else if (typeof gapStressedHealth === 'number') {
    if (gapStressedHealth < 1) {
      status = "gap-liquidation";
    } else if (gapStressedHealth < 1.2) {
      status = "thin";
    }
  } else {
    status = "Insufficient Data";
  }

  return {
    currentHealth,
    survivableDrawdown,
    gapStressedHealth,
    gapPercentageUsed: gapUsed,
    status
  };
}
