import { loadEnvConfig } from '@next/env';
import { resolve } from 'path';

// Load environment variables before anything else
loadEnvConfig(resolve(process.cwd()));

import { KNOWN_ASSETS } from '../lib/known-assets';
import { getReserveAttestation } from '../lib/attestation';

async function main() {
  console.log('Running Reserve/Backing Attestation Check across all Known Assets...\n');
  
  for (const asset of KNOWN_ASSETS) {
    console.log(`--- ${asset.symbol} (${asset.name}) ---`);
    console.log(`Issuer: ${asset.issuer}`);
    
    try {
      const attestation = await getReserveAttestation(asset);
      
      console.log(`Live Attestation Found: ${attestation.hasLiveAttestation ? 'Yes' : 'No'}`);
      console.log(`Classification: ${attestation.classification}`);
      
      if (attestation.hasLiveAttestation) {
        if (attestation.backingRatio !== null) {
          console.log(`Backing Ratio: ${attestation.backingRatio.toFixed(4)}`);
        }
        if (attestation.bufferPercent !== null) {
          console.log(`Buffer: ${attestation.bufferPercent.toFixed(2)}%`);
        }
        if (attestation.attestationAgeHours !== null) {
          console.log(`Attestation Age: ${attestation.attestationAgeHours.toFixed(2)} hours`);
        }
      }
      
      console.log(`Disclosure: ${attestation.disclosure}`);
      
      if (attestation.details) {
         if (attestation.details && Array.isArray(attestation.details.holdings)) {
           console.log(`Holdings:`);
           for (const holding of (attestation.details.holdings as Array<Record<string, any>>)) {
             console.log(`  - ${holding.quantity} ${holding.symbol} (Provider: ${holding.provider})`);
           }
         }
      }
    } catch (e: any) {
      console.error(`Error fetching attestation: ${e.message}`);
    }
    console.log('\n');
  }
}

main().catch(console.error);
