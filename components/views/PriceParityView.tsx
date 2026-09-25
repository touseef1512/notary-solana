"use client";

import React, { useState, useEffect } from "react";
import { getPriceParityAction } from "@/app/actions";
import { getMarketStatus, formatDuration } from "@/lib/market-hours";
import { PlainNote } from '@/components/PlainNote';
import { TradeCostCheck } from '@/components/TradeCostCheck';
import { TickerLogo } from '@/components/TickerLogo';

interface PriceParityResult {
  symbol: string;
  mint: string;
  issuer: string;
  dexPrice: number | null;
  rawUsdPrice: number | null;
  hasScaledUi: boolean;
  liquidity: number | null;
  underlyingClose: number | null;
  closeDate: string | null;
  gapPercent: number | null;
  fetchedAt: string;
  status: "ok" | "Insufficient Data";
  reason?: string;
  inKaminoMarket: boolean;
  modelGapPercent: number | null;
}

export const PriceParityView = () => {
  const [data, setData] = useState<PriceParityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await getPriceParityAction();
      setData(results);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const marketStatus = getMarketStatus(new Date());

  return (
    <div className="flex flex-col items-center justify-start w-full">
      <div className="w-full max-w-6xl px-4 mt-6 flex flex-col gap-6">
        <PlainNote text="This compares what a tokenized stock trades for on Solana with the last closing price of the real stock. A gap after the market closes can be normal because tokens keep trading. Thin liquidity means few funds are in the pool, so the price is less reliable." />
        
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-brand-text">Price parity</h2>
          <button 
            onClick={fetchData} 
            disabled={loading}
            className="px-3 py-1 border border-brand-accent text-brand-accent hover:bg-brand-accent hover:text-brand-bg disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-brand-accent text-xs transition-colors cursor-pointer"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="flex flex-col gap-1 p-4 border border-brand-border bg-brand-card">
          <p className={`text-sm ${marketStatus.isOpen ? 'text-positive' : 'text-brand-accent'}`}>
            US stock market: {marketStatus.isOpen ? 'OPEN' : 'CLOSED'}. {marketStatus.isOpen ? `Closes in ${formatDuration(marketStatus.minutesUntilChange)}. Gaps below reflect normal price movement.` : `Reopens in ${formatDuration(marketStatus.minutesUntilChange)}. Tokens keep trading 24/7, so the gaps below can widen until then.`}
          </p>
          <p className="text-[10px] text-brand-muted">
            Regular session only (9:30 AM to 4:00 PM New York time, Mon to Fri). Holidays are not modelled.
          </p>
        </div>

        {error && (
          <div className="flex items-center justify-center p-4 border border-negative bg-brand-card">
            <p className="text-negative text-sm">{error}</p>
          </div>
        )}

        {!error && (
          <div className="overflow-x-auto border border-brand-border bg-brand-bg">
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-card border-b border-brand-border">
                <tr>
                  <th className="p-3 text-[10px] text-brand-muted font-normal">Symbol</th>
                  <th className="p-3 text-[10px] text-brand-muted font-normal">Issuer</th>
                  <th className="p-3 text-[10px] text-brand-muted font-normal text-right">Dex price</th>
                  <th className="p-3 text-[10px] text-brand-muted font-normal text-right">Underlying close</th>
                  <th className="p-3 text-[10px] text-brand-muted font-normal text-right">Gap %</th>
                  <th className="p-3 text-[10px] text-brand-muted font-normal text-right">Risk model gap %</th>
                  <th className="p-3 text-[10px] text-brand-muted font-normal text-right">Liquidity</th>
                  <th className="p-3 text-[10px] text-brand-muted font-normal">Source note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {loading && data.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-brand-muted">
                      Loading...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-brand-muted">
                      No parity data available.
                    </td>
                  </tr>
                ) : (
                  data.map((row) => {
                    const isOk = row.status === "ok";
                    let gapColor = "text-brand-text";
                    if (isOk && row.gapPercent !== null) {
                      const absGap = Math.abs(row.gapPercent);
                      if (absGap >= 2) {
                        gapColor = "text-negative";
                      } else if (absGap >= 1) {
                        gapColor = "text-brand-accent";
                      } else {
                        gapColor = "text-positive";
                      }
                    }

                    const isThinLiquidity = row.liquidity !== null && row.liquidity < 100000;

                    return (
                      <tr key={row.mint} className="hover:bg-brand-border/40 transition-colors">
                        <td className="p-3 text-brand-text font-bold">
                          <div className="flex items-center gap-2">
                            <TickerLogo symbol={row.symbol} size={20} />
                            <span>{row.symbol}</span>
                            {row.inKaminoMarket && (
                              <span className="inline-flex px-1 py-0.5 text-[9px] border border-brand-accent text-brand-accent">
                                Kamino
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-brand-text">{row.issuer}</td>
                        
                        {!isOk ? (
                          <>
                            <td colSpan={5} className="p-3 text-brand-muted text-center">
                              Insufficient data ({row.reason})
                            </td>
                            <td className="p-3 text-brand-muted text-xs">
                              {row.reason}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-3 text-right">
                              {row.dexPrice === null ? (
                                <span className="text-brand-muted text-[10px]">Insufficient data</span>
                              ) : (
                                <span className="text-brand-text font-mono">${row.dexPrice.toFixed(2)}</span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              {row.underlyingClose === null ? (
                                <span className="text-brand-muted text-[10px]">Insufficient data</span>
                              ) : (
                                <>
                                  <div className="text-brand-text font-mono">${row.underlyingClose.toFixed(2)}</div>
                                  <div className="text-[10px] text-brand-muted mt-0.5">{row.closeDate}</div>
                                </>
                              )}
                            </td>
                            <td className={`p-3 text-right font-mono ${gapColor}`}>
                              {row.gapPercent !== null ? (
                                row.gapPercent > 0 ? `+${row.gapPercent.toFixed(2)}%` : `${row.gapPercent.toFixed(2)}%`
                              ) : (
                                "N/A"
                              )}
                            </td>
                            <td className="p-3 text-right text-brand-muted font-mono">
                              {row.modelGapPercent !== null ? (
                                row.modelGapPercent > 0 ? `+${row.modelGapPercent.toFixed(2)}%` : `${row.modelGapPercent.toFixed(2)}%`
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex flex-col items-end">
                                {row.liquidity === null ? (
                                  <span className="text-brand-muted text-[10px]">Insufficient data</span>
                                ) : (
                                  <>
                                    <span className="text-brand-text font-mono">
                                      ${row.liquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </span>
                                    {isThinLiquidity && (
                                      <span className="inline-flex px-1 py-0.5 text-[9px] mt-1 border border-negative text-negative">
                                        Thin liquidity
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-[10px] text-brand-muted">
                              {row.hasScaledUi ? "Scaled (Multiplier)" : "Raw"}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {data.length > 0 && (
          <TradeCostCheck assets={data.map((r) => ({ symbol: r.symbol, mint: r.mint }))} />
        )}

        <div className="border border-brand-border bg-brand-bg p-4 flex flex-col gap-2 mb-12">
          <p className="text-xs text-brand-muted">
            DEX prices from Jupiter, underlying closes from Tiingo (dated). During market hours the gap includes normal price movement. For tokens with a multiplier, one displayed token equals one share and Jupiter reports the price per displayed token, so no adjustment is applied.
          </p>
          <p className="text-xs text-brand-muted">
            Risk model gap is the fixed table used by the loan health checks (last set on Sep 11). Gap % is measured now: the DEX price against the last close. When the US market is closed it approximates the weekend gap; when open it also includes normal price movement. These are two different measurements, and the fixed table is not updated automatically.
          </p>
        </div>

      </div>
    </div>
  );
};
