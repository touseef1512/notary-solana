import { groupExposure } from '../lib/exposure';

function runTests() {
  let failed = false;

  const case1 = groupExposure([
    { symbol: 'AAPLx', issuer: 'xStocks', underlyingTicker: 'AAPL', balance: 10, totalValue: 3000 },
    { symbol: 'AAPLon', issuer: 'Ondo', underlyingTicker: 'AAPL', balance: 5, totalValue: 1500 }
  ]);
  
  if (case1.length === 1 && case1[0].combinedBalance === 15 && case1[0].combinedValue === 4500 && case1[0].issuerCount === 2 && case1[0].legs.length === 2) {
    console.log('Case 1 PASS');
  } else {
    console.log('Case 1 FAIL', case1);
    failed = true;
  }

  const case2 = groupExposure([
    { symbol: 'AAPLx', issuer: 'xStocks', underlyingTicker: 'AAPL', balance: 10, totalValue: 3000 },
    { symbol: 'AAPLon', issuer: 'Ondo', underlyingTicker: 'AAPL', balance: 5, totalValue: null }
  ]);

  if (case2.length === 1 && case2[0].combinedBalance === 15 && case2[0].combinedValue === null) {
    console.log('Case 2 PASS');
  } else {
    console.log('Case 2 FAIL', case2);
    failed = true;
  }

  const case3 = groupExposure([
    { symbol: 'AAPLx', issuer: 'xStocks', underlyingTicker: 'AAPL', balance: 10, totalValue: 3000 },
    { symbol: 'AAPLon', issuer: 'Ondo', underlyingTicker: 'AAPL', balance: 5, totalValue: 1500 },
    { symbol: 'TSLAx', issuer: 'xStocks', underlyingTicker: 'TSLA', balance: 2, totalValue: 800 }
  ]);

  if (case3.length === 2 && case3[0].ticker === 'AAPL' && case3[1].ticker === 'TSLA') {
    console.log('Case 3 PASS');
  } else {
    console.log('Case 3 FAIL', case3);
    failed = true;
  }

  const case4 = groupExposure([
    { symbol: 'TSLAx', issuer: 'xStocks', underlyingTicker: 'TSLA', balance: 2, totalValue: null },
    { symbol: 'AAPLx', issuer: 'xStocks', underlyingTicker: 'AAPL', balance: 10, totalValue: 3000 }
  ]);

  if (case4.length === 2 && case4[0].ticker === 'AAPL' && case4[1].ticker === 'TSLA') {
    console.log('Case 4 PASS');
  } else {
    console.log('Case 4 FAIL', case4);
    failed = true;
  }

  const case5 = groupExposure([]);
  if (case5.length === 0) {
    console.log('Case 5 PASS');
  } else {
    console.log('Case 5 FAIL', case5);
    failed = true;
  }

  if (failed) {
    process.exit(1);
  }
}

runTests();
