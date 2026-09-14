// Helper functions for market data fetching
// e.g. pulling prices for xStocks, Ondo, PreStocks
export interface DividendRecord {
  ex_dividend_date: string;
  declaration_date: string;
  record_date: string;
  payment_date: string;
  amount: number;
}

export interface SplitRecord {
  effective_date: string;
  split_factor: number;
}

export const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

let requestQueue: Promise<unknown> = Promise.resolve();

async function fetchFromAlphaVantage(functionName: 'DIVIDENDS' | 'SPLITS', ticker: string) {
  const actualFetchLogic = async () => {
    const apiKey = process.env.MARKET_DATA_API_KEY;
    if (!apiKey) {
      console.warn('MARKET_DATA_API_KEY is not configured, API limits will be strict');
    }
    
    // Alpha Vantage uses "demo" key if apiKey is empty or undefined for some endpoints, 
    // but it's safer to pass what we have.
    const url = `https://www.alphavantage.co/query?function=${functionName}&symbol=${ticker}&apikey=${apiKey || 'demo'}`;
    const response = await fetch(url, { next: { revalidate: 86400 } });
    const data = await response.json();

    if (data.Note || data.Information) {
      throw new Error(`Alpha Vantage API rate limit exceeded: ${data.Note || data.Information}`);
    }
    
    if (data['Error Message']) {
        throw new Error(`Alpha Vantage API error: ${data['Error Message']}`);
    }

    return data;
  };

  return new Promise<Awaited<ReturnType<typeof actualFetchLogic>>>((resolve, reject) => {
    requestQueue = requestQueue.catch(() => {}).then(async () => {
      try {
        const result = await actualFetchLogic();
        resolve(result);
      } catch (err) {
        reject(err);
      } finally {
        await delay(1100);
      }
    });
  });
}

export async function getDividendHistory(ticker: string): Promise<DividendRecord[]> {
  const data = await fetchFromAlphaVantage('DIVIDENDS', ticker);
  const records = data.data || [];
  
  const formattedRecords: DividendRecord[] = records.map((record: Record<string, string>) => ({
    ex_dividend_date: record.ex_dividend_date,
    declaration_date: record.declaration_date,
    record_date: record.record_date,
    payment_date: record.payment_date,
    amount: parseFloat(record.amount),
  }));
  return formattedRecords;
}

export async function getSplitHistory(ticker: string): Promise<SplitRecord[]> {
  const data = await fetchFromAlphaVantage('SPLITS', ticker);
  const records = data.data || [];

  const formattedRecords: SplitRecord[] = records.map((record: Record<string, string>) => ({
    effective_date: record.effective_date,
    split_factor: parseFloat(record.split_factor),
  }));
  return formattedRecords;
}

export async function getStockPrice(ticker: string, date?: string): Promise<{ price: number, date: string } | null> {
  const apiKey = process.env.TIINGO_API_KEY;
  if (!apiKey) {
    throw new Error('TIINGO_API_KEY is not configured in .env.local');
  }

  let url = `https://api.tiingo.com/tiingo/daily/${ticker.toLowerCase()}/prices?token=${apiKey}`;

  if (date) {
    // If a specific date is requested, we fetch a 7-day window ending on that date 
    // to ensure we catch the nearest prior trading day if it falls on a weekend/holiday.
    const target = new Date(date);
    const start = new Date(target);
    start.setDate(start.getDate() - 7);
    
    const startDateStr = start.toISOString().split('T')[0];
    url += `&startDate=${startDateStr}&endDate=${date}`;
  }

  const response = await fetch(url, { next: { revalidate: 86400 } });
  
  if (!response.ok) {
    throw new Error(`Tiingo API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`Tiingo API error: No pricing data found for ${ticker} on or before ${date}`);
  }

  // Tiingo returns chronological order (oldest to newest), so the last element is the closest to the endDate
  const targetDay = data[data.length - 1];
  
  if (typeof targetDay.close !== 'number') {
    throw new Error(`Tiingo API error: Invalid price value for ${ticker}`);
  }

  const result = { price: targetDay.close, date: targetDay.date.split('T')[0] };
  return result;
}

export async function getMarketData(symbol: string) {
  const dividends = await getDividendHistory(symbol);
  
  // Alpha Vantage free tier limit: 1 request per second
  await delay(1200);
  
  const splits = await getSplitHistory(symbol);
  
  return {
    dividends,
    splits
  };
}
