"use client";

import React, { useState, useEffect } from 'react';
import { getAssetTrustRiskProfilesAction } from '@/app/actions';
import type { TrustRiskProfile } from '@/lib/trust-risk-profile';
import { KNOWN_ASSETS } from '@/lib/known-assets';
import { PlainNote } from '@/components/PlainNote';
import { BookOpen, Loader2 } from 'lucide-react';
import { EndorseButton } from '@/components/EndorseButton';

export const TrustRegistryView = () => {
  const [profiles, setProfiles] = useState<Record<string, TrustRiskProfile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    async function fetchData() {
      try {
        setLoading(true);
        const profilesData = await getAssetTrustRiskProfilesAction();
        
        if (mounted) {
          const profilesMap: Record<string, TrustRiskProfile> = {};
          profilesData.forEach((p: TrustRiskProfile) => {
            if (!p.asset) return;
            profilesMap[p.asset.mintAddress] = p;
          });
          setProfiles(profilesMap);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          console.error(err);
          setError('Failed to fetch trust registry data.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-start w-full h-[calc(100vh-8rem)]">
      <div className="w-full max-w-6xl px-4 mt-2 mb-6">
        <PlainNote text="Before buying a tokenized stock, check whether its issuer publishes reserve data and whether Notary could verify it. Insufficient Data means no verifiable reserve data was available. It does not mean the asset is safe or unsafe." />
        <div className="flex flex-col mb-4">
          <h2 className="text-xl font-bold text-brand-text uppercase tracking-widest mb-2 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-brand-accent" />
            Trust Registry
          </h2>
          <p className="text-brand-muted text-sm max-w-2xl">
            Public overview of verified tokenized assets, trust scores, and reserve attestations. This data is available globally with zero setup required.
          </p>
        </div>

        {error ? (
          <div className="flex items-center justify-center h-32 border border-negative bg-brand-card">
            <p className="text-negative font-mono text-sm uppercase">{error}</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center h-48 border border-brand-border bg-brand-card">
            <Loader2 className="w-8 h-8 text-brand-accent animate-spin mb-4" />
            <p className="text-brand-muted font-mono text-sm uppercase tracking-widest">Compiling registry data...</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto border border-brand-border bg-brand-bg">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-brand-border text-xs text-brand-muted uppercase tracking-wider bg-brand-card">
                  <th className="py-3 px-4 font-medium">Symbol</th>
                  <th className="py-3 px-4 font-medium">Name</th>
                  <th className="py-3 px-4 font-medium">Issuer</th>
                  <th className="py-3 px-4 font-medium text-right">Trust Score</th>
                  <th className="py-3 px-4 font-medium text-center">Verified Events</th>
                  <th className="py-3 px-4 font-medium text-right">Reserve Ratio</th>
                  <th className="py-3 px-4 font-medium text-center">On-Chain Proof</th>
                  <th className="py-3 px-4 font-medium text-center">Endorse</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border font-mono text-sm">
                {KNOWN_ASSETS.map((asset) => {
                  const profileData = profiles[asset.mintAddress];
                  
                  // Calculate total verified events
                  let verifiedEvents = 0;
                  if (profileData?.breakdown) {
                    verifiedEvents = profileData.breakdown.filter(e => e.independentlyVerified).length;
                  }

                  return (
                    <tr key={asset.mintAddress} className="hover:bg-brand-card/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-brand-text">{asset.symbol}</td>
                      <td className="py-3 px-4 text-brand-muted">{asset.name}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex px-1.5 py-0.5 text-[10px] uppercase tracking-wider border border-brand-border bg-brand-card text-brand-text">
                          {asset.issuer}
                        </span>
                      </td>
                      
                      {/* Trust Score */}
                      <td className="py-3 px-4 text-right">
                        {profileData?.trustScore === null ? (
                          <span className="text-brand-muted uppercase text-[10px] tracking-widest">Insufficient Data</span>
                        ) : profileData?.trustScore !== undefined ? (
                          <span className="text-brand-accent text-base">{profileData.trustScore.toFixed(0)}%</span>
                        ) : (
                          <span className="text-brand-muted">-</span>
                        )}
                      </td>
                      
                      {/* Verified Events */}
                      <td className="py-3 px-4 text-center">
                        {verifiedEvents > 0 ? (
                          <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono text-positive border border-positive uppercase">
                            {verifiedEvents} VERIFIED
                          </span>
                        ) : (
                          <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono text-brand-muted border border-brand-muted uppercase">
                            0 VERIFIED
                          </span>
                        )}
                      </td>
                      
                      {/* Reserve Ratio */}
                      <td className="py-3 px-4 text-right">
                        {profileData?.backingRatio === null ? (
                          <span className="text-brand-muted uppercase text-[10px] tracking-widest">Insufficient Data</span>
                        ) : profileData?.backingRatio !== undefined ? (
                          <span className="text-brand-accent text-base">{(profileData.backingRatio * 100).toFixed(2)}%</span>
                        ) : (
                          <span className="text-brand-muted">-</span>
                        )}
                      </td>
                      
                      {/* On-Chain Proof */}
                      <td className="py-3 px-4 text-center">
                        {asset.notarizationSignature ? (
                          <a 
                            href={`https://explorer.solana.com/tx/${asset.notarizationSignature}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-accent hover:text-white text-[10px] font-mono uppercase underline tracking-wider whitespace-nowrap"
                          >
                            View on-chain proof ↗
                          </a>
                        ) : (
                          <span className="text-brand-muted/50 text-[10px] uppercase tracking-widest">UNAVAILABLE</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <EndorseButton symbol={asset.symbol} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
