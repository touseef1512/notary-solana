import { NextResponse } from 'next/server';
import config from '@/lib/sas-config.json';

const SCHEMA_LAYOUT = [12, 3, 3, 2, 2, 12, 8, 2, 3];
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

export async function GET() {
  return NextResponse.json({
    cluster: "devnet",
    credential: config.credentialPubkey,
    schema: {
      pubkey: config.schemaPubkey,
      name: config.schemaName,
      version: config.schemaVersion,
      fieldNames: SCHEMA_FIELD_NAMES,
      layout: SCHEMA_LAYOUT,
    },
    units: "UsdCents are in cents (e.g. 100 = $1.00). Bps are in basis points (e.g. 10000 = 100%). worstAssetSurvivableDrawdownBps is signed and can be negative (negative means already past liquidation).",
    notes: "Attestations are point-in-time snapshots; check computedAtUnixTs."
  });
}
