import { PublicKey } from "@solana/web3.js";
import { KAMINO_PARITY_EXTRA, KAMINO_COLLATERAL_SYMBOLS, getParityAssets } from "../lib/parity-assets";
import { getAllMeasuredWeekendGaps } from "../lib/weekend-gap";

let failed = false;
function check(name: string, ok: boolean) {
  console.log((ok ? "PASS" : "FAIL") + ": " + name);
  if (!ok) failed = true;
}

const ON_CHAIN: Record<string, string> = {
  CRCLx: "XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1",
  GOOGLx: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN",
  HOODx: "XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg",
  METAx: "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu",
  MSTRx: "XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ",
  QQQx: "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ",
  SPYx: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W",
};
const TICKERS: Record<string, string> = { CRCLx: "CRCL", GOOGLx: "GOOGL", HOODx: "HOOD", METAx: "META", MSTRx: "MSTR", QQQx: "QQQ", SPYx: "SPY" };

async function run() {
  const gapData = await getAllMeasuredWeekendGaps();
  check("(1) exactly seven extra assets", KAMINO_PARITY_EXTRA.length === 7);
KAMINO_PARITY_EXTRA.forEach((a) => {
  check("(2) " + a.symbol + " mint equals the on-chain value", ON_CHAIN[a.symbol] === a.mintAddress);
  check("(3) " + a.symbol + " ticker", TICKERS[a.symbol] === a.underlyingTicker && a.issuer === "xStocks");
  let valid = true;
  try { new PublicKey(a.mintAddress); } catch { valid = false; }
  check("(4) " + a.symbol + " mint is a valid public key", valid);
  check("(5) " + a.symbol + " has a measured weekend gap", Object.prototype.hasOwnProperty.call(gapData, a.symbol));
});
const all = getParityAssets();
const mints = all.map((a) => a.mintAddress);
check("(6) thirteen parity assets with unique mints", all.length === 13 && new Set(mints).size === 13);
check("(7) ten Kamino collateral symbols, each present in the parity list", KAMINO_COLLATERAL_SYMBOLS.length === 10 && KAMINO_COLLATERAL_SYMBOLS.every((s) => all.some((a) => a.symbol === s)));
check("(8) every fixed-table symbol is a Kamino collateral symbol", Object.keys(gapData).every((s) => KAMINO_COLLATERAL_SYMBOLS.indexOf(s) !== -1));
if (failed) process.exitCode = 1;
}

run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
