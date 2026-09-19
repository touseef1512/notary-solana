/**
 * scripts/consumer-demo.ts
 * Run with: npx tsx scripts/consumer-demo.ts <obligation> [baseUrl]
 */

import { fetchMaybeAttestation, deserializeAttestationData, deriveAttestationPda } from 'sas-lib';
import { createSolanaRpc, address } from './sas-kit-shim';

async function main() {
  console.log("=== DEMO CONSUMER ===");
  const args = process.argv.slice(2);
  const obligation = args[0];
  const baseUrl = args[1] || 'http://localhost:3000';

  if (!obligation) {
    console.error("Usage: npx tsx scripts/consumer-demo.ts <obligation_pubkey> [baseUrl]");
    process.exit(1);
  }

  console.log(`Fetching registry from ${baseUrl}/api/v1/registry ...`);
  let registry: any;
  try {
    const regRes = await fetch(`${baseUrl}/api/v1/registry`);
    if (!regRes.ok) throw new Error(`Status ${regRes.status}`);
    registry = await regRes.json();
  } catch (err: any) {
    console.error(`Could not reach registry at ${baseUrl}: ${err.message || String(err)}`);
    process.exit(1);
  }

  const rpc = createSolanaRpc('https://api.devnet.solana.com');
  
  let credentialPda: any, schemaPda: any, nonce: any;
  try {
    credentialPda = address(registry.credential);
    schemaPda = address(registry.schema.pubkey);
    nonce = address(obligation);
  } catch (err: any) {
    console.error(`Invalid obligation pubkey or registry config: ${err.message || String(err)}`);
    process.exit(1);
  }

  const [attestationPda] = await deriveAttestationPda({ credential: credentialPda, schema: schemaPda, nonce });
  
  console.log(`Fetching attestation PDA: ${attestationPda} from devnet...`);
  // @ts-ignore - bypassing strict fetchMaybeAttestation typing for ease in demo
  const existingAttestation = await fetchMaybeAttestation(rpc as any, attestationPda);

  if (!existingAttestation.exists) {
    console.log("UNKNOWN: no attestation found for this obligation, treat as unverified");
    process.exit(3);
  }

  const attestationData = existingAttestation.data;
  
  const textEncoder = new TextEncoder();
  const encodedFields: number[] = [];
  for (const name of registry.schema.fieldNames) {
    const bytes = textEncoder.encode(name);
    encodedFields.push(bytes.length & 0xff);
    encodedFields.push((bytes.length >> 8) & 0xff);
    encodedFields.push((bytes.length >> 16) & 0xff);
    encodedFields.push((bytes.length >> 24) & 0xff);
    encodedFields.push(...bytes);
  }

  const mockSchemaData = {
    layout: registry.schema.layout,
    fieldNames: encodedFields
  };

  // @ts-ignore
  const decodedRaw = deserializeAttestationData(mockSchemaData, new Uint8Array(attestationData.data)) as Record<string, unknown>;
  
  const decoded: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(decodedRaw)) {
    decoded[k] = typeof v === 'bigint' ? v.toString() : v;
  }

  console.log("\nDecoded Fields:");
  console.log(JSON.stringify(decoded, null, 2));

  const gapStressedBps = Number(decoded.gapStressedHealthFactorBps);
  const computedAt = Number(decoded.computedAtUnixTs);
  
  if (!Number.isFinite(gapStressedBps) || !Number.isFinite(computedAt)) {
    console.log("BLOCK: attestation data missing or could not be decoded (fail closed)");
    process.exit(2);
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - computedAt;

  console.log("\nDecision:");
  if (gapStressedBps < 10000) {
    console.log("BLOCK: Gap stressed health factor is < 1.0 (under 10000 bps)");
  } else if (gapStressedBps < 12000) {
    console.log("WARN: Gap stressed health factor is < 1.2 (under 12000 bps)");
  } else if (ageSeconds > 86400) {
    console.log(`WARN: Attestation is older than 24 hours (age: ${Math.floor(ageSeconds/3600)}h)`);
  } else {
    console.log("ALLOW: Obligation is healthy.");
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
