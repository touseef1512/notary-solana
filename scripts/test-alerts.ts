import { getUpcomingAlerts } from '../lib/alerts';
import { KNOWN_ASSETS } from '../lib/known-assets';

async function run() {
  console.log("Generating upcoming alerts for all known assets...\n");
  
  for (const asset of KNOWN_ASSETS) {
    const result = await getUpcomingAlerts(asset);
    console.log(`=== ${asset.symbol} ===`);
    console.log(JSON.stringify(result, null, 2));
    console.log("\n");
  }
}

run().catch(console.error);
