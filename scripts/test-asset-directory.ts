import { buildAssetDirectory } from '../lib/asset-directory';

interface Expected {
  symbol: string;
  mint: string;
  ticker: string;
  issuer: string;
  kamino: boolean;
  registry: boolean;
}

const EXPECTED: Expected[] = [
  { symbol: 'AAPLx', mint: 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp', ticker: 'AAPL', issuer: 'xStocks', kamino: true, registry: true },
  { symbol: 'TSLAx', mint: 'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB', ticker: 'TSLA', issuer: 'xStocks', kamino: true, registry: true },
  { symbol: 'NVDAx', mint: 'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh', ticker: 'NVDA', issuer: 'xStocks', kamino: true, registry: true },
  { symbol: 'AAPLon', mint: '123mYEnRLM2LLYsJW3K6oyYh8uP1fngj732iG638ondo', ticker: 'AAPL', issuer: 'Ondo', kamino: false, registry: true },
  { symbol: 'TSLAon', mint: 'KeGv7bsfR4MheC1CkmnAVceoApjrkvBhHYjWb67ondo', ticker: 'TSLA', issuer: 'Ondo', kamino: false, registry: true },
  { symbol: 'NVDAon', mint: 'gEGtLTPNQ7jcg25zTetkbmF7teoDLcrfTnQfmn2ondo', ticker: 'NVDA', issuer: 'Ondo', kamino: false, registry: true },
  { symbol: 'CRCLx', mint: 'XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1', ticker: 'CRCL', issuer: 'xStocks', kamino: true, registry: false },
  { symbol: 'GOOGLx', mint: 'XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN', ticker: 'GOOGL', issuer: 'xStocks', kamino: true, registry: false },
  { symbol: 'HOODx', mint: 'XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg', ticker: 'HOOD', issuer: 'xStocks', kamino: true, registry: false },
  { symbol: 'METAx', mint: 'Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu', ticker: 'META', issuer: 'xStocks', kamino: true, registry: false },
  { symbol: 'MSTRx', mint: 'XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ', ticker: 'MSTR', issuer: 'xStocks', kamino: true, registry: false },
  { symbol: 'QQQx', mint: 'Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ', ticker: 'QQQ', issuer: 'xStocks', kamino: true, registry: false },
  { symbol: 'SPYx', mint: 'XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W', ticker: 'SPY', issuer: 'xStocks', kamino: true, registry: false },
];

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean): void {
  if (ok) {
    passed++;
    console.log('PASS ' + name);
  } else {
    failed++;
    console.log('FAIL ' + name);
  }
}

const entries = buildAssetDirectory();
check('13 entries', entries.length === 13);

const mints: string[] = [];
for (let i = 0; i < entries.length; i++) {
  if (mints.indexOf(entries[i].mintAddress) === -1) mints.push(entries[i].mintAddress);
}
check('all mints unique', mints.length === entries.length);

for (let i = 0; i < EXPECTED.length; i++) {
  const ex = EXPECTED[i];
  const found = entries.find((e) => e.symbol === ex.symbol);
  check(ex.symbol + ' exists', found !== undefined);
  if (found === undefined) continue;
  check(ex.symbol + ' mint matches independent copy', found.mintAddress === ex.mint);
  check(ex.symbol + ' ticker and issuer', found.underlyingTicker === ex.ticker && found.issuer === ex.issuer);
  check(ex.symbol + ' Kamino flag', found.inKaminoMarket === ex.kamino);
  check(ex.symbol + ' Trust Registry flag', found.inTrustRegistry === ex.registry);
}

let kaminoCount = 0;
let registryCount = 0;
for (let i = 0; i < entries.length; i++) {
  if (entries[i].inKaminoMarket) kaminoCount++;
  if (entries[i].inTrustRegistry) registryCount++;
}
check('10 entries on Kamino', kaminoCount === 10);
check('6 entries in the Trust Registry', registryCount === 6);

const again = buildAssetDirectory();
check('repeat call gives the same result', JSON.stringify(again) === JSON.stringify(entries));

console.log('');
console.log(passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exitCode = 1;
