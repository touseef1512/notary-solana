"use client";

import React, { useEffect, useState } from 'react';
import { getTrustLeaderboardAction } from '@/app/actions';
import type { TrustScoreResult } from '@/lib/trust-score';
import { PlainNote } from '@/components/PlainNote';

type LeaderboardData = {
  leaderboard: { issuer: string, averageTrustScore: number | null, assetsCount: number, totalAssetsForIssuer: number }[],
  scores: TrustScoreResult[]
};

export const TrustScoreView = () => {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getTrustLeaderboardAction()
      .then(res => {
        if (!mounted) return;
        setData(res);
      })
      .catch(err => {
        if (!mounted) return;
        console.error(err);
        setError("Failed to load trust scores.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const SkeletonCard = () => (
    <tr className="border-b border-brand-border animate-pulse">
      <td className="py-3 px-2"><div className="h-4 w-24 bg-brand-border rounded-sm"></div></td>
      <td className="py-3 px-2"><div className="h-4 w-16 bg-brand-border rounded-sm ml-auto"></div></td>
      <td className="py-3 px-2"><div className="h-4 w-20 bg-brand-border rounded-sm mx-auto"></div></td>
      <td className="py-3 px-2"><div className="h-4 w-20 bg-brand-border rounded-sm mx-auto"></div></td>
      <td className="py-3 px-2"><div className="h-4 w-20 bg-brand-border rounded-sm mx-auto"></div></td>
    </tr>
  );

  return (
    <div className="flex flex-col items-center justify-start w-full">
      <div className="w-full max-w-6xl px-4 mt-2 mb-6">
        <PlainNote text="The score shows how often past dividend adjustments for each issuer matched independently sourced market data in Notary checks. It is a comparison aid, not a recommendation." />
        <h2 className="text-xl font-bold text-brand-text uppercase tracking-widest mb-2">Issuer Leaderboard</h2>
        <p className="text-brand-muted text-sm mb-6 max-w-3xl">
          On-chain trust scores represent the percentage of historical corporate actions (like dividends) that have been mathematically verified against independently sourced market data.
        </p>

        {error ? (
          <div className="flex items-center justify-center h-32 border border-negative bg-brand-card">
            <p className="text-negative font-mono text-sm uppercase">{error}</p>
          </div>
        ) : (
          <div className="flex flex-col space-y-12">
            
            {/* Leaderboard Table */}
            <div className="w-full overflow-x-auto border border-brand-border bg-brand-bg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-brand-border text-xs text-brand-muted uppercase tracking-wider bg-brand-card">
                    <th className="py-2.5 px-3 font-medium">Issuer</th>
                    <th className="py-2.5 px-3 font-medium text-right">Average Trust Score</th>
                    <th className="py-2.5 px-3 font-medium text-center">Assets Verified</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {loading ? (
                    <>
                      <SkeletonCard />
                      <SkeletonCard />
                    </>
                  ) : data?.leaderboard.map((row) => (
                    <tr key={row.issuer} className="border-b border-brand-border hover:bg-brand-card transition-colors">
                      <td className="py-2.5 px-3 font-bold text-brand-text uppercase tracking-widest">{row.issuer}</td>
                      <td className="py-2.5 px-3 text-right">
                        {row.averageTrustScore === null ? (
                          <span className="text-brand-muted font-mono uppercase text-xs">Insufficient Data</span>
                        ) : (
                          <span className="text-brand-accent font-mono text-lg">{row.averageTrustScore.toFixed(0)}%</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-center text-brand-text">
                        {row.assetsCount} / {row.totalAssetsForIssuer}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Asset Detail Table */}
            <div>
              <h2 className="text-sm font-bold text-brand-text uppercase tracking-widest mb-4">Detailed Asset Verification</h2>
              <div className="w-full overflow-x-auto border border-brand-border bg-brand-bg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-brand-border text-xs text-brand-muted uppercase tracking-wider bg-brand-card">
                      <th className="py-2.5 px-3 font-medium">Symbol</th>
                      <th className="py-2.5 px-3 font-medium">Name</th>
                      <th className="py-2.5 px-3 font-medium text-right">Trust Score</th>
                      <th className="py-2.5 px-3 font-medium">Confidence Level</th>
                      <th className="py-2.5 px-3 font-medium text-center">Event Breakdown</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {loading ? (
                      <>
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                      </>
                    ) : data?.scores.map((score) => {
                      
                      const noTax = score.breakdown.filter(e => e.bucket === 'explained-no-tax').length;
                      const tax = score.breakdown.filter(e => e.bucket === 'explained-withholding-tax').length;
                      const unverifiable = score.breakdown.filter(e => e.bucket === 'unverifiable').length;
                      const unexplained = score.breakdown.filter(e => e.bucket === 'unexplained').length;

                      const totalVerified = noTax + tax;

                      return (
                        <tr key={score.asset.symbol} className="border-b border-brand-border hover:bg-brand-card transition-colors">
                          <td className="py-2.5 px-3 font-bold text-brand-text">{score.asset.symbol}</td>
                          <td className="py-2.5 px-3 text-brand-muted truncate max-w-[180px]">{score.asset.name}</td>
                          <td className="py-2.5 px-3 text-right">
                            {score.trustScore === null ? (
                              <span className="text-brand-muted font-mono uppercase text-xs">Insufficient Data</span>
                            ) : (
                              <span className="text-brand-accent font-mono text-base">{score.trustScore.toFixed(0)}%</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-brand-muted text-xs">
                            {score.confidenceLevel}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {totalVerified > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono text-positive border border-positive uppercase" title="Verified Events">
                                    {totalVerified} VERIFIED
                                  </span>
                                  {score.asset.notarizationSignature && (
                                    <a 
                                      href={`https://explorer.solana.com/tx/${score.asset.notarizationSignature}?cluster=devnet`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-brand-accent hover:text-white text-[10px] font-mono uppercase underline tracking-wider"
                                    >
                                      View on-chain proof ↗
                                    </a>
                                  )}
                                </div>
                              )}
                              {unexplained > 0 && (
                                <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono text-negative border border-negative uppercase" title="Unexplained Anomalies">
                                  {unexplained} ANOMALY
                                </span>
                              )}
                              {unverifiable > 0 && (
                                <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono text-brand-muted border border-brand-muted uppercase" title="Unverifiable due to missing data or indexer limitations">
                                  {unverifiable} UNVERIFIABLE
                                </span>
                              )}
                              {score.breakdown.length === 0 && (
                                <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono text-brand-muted border border-brand-muted uppercase">
                                  NO EVENTS
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
