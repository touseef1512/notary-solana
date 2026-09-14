import { KnownAsset } from './known-assets';

export interface AttestationResult {
  asset: KnownAsset;
  hasLiveAttestation: boolean;
  classification: string;
  attestationAgeHours: number | null;
  backingRatio: number | null;
  bufferPercent: number | null;
  disclosure: string;
  details: Record<string, unknown> | null;
}

const cache: Record<string, { timestamp: number, data: Record<string, unknown> }> = {};
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function getReserveAttestation(asset: KnownAsset): Promise<AttestationResult> {
  if (asset.issuer === 'xStocks') {
    return await getXStocksAttestation(asset);
  } else if (asset.issuer === 'Ondo') {
    return getOndoAttestation(asset);
  } else {
    return {
      asset,
      hasLiveAttestation: false,
      classification: "unknown issuer",
      attestationAgeHours: null,
      backingRatio: null,
      bufferPercent: null,
      disclosure: "No attestation implementation for this issuer.",
      details: null
    };
  }
}

async function getXStocksAttestation(asset: KnownAsset): Promise<AttestationResult> {
  const url = `https://api.xstocks.fi/api/v2/public/proof-of-reserves/${asset.symbol}`;
  
  let data: Record<string, unknown>;
  const now = Date.now();

  if (cache[url] && now - cache[url].timestamp < CACHE_TTL_MS) {
    data = cache[url].data;
  } else {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch from xStocks API: ${response.status} ${response.statusText}`);
      }
      data = await response.json();
      cache[url] = { timestamp: now, data };
    } catch (_e: unknown) {
      const errorMsg = _e instanceof Error ? _e.message : String(_e);
      return {
        asset,
        hasLiveAttestation: false,
        classification: "API error",
        attestationAgeHours: null,
        backingRatio: null,
        bufferPercent: null,
        disclosure: `Failed to fetch live attestation data: ${errorMsg}`,
        details: null
      };
    }
  }

  const sharesHeld = parseFloat(String(data.sharesHeld));
  const circulatingSupply = parseFloat(String(data.circulatingSupply));
  
  if (isNaN(sharesHeld) || isNaN(circulatingSupply) || circulatingSupply === 0) {
     return {
        asset,
        hasLiveAttestation: true,
        classification: "Invalid data received from API",
        attestationAgeHours: null,
        backingRatio: null,
        bufferPercent: null,
        disclosure: "API returned invalid numbers for sharesHeld or circulatingSupply.",
        details: data
      };
  }

  const backingRatio = sharesHeld / circulatingSupply;
  const bufferPercent = backingRatio - 1; // stored as a fraction consistent with backingRatio
  
  const apiTimestamp = new Date(String(data.timestamp)).getTime();
  const attestationAgeHours = (now - apiTimestamp) / (1000 * 60 * 60);

  let classification = "";
  if (backingRatio < 1.0) {
    classification = "UNDER-COLLATERALIZED - flag for review";
  } else {
    classification = `fully backed (+${(bufferPercent * 100).toFixed(2)}% buffer)`;
  }

  if (attestationAgeHours > 48) {
    classification += " (stale attestation)";
  }

  return {
    asset,
    hasLiveAttestation: true,
    classification,
    attestationAgeHours,
    backingRatio,
    bufferPercent,
    disclosure: "Note: circulatingSupply from this API is the issuer's GLOBAL total across all chains they issue on (EVM/TON/Solana per their own docs), not Solana-specific.",
    details: data
  };
}

function getOndoAttestation(asset: KnownAsset): AttestationResult {
  return {
    asset,
    hasLiveAttestation: false,
    classification: "no live, queryable reserve attestation found",
    attestationAgeHours: null,
    backingRatio: null,
    bufferPercent: null,
    disclosure: "Ondo uses a Chainlink oracle partnership and claims 1:1 backing per their docs. However, no live, queryable reserve attestation API was found. The static sourced context is reported honestly.",
    details: null
  };
}
