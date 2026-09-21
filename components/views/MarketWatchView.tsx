"use client";

import React, { useState, useEffect } from "react";
import { getMarketWatchAction } from "@/app/actions";
import { PlainNote } from '@/components/PlainNote';
import type { MarketWatchResult } from '@/lib/market-watch-core';

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
}

export const MarketWatchView = () => {
  const [result, setResult] = useState<MarketWatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const data = await getMarketWatchAction();
      setResult(data);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="flex flex-col items-center justify-start w-full">
      <div className="w-full max-w-6xl px-4 mt-6 flex flex-col gap-6">
        <PlainNote text="This lists every asset the Kamino xStocks lending market currently accepts, and the date Notary first saw each one. If an asset is added or removed, it shows up here. It only tells you what is listed. It does not say whether an asset is a good idea." />

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-brand-text uppercase tracking-widest">Market Watch</h2>
          <button 
            onClick={load} 
            disabled={loading}
            className="px-3 py-1 border border-brand-accent text-brand-accent hover:bg-brand-accent hover:text-brand-bg disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-brand-accent font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            {loading ? "REFRESHING..." : "Refresh"}
          </button>
        </div>

        {failed ? (
          <div className="border border-negative bg-brand-card p-4">
            <p className="text-negative">Could not load the market list. Try again in a moment.</p>
          </div>
        ) : result !== null && result.status === "unavailable" ? (
          <div className="border border-brand-border bg-brand-card p-4">
            <div className="text-brand-muted text-sm">Insufficient Data</div>
            {result.reason !== null && (
              <div className="text-brand-muted text-sm mt-1">{result.reason}</div>
            )}
          </div>
        ) : result !== null ? (
          <>
            {result.reason !== null && (
              <div className="border border-brand-border bg-brand-card p-4">
                <p className="text-brand-accent text-sm">{result.reason}</p>
              </div>
            )}
            
            <div className="border border-brand-border bg-brand-card p-4">
              <div className="flex flex-wrap gap-6">
                <div>
                  <div className="text-brand-text font-mono text-lg">{result.entries.filter(e => e.removedTs === null).length}</div>
                  <div className="text-brand-muted text-xs uppercase">Currently listed</div>
                </div>
                <div>
                  <div className="text-brand-text font-mono text-lg">{result.entries.filter(e => e.addedAfterBaseline).length}</div>
                  <div className="text-brand-muted text-xs uppercase">New since watching began</div>
                </div>
                <div>
                  <div className="text-brand-text font-mono text-lg">{result.entries.filter(e => e.removedTs !== null).length}</div>
                  <div className="text-brand-muted text-xs uppercase">Removed</div>
                </div>
              </div>
              {(result.baselineTs !== null || result.lastCheckedTs !== null) && (
                <div className="text-brand-muted text-sm mt-4">
                  {result.baselineTs !== null ? `Watching since ${formatDate(result.baselineTs)}.` : ""} 
                  {result.baselineTs !== null && result.lastCheckedTs !== null ? " " : ""}
                  {result.lastCheckedTs !== null ? `Last checked ${formatDate(result.lastCheckedTs)} ${formatTime(result.lastCheckedTs)} UTC.` : ""}
                </div>
              )}
            </div>

            {result.entries.length === 0 ? (
              <div className="border border-brand-border bg-brand-card p-4">
                <p className="text-brand-muted">No entries recorded yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-brand-border bg-brand-bg">
                <table className="w-full text-left text-sm">
                  <thead className="bg-brand-bg border-b border-brand-border">
                    <tr>
                      <th className="p-3 text-[10px] text-brand-muted uppercase tracking-widest font-normal">Asset</th>
                      <th className="p-3 text-[10px] text-brand-muted uppercase tracking-widest font-normal">First seen by Notary</th>
                      <th className="p-3 text-[10px] text-brand-muted uppercase tracking-widest font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {[...result.entries].sort((a, b) => {
                      const aHasEvent = a.removedTs !== null || a.addedAfterBaseline;
                      const bHasEvent = b.removedTs !== null || b.addedAfterBaseline;
                      
                      if (aHasEvent && !bHasEvent) return -1;
                      if (!aHasEvent && bHasEvent) return 1;
                      
                      if (aHasEvent && bHasEvent) {
                        const aTs = a.removedTs !== null ? a.removedTs : a.firstSeenTs;
                        const bTs = b.removedTs !== null ? b.removedTs : b.firstSeenTs;
                        if (aTs !== bTs) return bTs - aTs;
                      }
                      
                      return a.symbol.localeCompare(b.symbol);
                    }).map((e) => (
                      <tr key={e.mint} className="hover:bg-brand-card transition-colors">
                        <td className="p-3">
                          <div className="text-brand-text font-bold">{e.symbol}</div>
                          <a 
                            href={`https://explorer.solana.com/address/${e.mint}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-muted text-[10px] font-mono hover:text-brand-accent block mt-0.5"
                          >
                            {e.mint.substring(0, 4)}...{e.mint.substring(e.mint.length - 4)}
                          </a>
                        </td>
                        <td className="p-3">
                          <div className="text-brand-text font-mono">{formatDate(e.firstSeenTs)}</div>
                          {!e.addedAfterBaseline && (
                            <div className="text-brand-muted text-[10px] mt-0.5">when watching began</div>
                          )}
                        </td>
                        <td className="p-3">
                          {e.removedTs !== null ? (
                            <div className="text-negative">Removed {formatDate(e.removedTs)}</div>
                          ) : e.addedAfterBaseline ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex px-1 py-0.5 text-[9px] border border-brand-accent text-brand-accent uppercase tracking-widest">New</span>
                              <span className="text-brand-text">Listed</span>
                            </div>
                          ) : (
                            <div className="text-brand-text">Listed</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}

        <div className="border border-brand-border bg-brand-bg p-4 mb-12">
          <p className="text-xs text-brand-muted mb-2">Watching since is when Notary started recording this list, not when Kamino first listed an asset. Notary only checks the lending market when someone opens this page or presses Refresh, and at most once every 10 minutes, so this is a record, not continuous monitoring.</p>
          <p className="text-xs text-brand-muted">The list includes every asset in the xStocks market on Kamino, including stablecoins and cbBTC, not only stocks. Being listed is not a recommendation or advice of any kind.</p>
        </div>
      </div>
    </div>
  );
};
