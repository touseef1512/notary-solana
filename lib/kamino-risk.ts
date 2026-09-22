import { getKaminoPositions } from '@/lib/kamino';
import { computeSurvivableDrawdown, computeGapStressedHealthFactor } from '@/lib/risk-math';
import { getAttestationStatus } from '@/lib/sas-attestation';
import { buildLendingRiskProfile } from '@/lib/trust-risk-profile';
import { getAllMeasuredWeekendGaps } from '@/lib/weekend-gap';

export async function getKaminoRiskData(walletAddress: string) {
  try {
    const obligations = await getKaminoPositions(walletAddress);
    
    const gapData = await getAllMeasuredWeekendGaps();
    const gapPercentages = Object.fromEntries(Object.entries(gapData).map(([k, v]) => [k, v.percent]));

    return await Promise.all(obligations.map(async (obligation) => {
      let currentHealth: number | "Insufficient Data" = "Insufficient Data";
      if (obligation.borrowedValue > 0) {
        currentHealth = (obligation.depositedValue * obligation.liquidationLtvThreshold) / obligation.borrowedValue;
      }

      const drawdowns = computeSurvivableDrawdown(obligation);
      
      let worstAssetSymbol: string | null = null;
      let worstDrawdownValue: number | null = null;
      
      for (const [symbol, dd] of Object.entries(drawdowns)) {
        if (typeof dd === 'number') {
          if (worstDrawdownValue === null || dd < worstDrawdownValue) {
            worstDrawdownValue = dd;
            worstAssetSymbol = symbol;
          }
        }
      }

      const gapStressedHealth = computeGapStressedHealthFactor(obligation, gapPercentages);

      let attestationStatus = null;
      try {
        attestationStatus = await getAttestationStatus(obligation.obligationPubkey);
      } catch (e) {
        console.warn(`Failed to get attestation status for obligation ${obligation.obligationPubkey}:`, e);
      }

      return {
        ...obligation,
        currentHealth,
        drawdowns,
        worstAssetSymbol,
        worstDrawdownValue,
        gapStressedHealth,
        worstAssetGapDate: worstAssetSymbol && gapData[worstAssetSymbol] ? gapData[worstAssetSymbol].asOfDate : null,
        attestationStatus,
        profile: buildLendingRiskProfile({
          obligationPubkey: obligation.obligationPubkey,
          positions: obligation.positions,
          depositedValue: obligation.depositedValue,
          borrowedValue: obligation.borrowedValue,
          currentLtv: obligation.currentLtv,
          liquidationLtvThreshold: obligation.liquidationLtvThreshold,
          currentHealth,
          drawdowns,
          worstAssetSymbol,
          worstDrawdownValue,
          gapStressedHealth,
        }),
      };
    }));
  } catch (error) {
    console.error('Error getting Kamino risk data:', error);
    throw new Error('Failed to load Kamino risk data');
  }
}
