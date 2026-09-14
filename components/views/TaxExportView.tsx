"use client";

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { generateTaxCsvAction, getTokenizedStockHoldings } from '@/app/actions';
import { KNOWN_ASSETS } from '@/lib/known-assets';
import { Download, FileText, ChevronDown } from 'lucide-react';
import type { TokenHolding } from '@/lib/solana';

export const TaxExportView = () => {
  const { publicKey } = useWallet();
  const pubKeyString = publicKey?.toBase58();

  const [selectedAsset, setSelectedAsset] = useState<string>(KNOWN_ASSETS[0].mintAddress);
  const [purchaseDate, setPurchaseDate] = useState<string>('');
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [shares, setShares] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<TokenHolding[]>([]);

  // Fetch balances for pre-filling
  useEffect(() => {
    let mounted = true;
    if (pubKeyString) {
      getTokenizedStockHoldings(pubKeyString)
        .then((res) => {
          if (mounted) {
            setHoldings(res);
          }
        })
        .catch(console.warn);
    }
    return () => { mounted = false; };
  }, [pubKeyString]);

  // Pre-fill shares when selected asset changes
  useEffect(() => {
    const match = holdings.find(h => h.mintAddress === selectedAsset);
    if (match) {
      setShares(match.balance.toString());
    } else {
      setShares('');
    }
  }, [selectedAsset, holdings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseDate || !purchasePrice || !shares) {
      setError("Please fill out all fields.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const csvString = await generateTaxCsvAction(
        selectedAsset,
        purchaseDate,
        parseFloat(purchasePrice),
        parseFloat(shares)
      );

      // Trigger download
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const assetObj = KNOWN_ASSETS.find(a => a.mintAddress === selectedAsset);
      const symbol = assetObj ? assetObj.symbol : "tax";
      link.setAttribute('download', `${symbol}_tax_export.csv`);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to generate tax CSV.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-start w-full">
      <div className="w-full max-w-4xl px-4 mt-2 mb-6">
        <h2 className="text-xl font-bold text-brand-text uppercase tracking-widest mb-2 flex items-center gap-2">
          <FileText className="w-5 h-5 text-brand-accent" />
          Tax Export
        </h2>
        <p className="text-brand-muted text-sm mb-6 max-w-3xl">
          Generate an IRS-compatible CSV ledger of your corporate actions, accounting for cross-border withholding tax and cumulative cost basis adjustments.
        </p>

        <div className="border border-brand-border bg-brand-bg p-6 max-w-2xl">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            
            {/* Asset Selector */}
            <div className="flex flex-col gap-2">
              <label htmlFor="tax-asset" className="text-xs font-mono uppercase tracking-widest text-brand-muted">Target Asset</label>
              <div className="relative">
                <select
                  id="tax-asset"
                  value={selectedAsset}
                  onChange={(e) => setSelectedAsset(e.target.value)}
                  className="w-full bg-brand-card border border-brand-border text-brand-text py-3 pl-4 pr-10 font-mono text-sm focus:outline-none focus:border-brand-accent transition-colors appearance-none cursor-pointer"
                  disabled={loading}
                >
                  {KNOWN_ASSETS.map((asset) => (
                    <option key={asset.mintAddress} value={asset.mintAddress}>
                      {asset.symbol} - {asset.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-muted pointer-events-none" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Purchase Date */}
              <div className="flex flex-col gap-2">
                <label htmlFor="tax-date" className="text-xs font-mono uppercase tracking-widest text-brand-muted">Purchase Date</label>
                <input
                  id="tax-date"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full bg-brand-card border border-brand-border text-brand-text px-4 py-3 font-mono text-sm focus:outline-none focus:border-brand-accent transition-colors placeholder:text-brand-muted/50"
                  disabled={loading}
                />
              </div>

              {/* Purchase Price */}
              <div className="flex flex-col gap-2">
                <label htmlFor="tax-price" className="text-xs font-mono uppercase tracking-widest text-brand-muted">Purchase Price (USD)</label>
                <input
                  id="tax-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="e.g. 150.00"
                  className="w-full bg-brand-card border border-brand-border text-brand-text px-4 py-3 font-mono text-sm focus:outline-none focus:border-brand-accent transition-colors placeholder:text-brand-muted/50"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Shares */}
            <div className="flex flex-col gap-2">
              <label htmlFor="tax-shares" className="text-xs font-mono uppercase tracking-widest text-brand-muted">
                Shares {pubKeyString && <span className="text-[10px] text-brand-accent ml-2">(Auto-filled from wallet balance)</span>}
              </label>
              <input
                id="tax-shares"
                type="number"
                step="any"
                min="0"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                placeholder="e.g. 10.5"
                className="w-full bg-brand-card border border-brand-border text-brand-text px-4 py-3 font-mono text-sm focus:outline-none focus:border-brand-accent transition-colors placeholder:text-brand-muted/50"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="mt-2 p-3 border border-negative bg-brand-card">
                <p className="text-negative font-mono text-xs uppercase">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="mt-4 bg-brand-accent text-[#050505] px-6 py-4 font-bold font-mono text-sm uppercase tracking-widest hover:bg-opacity-90 transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-brand-accent w-full"
            >
              {loading ? (
                <>
                  <div className="w-1.5 h-3 bg-[#050505] animate-pulse" /> Generating CSV...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Generate Tax Export
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
