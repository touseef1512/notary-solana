"use client";

import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { getTokenizedStockHoldings } from './actions';
import { TokenHolding } from '@/lib/solana';

// TODO: remove before submission
const DEV_TEST_WALLET = "S7vYFFWH6BjJyEsdrPQpqpYTqLTrPRK6KW3VwsJuRaS";

export default function Home() {
  const { publicKey, connected } = useWallet();
  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDemoData, setIsDemoData] = useState(false);

  useEffect(() => {
    if (connected && publicKey) {
      setLoading(true);
      setError(null);
      setIsDemoData(false);
      
      getTokenizedStockHoldings(publicKey.toString())
        .then((data) => {
          if (data.length > 0) {
            setHoldings(data);
          } else {
            // Fallback to demo data
            setIsDemoData(true);
            return getTokenizedStockHoldings(DEV_TEST_WALLET).then((demoData) => {
              setHoldings(demoData);
            });
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
      setError(null);
      setIsDemoData(false);
    }
  }, [connected, publicKey]);

  // Loading skeleton card component
  const SkeletonCard = () => (
    <div className="flex flex-col p-6 rounded-2xl bg-slate-900/40 border border-slate-800 animate-pulse h-[168px]">
      <div className="flex justify-between items-start mb-6">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-24 bg-slate-800 rounded"></div>
          <div className="h-4 w-32 bg-slate-800/60 rounded"></div>
        </div>
        <div className="h-6 w-16 bg-slate-800 rounded-full"></div>
      </div>
      <div className="mt-auto pt-5 border-t border-slate-800/80 flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-16 bg-slate-800/60 rounded"></div>
          <div className="h-8 w-28 bg-slate-800 rounded"></div>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <div className="h-3 w-12 bg-slate-800/60 rounded"></div>
          <div className="h-6 w-20 bg-slate-800 rounded"></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col items-center justify-start min-h-[70vh] w-full pb-20">
      <div className="space-y-4 text-center mt-12 mb-16">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
          Notary Dashboard
        </h1>
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto">
          The on-chain trust and verification layer for tokenized equities on Solana. Connect your wallet to view and verify xStocks, Ondo, and PreStocks.
        </p>
      </div>
      
      <div className="w-full max-w-5xl px-4">
        {!connected ? (
          <div className="flex items-center justify-center h-64 border-2 border-dashed border-slate-700 rounded-3xl bg-slate-800/20 backdrop-blur-sm">
            <p className="text-slate-500 font-medium text-lg">Connect your wallet to view your tokenized stock holdings</p>
          </div>
        ) : (
          <div className="flex flex-col space-y-6">
            {isDemoData && publicKey && (
              <div className="bg-amber-950/40 border border-amber-900/50 rounded-xl p-4 flex items-center justify-center">
                <p className="text-amber-400/90 text-sm font-medium">
                  Showing demo data for <span className="font-mono text-amber-300 mx-1">{publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}</span> (your wallet has no known holdings)
                </p>
              </div>
            )}
            
            <div className="flex items-center justify-between px-2">
              <h2 className="text-2xl font-bold text-slate-200">Your Portfolio</h2>
              <span className="text-sm font-medium text-slate-500 bg-slate-800/50 px-3 py-1 rounded-full">
                {loading ? 'Updating...' : `${holdings.length} Assets`}
              </span>
            </div>

            {error ? (
              <div className="flex items-center justify-center h-48 border-2 border-dashed border-red-900/50 rounded-2xl bg-red-950/20">
                <p className="text-red-400 font-medium">{error}</p>
              </div>
            ) : holdings.length === 0 && !loading ? (
               <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-700 rounded-2xl bg-slate-800/50">
                <p className="text-slate-400 font-medium text-lg mb-2">No tokenized stocks found</p>
                <p className="text-slate-500 text-sm max-w-md text-center">Your wallet is connected, but we didn&apos;t find any known xStocks. Try funding your wallet or connecting a different one.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading && holdings.length === 0 ? (
                  <>
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                  </>
                ) : (
                  holdings.map((holding) => (
                    <div 
                      key={holding.mintAddress} 
                      className="group flex flex-col p-6 rounded-2xl bg-slate-900/40 border border-slate-800 hover:border-indigo-500/30 hover:bg-slate-800/60 transition-all duration-300 shadow-xl backdrop-blur-sm"
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-xl font-bold text-slate-100">{holding.symbol}</h3>
                          </div>
                          <p className="text-sm text-slate-400 font-medium">{holding.name}</p>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm">
                          {holding.issuer}
                        </span>
                      </div>
                      
                      <div className="mt-auto pt-5 border-t border-slate-800/80 flex justify-between items-end">
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Balance</span>
                          <span className="text-2xl font-mono font-bold text-slate-200">
                            {holding.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Value</span>
                          <span className="text-lg font-medium text-slate-400">
                            — {/* Placeholder for real pricing */}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
