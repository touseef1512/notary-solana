export interface ExposureInput {
  symbol: string;
  issuer: string;
  underlyingTicker: string;
  balance: number;
  totalValue: number | null;
}

export interface ExposureLeg {
  symbol: string;
  issuer: string;
  balance: number;
  totalValue: number | null;
}

export interface ExposureGroup {
  ticker: string;
  legs: ExposureLeg[];
  combinedBalance: number;
  combinedValue: number | null;
  issuerCount: number;
}

export function groupExposure(items: ExposureInput[]): ExposureGroup[] {
  const grouped: Record<string, ExposureInput[]> = {};
  items.forEach(item => {
    if (!grouped[item.underlyingTicker]) {
      grouped[item.underlyingTicker] = [];
    }
    grouped[item.underlyingTicker].push(item);
  });

  const result: ExposureGroup[] = [];
  const tickers = Object.keys(grouped);
  
  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    const groupItems = grouped[ticker];
    const legs: ExposureLeg[] = [];
    
    let combinedBalance = 0;
    let allValuesValid = true;
    let sumValue = 0;
    const issuers: Record<string, boolean> = {};
    
    for (let j = 0; j < groupItems.length; j++) {
      const item = groupItems[j];
      legs.push({
        symbol: item.symbol,
        issuer: item.issuer,
        balance: item.balance,
        totalValue: item.totalValue
      });
      combinedBalance += item.balance;
      issuers[item.issuer] = true;
      if (item.totalValue === null || !Number.isFinite(item.totalValue)) {
        allValuesValid = false;
      } else {
        sumValue += item.totalValue;
      }
    }
    
    result.push({
      ticker,
      legs,
      combinedBalance,
      combinedValue: allValuesValid ? sumValue : null,
      issuerCount: Object.keys(issuers).length
    });
  }
  
  result.sort((a, b) => {
    if (a.combinedValue !== null && b.combinedValue !== null) {
      if (a.combinedValue !== b.combinedValue) {
        return b.combinedValue - a.combinedValue;
      }
    } else if (a.combinedValue !== null && b.combinedValue === null) {
      return -1;
    } else if (a.combinedValue === null && b.combinedValue !== null) {
      return 1;
    }
    
    if (a.ticker < b.ticker) return -1;
    if (a.ticker > b.ticker) return 1;
    return 0;
  });
  
  return result;
}
