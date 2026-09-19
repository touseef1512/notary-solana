"use client";

import React, { useState, useEffect } from 'react';
import { simulateLoanAction, getGapSymbolsAction } from '@/app/actions';
import type { WhatIfOutput } from '@/lib/what-if';

export const WhatIfSimulator = () => {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [depositSymbol, setDepositSymbol] = useState<string>('');
  const [depositUsd, setDepositUsd] = useState<string>('');
  const [borrowUsd, setBorrowUsd] = useState<string>('');
  const [thresholdStr, setThresholdStr] = useState<string>('');
  const [result, setResult] = useState<WhatIfOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getGapSymbolsAction().then(syms => {
      setSymbols(syms);
      if (syms.length > 0) setDepositSymbol(syms[0]);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    setResult(null);
    setError(null);
  }, [depositSymbol, depositUsd, borrowUsd, thresholdStr]);

  const formatHealth = (n: number) => {
    return (Math.floor(n * 100) / 100).toFixed(2);
  };

  const handleSimulate = async () => {
    if (!depositSymbol || !depositUsd || !thresholdStr || !borrowUsd) {
      setError("Please fill all required fields.");
      return;
    }
    const ltv = parseFloat(thresholdStr);
    if (!Number.isFinite(ltv) || ltv <= 1 || ltv > 100) {
      setError("Enter Liquidation LTV as a percent between 1 and 100 (e.g. 85, not 0.85).");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await simulateLoanAction({
        depositSymbol,
        depositUsd: parseFloat(depositUsd),
        borrowUsd: parseFloat(borrowUsd),
        liquidationLtvThreshold: parseFloat(thresholdStr) / 100
      });
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to simulate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-brand-border bg-brand-bg p-4 flex flex-col gap-4 mt-6">
      <h3 className="text-sm font-bold text-brand-text uppercase tracking-widest">What-if Loan Simulator</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-brand-muted uppercase tracking-widest">Deposit Asset</label>
          <select 
            value={depositSymbol} 
            onChange={e => setDepositSymbol(e.target.value)}
            className="bg-brand-card border border-brand-border text-brand-text font-mono text-sm p-2 outline-none focus:border-brand-accent transition-colors"
          >
            {symbols.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-brand-muted uppercase tracking-widest">Deposit USD</label>
          <input 
            type="number" 
            value={depositUsd} 
            onChange={e => setDepositUsd(e.target.value)}
            className="bg-brand-card border border-brand-border text-brand-text font-mono text-sm p-2 outline-none focus:border-brand-accent transition-colors"
            placeholder="0.00"
          />
        </div>
        
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-brand-muted uppercase tracking-widest">Borrow USD</label>
          <input 
            type="number" 
            value={borrowUsd} 
            onChange={e => setBorrowUsd(e.target.value)}
            className="bg-brand-card border border-brand-border text-brand-text font-mono text-sm p-2 outline-none focus:border-brand-accent transition-colors"
            placeholder="0.00"
          />
        </div>
        
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-brand-muted uppercase tracking-widest">Liquidation LTV (%)</label>
          <input 
            type="number" 
            value={thresholdStr} 
            onChange={e => setThresholdStr(e.target.value)}
            className="bg-brand-card border border-brand-border text-brand-text font-mono text-sm p-2 outline-none focus:border-brand-accent transition-colors"
            placeholder="e.g. 85"
          />
          <span className="text-[10px] text-brand-muted italic">Required. Must be taken from Kamino for the chosen asset.</span>
        </div>
      </div>

      {error && <div className="text-negative font-mono text-xs uppercase">{error}</div>}

      <div className="flex justify-end">
        <button 
          onClick={handleSimulate} 
          disabled={loading}
          className="px-4 py-2 border border-brand-accent text-brand-accent hover:bg-brand-accent hover:text-brand-bg disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-brand-accent disabled:cursor-not-allowed font-mono text-xs uppercase tracking-wider transition-colors"
        >
          {loading ? "SIMULATING..." : "Simulate"}
        </button>
      </div>

      {result && (
        <div className="mt-4 border-t border-brand-border pt-4 flex flex-col gap-4">
          {result.status === 'no-borrow' ? (
            <div className="text-sm font-mono text-positive">No borrow entered, so there is no liquidation risk to simulate.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-brand-muted uppercase tracking-widest mb-1">STATUS</span>
                  <span className={`font-mono text-sm uppercase ${
                    result.status === 'ok' ? 'text-positive' :
                    result.status === 'thin' ? 'text-brand-accent' :
                    'text-negative'
                  }`}>
                    {result.status.replace('-', ' ')}
                  </span>
                </div>
                
                <div className="flex flex-col">
                  <span className="text-[10px] text-brand-muted uppercase tracking-widest mb-1">CURRENT HEALTH</span>
                  <span className="font-mono text-sm text-brand-text">
                    {result.currentHealth === "Insufficient Data" ? "N/A" : formatHealth(result.currentHealth as number)}
                  </span>
                </div>
                
                <div className="flex flex-col">
                  <span className="text-[10px] text-brand-muted uppercase tracking-widest mb-1">SURVIVABLE DRAWDOWN</span>
                  <span className="font-mono text-sm text-brand-text">
                    {result.survivableDrawdown === "Insufficient Data" ? "N/A" : 
                     (result.survivableDrawdown as number) < 0 ? "already past liquidation" :
                     `${((result.survivableDrawdown as number) * 100).toFixed(2)}% drop`
                    }
                  </span>
                </div>
                
                <div className="flex flex-col">
                  <span className="text-[10px] text-brand-muted uppercase tracking-widest mb-1">GAP STRESSED HEALTH</span>
                  <span className="font-mono text-sm text-brand-text">
                    {result.gapStressedHealth === "Insufficient Data" ? "N/A" : formatHealth(result.gapStressedHealth as number)}
                  </span>
                </div>
              </div>
              
              <div className="text-[10px] text-brand-muted italic border-t border-brand-border/50 pt-2 flex flex-col gap-1">
                <span>Uses the last observed weekend gap for this asset ({result.gapPercentageUsed}%), a static figure, not a prediction. Real weekend moves can be larger. Borrow side assumed to be a stablecoin.</span>
                {result.gapPercentageUsed >= 0 && (
                  <span>This asset&apos;s last observed gap was not a drop, so the gap-stressed figure shows no downside stress. Check the survivable drawdown instead.</span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
