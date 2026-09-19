import { KnownAsset } from './known-assets';
import { HoldingData, computeTrueTotalReturn } from './total-return';
import { getStockPrice } from './market-data';

export async function generateTaxCsv(asset: KnownAsset, holdings: HoldingData): Promise<string> {
  // Pass 0 for currentPrice since we only need the events for tax export
  const result = await computeTrueTotalReturn(asset, holdings, 0);
  
  // Sort events chronologically (oldest first)
  const sortedEvents = [...result.events].sort(
    (a, b) => new Date(a.exDate).getTime() - new Date(b.exDate).getTime()
  );
  
  const lines: string[] = [];
  lines.push("Ex-Dividend Date,Gross Amount (USD),Withholding Rate Applied,Tax Withheld (USD),Net Received (USD),Cumulative Net Dividends (USD),Reference Price (USD),Verification Status");
  
  let cumulative = 0;
  let totalGross = 0;
  let totalTax = 0;
  let totalNet = 0;
  let unknownCount = 0;
  
  for (const ev of sortedEvents) {
    const rateKnown = ev.independentlyVerified || result.latestRateVerified;
    
    totalGross += ev.grossAmount;
    
    let rateCell = "Insufficient Data";
    let taxCell = "Insufficient Data";
    let netCell = "Insufficient Data";
    let cumulativeCell = "Insufficient Data";
    
    let status = ev.independentlyVerified 
      ? "Independently Verified On-Chain" 
      : "Assumed — Not Independently Verifiable";
      
    if (rateKnown) {
      const taxWithheld = ev.grossAmount - ev.actualReceived;
      cumulative += ev.actualReceived;
      totalTax += taxWithheld;
      totalNet += ev.actualReceived;
      
      rateCell = ev.grossAmount > 0 ? (taxWithheld / ev.grossAmount * 100).toFixed(2) + "%" : "0.00%";
      taxCell = taxWithheld.toFixed(4);
      netCell = ev.actualReceived.toFixed(4);
      cumulativeCell = cumulative.toFixed(4);
    } else {
      unknownCount++;
      status = "Withholding could not be verified";
    }
    
    const refCell = ev.referencePrice > 0 ? ev.referencePrice.toFixed(2) : "Insufficient Data";
    
    lines.push(`${ev.exDate},${ev.grossAmount.toFixed(4)},${rateCell},${taxCell},${netCell},${cumulativeCell},${refCell},"${status}"`);
  }
  
  lines.push("");
  lines.push(`Total,${totalGross.toFixed(4)},-,${totalTax.toFixed(4)},${totalNet.toFixed(4)},-,-,-`);
  if (unknownCount > 0) {
    lines.push(`Rows with unknown withholding: ${unknownCount} (excluded from tax and net totals)`);
  }
  
  lines.push("");
  lines.push("Estimated position (price only and excludes dividends)");
  
  let costBasisCell = "Insufficient Data";
  let dateCell = "Insufficient Data";
  let priceCell = "Insufficient Data";
  let mvCell = "Insufficient Data";
  let gainCell = "Insufficient Data";

  if (Number.isFinite(holdings.purchasePrice) && Number.isFinite(holdings.shares) && holdings.purchasePrice > 0 && holdings.shares > 0) {
    costBasisCell = (holdings.purchasePrice * holdings.shares).toFixed(2);
    
    let price: number | null = null;
    let dateStr: string | null = null;
    try {
      const priceData = await getStockPrice(asset.underlyingTicker);
      if (priceData && priceData.price !== null && Number.isFinite(priceData.price) && priceData.price > 0) {
        price = priceData.price;
        dateStr = priceData.date;
      }
    } catch {
    }
    
    if (price !== null && dateStr !== null) {
      priceCell = price.toFixed(2);
      dateCell = dateStr;
      mvCell = (price * holdings.shares).toFixed(2);
      gainCell = (price * holdings.shares - holdings.purchasePrice * holdings.shares).toFixed(2);
    }
  }

  lines.push(`Cost basis from your entered figures (USD),${costBasisCell}`);
  lines.push(`Last close date of underlying stock,${dateCell}`);
  lines.push(`Last close price of underlying stock (USD),${priceCell}`);
  lines.push(`Estimated market value (USD),${mvCell}`);
  lines.push(`Estimated unrealized gain or loss (USD),${gainCell}`);
  lines.push(`"Estimated from the last close of the underlying stock and the purchase price and share count you entered. It is not the token price, is not a realized gain, and ignores fees and taxes."`);

  lines.push("");
  lines.push("This report reflects on-chain verified data where available and reasonable assumptions where independent verification was not possible on public infrastructure. Consult a tax professional. Not tax advice.");
  
  return lines.join("\n");
}
