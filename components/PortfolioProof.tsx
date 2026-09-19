"use client";

import React, { useState, useEffect } from 'react';
import { generatePortfolioProofAction } from '@/app/actions';

export function PortfolioProof({ walletAddress }: { walletAddress: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ filename: string; content: string; sha256: string } | null>(null);

  useEffect(() => {
    setResult(null);
    setError(null);
  }, [walletAddress]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const proof = await generatePortfolioProofAction(walletAddress);
      setResult(proof);
    } catch {
      setError("Failed to generate portfolio proof");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([result.content], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border border-brand-border bg-brand-card p-4">
      <h3 className="text-brand-text text-sm font-bold uppercase tracking-widest mb-2">Portfolio proof</h3>
      <p className="text-brand-muted text-sm mb-4">
        Download a snapshot of this wallet with links to the on-chain records, plus a fingerprint you can use to check the file was not edited.
      </p>
      
      {!result ? (
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center justify-center px-4 py-2 border border-brand-border bg-brand-bg text-brand-text font-bold uppercase tracking-wider text-sm hover:bg-brand-card transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'GENERATING...' : 'Generate proof'}
        </button>
      ) : (
        <div className="flex flex-col space-y-4">
          <div className="flex flex-col">
            <span className="text-brand-muted text-[10px] uppercase tracking-widest mb-1">FILENAME</span>
            <span className="text-brand-text text-sm">{result.filename}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-brand-muted text-[10px] uppercase tracking-widest mb-1">SHA-256 FINGERPRINT</span>
            <span className="text-brand-accent text-sm font-mono break-all">{result.sha256}</span>
          </div>
          <div>
            <button
              onClick={handleDownload}
              className="inline-flex items-center justify-center px-4 py-2 border border-brand-border bg-brand-bg text-brand-text font-bold uppercase tracking-wider text-sm hover:bg-brand-card transition-colors"
            >
              Download JSON
            </button>
          </div>
          <p className="text-brand-muted text-[10px] uppercase tracking-widest">
            The fingerprint detects later edits to the file. It is not a digital signature. Values are a point-in-time snapshot.
          </p>
        </div>
      )}
      {error && (
        <p className="text-negative text-sm mt-2">{error}</p>
      )}
    </div>
  );
}
