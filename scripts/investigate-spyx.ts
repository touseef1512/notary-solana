import { getParityAssets } from '../lib/parity-assets';
import { computeTrustScore } from '../lib/trust-score';

async function investigate() {
  const assets = getParityAssets();
  const asset = assets.find(a => a.symbol === 'SPYx');
  if (!asset) throw new Error("SPYx not found");

  console.log(`Investigating ${asset.symbol} after fix...`);
  const score = await computeTrustScore(asset as any);
  
  console.log(`\nFinal Trust Score: ${score.trustScore === null ? 'null (Insufficient Data)' : score.trustScore + '%'}`);
  console.log(`Confidence Level: ${score.confidenceLevel}`);
  console.log(`Events Analyzed: ${score.eventsAnalyzed}`);
  console.log(`\nEvent Breakdown:`);
  console.log(JSON.stringify(score.breakdown, null, 2));
}

investigate().catch(console.error);
