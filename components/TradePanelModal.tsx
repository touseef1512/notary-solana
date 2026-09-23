"use client";

import React, { useState } from "react";

interface TradePanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  stockMint: string;
}

export const TradePanelModal: React.FC<TradePanelModalProps> = ({
  isOpen,
  onClose,
  symbol,
  stockMint,
}) => {
  const [isBuying, setIsBuying] = useState(true);

  // USDC mint on Solana
  const usdcMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const inputMint = isBuying ? usdcMint : stockMint;
  const outputMint = isBuying ? stockMint : usdcMint;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-brand-bg border border-brand-border flex flex-col w-full max-w-md max-h-full overflow-hidden shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-brand-border">
          <h2 className="text-lg font-bold text-brand-text">Trade {symbol}</h2>
          <button
            onClick={onClose}
            className="text-brand-muted hover:text-brand-text transition-colors"
          >
            Close
          </button>
        </div>
        
        <div className="p-3 bg-brand-card border-b border-brand-border flex-shrink-0">
          <p className="text-xs text-brand-muted">
            Notary doesn&apos;t execute trades or hold funds. This opens Jupiter in a new tab, where you trade directly with Jupiter.
          </p>
        </div>

        <div className="flex items-center justify-center p-4 border-b border-brand-border flex-shrink-0">
          <div className="flex bg-brand-card border border-brand-border rounded-md overflow-hidden">
            <button
              onClick={() => setIsBuying(true)}
              className={`px-4 py-1.5 text-sm transition-colors ${
                isBuying 
                  ? "bg-brand-accent text-brand-bg font-bold" 
                  : "text-brand-muted hover:text-brand-text"
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setIsBuying(false)}
              className={`px-4 py-1.5 text-sm transition-colors ${
                !isBuying 
                  ? "bg-brand-accent text-brand-bg font-bold" 
                  : "text-brand-muted hover:text-brand-text"
              }`}
            >
              Sell
            </button>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto min-h-0 flex items-center justify-center p-6">
          <a
            href={`https://jup.ag/swap?sell=${inputMint}&buy=${outputMint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full text-center py-3 bg-brand-accent text-brand-bg font-bold transition-opacity hover:opacity-90"
          >
            Continue to Jupiter
          </a>
        </div>
      </div>
    </div>
  );
};
