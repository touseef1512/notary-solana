"use client";

import React, { useState, useEffect } from 'react';
import { getAssetTrustRiskProfilesAction, getAssetHistoryAction } from '@/app/actions';
import type { TrustRiskProfile } from '@/lib/trust-risk-profile';
import { getParityAssets } from '@/lib/parity-assets';
import { AssetSnapshot, summarizeHistory } from '@/lib/history-types';
import { PlainNote } from '@/components/PlainNote';
import { BookOpen, Loader2 } from 'lucide-react';
import { EndorseButton } from '@/components/EndorseButton';
import { TickerLogo } from '@/components/TickerLogo';

export const TrustRegistryView = () => {
  const [profiles, setProfiles] = useState<Record<string, TrustRiskProfile>>({});
  const [history, setHistory] = useState<Record<string, AssetSnapshot[]>>({});
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
        
        try {
          const hist = await getAssetHistoryAction();
          if (mounted) {
            setHistory(hist);
          }
        } catch {
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
        <PlainNote text={
          <div className="flex flex-col gap-2">
            <p>Before buying a tokenized stock, check whether its issuer publishes reserve data and whether Notary could verify it. This is not a recommendation.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Insufficient data</strong>: no verifiable reserve data was available.</li>
              <li><strong>Verified count</strong>: the number of historical corporate actions verified against independent data.</li>
              <li><strong>Unavailable (on-chain proof)</strong>: no cryptographic proof is on the Solana ledger.</li>
              <li><strong>Not checked yet</strong>: Notary has no reserve check for that token.</li>
              <li><strong>History checks</strong>: each check is a point in time Notary compared the asset&apos;s on-chain data against outside sources. The count shows how many times this has happened since monitoring began.</li>
            </ul>
          </div>
        } />
        <div className="flex flex-col mb-4">
          <h2 className="text-xl font-bold text-brand-text mb-2 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-brand-accent" />
            Trust registry
          </h2>
          <p className="text-brand-muted text-sm max-w-2xl">
            Public overview of verified tokenized assets, trust scores, and reserve attestations. This data is available globally with zero setup required.
          </p>
        </div>

        {error ? (
          <div className="flex items-center justify-center h-32 border border-negative bg-brand-card">
            <p className="text-negative font-mono text-sm">{error}</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center h-48 border border-brand-border bg-brand-card">
            <Loader2 className="w-8 h-8 text-brand-accent animate-spin mb-4" />
            <p className="text-brand-muted font-mono text-sm">Compiling registry data...</p>
          </div>
        ) : (
          <>
          <div className="w-full overflow-x-auto border border-brand-border bg-brand-bg">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-brand-border text-xs text-brand-muted bg-brand-card">
                  <th className="py-3 px-4 font-medium">Symbol</th>
                  <th className="py-3 px-4 font-medium">Name</th>
                  <th className="py-3 px-4 font-medium">Issuer</th>
                  <th className="py-3 px-4 font-medium text-right">Trust score</th>
                  <th className="py-3 px-4 font-medium text-center">Verified events</th>
                  <th className="py-3 px-4 font-medium text-right">Reserve ratio</th>
                  <th className="py-3 px-4 font-medium text-right">History</th>
                  <th className="py-3 px-4 font-medium text-center">On-chain proof</th>
                  <th className="py-3 px-4 font-medium text-center">Endorse</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border text-sm">
                {getParityAssets().map((asset) => {
                  const profileData = profiles[asset.mintAddress];
                  
                  // Calculate total verified events
                  let verifiedEvents = 0;
                  if (profileData?.breakdown) {
                    verifiedEvents = profileData.breakdown.filter(e => e.independentlyVerified).length;
                  }

                  return (
                    <tr key={asset.mintAddress} className="hover:bg-brand-card/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex flex-col items-start">
                          <div className="flex items-center gap-2">
                            <TickerLogo symbol={asset.symbol} size={20} />
                            <span className="font-bold text-brand-text">{asset.symbol}</span>
                          </div>
                          {(profileData?.trustScore !== null && profileData?.trustScore !== undefined) || asset.notarizationSignature ? (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
                              <span className="font-mono text-[9px] text-brand-muted uppercase whitespace-nowrap">Verified on Solana Devnet (demo)</span>
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-brand-muted">{asset.name}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex px-1.5 py-0.5 text-[10px] border border-brand-border bg-brand-card text-brand-text">
                          {asset.issuer}
                        </span>
                      </td>
                      
                      {/* Trust Score */}
                      <td className="py-3 px-4 text-right">
                        {profileData?.trustScore === null ? (
                          <span className="text-brand-muted text-[10px]">Insufficient data</span>
                        ) : profileData?.trustScore !== undefined ? (
                          <span className="text-brand-accent text-base font-mono">{profileData.trustScore.toFixed(0)}%</span>
                        ) : (
                          <span className="text-brand-muted">-</span>
                        )}
                      </td>
                      
                      {/* Verified Events */}
                      <td className="py-3 px-4 text-center">
                        {verifiedEvents > 0 ? (
                          <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono text-positive border border-positive">
                            {verifiedEvents} verified
                          </span>
                        ) : (
                          <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono text-brand-muted border border-brand-muted">
                            0 verified
                          </span>
                        )}
                      </td>
                      
                      {/* Reserve Ratio */}
                      <td className="py-3 px-4 text-right">
                        {profileData?.backingRatio === null ? (
                          <span className="text-brand-muted text-[10px]">Insufficient data</span>
                        ) : profileData?.backingRatio !== undefined ? (
                          <span className="text-brand-accent text-base font-mono">{(profileData.backingRatio * 100).toFixed(2)}%</span>
                        ) : (
                          <span className="text-brand-muted">-</span>
                        )}
                      </td>
                      
                      {/* History */}
                      <td className="py-3 px-4 text-right">
                        {(() => {
                          const snapshots = history[asset.symbol] ?? [];
                          const summary = summarizeHistory(snapshots);
                          if (summary.count === 0) {
                            return <span className="text-brand-muted text-[10px]">No history</span>;
                          } else if (summary.count === 1 && summary.firstTs !== null) {
                            const dateStr = new Date(summary.firstTs * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
                            return <span className="text-brand-muted text-[10px]">1 check, {dateStr}</span>;
                          } else if (summary.count >= 2 && summary.firstTs !== null) {
                            const dateStr = new Date(summary.firstTs * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
                            const changes: string[] = [];
                            if (summary.backingRatioChangePoints !== null) {
                              const sign = summary.backingRatioChangePoints >= 0 ? '+' : '';
                              changes.push(`Reserve ${sign}${summary.backingRatioChangePoints.toFixed(2)} pts`);
                            }
                            if (summary.trustScoreChange !== null) {
                              const sign = summary.trustScoreChange >= 0 ? '+' : '';
                              changes.push(`Score ${sign}${summary.trustScoreChange.toFixed(0)} pts`);
                            }
                            return (
                              <div className="flex flex-col items-end">
                                <span>{summary.count} checks since {dateStr}</span>
                                {changes.length > 0 && (
                                  <span className="text-[10px] text-brand-muted mt-1">
                                    {changes.join(', ')}
                                  </span>
                                )}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </td>
                      
                      {/* On-Chain Proof */}
                      <td className="py-3 px-4 text-center">
                        {asset.notarizationSignature ? (
                          <a 
                            href={`https://explorer.solana.com/tx/${asset.notarizationSignature}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-accent hover:text-white text-[10px] font-mono underline whitespace-nowrap"
                          >
                            View on-chain proof ↗
                          </a>
                        ) : (
                          <span className="text-brand-muted/50 text-[10px]">Unavailable</span>
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
          <p className="text-brand-muted text-xs mt-4">
            History is recorded whenever this page loads, at most once per hour per asset. It is not continuous monitoring, so early trends are short.
          </p>
          </>
        )}
      </div>
    </div>
  );
};
