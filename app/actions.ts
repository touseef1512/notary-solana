"use server";

import { getTokenizedStockHoldings as fetchHoldings } from "@/lib/solana";
import { TokenHolding } from "@/lib/solana";

export async function getTokenizedStockHoldings(walletAddress: string): Promise<TokenHolding[]> {
  return await fetchHoldings(walletAddress);
}
