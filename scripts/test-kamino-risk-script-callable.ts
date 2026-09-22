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

async function main() {
  const { getKaminoRiskData } = await import('../lib/kamino-risk');
  const data = await getKaminoRiskData('Fa7LNzj3SCV364hya9dx9evL29pC1awx24iHeCEwX6vU');
  const ok = Array.isArray(data) && data.length > 0 && typeof data[0].obligationPubkey === 'string';
  console.log(ok ? 'PASS callable from plain script, returns real obligation data' : 'FAIL unexpected shape: ' + JSON.stringify(data));
  process.exit(ok ? 0 : 1);
}
main().catch((e) => {
  console.error('FAIL threw:', e instanceof Error ? e.message : e);
  process.exit(1);
});
