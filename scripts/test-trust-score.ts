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
    if (score.trustScore === null) {
      console.log('No dividend events to analyze yet.\n');
      continue;
    }
    
    console.log(`Composite Trust Score: ${score.trustScore.toFixed(2)}/100`);
    console.log(`  - Verification Track Record (50% weight): ${score.verificationTrackRecord!.toFixed(2)}%`);
    console.log(`  - Verification Coverage (35% weight):     ${score.verificationCoverage!.toFixed(2)}%`);
    console.log(`  - Timing Accuracy (15% weight):           ${score.timingAccuracy!.toFixed(2)}%\n`);
    
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
    console.log('No issuers with valid trust scores yet.');
  } else {
    leaderboard.forEach((entry, i) => {
      console.log(`${i+1}. ${entry.issuer}`);
      console.log(`   Average Trust Score: ${entry.averageTrustScore.toFixed(2)} (across ${entry.assetsCount} valid assets)`);
    });
  }
}

main().catch(console.error);
