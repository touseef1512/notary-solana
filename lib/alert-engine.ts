import { AlertResult, getAllUpcomingAlerts } from './alerts';
import { getKaminoRiskData } from '@/lib/kamino-risk';

export interface NotaryAlert {
  kind: 'dividend-event' | 'liquidation-risk' | 'reserve-drop' | 'market-watch';
  title: string;
  severity: 'info' | 'warning' | 'critical';
  daysUntil: number | null;
  note: string;
  assetSymbol?: string;
  obligationPubkey?: string;
}

export function dividendAlertsToNotaryAlerts(alerts: AlertResult[]): NotaryAlert[] {
  const result: NotaryAlert[] = [];
  
  for (const alert of alerts) {
    if (alert.confidenceLevel === 'no-data') {
      // Exclude no-data alerts to keep the engine focused on actionable items
      continue;
    }
    
    let severity: 'info' | 'warning' | 'critical' = 'info';
    
    if (alert.confidenceLevel === 'confirmed' && alert.daysUntil !== null && alert.daysUntil <= 7) {
      severity = 'warning';
    }
    
    result.push({
      kind: 'dividend-event',
      title: `Upcoming Dividend: ${alert.asset.symbol}`,
      severity,
      daysUntil: alert.daysUntil,
      note: alert.note,
      assetSymbol: alert.asset.symbol
    });
  }
  
  return result;
}

export async function getLiquidationRiskAlerts(walletAddress: string | undefined): Promise<NotaryAlert[]> {
  if (!walletAddress) {
    return [];
  }

  const obligations = await getKaminoRiskData(walletAddress);
  const alerts: NotaryAlert[] = [];

  for (const obligation of obligations) {
    if (obligation.gapStressedHealth === 'Insufficient Data') {
      continue;
    }

    let severity: 'warning' | 'critical';
    if (obligation.gapStressedHealth < 1) {
      severity = 'critical';
    } else if (obligation.gapStressedHealth < 1.2) {
      severity = 'warning';
    } else {
      continue;
    }

    alerts.push({
      kind: 'liquidation-risk',
      title: `Liquidation Risk: ${obligation.worstAssetSymbol ?? 'obligation'}`,
      severity,
      daysUntil: null,
      note: `Gap-stressed health factor: ${obligation.gapStressedHealth}`,
      obligationPubkey: obligation.obligationPubkey,
    });
  }

  return alerts;
}

export async function getReserveDropAlerts(): Promise<NotaryAlert[]> {
  const { KNOWN_ASSETS } = await import('@/lib/known-assets');
  const { buildAssetTrustRiskProfile } = await import('@/lib/trust-risk-profile');

  const profiles = await Promise.all(KNOWN_ASSETS.map(asset => buildAssetTrustRiskProfile(asset)));
  const alerts: NotaryAlert[] = [];

  for (const profile of profiles) {
    if (!profile.hasLiveAttestation || profile.backingRatio === null || profile.backingRatio === undefined) {
      continue;
    }

    if (profile.backingRatio < 1.0) {
      alerts.push({
        kind: 'reserve-drop',
        title: `Reserve Drop: ${profile.asset?.symbol ?? 'unknown'}`,
        severity: 'critical',
        daysUntil: null,
        note: `Backing ratio ${(profile.backingRatio * 100).toFixed(2)}% — under-collateralized`,
        assetSymbol: profile.asset?.symbol,
      });
    } else if (profile.attestationAgeHours !== null && profile.attestationAgeHours !== undefined && profile.attestationAgeHours > 48) {
      alerts.push({
        kind: 'reserve-drop',
        title: `Stale Attestation: ${profile.asset?.symbol ?? 'unknown'}`,
        severity: 'warning',
        daysUntil: null,
        note: `Reserve attestation is ${profile.attestationAgeHours.toFixed(0)} hours old`,
        assetSymbol: profile.asset?.symbol,
      });
    }
  }

  return alerts;
}

export async function getAllNotaryAlerts(walletAddress?: string): Promise<NotaryAlert[]> {
  const upcomingAlerts = await getAllUpcomingAlerts();
  const dividendAlerts = dividendAlertsToNotaryAlerts(upcomingAlerts);
  
  const liquidationAlerts = await getLiquidationRiskAlerts(walletAddress);
  const reserveDropAlerts = await getReserveDropAlerts();
  
  let marketWatchAlerts: NotaryAlert[] = [];
  try {
    const { getStoredMarketWatch } = await import('@/lib/market-watch');
    const { buildMarketWatchAlerts } = await import('@/lib/market-watch-alerts');
    const stored = await getStoredMarketWatch();
    marketWatchAlerts = buildMarketWatchAlerts(stored, Math.floor(Date.now() / 1000));
  } catch {
    marketWatchAlerts = [];
  }
  
  const merged = [...dividendAlerts, ...liquidationAlerts, ...reserveDropAlerts, ...marketWatchAlerts];
  
  // Sort by daysUntil ascending, nulls last
  merged.sort((a, b) => {
    if (a.daysUntil === null && b.daysUntil === null) return 0;
    if (a.daysUntil === null) return 1;
    if (b.daysUntil === null) return -1;
    return a.daysUntil - b.daysUntil;
  });
  
  return merged;
}
