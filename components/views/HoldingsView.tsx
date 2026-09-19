"use client";

import React, { useEffect, useState } from 'react';
import { useActiveAddress } from '@/components/ActiveAddressProvider';
import { verifyAllHoldings, VerificationStatusResult, getHoldingsWithPrices, TokenHoldingWithPrice } from '@/app/actions';
import { PlainNote } from '@/components/PlainNote';

const HoldingRow = ({
  holding, 
  verification 
}: { 
  holding: TokenHoldingWithPrice, 
  verification: VerificationStatusResult | null 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const renderBadge = () => {
    if (!verification) {
      return (
        <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono text-brand-muted border border-brand-muted uppercase">
          CHECKING...
        </span>
      );
    }
    
    switch (verification.status) {
      case 'verified':
        return (
          <div className="flex items-center gap-2 justify-end">
            <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono text-positive border border-positive uppercase">
              VERIFIED
            </span>
            {holding.notarizationSignature && (
              <a 
                href={`https://explorer.solana.com/tx/${holding.notarizationSignature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-accent hover:text-white text-[10px] font-mono uppercase underline tracking-wider"
              >
                View on-chain proof ↗
              </a>
            )}
          </div>
        );
      case 'anomaly':
        return (
          <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono text-negative border border-negative uppercase">
            ANOMALY
          </span>
        );
      case 'no_events':
        return (
          <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono text-brand-muted border border-brand-muted uppercase">
            NO EVENTS
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono text-[#FF9F1C] border border-[#FF9F1C] uppercase" title={verification.error}>
            ERROR
          </span>
        );
    }
  };

  const handleRowClick = () => {
    if (verification?.narration) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <>
      <tr 
        className="border-b border-brand-border hover:bg-brand-card transition-colors cursor-pointer"
        onClick={handleRowClick}
      >
        <td className="py-2.5 px-3 font-bold text-brand-text">{holding.symbol}</td>
        <td className="py-2.5 px-3 text-brand-muted truncate max-w-[180px]">{holding.name}</td>
        <td className="py-2.5 px-3 text-brand-muted text-xs uppercase tracking-wider">{holding.issuer}</td>
        <td className="py-2.5 px-3 font-mono text-brand-text text-right">
          {holding.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
        </td>
        <td className="py-2.5 px-3 font-mono text-right">
          {holding.currentPrice !== null 
            ? <span className="text-brand-text">${holding.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            : <span className="text-brand-muted">N/A</span>}
        </td>
        <td className="py-2.5 px-3 font-mono text-right">
          {holding.totalValue !== null 
            ? <span className="text-brand-text">${holding.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            : <span className="text-brand-muted">N/A</span>}
        </td>
        <td className="py-2.5 px-3 text-center">
          {renderBadge()}
        </td>
      </tr>
      {isExpanded && verification?.narration && (
        <tr className="border-b border-brand-border bg-[#050505]">
          <td colSpan={7} className="p-4">
            <div className="border border-brand-border bg-brand-bg p-4 flex flex-col gap-2">
              <span className="text-[10px] text-brand-accent uppercase tracking-widest font-bold">ANALYSIS_NARRATIVE</span>
              <p className="font-mono text-sm text-brand-text whitespace-pre-wrap leading-relaxed">
                {verification.narration}
              </p>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export const HoldingsView = () => {
  const { activeAddress } = useActiveAddress();
  const [holdings, setHoldings] = useState<TokenHoldingWithPrice[]>([]);
  const [verificationResults, setVerificationResults] = useState<Record<string, VerificationStatusResult>>({});
  const [totalPortfolioValue, setTotalPortfolioValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pubKeyString = activeAddress;
  const verifiedCount = Object.values(verificationResults).filter(v => v.status === 'verified').length;

  useEffect(() => {
    if (pubKeyString) {
      setLoading(true);
      setError(null);
      setVerificationResults({});
      
      getHoldingsWithPrices(pubKeyString)
        .then(async (data) => {
          setHoldings(data);
          const total = data.reduce((acc, h) => acc + (h.totalValue || 0), 0);
          setTotalPortfolioValue(data.length > 0 ? total : null);

          if (data.length > 0) {
            try {
              const results = await verifyAllHoldings(data.map(h => h.mintAddress));
              setVerificationResults(results);
            } catch (err) {
              console.error('Failed to verify all holdings:', err);
            }
          }
        })
        .catch((err) => {
          console.error(err);
          setError('Failed to fetch holdings. Please try again later.');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setHoldings([]);
      setTotalPortfolioValue(null);
      setVerificationResults({});
      setError(null);
    }
  }, [pubKeyString]);

  const SkeletonCard = () => (
    <tr className="border-b border-brand-border animate-pulse">
      <td className="py-3 px-2"><div className="h-4 w-12 bg-brand-border rounded-sm"></div></td>
      <td className="py-3 px-2"><div className="h-4 w-24 bg-brand-border rounded-sm"></div></td>
      <td className="py-3 px-2"><div className="h-4 w-16 bg-brand-border rounded-sm"></div></td>
      <td className="py-3 px-2"><div className="h-4 w-16 bg-brand-border rounded-sm ml-auto"></div></td>
      <td className="py-3 px-2"><div className="h-4 w-12 bg-brand-border rounded-sm ml-auto"></div></td>
      <td className="py-3 px-2"><div className="h-4 w-16 bg-brand-border rounded-sm ml-auto"></div></td>
      <td className="py-3 px-2"><div className="h-4 w-10 bg-brand-border rounded-sm mx-auto"></div></td>
    </tr>
  );

  return (
    <div className="flex flex-col items-center justify-start w-full">
      <div className="w-full max-w-6xl px-4 mt-6">
        <PlainNote text="This lists the tokenized stocks in a wallet and checks how dividends were applied to them. Dividends are applied automatically as a multiplier on your balance, so your balance can change without you doing anything." />
      </div>
      {pubKeyString && (
        <div className="w-full max-w-6xl px-4 mt-2 mb-6">
          <div className="flex flex-row items-center gap-6 border-b border-brand-border pb-4">
            <div className="flex flex-col">
              <span className="text-[10px] text-brand-muted uppercase tracking-widest mb-1">PORTFOLIO_VALUE</span>
              <span className="font-mono text-xl text-brand-accent">
                {totalPortfolioValue !== null 
                  ? `$${totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                  : '---'}
              </span>
            </div>
            <div className="flex flex-col border-l border-brand-border pl-6">
              <span className="text-[10px] text-brand-muted uppercase tracking-widest mb-1">VERIFIED_ASSETS</span>
              <span className="font-mono text-xl text-brand-accent">{verifiedCount}</span>
            </div>
            <div className="flex flex-col border-l border-brand-border pl-6">
              <span className="text-[10px] text-brand-muted uppercase tracking-widest mb-1">ACTIVE_ALERTS</span>
              <span className="font-mono text-xl text-brand-accent">0</span>
            </div>
          </div>
        </div>
      )}
      
      <div className="w-full max-w-6xl px-4">
        {!pubKeyString ? (
          <div className="flex items-center justify-center h-48 border border-brand-border bg-brand-card">
            <p className="text-brand-muted font-mono text-sm uppercase tracking-widest">Connect wallet or enter address to view terminal</p>
          </div>
        ) : (
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-brand-text uppercase tracking-widest">Your Portfolio</h2>
              <span className="text-xs font-mono text-brand-muted">
                {loading ? 'UPDATING...' : `${holdings.length} ASSETS`}
              </span>
            </div>

            {error ? (
              <div className="flex items-center justify-center h-32 border border-negative bg-brand-card">
                <p className="text-negative font-mono text-sm uppercase">{error}</p>
              </div>
            ) : holdings.length === 0 && !loading ? (
               <div className="flex flex-col items-center justify-center h-48 border border-brand-border bg-brand-card px-4">
                <p className="text-brand-muted font-mono text-sm uppercase tracking-widest mb-2 text-center">No known holdings for this address</p>
                <p className="text-brand-muted text-xs max-w-md text-center font-sans">We didn&apos;t find any supported tokenized assets associated with this public key.</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto border border-brand-border bg-brand-bg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-brand-border text-xs text-brand-muted uppercase tracking-wider bg-brand-card">
                      <th className="py-2.5 px-3 font-medium">Symbol</th>
                      <th className="py-2.5 px-3 font-medium">Name</th>
                      <th className="py-2.5 px-3 font-medium">Issuer</th>
                      <th className="py-2.5 px-3 font-medium text-right">Balance</th>
                      <th className="py-2.5 px-3 font-medium text-right">Price</th>
                      <th className="py-2.5 px-3 font-medium text-right">Value</th>
                      <th className="py-2.5 px-3 font-medium text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {loading && holdings.length === 0 ? (
                      <>
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                      </>
                    ) : (
                      holdings.map((holding) => (
                        <HoldingRow 
                          key={holding.mintAddress} 
                          holding={holding} 
                          verification={verificationResults[holding.mintAddress] ?? null}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
