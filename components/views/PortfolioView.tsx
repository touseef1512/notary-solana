"use client";

import React, { useState } from 'react';
import { useActiveAddress } from '@/components/ActiveAddressProvider';
import type { TaxEntryInput } from '@/lib/statement';
import { TaxExportView } from '@/components/views/TaxExportView';
import { HoldingsView } from '@/components/views/HoldingsView';
import { generateUnifiedStatementAction } from '@/app/actions';
import { Download } from 'lucide-react';

interface PortfolioViewProps {
  subTab: string;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({ subTab }) => {
  const { activeAddress } = useActiveAddress();
  const [taxEntries, setTaxEntries] = useState<TaxEntryInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownloadStatement = async () => {
    if (!activeAddress) return;
    setLoading(true);
    setError(null);
    try {
      const { filename, content } = await generateUnifiedStatementAction(activeAddress, taxEntries);
      const blob = new Blob([content], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to generate unified statement.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col w-full">
      <div className="w-full flex items-center justify-between mb-6 px-4">
        <div className="flex flex-col">
          {error && (
            <div className="mb-2 p-3 border border-negative bg-brand-card">
              <p className="text-negative font-mono text-xs uppercase">{error}</p>
            </div>
          )}
          <button
            onClick={handleDownloadStatement}
            disabled={!activeAddress || loading}
            className="bg-brand-accent text-brand-card px-4 py-2 font-bold font-mono text-sm uppercase tracking-widest hover:bg-opacity-90 transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border border-brand-accent w-fit"
          >
            {loading ? (
              <>
                <div className="w-1.5 h-3 bg-brand-card animate-pulse" /> Generating...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download Statement
              </>
            )}
          </button>
          {!activeAddress && (
            <span className="text-[10px] text-brand-muted uppercase mt-2 font-mono">Connect wallet to download statement</span>
          )}
        </div>
      </div>

      {subTab === 'tax' ? (
        <TaxExportView entries={taxEntries} onEntriesChange={setTaxEntries} />
      ) : (
        <HoldingsView />
      )}
    </div>
  );
};
