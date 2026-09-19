"use client";

import React from "react";

interface LandingViewProps {
  onNavigate: (tabId: string) => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onNavigate }) => {
  return (
    <div className="flex flex-col items-center justify-start w-full">
      <div className="w-full max-w-6xl px-4 mt-6 flex flex-col gap-6">
        
        <div className="flex flex-col gap-2 p-6 border border-brand-border bg-brand-bg">
          <h2 className="text-xl font-bold text-brand-text uppercase tracking-widest">Notary</h2>
          <p className="font-mono text-sm text-brand-muted">
            Tokenized stocks on Solana, explained in plain language. Research before you buy, check what you hold, and see risk before it hits.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <p className="text-sm font-bold text-brand-accent uppercase tracking-widest px-2">What describes you best?</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="border border-brand-border bg-brand-card p-6 flex flex-col gap-4 justify-between">
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-bold text-brand-text uppercase tracking-widest">I am new and want to research before buying</h3>
                <p className="font-mono text-xs text-brand-muted">
                  See how well the reserves behind each tokenized stock are documented and checked before you spend anything.
                </p>
              </div>
              <button 
                onClick={() => onNavigate('registry')}
                className="w-full px-3 py-2 border border-brand-accent text-brand-accent hover:bg-brand-accent hover:text-brand-bg font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer text-center"
              >
                Open Trust Registry
              </button>
            </div>

            <div className="border border-brand-border bg-brand-card p-6 flex flex-col gap-4 justify-between">
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-bold text-brand-text uppercase tracking-widest">I already hold tokenized stocks</h3>
                <p className="font-mono text-xs text-brand-muted">
                  Check that your holdings are verified and see dividend effects and alerts.
                </p>
              </div>
              <button 
                onClick={() => onNavigate('holdings')}
                className="w-full px-3 py-2 border border-brand-accent text-brand-accent hover:bg-brand-accent hover:text-brand-bg font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer text-center"
              >
                Open Holdings
              </button>
            </div>

            <div className="border border-brand-border bg-brand-card p-6 flex flex-col gap-4 justify-between">
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-bold text-brand-text uppercase tracking-widest">I borrow or lend against stocks</h3>
                <p className="font-mono text-xs text-brand-muted">
                  See how close a loan is to liquidation, including a weekend price gap, and try a what-if loan.
                </p>
              </div>
              <button 
                onClick={() => onNavigate('collateral-risk')}
                className="w-full px-3 py-2 border border-brand-accent text-brand-accent hover:bg-brand-accent hover:text-brand-bg font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer text-center"
              >
                Open Collateral Risk
              </button>
            </div>

            <div className="border border-brand-border bg-brand-card p-6 flex flex-col gap-4 justify-between">
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-bold text-brand-text uppercase tracking-widest">I need reports</h3>
                <p className="font-mono text-xs text-brand-muted">
                  Export a CSV of the dividend history on a tokenized stock for tax reporting.
                </p>
              </div>
              <button 
                onClick={() => onNavigate('tax')}
                className="w-full px-3 py-2 border border-brand-accent text-brand-accent hover:bg-brand-accent hover:text-brand-bg font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer text-center"
              >
                Open Tax Export
              </button>
            </div>

          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 p-4 border border-brand-border bg-brand-bg justify-between items-start md:items-center">
          <div className="flex flex-col gap-2 w-full md:w-1/2 md:border-r border-brand-border md:pr-4">
            <p className="font-mono text-xs text-brand-muted">Curious how far tokens trade from the real stock?</p>
            <button 
              onClick={() => onNavigate('price-parity')}
              className="w-full md:w-auto px-3 py-1 border border-brand-accent text-brand-accent hover:bg-brand-accent hover:text-brand-bg font-mono text-[10px] uppercase tracking-wider transition-colors cursor-pointer text-center"
            >
              Open Price Parity
            </button>
          </div>
          <div className="flex flex-col gap-2 w-full md:w-1/2 md:pl-4">
            <p className="font-mono text-xs text-brand-muted">Building something? Read the public API.</p>
            <button 
              onClick={() => onNavigate('developer')}
              className="w-full md:w-auto px-3 py-1 border border-brand-accent text-brand-accent hover:bg-brand-accent hover:text-brand-bg font-mono text-[10px] uppercase tracking-wider transition-colors cursor-pointer text-center"
            >
              Open Developers
            </button>
          </div>
        </div>

        <div className="border border-brand-border bg-brand-bg p-4 flex flex-col gap-2 mb-12">
          <p className="font-mono text-xs text-brand-muted">
            Notary explains and links to sources. It does not give investment or legal advice. Venues, fees and regulation differ by country. Attestations are published on Solana devnet.
          </p>
        </div>

      </div>
    </div>
  );
};
