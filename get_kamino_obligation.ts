// @ts-nocheck
import { Connection, PublicKey } from '@solana/web3.js';
import { KaminoMarket, KaminoObligation } from '@kamino-finance/klend-sdk';

async function main() {
  const connection = new Connection('https://api.mainnet-beta.solana.com');
  const marketPubkey = new PublicKey('5wJeMrUYECGq41fxRESKALVcHnNX26TAWy4W98yULsua');
  
  console.log('Loading market...');
  const market = await KaminoMarket.load(connection, marketPubkey, 400);
  if (!market) {
      console.log('market not found');
      return;
  }
  
  console.log('Fetching all obligations...');
  const obligations = await market.getAllObligationsForMarket();
  
  const activeObligations = obligations.filter(ob => ob.state.deposits.some(d => d.depositReserve.toBase58() !== '11111111111111111111111111111111'));
  
  if (activeObligations.length > 0) {
      console.log('Found an active obligation wallet:', activeObligations[0].state.owner.toBase58());
      console.log('Stats:', JSON.stringify(activeObligations[0].refreshedStats, null, 2));
      console.log('Keys of active obligation:', Object.keys(activeObligations[0]));
  } else {
      console.log('No active obligations found');
  }
}

main().catch(console.error);
