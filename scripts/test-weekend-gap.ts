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
loadEnv();

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean) {
  if (ok) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name); }
}

async function main() {
  const { getMeasuredWeekendGap } = await import('../lib/weekend-gap');

  const result = await getMeasuredWeekendGap('TSLAx');
  if (result === 'Insufficient Data') {
    console.log('TSLAx returned Insufficient Data (check manually if this is expected)');
  } else {
    check('percent is a finite number', Number.isFinite(result.percent));
    check('percent is not positive (worst gap should be a drop)', result.percent <= 0);
    check('percent within plausible bounds', result.percent > -50 && result.percent <= 0);
    check('asOfDate looks like a real date', /^\d{4}-\d{2}-\d{2}/.test(result.asOfDate));
    check('computedAt is a recent unix timestamp', result.computedAt > (Date.now() / 1000 - 300) && result.computedAt <= (Date.now() / 1000));
  }

  const unknown = await getMeasuredWeekendGap('NOTASYMBOL123');
  check('unknown symbol returns Insufficient Data, not a crash or fake number', unknown === 'Insufficient Data');

  const start = Date.now();
  await getMeasuredWeekendGap('TSLAx');
  const cachedMs = Date.now() - start;
  check('second call for same symbol is fast (cache likely hit, <1500ms)', cachedMs < 1500);

  console.log(pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Test script failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
