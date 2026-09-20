"use client";

import React, { useState, useEffect } from 'react';
import { getWalletDigestAction } from '@/app/actions';

export function WalletDigest({ walletAddress }: { walletAddress: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ text: string; mode: "ai" | "template"; generatedAt: string } | null>(null);

  useEffect(() => {
    setResult(null);
    setError(null);
  }, [walletAddress]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await getWalletDigestAction(walletAddress);
      setResult(res);
    } catch {
      setError("Could not build the digest right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-brand-border bg-brand-card p-4">
      <h3 className="text-brand-text text-sm font-bold uppercase tracking-widest mb-2">Wallet digest</h3>
      <p className="text-brand-muted text-sm mb-4">
        A short plain-language summary of this wallet, built from live data.
      </p>
      
      {!result ? (
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center justify-center px-4 py-2 border border-brand-border bg-brand-bg text-brand-text font-bold uppercase tracking-wider text-sm hover:bg-brand-card transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'SUMMARIZING...' : 'Summarize this wallet'}
        </button>
      ) : (
        <div className="flex flex-col space-y-4">
          <p className="text-brand-text text-sm whitespace-pre-wrap">{result.text}</p>
          <p className="text-brand-muted text-[10px] uppercase tracking-widest mt-2">
            {result.mode === "ai" 
              ? "Worded by an AI model. Every number is checked against the data, and a plain template is shown if the check fails." 
              : "Plain template built directly from the data."}
            {" "}Generated at {new Date(result.generatedAt).toISOString().substring(11, 16)} UTC
          </p>
        </div>
      )}
      {error && (
        <p className="text-negative text-sm mt-2">{error}</p>
      )}
    </div>
  );
}
