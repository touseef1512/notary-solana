"use client";

import React, { useState } from "react";
import { getTradeCostAction } from "@/app/actions";
import type { TradeCostResult } from "@/lib/trade-cost";

export const TradeCostCheck = ({ assets }: { assets: { symbol: string; mint: string }[] }) => {
  const [selectedAsset, setSelectedAsset] = useState<string>(assets.length > 0 ? assets[0].mint : "");
  const [selectedSize, setSelectedSize] = useState<number>(1000);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TradeCostResult | null>(null);
  const [error, setError] = useState<boolean>(false);

  const sizes = [100, 1000, 10000];

  if (assets.length === 0) return null;

  const handleAssetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedAsset(e.target.value);
    setResult(null);
    setError(false);
  };

  const handleSizeChange = (size: number) => {
    setSelectedSize(size);
    setResult(null);
    setError(false);
  };

  const checkCost = async () => {
    setLoading(true);
    setResult(null);
    setError(false);
    try {
      const res = await getTradeCostAction(selectedAsset, selectedSize);
      setResult(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const assetSymbol = assets.find(a => a.mint === selectedAsset)?.symbol || "";

  return (
    <div className="border border-brand-border bg-brand-card p-4">
      <h3 className="font-bold text-brand-text uppercase tracking-widest text-sm mb-2">Trade cost check</h3>
      <p className="text-sm text-brand-muted mb-4">
        See how much a purchase of a given size would move the price, and which pools it would route through. This uses a live quote and does not place any trade.
      </p>

      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <select 
          value={selectedAsset} 
          onChange={handleAssetChange}
          className="bg-brand-bg border border-brand-border text-brand-text p-2 font-mono text-sm uppercase focus:outline-none focus:border-brand-accent transition-colors"
        >
          {assets.map(a => (
            <option key={a.mint} value={a.mint}>{a.symbol}</option>
          ))}
        </select>
        
        <div className="flex gap-2">
          {sizes.map(size => {
            const isSelected = size === selectedSize;
            return (
              <button
                key={size}
                onClick={() => handleSizeChange(size)}
                className={`px-3 py-1 font-mono text-sm transition-colors border ${
                  isSelected 
                    ? "border-brand-accent text-brand-accent" 
                    : "border-brand-border text-brand-muted hover:border-brand-text hover:text-brand-text bg-brand-bg"
                }`}
              >
                ${size.toLocaleString()}
              </button>
            );
          })}
        </div>

        <button 
          onClick={checkCost} 
          disabled={loading}
          className="px-3 py-1 border border-brand-text text-brand-text hover:bg-brand-text hover:text-brand-bg disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-brand-text font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer"
        >
          {loading ? "CHECKING..." : "Check cost"}
        </button>
      </div>

      {(result || error) && (
        <div className="border border-brand-border bg-brand-bg p-3 mt-4">
          {error ? (
            <p className="text-sm text-brand-text">Could not get a quote right now.</p>
          ) : result?.status === "rate_limited" ? (
            <p className="text-sm text-brand-text">The quote service is busy. Please try again in a minute.</p>
          ) : result?.status === "unavailable" ? (
            <p className="text-sm text-brand-text">Could not get a quote right now.</p>
          ) : result?.status === "no_route" ? (
            <p className="text-sm text-brand-text">No route was found for this size. That usually means the pools are too thin for a trade this large.</p>
          ) : result?.status === "ok" ? (
            <>
              <p className="text-sm text-brand-text mb-2">
                Buying ${result.usdAmount.toLocaleString()} of {assetSymbol} {result.venues.length > 0 ? `would go through ${result.venues.join(", ")}` : "would go through the available pools"}. Estimated price impact: {result.impactPercent !== null && result.impactPercent < 0.01 ? "under 0.01" : result.impactPercent?.toFixed(2)}%.
              </p>
              <p className="text-xs text-brand-muted">
                Price impact is how much the size of the trade moves the price against the buyer. It is not the pool fee, and a real fill can differ from a quote. Quote time: {new Date(result.fetchedAt).toISOString().substring(11, 16)} UTC.
              </p>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};
