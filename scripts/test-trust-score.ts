import { loadEnvConfig } from '@next/env';
import { resolve } from 'path';

// Load environment variables before anything else
loadEnvConfig(resolve(process.cwd()));

import { getIssuerLeaderboard } from '../lib/trust-score';

async function main() {
  console.log('Running Trust Score Engine across all Known Assets...\n');
  
  const { leaderboard, scores } = await getIssuerLeaderboard();
  
  console.log('\n======================================================');
  console.log('               INDIVIDUAL TRUST SCORES                ');
  console.log('======================================================\n');
  
  for (const score of scores) {
    console.log(`--- ${score.asset.symbol} (${score.asset.name}) ---`);
    if (score.eventsAnalyzed === 0) {
      console.log('No dividend events to analyze yet.\n');
      continue;
    }
    
    if (score.trustScore === null) {
      console.log(`Composite Trust Score: N/A (no independently verified events)`);
    } else {
      console.log(`Composite Trust Score: ${score.trustScore.toFixed(2)}/100`);
    }
    console.log(`Confidence Level: ${score.confidenceLevel}\n`);
    
    console.log(`Events Analyzed: ${score.eventsAnalyzed}`);
    console.log('Breakdown:');
    score.breakdown.forEach((event, i) => {
      console.log(`  ${i+1}. Ex-Date: ${event.exDate}`);
      console.log(`     Bucket: ${event.bucket}`);
      console.log(`     Independently Verified: ${event.independentlyVerified ? 'Yes' : 'No (Fallback Assumed)'}`);
      console.log(`     Timing Match: ${event.timingMatch ? 'Yes' : 'No'}`);
    });
    console.log('\n');
  }

  console.log('======================================================');
  console.log('                 ISSUER LEADERBOARD                   ');
  console.log('======================================================\n');
  
  if (leaderboard.length === 0) {
    console.log('No issuers yet.');
  } else {
    leaderboard.forEach((entry, i) => {
      console.log(`${i+1}. ${entry.issuer}`);
      if (entry.averageTrustScore === null) {
        console.log(`   Average Trust Score: N/A - insufficient verified data yet (across ${entry.assetsCount} of ${entry.totalAssetsForIssuer} assets)`);
      } else {
        console.log(`   Average Trust Score: ${entry.averageTrustScore.toFixed(2)} (across ${entry.assetsCount} of ${entry.totalAssetsForIssuer} assets)`);
      }
    });
  }
}

main().catch(console.error);
