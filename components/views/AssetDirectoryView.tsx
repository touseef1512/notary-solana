"use client";

import React, { useState } from "react";
import { buildAssetDirectory } from "@/lib/asset-directory";
import { PlainNote } from '@/components/PlainNote';
import { TickerLogo } from '@/components/TickerLogo';

type FilterType = 'all' | 'xStocks' | 'Ondo' | 'kamino';

const FILTERS: FilterType[] = ['all', 'xStocks', 'Ondo', 'kamino'];

export const AssetDirectoryView = () => {
  const [entries] = useState(() => buildAssetDirectory());
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredEntries = entries.filter(e => {
    if (filter === 'all') return true;
    if (filter === 'xStocks') return e.issuer === 'xStocks';
    if (filter === 'Ondo') return e.issuer === 'Ondo';
    if (filter === 'kamino') return e.inKaminoMarket;
    return true;
  });

  const sortedEntries = [...filteredEntries].sort((a, b) => {
    const tickerCmp = a.underlyingTicker.localeCompare(b.underlyingTicker);
    if (tickerCmp !== 0) return tickerCmp;
    return a.symbol.localeCompare(b.symbol);
  });

  return (
    <div className="flex flex-col items-center justify-start w-full">
      <div className="w-full max-w-6xl px-4 mt-6 flex flex-col gap-6">
        <PlainNote text={
          <div className="flex flex-col gap-2">
            <p>This lists the tokenized stocks Notary knows about: who issues each one, which real stock it tracks, and their status in Kamino and Notary checks. This is not a recommendation or advice of any kind.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Accepted</strong>: the token is on the Kamino lending market reserve list (verified Sep 20).</li>
              <li><strong>Not in this market</strong>: the token is not currently accepted by Kamino.</li>
              <li><strong>Included</strong>: Notary checks the reserves behind this token.</li>
              <li><strong>Not checked yet</strong>: Notary has no reserve check for that token.</li>
            </ul>
          </div>
        } />

        <h2 className="text-sm font-bold text-brand-text">Asset directory</h2>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const label = f === 'kamino' ? 'On Kamino' : f === 'all' ? 'All' : f;
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 border border-brand-accent text-xs transition-colors cursor-pointer ${
                  active 
                    ? "bg-brand-accent text-brand-bg" 
                    : "text-brand-accent hover:bg-brand-accent hover:text-brand-bg"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="text-brand-muted text-sm">
          Showing {sortedEntries.length} of {entries.length} assets.
        </div>

        {sortedEntries.length === 0 ? (
          <div className="border border-brand-border bg-brand-card p-4">
            <p className="text-brand-muted">No assets match this filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-brand-border bg-brand-bg">
            <table className="w-full text-left text-sm min-w-[800px]">
              <thead className="bg-brand-bg border-b border-brand-border">
                <tr>
                  <th className="p-3 text-[10px] text-brand-muted font-normal">Asset</th>
                  <th className="p-3 text-[10px] text-brand-muted font-normal">Issuer</th>
                  <th className="p-3 text-[10px] text-brand-muted font-normal">Real stock</th>
                  <th className="p-3 text-[10px] text-brand-muted font-normal">Kamino market</th>
                  <th className="p-3 text-[10px] text-brand-muted font-normal">Trust registry</th>
                  <th className="p-3 text-[10px] text-brand-muted font-normal">Mint</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {sortedEntries.map(e => (
                  <tr key={e.mintAddress} className="hover:bg-brand-card transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <TickerLogo symbol={e.symbol} size={20} />
                        <div className="text-brand-text font-bold">{e.symbol}</div>
                      </div>
                      <div className="text-brand-muted text-[10px]">{e.name}</div>
                    </td>
                    <td className="p-3 text-brand-text">{e.issuer}</td>
                    <td className="p-3 text-brand-text font-mono">{e.underlyingTicker}</td>
                    <td className="p-3">
                      {e.inKaminoMarket ? (
                        <span className="inline-flex px-1 py-0.5 text-[9px] border border-brand-accent text-brand-accent">
                          Accepted
                        </span>
                      ) : (
                        <span className="text-brand-muted">Not in this market</span>
                      )}
                    </td>
                    <td className="p-3">
                      {e.inTrustRegistry ? (
                        <div className="flex flex-col items-start">
                          <span className="text-brand-text">Included</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
                            <span className="font-mono text-[9px] text-brand-muted uppercase whitespace-nowrap">Verified on Solana Devnet (demo)</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-brand-muted">Not checked yet</span>
                      )}
                    </td>
                    <td className="p-3">
                      <a 
                        href={`https://explorer.solana.com/address/${e.mintAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-muted text-[10px] font-mono hover:text-brand-accent"
                      >
                        {e.mintAddress.substring(0, 4)}...{e.mintAddress.substring(e.mintAddress.length - 4)}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}


      </div>
    </div>
  );
};
