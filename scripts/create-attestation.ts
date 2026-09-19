/**
 * scripts/create-attestation.ts
 *
 * Creates a SAS attestation for a Kamino obligation's risk metrics.
 */

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
} from './sas-kit-shim';

import { getKaminoPositions } from '../lib/kamino.js';
import { computeSurvivableDrawdown, computeGapStressedHealthFactor } from '../lib/risk-math.js';

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
  instruction: Parameters<typeof appendTransactionMessageInstruction>[0],
  label: string
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

  const sigBase58 = getSignatureFromTransaction(signed);
  console.log(`  ✓ ${label} confirmed`);
  console.log(`    Signature: ${sigBase58}`);
  console.log(`    Explorer:  https://explorer.solana.com/tx/${sigBase58}?cluster=devnet`);
  return sigBase58 as string;
}

async function main() {
  console.log('=== SAS Attestation Creation ===\n');

  // Load keypair
  const env = loadEnv();
  if (!env['NOTARY_KEYPAIR']) throw new Error('NOTARY_KEYPAIR not found in .env.local');
  const keypairBytes = new Uint8Array(JSON.parse(env['NOTARY_KEYPAIR']));
  const signer = await createKeyPairSignerFromBytes(keypairBytes);
  console.log(`Signer address: ${signer.address}`);

  // RPC connections
  const rpc = createSolanaRpc('https://api.devnet.solana.com');
  const rpcSubs = createSolanaRpcSubscriptions('wss://api.devnet.solana.com');

  // 1. Read lib/sas-config.json
  const configPath = path.resolve(process.cwd(), 'lib', 'sas-config.json');
  if (!fs.existsSync(configPath)) throw new Error('sas-config.json not found');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const credentialPda = address(config.credentialPubkey);
  const schemaPda = address(config.schemaPubkey);

  // 2. Fetch the on-chain schema account
  const schemaAccount = await fetchMaybeSchema(rpc as Parameters<typeof fetchMaybeSchema>[0], schemaPda);
  if (!schemaAccount.exists) {
    throw new Error('Schema account not found on-chain. Did you run setup-sas.ts?');
  }

  // 3. Fetch Kamino obligations
  const demoWallet = 'Fa7LNzj3SCV364hya9dx9evL29pC1awx24iHeCEwX6vU';
  console.log(`\nFetching Kamino positions for demo wallet: ${demoWallet}`);
  const obligations = await getKaminoPositions(demoWallet);
  if (obligations.length === 0) {
    throw new Error('No obligations found for demo wallet.');
  }
  const obligation = obligations[0];

  // 4 & 5. Compute risk metrics
  const currentHealth = (obligation.depositedValue * obligation.liquidationLtvThreshold) / obligation.borrowedValue;
  const drawdowns = computeSurvivableDrawdown(obligation);
  
  let worstAssetSymbol = '';
  let worstDrawdownValue = Infinity;
  let allInsufficient = true;
  for (const [symbol, dd] of Object.entries(drawdowns)) {
    if (typeof dd === 'number') {
      allInsufficient = false;
      if (dd < worstDrawdownValue) {
        worstDrawdownValue = dd;
        worstAssetSymbol = symbol;
      }
    }
  }
  if (allInsufficient) {
    throw new Error('All survivable drawdowns are "Insufficient Data", cannot determine worst asset.');
  }

  const gapPercentages = {
    'CRCLx': -4.71,
    'METAx': 3.67,
    'TSLAx': -2.39,
    'NVDAx': -2.64,
    'HOODx': -1.89,
    'QQQx': -1.17,
    'MSTRx': -1.01,
    'SPYx': -0.36,
    'AAPLx': 0.03,
    'GOOGLx': 2.16
  };
  const gapStressedHealth = computeGapStressedHealthFactor(obligation, gapPercentages);
  if (typeof gapStressedHealth !== 'number') {
    throw new Error('Gap-stressed health factor is "Insufficient Data", stopping.');
  }

  // 6. Build the attestation data object
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

  console.log('\nAttestation Data Object:', dataObject);

  // 7. Serialize this object
  const serializedData = serializeAttestationData(schemaAccount.data, dataObject);

  // 8. Derive the attestation PDA
  const nonce = address(obligation.obligationPubkey);
  const [attestationPda] = await deriveAttestationPda({ credential: credentialPda, schema: schemaPda, nonce });
  console.log(`\nAttestation PDA: ${attestationPda}`);

  // 9. Check if it already exists
  const existingAttestation = await fetchMaybeAttestation(rpc as Parameters<typeof fetchMaybeAttestation>[0], attestationPda);
  if (existingAttestation.exists) {
    console.log('  → Attestation already exists, skipping.');
  } else {
    console.log('  → Creating attestation...');
    // 10. Build the instruction
    // Assuming expiry=0 means 'never expires' since there's no documentation on it in createAttestation.d.ts or attestation.d.ts.
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
    // 11. Send it
    await buildAndSend(rpc, rpcSubs, signer, attestationIx, 'createAttestation');
  }

  // 12. Read back from chain
  console.log('\n=== On-Chain Readback ===\n');
  const attestationAccount = await fetchMaybeAttestation(rpc as Parameters<typeof fetchMaybeAttestation>[0], attestationPda);
  if (attestationAccount.exists) {
    const attestation = attestationAccount.data;
    const decoded = deserializeAttestationData(schemaAccount.data, attestation.data);
    console.log('Decoded Attestation Data:');
    for (const [key, value] of Object.entries(decoded as Record<string, any>)) {
      if (typeof value === 'bigint') {
        console.log(`  ${key}: ${value.toString()}`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    }
  } else {
    console.log('ERROR: Attestation account not found on-chain!');
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
