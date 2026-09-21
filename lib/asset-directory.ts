import { getParityAssets, KAMINO_COLLATERAL_SYMBOLS } from './parity-assets';
import { KNOWN_ASSETS } from './known-assets';

export interface DirectoryEntry {
  symbol: string;
  name: string;
  issuer: string;
  underlyingTicker: string;
  mintAddress: string;
  inKaminoMarket: boolean;
  inTrustRegistry: boolean;
}

export function buildAssetDirectory(): DirectoryEntry[] {
  const assets = getParityAssets();
  const entries: DirectoryEntry[] = [];
  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    let inKaminoMarket = false;
    for (let j = 0; j < KAMINO_COLLATERAL_SYMBOLS.length; j++) {
      if (KAMINO_COLLATERAL_SYMBOLS[j] === asset.symbol) {
        inKaminoMarket = true;
        break;
      }
    }
    let inTrustRegistry = false;
    for (let j = 0; j < KNOWN_ASSETS.length; j++) {
      if (KNOWN_ASSETS[j].mintAddress === asset.mintAddress) {
        inTrustRegistry = true;
        break;
      }
    }
    entries.push({
      symbol: asset.symbol,
      name: asset.name,
      issuer: asset.issuer,
      underlyingTicker: asset.underlyingTicker,
      mintAddress: asset.mintAddress,
      inKaminoMarket,
      inTrustRegistry
    });
  }
  return entries;
}
