"use client";

import React, { useState, useEffect } from "react";
import { getPriceParityAction } from "@/app/actions";

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

  return (
    <div className="flex flex-col items-center justify-start w-full">
      <div className="w-full max-w-6xl px-4 mt-6 flex flex-col gap-6">
        
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-brand-text uppercase tracking-widest">Price Parity</h2>
          <button 
            onClick={fetchData} 
            disabled={loading}
            className="px-3 py-1 border border-brand-accent text-brand-accent hover:bg-brand-accent hover:text-brand-bg disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-brand-accent font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            {loading ? "REFRESHING..." : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="flex items-center justify-center p-4 border border-negative bg-brand-card">
            <p className="text-negative font-mono text-sm uppercase">{error}</p>
          </div>
        )}

        {!error && (
          <div className="overflow-x-auto border border-brand-border bg-brand-bg">
            <table className="w-full text-left font-mono text-sm">
              <thead className="bg-[#0A0A0A] border-b border-brand-border">
                <tr>
                  <th className="p-3 text-[10px] text-brand-muted uppercase tracking-widest font-normal">Symbol</th>
                  <th className="p-3 text-[10px] text-brand-muted uppercase tracking-widest font-normal">Issuer</th>
                  <th className="p-3 text-[10px] text-brand-muted uppercase tracking-widest font-normal text-right">DEX Price</th>
                  <th className="p-3 text-[10px] text-brand-muted uppercase tracking-widest font-normal text-right">Underlying Close</th>
                  <th className="p-3 text-[10px] text-brand-muted uppercase tracking-widest font-normal text-right">Gap %</th>
                  <th className="p-3 text-[10px] text-brand-muted uppercase tracking-widest font-normal text-right">Liquidity</th>
                  <th className="p-3 text-[10px] text-brand-muted uppercase tracking-widest font-normal">Source Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {loading && data.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-brand-muted uppercase tracking-widest">
                      LOADING...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-brand-muted uppercase tracking-widest">
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
                      <tr key={row.mint} className="hover:bg-[#1A1A1A] transition-colors">
                        <td className="p-3 text-brand-text font-bold">{row.symbol}</td>
                        <td className="p-3 text-brand-text">{row.issuer}</td>
                        
                        {!isOk ? (
                          <>
                            <td colSpan={4} className="p-3 text-brand-muted text-center uppercase tracking-widest">
                              Insufficient Data ({row.reason})
                            </td>
                            <td className="p-3 text-brand-muted text-xs">
                              {row.reason}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-3 text-right">
                              {row.dexPrice === null ? (
                                <span className="text-brand-muted uppercase tracking-widest text-[10px]">Insufficient Data</span>
                              ) : (
                                <span className="text-brand-text">${row.dexPrice.toFixed(2)}</span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              {row.underlyingClose === null ? (
                                <span className="text-brand-muted uppercase tracking-widest text-[10px]">Insufficient Data</span>
                              ) : (
                                <>
                                  <div className="text-brand-text">${row.underlyingClose.toFixed(2)}</div>
                                  <div className="text-[10px] text-brand-muted mt-0.5">{row.closeDate}</div>
                                </>
                              )}
                            </td>
                            <td className={`p-3 text-right ${gapColor}`}>
                              {row.gapPercent !== null ? (
                                row.gapPercent > 0 ? `+${row.gapPercent.toFixed(2)}%` : `${row.gapPercent.toFixed(2)}%`
                              ) : (
                                "N/A"
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex flex-col items-end">
                                {row.liquidity === null ? (
                                  <span className="text-brand-muted uppercase tracking-widest text-[10px]">Insufficient Data</span>
                                ) : (
                                  <>
                                    <span className="text-brand-text">
                                      ${row.liquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </span>
                                    {isThinLiquidity && (
                                      <span className="inline-flex px-1 py-0.5 text-[9px] mt-1 border border-negative text-negative uppercase tracking-widest">
                                        Thin Liquidity
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-[10px] text-brand-muted uppercase">
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

        <div className="border border-brand-border bg-brand-bg p-4 flex flex-col gap-2 mb-12">
          <p className="font-mono text-xs text-brand-muted">
            DEX prices from Jupiter, underlying closes from Tiingo (dated). During market hours the gap includes normal price movement. For tokens with a multiplier, one displayed token equals one share and Jupiter reports the price per displayed token, so no adjustment is applied.
          </p>
        </div>

      </div>
    </div>
  );
};
