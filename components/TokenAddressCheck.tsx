"use client";

import React, { useState } from "react";
import { getParityAssets } from "@/lib/parity-assets";
import { USDC_MINT } from "@/lib/trade-cost";

interface TokenAddressCheckProps {
  onSelectMint?: (mint: string) => void;
}

interface CheckResult {
  mint: string;
  message: React.ReactNode;
}

export const TokenAddressCheck: React.FC<TokenAddressCheckProps> = ({ onSelectMint }) => {
  const [inputValue, setInputValue] = useState("");
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [noMatch, setNoMatch] = useState(false);

  const handleCheck = () => {
    const trimmed = inputValue.trim();
    const regex = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
    const matches = trimmed.match(regex);

    if (!matches || matches.length === 0) {
      setNoMatch(true);
      setResults(null);
      return;
    }

    setNoMatch(false);
    const uniqueMatches = Array.from(new Set(matches)).slice(0, 4);
    const registry = getParityAssets();

    const newResults: CheckResult[] = uniqueMatches.map((mint) => {
      const shortMint = `${mint.slice(0, 4)}...${mint.slice(-4)}`;
      let message: React.ReactNode = null;

      if (mint === USDC_MINT) {
        message = `${shortMint}: This is USDC, the currency used to buy. It is not a stock token.`;
      } else {
        const exactMatch = registry.find((a) => a.mintAddress === mint);
        if (exactMatch) {
          message = (
            <>
              Matches Notary&apos;s registry: {exactMatch.name} ({exactMatch.symbol}), issued by {exactMatch.issuer}.
              {onSelectMint && (
                <button
                  onClick={() => onSelectMint(mint)}
                  className="ml-2 text-brand-accent hover:underline text-xs"
                >
                  Show this stock
                </button>
              )}
            </>
          );
        } else {
          // Check for similar start/end
          const start4 = mint.slice(0, 4);
          const end4 = mint.slice(-4);
          const similarMatch = registry.find(
            (a) => a.mintAddress.startsWith(start4) || a.mintAddress.endsWith(end4)
          );

          if (similarMatch) {
            message = `Not in Notary's registry. It shares its first or last characters with ${similarMatch.symbol}'s registered address but is a different address. Compare the full address with the issuer's before trading.`;
          } else {
            message = "Not in Notary's registry. That does not mean anything is wrong with it, only that Notary has no record of it. Verify the address with the issuer before trading.";
          }
        }
      }

      return { mint, message };
    });

    setResults(newResults);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleCheck();
    }
  };

  const handleClear = () => {
    setInputValue("");
    setResults(null);
    setNoMatch(false);
  };

  return (
    <div className="flex flex-col items-center justify-start w-full">
      <div className="w-full max-w-6xl px-4 mt-6 flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold text-brand-text mb-1 font-sans">Check a token address</h2>
          <p className="text-sm text-brand-muted font-sans">
            Paste a token address or a Jupiter swap link to see whether Notary has it on record.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-grow bg-brand-bg border border-brand-border text-brand-text px-3 py-2 text-sm focus:border-brand-accent focus:outline-none w-full sm:w-auto"
            placeholder="Paste address or link..."
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleCheck}
              className="px-4 py-2 bg-brand-bg border border-brand-accent text-brand-accent hover:bg-brand-accent hover:text-brand-bg transition-colors text-sm font-sans"
            >
              Check
            </button>
            {inputValue.length > 0 && (
              <button
                onClick={handleClear}
                className="text-brand-muted hover:text-brand-text text-sm font-sans"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {noMatch && (
          <div className="text-brand-text text-sm mt-2">
            That doesn&apos;t look like a Solana token address or a Jupiter link.
          </div>
        )}

        {results && results.length > 0 && (
          <div className="flex flex-col divide-y divide-brand-border mt-2 border-t border-b border-brand-border py-1">
            {results.map((res, i) => {
              const shortMint = `${res.mint.slice(0, 4)}...${res.mint.slice(-4)}`;
              return (
                <div key={i} className="flex flex-col py-3">
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 justify-between items-start text-sm">
                    <span className="font-mono text-brand-text whitespace-nowrap">{shortMint}</span>
                    <span className="text-brand-text font-sans">{res.message}</span>
                  </div>
                  <div className="font-mono text-brand-muted text-xs mt-1 sm:text-right">
                    {res.mint}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {results && results.length > 0 && (
          <p className="text-xs text-brand-muted">
            This compares the address with Notary&apos;s own list of tracked tokens. It is not a verdict on any token.
          </p>
        )}
      </div>
    </div>
  );
};
