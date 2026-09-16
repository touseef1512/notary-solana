/**
 * scripts/setup-sas.ts
 *
 * One-time setup: creates a Credential + Schema on-chain via the Solana
 * Attestation Service (SAS) on devnet. Checks whether they already exist
 * before sending any transactions. Writes pubkeys to lib/sas-config.json.
 *
 * Run: npx tsx scripts/setup-sas.ts
 */

import fs from 'fs';
import path from 'path';

// ── SAS lib (instruction builders, PDA helpers, account decoders) ──────────
import {
  deriveCredentialPda,
  deriveSchemaPda,
  getCreateCredentialInstruction,
  getCreateSchemaInstruction,
  fetchMaybeCredential,
  fetchMaybeSchema,
} from 'sas-lib';

// ── Kit primitives from the shim (sas-lib's own @solana/kit@5.5.1) ────────
import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createKeyPairSignerFromBytes,
  createTransactionMessage,
  appendTransactionMessageInstruction,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  sendAndConfirmTransactionFactory,
  address,
  pipe,
} from './sas-kit-shim';

// ── Config ──────────────────────────────────────────────────────────────────
const CREDENTIAL_NAME = 'Notary Risk Oracle';
const SCHEMA_NAME     = 'KaminoObligationRisk';
const SCHEMA_VERSION  = 1;
const SCHEMA_DESCRIPTION = 'Kamino obligation risk metrics published by the Notary protocol';

/*
 * Schema layout — one byte per field, using the compactLayoutMapping from sas-lib/utils.js:
 *   0=u8, 1=u16, 2=u32, 3=u64, 4=u128, 5=i8, 6=i16, 7=i32, 8=i64, 9=i128,
 *   10=bool, 11=char, 12=String, 13=Vec<u8>, ...
 *
 * Fields:
 *   obligationPubkey              → 12  (String)
 *   depositedValueUsdCents        → 3   (u64  — cents, e.g. $326.03 = 32603)
 *   borrowedValueUsdCents         → 3   (u64)
 *   liquidationThresholdBps       → 2   (u32  — basis points, e.g. 40% = 4000)
 *   currentHealthFactorBps        → 2   (u32  — HF*10000, e.g. 1.1919 = 11919)
 *   worstAssetSymbol              → 12  (String)
 *   worstAssetSurvivableDrawdownBps→ 2  (u32  — e.g. 39.22% = 3922)
 *   gapStressedHealthFactorBps    → 2   (u32  — HF*10000)
 *   computedAtUnixTs              → 8   (i64  — unix timestamp)
 */
