import fs from 'fs';
import path from 'path';

import {
  getCreateAttestationInstruction,
  deriveAttestationPda,
  fetchMaybeSchema,
  fetchMaybeAttestation,
  serializeAttestationData,
  deserializeAttestationData,
} from 'sas-lib';

import {
  createSolanaRpc,
  createKeyPairSignerFromBytes,
  createTransactionMessage,
  appendTransactionMessageInstruction,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  sendAndConfirmTransactionFactory,
  createSolanaRpcSubscriptions,
  getSignatureFromTransaction,
  address,
  pipe,
} from '../scripts/sas-kit-shim';

import { KaminoObligationData } from './kamino';

function loadEnv(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const m = line.match(/^([^=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
    }
  }
  return process.env as Record<string, string>;
}

async function getLatestBlockhash(rpc: ReturnType<typeof createSolanaRpc>) {
  const { value } = await rpc.getLatestBlockhash({ commitment: 'confirmed' }).send();
  return value;
}

async function buildAndSend(
  rpc: ReturnType<typeof createSolanaRpc>,
  rpcSubs: ReturnType<typeof createSolanaRpcSubscriptions>,
  signer: Awaited<ReturnType<typeof createKeyPairSignerFromBytes>>,
  instruction: Parameters<typeof appendTransactionMessageInstruction>[0]
): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await getLatestBlockhash(rpc);

  const txMsg = pipe(
    createTransactionMessage({ version: 0 }),
    (m: Parameters<typeof setTransactionMessageFeePayerSigner>[1]) => setTransactionMessageFeePayerSigner(signer, m),
    (m: Parameters<typeof setTransactionMessageLifetimeUsingBlockhash>[1]) =>
      setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight }, m),
    (m: Parameters<typeof appendTransactionMessageInstruction>[1]) =>
      appendTransactionMessageInstruction(instruction, m),
  );

  const signed = await signTransactionMessageWithSigners(txMsg);

  const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions: rpcSubs });
  await sendAndConfirm(signed, { commitment: 'confirmed' });

  return getSignatureFromTransaction(signed) as string;
}

function getSasConfig() {
  const configPath = path.resolve(process.cwd(), 'lib', 'sas-config.json');
  if (!fs.existsSync(configPath)) throw new Error('sas-config.json not found');
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

export async function getAttestationStatus(obligationPubkey: string): Promise<{ exists: boolean; decoded: Record<string, unknown> | null; attestationPda: string }> {
  const config = getSasConfig();
  const credentialPda = address(config.credentialPubkey);
  const schemaPda = address(config.schemaPubkey);

  const rpc = createSolanaRpc('https://api.devnet.solana.com');

  const schemaAccount = await fetchMaybeSchema(rpc as Parameters<typeof fetchMaybeSchema>[0], schemaPda);
  if (!schemaAccount.exists) {
    throw new Error('Schema account not found on-chain. Did you run setup-sas.ts?');
  }

  const nonce = address(obligationPubkey);
  const [attestationPda] = await deriveAttestationPda({ credential: credentialPda, schema: schemaPda, nonce });

  const existingAttestation = await fetchMaybeAttestation(rpc as Parameters<typeof fetchMaybeAttestation>[0], attestationPda);
  if (!existingAttestation.exists) {
    return { exists: false, decoded: null, attestationPda };
  }

  const attestation = existingAttestation.data;
  const decodedRaw = deserializeAttestationData(schemaAccount.data, new Uint8Array(attestation.data)) as Record<string, unknown>;
  
  const decoded: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(decodedRaw)) {
    if (typeof v === 'bigint') {
      decoded[k] = v.toString();
    } else {
      decoded[k] = v;
    }
  }

  return { exists: true, decoded, attestationPda };
}

export async function publishRiskAttestation(
  obligation: KaminoObligationData, 
  drawdowns: Record<string, number | "Insufficient Data">, 
  worstAssetSymbol: string, 
  worstDrawdownValue: number, 
  gapStressedHealth: number
): Promise<{ signature: string; explorerUrl: string; attestationPda: string }> {
  const env = loadEnv();
  if (!env['NOTARY_KEYPAIR']) throw new Error('NOTARY_KEYPAIR not found in .env.local');
  const keypairBytes = new Uint8Array(JSON.parse(env['NOTARY_KEYPAIR']));
  const signer = await createKeyPairSignerFromBytes(keypairBytes);

  const rpc = createSolanaRpc('https://api.devnet.solana.com');
  const rpcSubs = createSolanaRpcSubscriptions('wss://api.devnet.solana.com');

  const config = getSasConfig();
  const credentialPda = address(config.credentialPubkey);
  const schemaPda = address(config.schemaPubkey);

  const schemaAccount = await fetchMaybeSchema(rpc as Parameters<typeof fetchMaybeSchema>[0], schemaPda);
  if (!schemaAccount.exists) {
    throw new Error('Schema account not found on-chain. Did you run setup-sas.ts?');
  }

  const nonce = address(obligation.obligationPubkey);
  const [attestationPda] = await deriveAttestationPda({ credential: credentialPda, schema: schemaPda, nonce });

  const existingAttestation = await fetchMaybeAttestation(rpc as Parameters<typeof fetchMaybeAttestation>[0], attestationPda);
  if (existingAttestation.exists) {
    throw new Error('Attestation already exists for this obligation');
  }

  const currentHealth = (obligation.depositedValue * obligation.liquidationLtvThreshold) / obligation.borrowedValue;

  const dataObject = {
    obligationPubkey: obligation.obligationPubkey,
    depositedValueUsdCents: BigInt(Math.round(obligation.depositedValue * 100)),
    borrowedValueUsdCents: BigInt(Math.round(obligation.borrowedValue * 100)),
    liquidationThresholdBps: Math.round(obligation.liquidationLtvThreshold * 10000),
    currentHealthFactorBps: Math.round(currentHealth * 10000),
    worstAssetSymbol: worstAssetSymbol,
    worstAssetSurvivableDrawdownBps: BigInt(Math.round(worstDrawdownValue * 10000)),
    gapStressedHealthFactorBps: Math.round(gapStressedHealth * 10000),
    computedAtUnixTs: BigInt(Math.floor(Date.now() / 1000)),
  };

  const serializedData = serializeAttestationData(schemaAccount.data, dataObject);

  // Assuming expiry=0 means 'never expires'
  const attestationIx = getCreateAttestationInstruction({
    payer: signer,
    authority: signer,
    credential: credentialPda,
    schema: schemaPda,
    attestation: attestationPda,
    nonce,
    data: serializedData,
    expiry: 0,
  });

  const signature = await buildAndSend(rpc, rpcSubs, signer, attestationIx);
  const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;

  return { signature, explorerUrl, attestationPda };
}
