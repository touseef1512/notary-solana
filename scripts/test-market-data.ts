import { getDividendHistory } from '../lib/market-data';

async function main() {
  console.log('--- Test 1: TSLA (first call, should hit Alpha Vantage fresh) ---');
  try {
    const tsla1 = await getDividendHistory('TSLA');
    console.log('TSLA result 1:', JSON.stringify(tsla1));
  } catch (err) {
    console.log('TSLA call 1 threw:', err);
  }

  console.log('--- Test 2: TSLA (second call, should hit Redis cache, no new AV request) ---');
  const start = Date.now();
  try {
    const tsla2 = await getDividendHistory('TSLA');
    console.log('TSLA result 2:', JSON.stringify(tsla2));
    console.log('Second call took', Date.now() - start, 'ms');
  } catch (err) {
    console.log('TSLA call 2 threw:', err);
  }

  console.log('--- Test 3: AAPL (confirm still working) ---');
  try {
    const aapl = await getDividendHistory('AAPL');
    console.log('AAPL result:', JSON.stringify(aapl));
  } catch (err) {
    console.log('AAPL call threw:', err);
  }
}

main();