const SCHEMA_LAYOUT      = Uint8Array.from([12, 3, 3, 2, 2, 12, 2, 2, 8]);
const SCHEMA_FIELD_NAMES = [
  'obligationPubkey',
  'depositedValueUsdCents',
  'borrowedValueUsdCents',
  'liquidationThresholdBps',
  'currentHealthFactorBps',
  'worstAssetSymbol',
  'worstAssetSurvivableDrawdownBps',
  'gapStressedHealthFactorBps',
  'computedAtUnixTs',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadEnv(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  const env: Record<string, string> = {};
  for (const line of lines) {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
  }
  return env;
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

  // Extract signature from signed tx
  const sigs = Object.entries(signed.signatures ?? {});
  const sig = sigs.length > 0 ? sigs[0][1] : 'unknown';
  const sigBase58 = Buffer.from(sig as Uint8Array).toString('base58') ?? sig;
  console.log(`  ✓ ${label} confirmed`);
  console.log(`    Signature: ${sigBase58}`);
  console.log(`    Explorer:  https://explorer.solana.com/tx/${sigBase58}?cluster=devnet`);
  return sigBase58 as string;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== SAS Setup: Credential + Schema ===\n');

  // 1. Load keypair
  const env = loadEnv();
  if (!env['NOTARY_KEYPAIR']) throw new Error('NOTARY_KEYPAIR not found in .env.local');
  const keypairBytes = new Uint8Array(JSON.parse(env['NOTARY_KEYPAIR']));
  const signer = await createKeyPairSignerFromBytes(keypairBytes);
  console.log(`Signer address: ${signer.address}`);

  // 2. RPC connections
  const rpc     = createSolanaRpc('https://api.devnet.solana.com');
  const rpcSubs = createSolanaRpcSubscriptions('wss://api.devnet.solana.com');

  // Check devnet balance
  const balResp = await rpc.getBalance(signer.address as Parameters<typeof rpc.getBalance>[0], { commitment: 'confirmed' }).send();
  console.log(`Devnet balance: ${Number(balResp.value) / 1e9} SOL\n`);

  // 3. Derive Credential PDA
  const [credentialPda] = await deriveCredentialPda({ authority: signer.address, name: CREDENTIAL_NAME });
  console.log(`Credential PDA: ${credentialPda}`);

  // 4. Check if credential already exists
  const existingCredential = await fetchMaybeCredential(rpc as Parameters<typeof fetchMaybeCredential>[0], credentialPda);
  let credentialSig = 'already-existed';
  if (!existingCredential.exists) {
    console.log('  → Creating credential...');
    const credIx = getCreateCredentialInstruction({
      payer:      signer,
      credential: credentialPda,
      authority:  signer,
      name:       CREDENTIAL_NAME,
      signers:    [signer.address],
    });
    credentialSig = await buildAndSend(rpc, rpcSubs, signer, credIx, 'createCredential');
  } else {
    console.log('  → Credential already exists, skipping.');
  }

  // 5. Derive Schema PDA
  const [schemaPda] = await deriveSchemaPda({ credential: credentialPda, name: SCHEMA_NAME, version: SCHEMA_VERSION });
  console.log(`\nSchema PDA: ${schemaPda}`);

  // 6. Check if schema already exists
  const existingSchema = await fetchMaybeSchema(rpc as Parameters<typeof fetchMaybeSchema>[0], schemaPda);
  let schemaSig = 'already-existed';
  if (!existingSchema.exists) {
    console.log('  → Creating schema...');
    const schemaIx = getCreateSchemaInstruction({
      payer:       signer,
      authority:   signer,
      credential:  credentialPda,
      schema:      schemaPda,
      name:        SCHEMA_NAME,
      description: SCHEMA_DESCRIPTION,
      layout:      SCHEMA_LAYOUT,
      fieldNames:  SCHEMA_FIELD_NAMES,
    });
    schemaSig = await buildAndSend(rpc, rpcSubs, signer, schemaIx, 'createSchema');
  } else {
    console.log('  → Schema already exists, skipping.');
  }

  // 7. Fetch and decode both accounts from chain
  console.log('\n=== On-Chain Readback ===\n');

  const credAccount = await fetchMaybeCredential(rpc as Parameters<typeof fetchMaybeCredential>[0], credentialPda);
  if (credAccount.exists) {
    const c = credAccount.data;
    console.log('Credential account:');
    console.log('  discriminator:', c.discriminator);
    console.log('  authority:    ', c.authority);
    console.log('  name (bytes): ', Buffer.from(c.name).toString());
    console.log('  authorizedSigners:', c.authorizedSigners);
  } else {
    console.log('ERROR: Credential account not found after creation!');
  }

  const schemaAccount = await fetchMaybeSchema(rpc as Parameters<typeof fetchMaybeSchema>[0], schemaPda);
  if (schemaAccount.exists) {
    const s = schemaAccount.data;
    console.log('\nSchema account:');
    console.log('  discriminator:', s.discriminator);
    console.log('  credential:   ', s.credential);
    console.log('  name (bytes): ', Buffer.from(s.name).toString());
    console.log('  description:  ', Buffer.from(s.description).toString());
    console.log('  layout:       ', Array.from(s.layout));
    console.log('  isPaused:     ', s.isPaused);
    console.log('  version:      ', s.version);
    // Decode field names from the joined-vec format
    const fieldNamesBytes = Buffer.from(s.fieldNames);
    const fields: string[] = [];
    let offset = 0;
    while (offset < fieldNamesBytes.length) {
      const len = fieldNamesBytes.readUInt32LE(offset);
      offset += 4;
      fields.push(fieldNamesBytes.slice(offset, offset + len).toString());
      offset += len;
    }
    console.log('  fieldNames:   ', fields);
  } else {
    console.log('ERROR: Schema account not found after creation!');
  }

  // 8. Write lib/sas-config.json
  const config = {
    credentialPubkey: credentialPda,
    schemaPubkey:     schemaPda,
    schemaName:       SCHEMA_NAME,
    schemaVersion:    SCHEMA_VERSION,
    credentialTxSig:  credentialSig,
    schemaTxSig:      schemaSig,
    createdAt:        new Date().toISOString(),
  };
  const configPath = path.resolve(process.cwd(), 'lib', 'sas-config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`\n✓ Wrote lib/sas-config.json:`);
  console.log(JSON.stringify(config, null, 2));
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
