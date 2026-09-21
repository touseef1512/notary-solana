import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^([^=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
    }
  }
}

function tsToIso(ts: number | null): string {
  if (ts === null) return '-';
  return new Date(ts * 1000).toISOString();
}

async function main() {
  loadEnv();
  
  const { getMarketWatch } = await import('../lib/market-watch');
  
  const writeMode = process.argv.indexOf('--write') !== -1;
  const result = await getMarketWatch({ dryRun: !writeMode });
  
  console.log(`status: ${result.status}`);
  console.log(`reason: ${result.reason}`);
  console.log(`checkedNow: ${result.checkedNow}`);
  console.log(`baselineTs: ${tsToIso(result.baselineTs)}`);
  console.log(`lastCheckedTs: ${tsToIso(result.lastCheckedTs)}`);
  console.log('');
  
  for (let i = 0; i < result.entries.length; i++) {
    const e = result.entries[i];
    const sym = e.symbol.padEnd(14);
    const m = e.mint.padEnd(46);
    const first = tsToIso(e.firstSeenTs);
    const added = String(e.addedAfterBaseline);
    const rm = tsToIso(e.removedTs);
    console.log(`${sym}${m}${first}  ${added}  ${rm}`);
  }
  
  console.log('');
  if (writeMode) {
    console.log('WRITE MODE: state saved if Redis accepted it');
  } else {
    console.log('DRY RUN: nothing was written');
  }
}

main().catch((e) => {
  console.error('Script failed:', e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
