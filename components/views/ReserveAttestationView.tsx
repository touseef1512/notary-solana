"use client";

import React, { useEffect, useState } from 'react';
import { getReserveAttestationsAction } from '@/app/actions';
import type { AttestationResult } from '@/lib/attestation';
import { PlainNote } from '@/components/PlainNote';

export const ReserveAttestationView = () => {
  const [attestations, setAttestations] = useState<AttestationResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getReserveAttestationsAction()
      .then(res => {
        if (!mounted) return;
        setAttestations(res);
      })
      .catch(err => {
        if (!mounted) return;
        console.error(err);
        setError("Failed to load reserve attestations.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const SkeletonCard = () => (
    <tr className="border-b border-brand-border animate-pulse">
      <td className="py-3 px-2"><div className="h-4 w-16 bg-brand-border rounded-sm"></div></td>
      <td className="py-3 px-2"><div className="h-4 w-24 bg-brand-border rounded-sm"></div></td>
      <td className="py-3 px-2"><div className="h-4 w-16 bg-brand-border rounded-sm ml-auto"></div></td>
      <td className="py-3 px-2"><div className="h-4 w-16 bg-brand-border rounded-sm mx-auto"></div></td>
      <td className="py-3 px-2"><div className="h-4 w-16 bg-brand-border rounded-sm mx-auto"></div></td>
      <td className="py-3 px-2"><div className="h-4 w-32 bg-brand-border rounded-sm mx-auto"></div></td>
    </tr>
  );

  return (
    <div className="flex flex-col items-center justify-start w-full">
      <div className="w-full max-w-6xl px-4 mt-2 mb-6">
        <PlainNote text="This compares the tokens an issuer has in circulation with the reserves it reports. A ratio at or above 1 means reported reserves cover the tokens. The figures come from the issuer, and for xStocks the ratio uses supply across all blockchains, not only Solana." />
        <h2 className="text-xl font-bold text-brand-text uppercase tracking-widest mb-2">Reserve Attestation</h2>
        <p className="text-brand-muted text-sm mb-6 max-w-3xl">
          Verify cryptographic proofs of off-chain asset reserves. Real-time attestations validate that tokenized assets are fully backed 1:1 by traditional securities.
        </p>

        {error ? (
          <div className="flex items-center justify-center h-32 border border-negative bg-brand-card">
            <p className="text-negative font-mono text-sm uppercase">{error}</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto border border-brand-border bg-brand-bg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-brand-border text-xs text-brand-muted uppercase tracking-wider bg-brand-card">
                  <th className="py-2.5 px-3 font-medium">Symbol</th>
                  <th className="py-2.5 px-3 font-medium">Classification</th>
                  <th className="py-2.5 px-3 font-medium text-right">Backing Ratio</th>
                  <th className="py-2.5 px-3 font-medium text-right">Buffer</th>
                  <th className="py-2.5 px-3 font-medium text-right">Age</th>
                  <th className="py-2.5 px-3 font-medium text-left">Disclosure</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {loading ? (
                  <>
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                  </>
                ) : attestations?.map((item) => {
                  const hasData = item.hasLiveAttestation;
                  
                  return (
                    <tr key={item.asset.symbol} className="border-b border-brand-border hover:bg-brand-card transition-colors">
                      <td className="py-2.5 px-3 font-bold text-brand-text uppercase">{item.asset.symbol}</td>
                      <td className="py-2.5 px-3 text-brand-text uppercase tracking-widest text-xs">{item.classification}</td>
                      <td className="py-2.5 px-3 text-right">
                        {!hasData || item.backingRatio === null ? (
                          <span className="text-brand-muted font-mono uppercase text-[10px]">Insufficient Data</span>
                        ) : (
                          <span className="text-brand-accent font-mono text-base">{(item.backingRatio * 100).toFixed(2)}%</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {!hasData || item.bufferPercent === null ? (
                          <span className="text-brand-muted font-mono uppercase text-[10px]">Insufficient Data</span>
                        ) : (
                          <span className="text-brand-text font-mono text-base">{(item.bufferPercent * 100).toFixed(2)}%</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {!hasData || item.attestationAgeHours === null ? (
                          <span className="text-brand-muted font-mono uppercase text-[10px]">Insufficient Data</span>
                        ) : (
                          <span className="text-brand-text font-mono text-base">{item.attestationAgeHours.toFixed(1)}h</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-brand-muted text-xs font-mono max-w-[250px] truncate" title={item.disclosure}>
                        {item.disclosure}
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
