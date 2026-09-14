import { Connection, PublicKey } from '@solana/web3.js';
import { KNOWN_ASSETS_MAP, KnownAsset } from './known-assets';

// Helper functions for interacting with Solana programs
// e.g. verifying tokenized equities ownership

export function getSolanaConnection(network: 'mainnet' | 'devnet' = 'devnet') {
  const endpoint = network === 'mainnet' 
    ? process.env.SOLANA_RPC_URL 
    : process.env.SOLANA_DEVNET_RPC_URL;
    
  if (!endpoint) {
    throw new Error('RPC URL is not configured');
  }
  
  return new Connection(endpoint, 'confirmed');
}

export interface TokenHolding extends KnownAsset {
  balance: number;
}

export async function getTokenizedStockHoldings(walletAddress: string): Promise<TokenHolding[]> {
  try {
    const connection = getSolanaConnection('mainnet');
    const pubKey = new PublicKey(walletAddress);

    // The Classic SPL Token program ID
    const tokenProgramId = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    // The Token-2022 program ID
    const token2022ProgramId = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
    
    // Fetch accounts from both token programs in parallel
    const [classicResponse, token2022Response] = await Promise.all([
      connection.getParsedTokenAccountsByOwner(pubKey, { programId: tokenProgramId }),
      connection.getParsedTokenAccountsByOwner(pubKey, { programId: token2022ProgramId })
    ]);

    const holdingsMap = new Map<string, TokenHolding>();
    
    // Combine the result sets
    const allAccounts = [...classicResponse.value, ...token2022Response.value];

    for (const { account } of allAccounts) {
      const parsedInfo = account.data.parsed.info;
      const mintAddress = parsedInfo.mint;
      const uiAmount = parsedInfo.tokenAmount.uiAmount;

      if (uiAmount === null || uiAmount === 0) continue;

      const knownAsset = KNOWN_ASSETS_MAP[mintAddress];
      if (knownAsset) {
        const existing = holdingsMap.get(mintAddress);
        if (existing) {
          existing.balance += uiAmount;
        } else {
          holdingsMap.set(mintAddress, {
            ...knownAsset,
            balance: uiAmount,
          });
        }
      }
    }

    return Array.from(holdingsMap.values());
  } catch (error) {
    console.error('Error fetching tokenized stock holdings:', error);
    throw new Error('Failed to fetch holdings');
  }
}

export interface ScaledUiAmountConfig {
  authority: string;
  multiplier: number;
  newMultiplier: number;
  newMultiplierEffectiveTimestamp: number;
}

export async function getScaledUiAmountConfig(mintAddress: string): Promise<ScaledUiAmountConfig | null> {
  const connection = getSolanaConnection('mainnet');
  const info = await connection.getParsedAccountInfo(new PublicKey(mintAddress));
  if (!info.value) return null;
  
  const data = info.value.data;
  if (!('parsed' in data)) return null;
  
  const extensions = data.parsed.info.extensions || [];
  const config = extensions.find((ext: { extension: string; state?: Record<string, string | number> }) => ext.extension === 'scaledUiAmountConfig');
  
  if (!config || !config.state) return null;
  
  return {
    authority: config.state.authority,
    multiplier: parseFloat(config.state.multiplier),
    newMultiplier: parseFloat(config.state.newMultiplier),
    newMultiplierEffectiveTimestamp: config.state.newMultiplierEffectiveTimestamp
  };
}

export function computeActiveMultiplier(config: ScaledUiAmountConfig, atTimestamp: number = Math.floor(Date.now() / 1000)): number {
  if (config.newMultiplierEffectiveTimestamp !== 0 && atTimestamp >= config.newMultiplierEffectiveTimestamp) {
    return config.newMultiplier;
  }
  return config.multiplier;
}

import { Keypair, Transaction, TransactionInstruction } from '@solana/web3.js';
import { VerificationResult } from './verification';

export async function notarizeVerificationResult(result: VerificationResult, asset: KnownAsset): Promise<string> {
  const connection = getSolanaConnection('devnet');
  
  const keypairString = process.env.NOTARY_KEYPAIR;
  if (!keypairString) {
    throw new Error('NOTARY_KEYPAIR is not set in environment variables');
  }
  
  let secretKey: Uint8Array;
  try {
    secretKey = Uint8Array.from(JSON.parse(keypairString));
  } catch {
    throw new Error('Invalid NOTARY_KEYPAIR format. Expected JSON array of numbers.');
  }
  const keypair = Keypair.fromSecretKey(secretKey);

  // Compact JSON format for memo
  const memoData = {
    t: asset.underlyingTicker,
    v: result.verdict === 'matches expected yield, no withholding signal detected' ? 'match' 
       : result.verdict === 'consistent with US 30% withholding tax on dividend' ? 'tax_30'
       : 'unexplained',
    d: parseFloat(result.discrepancy.toFixed(4)),
    ts: Math.floor(Date.now() / 1000)
  };

  const memoString = JSON.stringify(memoData);
  
  // Memo program v2
  const memoProgramId = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
  
  const instruction = new TransactionInstruction({
    keys: [{ pubkey: keypair.publicKey, isSigner: true, isWritable: true }],
    programId: memoProgramId,
    data: Buffer.from(memoString, 'utf-8'),
  });

  const transaction = new Transaction().add(instruction);
  
  try {
    const signature = await connection.sendTransaction(transaction, [keypair]);
    
    // Wait for confirmation
    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      signature,
      ...latestBlockhash
    });

    return signature;
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Notarization transaction failed:', errorMsg);
    throw new Error(`Failed to notarize to Solana Devnet. Check if the wallet has SOL.`);
  }
}
export async function getHistoricalMultiplierChange(mintAddress: string, approximateTimestamp: number): Promise<{ multiplier: number, newMultiplier: number } | null> {
  const connection = getSolanaConnection('mainnet');
  
  try {
    const config = await getScaledUiAmountConfig(mintAddress);
    if (!config || !config.authority) {
      throw new Error('No authority found for scaledUiAmountConfig');
    }
    
    const authorityPubkey = new PublicKey(config.authority);
    
    // We attempt to paginate the authority account instead of the mint, 
    // as it should theoretically have fewer transactions.
    const sigs = await connection.getSignaturesForAddress(authorityPubkey, { limit: 1000 });
    
    if (sigs.length === 0) return null;
    
    const oldestInBatch = sigs[sigs.length - 1];
    
    if (oldestInBatch.blockTime && oldestInBatch.blockTime > approximateTimestamp + 86400 * 30) {
      // Even querying the authority account, 1000 txns only takes us back a few days
      throw new Error(`Authority account transaction history too deep. 1000 txns only reach ${new Date(oldestInBatch.blockTime * 1000).toISOString()}. Cannot realistically paginate to ${new Date(approximateTimestamp * 1000).toISOString()} without a dedicated indexer.`);
    }

    // In a tractable scenario, we would parse the signatures around approximateTimestamp:
    // const tx = await connection.getParsedTransaction(targetSig.signature, { maxSupportedTransactionVersion: 0 });
    // extract multiplier values...

    return null;
  } catch (_e: unknown) {
    const errorMsg = _e instanceof Error ? _e.message : String(_e);
    console.warn(`Historical verification failed: ${errorMsg}`);
    if (errorMsg.includes('transaction history too deep')) {
      throw _e;
    }
    return null;
  }
}
