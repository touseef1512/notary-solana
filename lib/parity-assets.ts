import { KNOWN_ASSETS } from "./known-assets";

export interface ParityAsset {
  symbol: string;
  name: string;
  issuer: string;
  mintAddress: string;
  underlyingTicker: string;
}

export const KAMINO_PARITY_EXTRA: ParityAsset[] = [
  { symbol: "CRCLx", name: "Circle xStock", issuer: "xStocks", mintAddress: "XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1", underlyingTicker: "CRCL" },
  { symbol: "GOOGLx", name: "Alphabet xStock", issuer: "xStocks", mintAddress: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN", underlyingTicker: "GOOGL" },
  { symbol: "HOODx", name: "Robinhood xStock", issuer: "xStocks", mintAddress: "XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg", underlyingTicker: "HOOD" },
  { symbol: "METAx", name: "Meta xStock", issuer: "xStocks", mintAddress: "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu", underlyingTicker: "META" },
  { symbol: "MSTRx", name: "MicroStrategy xStock", issuer: "xStocks", mintAddress: "XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ", underlyingTicker: "MSTR" },
  { symbol: "QQQx", name: "Nasdaq xStock", issuer: "xStocks", mintAddress: "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ", underlyingTicker: "QQQ" },
  { symbol: "SPYx", name: "SP500 xStock", issuer: "xStocks", mintAddress: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W", underlyingTicker: "SPY" }
];

export const KAMINO_COLLATERAL_SYMBOLS: string[] = ["AAPLx","CRCLx","GOOGLx","HOODx","METAx","MSTRx","NVDAx","QQQx","SPYx","TSLAx"];

export function getParityAssets(): ParityAsset[] {
  const result: ParityAsset[] = [];
  const seenMints = new Set<string>();

  for (let i = 0; i < KNOWN_ASSETS.length; i++) {
    const a = KNOWN_ASSETS[i];
    if (a.mintAddress && a.underlyingTicker) {
      if (!seenMints.has(a.mintAddress)) {
        result.push({
          symbol: a.symbol,
          name: a.name,
          issuer: a.issuer,
          mintAddress: a.mintAddress,
          underlyingTicker: a.underlyingTicker
        });
        seenMints.add(a.mintAddress);
      }
    }
  }

  for (let i = 0; i < KAMINO_PARITY_EXTRA.length; i++) {
    const a = KAMINO_PARITY_EXTRA[i];
    if (!seenMints.has(a.mintAddress)) {
      result.push(a);
      seenMints.add(a.mintAddress);
    }
  }

  return result;
}
