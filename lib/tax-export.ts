import { KnownAsset } from './known-assets';
import { HoldingData, computeTrueTotalReturn } from './total-return';

export async function generateTaxCsv(asset: KnownAsset, holdings: HoldingData): Promise<string> {
  // Pass 0 for currentPrice since we only need the events for tax export
  const result = await computeTrueTotalReturn(asset, holdings, 0);
  
  // Sort events chronologically (oldest first)
  const sortedEvents = [...result.events].sort(
    (a, b) => new Date(a.exDate).getTime() - new Date(b.exDate).getTime()
  );
  
  const lines: string[] = [];
  lines.push("Ex-Dividend Date,Gross Amount (USD),Tax Withheld (USD),Net Received (USD),Cumulative Cost Basis Adjustment (USD),Verification Status");
  
  let cumulative = 0;
  let totalGross = 0;
  let totalTax = 0;
  let totalNet = 0;
  
  for (const ev of sortedEvents) {
    const taxWithheld = ev.grossAmount - ev.actualReceived;
    cumulative += ev.actualReceived;
    
    totalGross += ev.grossAmount;
    totalTax += taxWithheld;
    totalNet += ev.actualReceived;
    
    const status = ev.independentlyVerified 
      ? "Independently Verified On-Chain" 
      : "Assumed — Not Independently Verifiable";
    
    lines.push(`${ev.exDate},${ev.grossAmount.toFixed(4)},${taxWithheld.toFixed(4)},${ev.actualReceived.toFixed(4)},${cumulative.toFixed(4)},"${status}"`);
  }
  
  lines.push("");
  lines.push(`Total,${totalGross.toFixed(4)},${totalTax.toFixed(4)},${totalNet.toFixed(4)},-,-`);
  lines.push("");
  lines.push("This report reflects on-chain verified data where available and reasonable assumptions where independent verification was not possible on public infrastructure. Consult a tax professional. Not tax advice.");
  
  return lines.join("\n");
}
