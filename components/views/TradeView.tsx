"use client";

import React, { useState, useEffect, useMemo } from "react";
import { getPriceParityAction, getTradeCostAction } from "@/app/actions";
import { ALLOWED_USD_SIZES } from "@/lib/trade-cost";
import { getParityAssets } from "@/lib/parity-assets";
import { TradePanelModal } from "@/components/TradePanelModal";
import { TokenAddressCheck } from "@/components/TokenAddressCheck";
import type { TradeCostResult } from "@/lib/trade-cost";

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

type CostCacheEntry = TradeCostResult | { status: "loading" } | { status: "error" };

export const TradeView = () => {
  const [data, setData] = useState<PriceParityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedTicker, setSelectedTicker] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<number>(1000);
  const [costCache, setCostCache] = useState<Record<string, CostCacheEntry>>({});
  const [tradeModalStock, setTradeModalStock] = useState<{ symbol: string, mint: string, context?: { sizeUsd: number; issuer: string; gapPercent: number | null; liquidity: number | null; closeDate: string | null } } | null>(null);

  const tickerMap = useMemo(() => {
    const map = new Map<string, string>();
    getParityAssets().forEach(asset => {
      map.set(asset.mintAddress, asset.underlyingTicker);
    });
    return map;
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await getPriceParityAction();
      setData(results);
      
      // Auto-select first ticker if none selected
      if (results.length > 0 && !selectedTicker) {
        const uniqueTickers = Array.from(new Set(results.map(r => tickerMap.get(r.mint)).filter(Boolean)));
        if (uniqueTickers.length > 0) {
          setSelectedTicker(uniqueTickers[0] as string);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load parity data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uniqueTickers = useMemo(() => {
    return Array.from(new Set(data.map(r => tickerMap.get(r.mint)).filter(Boolean))) as string[];
  }, [data, tickerMap]);

  useEffect(() => {
    if (!selectedTicker || data.length === 0) return;

    const rows = data.filter(row => tickerMap.get(row.mint) === selectedTicker);
    const needed = rows.filter(row => !costCache[`${row.mint}:${selectedSize}`]);

    if (needed.length > 0) {
      const updates: Record<string, CostCacheEntry> = {};
      needed.forEach(row => {
        updates[`${row.mint}:${selectedSize}`] = { status: "loading" };
      });
      setCostCache(prev => ({ ...prev, ...updates }));

      Promise.all(
        needed.map(row =>
          getTradeCostAction(row.mint, selectedSize)
            .then(res => ({ mint: row.mint, res }))
            .catch(() => ({ mint: row.mint, res: { status: "error" } as CostCacheEntry }))
        )
      ).then(results => {
        setCostCache(prev => {
          const next = { ...prev };
          results.forEach(({ mint, res }) => {
            next[`${mint}:${selectedSize}`] = res;
          });
          return next;
        });
      });
    }
  }, [selectedTicker, selectedSize, data, tickerMap, costCache]);

  const rowsForTicker = useMemo(() => {
    return data.filter(row => tickerMap.get(row.mint) === selectedTicker);
  }, [data, tickerMap, selectedTicker]);

  const lowestImpactMint = useMemo(() => {
    const validRows = rowsForTicker.filter(row => {
      const cost = costCache[`${row.mint}:${selectedSize}`];
      return cost && cost.status === "ok" && (cost as TradeCostResult).impactPercent !== null;
    });

    if (validRows.length >= 2) {
      let bestRow = validRows[0];
      let bestCost = costCache[`${bestRow.mint}:${selectedSize}`] as TradeCostResult;

      for (let i = 1; i < validRows.length; i++) {
        const row = validRows[i];
        const cost = costCache[`${row.mint}:${selectedSize}`] as TradeCostResult;

        if (cost.impactPercent! < bestCost.impactPercent!) {
          bestRow = row;
          bestCost = cost;
        } else if (cost.impactPercent === bestCost.impactPercent) {
          if ((row.liquidity ?? 0) > (bestRow.liquidity ?? 0)) {
            bestRow = row;
            bestCost = cost;
          }
        }
      }
      return bestRow.mint;
    }
    return null;
  }, [rowsForTicker, costCache, selectedSize]);

  const handleRetry = (mint: string) => {
    setCostCache(prev => ({ ...prev, [`${mint}:${selectedSize}`]: { status: "loading" } }));
    getTradeCostAction(mint, selectedSize)
      .then(res => setCostCache(prev => ({ ...prev, [`${mint}:${selectedSize}`]: res })))
      .catch(() => setCostCache(prev => ({ ...prev, [`${mint}:${selectedSize}`]: { status: "error" } })));
  };

  const hasMultipleIssuers = new Set(rowsForTicker.map(r => r.issuer)).size > 1;

  return (
    <div className="flex flex-col items-center justify-start w-full">
      <div className="w-full max-w-6xl px-4 mt-6 flex flex-col gap-6">
        
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-brand-text">Trade</h2>
        </div>

        <TokenAddressCheck
          onSelectMint={(mint) => {
            const t = tickerMap.get(mint);
            if (t) setSelectedTicker(t);
          }}
        />

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs text-brand-muted uppercase tracking-wider">Stock</label>
            <select
              value={selectedTicker}
              onChange={(e) => setSelectedTicker(e.target.value)}
              className="bg-brand-bg border border-brand-border text-brand-text px-3 py-2 text-sm focus:border-brand-accent focus:outline-none"
            >
              {uniqueTickers.map(ticker => (
                <option key={ticker} value={ticker}>{ticker}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-brand-muted uppercase tracking-wider">Size</label>
            <div className="flex gap-2">
              {ALLOWED_USD_SIZES.map(size => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={`px-3 py-2 text-sm transition-colors border ${
                    selectedSize === size
                      ? "border-brand-accent bg-brand-accent/10 text-brand-accent"
                      : "border-brand-border text-brand-text hover:border-brand-accent/50 hover:text-brand-accent"
                  }`}
                >
                  ${size.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
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
                  <th className="p-3 text-[10px] text-brand-muted font-normal">Issuer</th>
                  <th className="p-3 text-[10px] text-brand-muted font-normal">Token</th>
                  <th className="p-3 text-[10px] text-brand-muted font-normal text-right">Dex price</th>
                  <th className="p-3 text-[10px] text-brand-muted font-normal text-right">Gap to underlying close (%)</th>
                  <th className="p-3 text-[10px] text-brand-muted font-normal text-right">Liquidity</th>
                  <th className="p-3 text-[10px] text-brand-muted font-normal text-right">Estimated price impact</th>
                  <th className="p-3 text-[10px] text-brand-muted font-normal"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {loading && data.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-brand-muted">
                      Loading...
                    </td>
                  </tr>
                ) : rowsForTicker.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-brand-muted">
                      No parity data available for this stock.
                    </td>
                  </tr>
                ) : (
                  rowsForTicker.map((row) => {
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
                    const cacheKey = `${row.mint}:${selectedSize}`;
                    const costInfo = costCache[cacheKey];

                    return (
                      <tr key={row.mint} className="hover:bg-brand-border/40 transition-colors">
                        <td className="p-3 text-brand-text font-bold">{row.issuer}</td>
                        <td className="p-3 text-brand-text">
                          {row.symbol}
                          {row.inKaminoMarket && (
                            <span className="inline-flex px-1 py-0.5 text-[9px] ml-2 border border-brand-accent text-brand-accent">
                              Kamino
                            </span>
                          )}
                        </td>
                        
                        {!isOk ? (
                          <>
                            <td colSpan={4} className="p-3 text-brand-muted text-center">
                              Insufficient data ({row.reason})
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => setTradeModalStock({ symbol: row.symbol, mint: row.mint, context: { sizeUsd: selectedSize, issuer: row.issuer, gapPercent: row.gapPercent, liquidity: row.liquidity, closeDate: row.closeDate } })}
                                className="px-3 py-1 border border-brand-accent text-brand-accent hover:bg-brand-accent hover:text-brand-bg transition-colors cursor-pointer text-xs"
                              >
                                Trade
                              </button>
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
                            <td className={`p-3 text-right font-mono ${gapColor}`}>
                              {row.gapPercent !== null ? (
                                row.gapPercent > 0 ? `+${row.gapPercent.toFixed(2)}%` : `${row.gapPercent.toFixed(2)}%`
                              ) : (
                                "N/A"
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
                            <td className="p-3 text-right">
                              <div className="flex flex-col items-end">
                                {!costInfo || costInfo.status === "loading" ? (
                                  <span className="text-brand-muted text-[10px]">Loading...</span>
                                ) : costInfo.status === "rate_limited" ? (
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="text-brand-accent text-[10px]">Rate limited. Try again in a moment.</span>
                                    <button onClick={() => handleRetry(row.mint)} className="text-[9px] uppercase border border-brand-accent text-brand-accent px-1.5 py-0.5 hover:bg-brand-accent hover:text-brand-bg">Retry</button>
                                  </div>
                                ) : costInfo.status === "no_route" ? (
                                  <span className="text-brand-muted text-[10px]">No route found at this size</span>
                                ) : costInfo.status === "unavailable" ? (
                                  <span className="text-brand-muted text-[10px]">Quote unavailable</span>
                                ) : costInfo.status === "error" ? (
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="text-negative text-[10px]">Error loading quote</span>
                                    <button onClick={() => handleRetry(row.mint)} className="text-[9px] uppercase border border-negative text-negative px-1.5 py-0.5 hover:bg-negative hover:text-brand-bg">Retry</button>
                                  </div>
                                ) : (costInfo as TradeCostResult).impactPercent !== null ? (
                                  <>
                                    <span className="text-brand-text font-mono">
                                      {((costInfo as TradeCostResult).impactPercent as number).toFixed(2)}%
                                    </span>
                                    {lowestImpactMint === row.mint && (
                                      <span className="text-[10px] text-brand-accent mt-1">
                                        Lowest estimated price impact at this size
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-brand-muted text-[10px]">Insufficient data</span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => setTradeModalStock({ symbol: row.symbol, mint: row.mint, context: { sizeUsd: selectedSize, issuer: row.issuer, gapPercent: row.gapPercent, liquidity: row.liquidity, closeDate: row.closeDate } })}
                                className="px-3 py-1 border border-brand-accent text-brand-accent hover:bg-brand-accent hover:text-brand-bg transition-colors cursor-pointer text-xs"
                              >
                                Trade
                              </button>
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

        {!hasMultipleIssuers && !loading && data.length > 0 && rowsForTicker.length > 0 && (
          <div className="border border-brand-border bg-brand-bg p-4 mt-2">
            <p className="text-sm text-brand-text">
              Only one issuer is tracked for this stock, so there is nothing to compare.
            </p>
          </div>
        )}

        {data.length > 0 && (
          <div className="border border-brand-border bg-brand-bg p-4 flex flex-col gap-2 mb-12">
            <p className="text-xs text-brand-muted">
              Issuers differ in more than price: terms, eligibility and redemption rules vary. This table compares market data only and is not a recommendation.
            </p>
          </div>
        )}

      </div>

      {tradeModalStock && (
        <TradePanelModal
          isOpen={true}
          onClose={() => setTradeModalStock(null)}
          symbol={tradeModalStock.symbol}
          stockMint={tradeModalStock.mint}
          context={tradeModalStock.context}
        />
      )}
    </div>
  );
};
