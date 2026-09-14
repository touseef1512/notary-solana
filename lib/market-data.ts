// Helper functions for market data fetching
// e.g. pulling prices for xStocks, Ondo, PreStocks
import fs from 'fs';
import path from 'path';

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

const CACHE_DIR = path.join(process.cwd(), '.cache', 'market-data');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCachePath(ticker: string, type: 'dividends' | 'splits' | string) {
  return path.join(CACHE_DIR, `${ticker}-${type}.json`);
}

async function getCachedData<T>(ticker: string, type: 'dividends' | 'splits' | string): Promise<T | null> {
  const cachePath = getCachePath(ticker, type);
  try {
    if (fs.existsSync(cachePath)) {
      const stats = fs.statSync(cachePath);
      const now = new Date().getTime();
      if (now - stats.mtimeMs < CACHE_TTL_MS) {
        const data = fs.readFileSync(cachePath, 'utf-8');
        return JSON.parse(data) as T;
      }
    }
  } catch (error) {
    console.error(`Error reading cache for ${ticker} ${type}:`, error);
  }
  return null;
}

function setCachedData<T>(ticker: string, type: 'dividends' | 'splits' | string, data: T) {
  const cachePath = getCachePath(ticker, type);
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Error writing cache for ${ticker} ${type}:`, error);
  }
}

async function fetchFromAlphaVantage(functionName: 'DIVIDENDS' | 'SPLITS', ticker: string) {
  const apiKey = process.env.MARKET_DATA_API_KEY;
  if (!apiKey) {
    console.warn('MARKET_DATA_API_KEY is not configured, API limits will be strict');
  }
  
  // Alpha Vantage uses "demo" key if apiKey is empty or undefined for some endpoints, 
  // but it's safer to pass what we have.
  const url = `https://www.alphavantage.co/query?function=${functionName}&symbol=${ticker}&apikey=${apiKey || 'demo'}`;
  
  const response = await fetch(url);
  const data = await response.json();

  if (data.Note || data.Information) {
    throw new Error(`Alpha Vantage API rate limit exceeded: ${data.Note || data.Information}`);
  }
  
  if (data['Error Message']) {
      throw new Error(`Alpha Vantage API error: ${data['Error Message']}`);
  }

  return data;
}

export async function getDividendHistory(ticker: string): Promise<DividendRecord[]> {
  const cached = await getCachedData<DividendRecord[]>(ticker, 'dividends');
  if (cached) return cached;

  const data = await fetchFromAlphaVantage('DIVIDENDS', ticker);
  const records = data.data || [];
  
  const formattedRecords: DividendRecord[] = records.map((record: Record<string, string>) => ({
    ex_dividend_date: record.ex_dividend_date,
    declaration_date: record.declaration_date,
    record_date: record.record_date,
    payment_date: record.payment_date,
    amount: parseFloat(record.amount),
  }));

  setCachedData(ticker, 'dividends', formattedRecords);
  return formattedRecords;
}

export async function getSplitHistory(ticker: string): Promise<SplitRecord[]> {
  const cached = await getCachedData<SplitRecord[]>(ticker, 'splits');
  if (cached) return cached;

  const data = await fetchFromAlphaVantage('SPLITS', ticker);
  const records = data.data || [];

  const formattedRecords: SplitRecord[] = records.map((record: Record<string, string>) => ({
    effective_date: record.effective_date,
    split_factor: parseFloat(record.split_factor),
  }));

  setCachedData(ticker, 'splits', formattedRecords);
  return formattedRecords;
}

export async function getStockPrice(ticker: string, date?: string): Promise<{ price: number, date: string } | null> {
  const cacheType = date ? `price-${date}-tiingo` : `price-latest-tiingo`;
  const cached = await getCachedData<{ price: number, date: string }>(ticker, cacheType);
  if (cached) return cached;

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

  const response = await fetch(url);
  
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
  setCachedData(ticker, cacheType, result);
  return result;
}

export const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

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
