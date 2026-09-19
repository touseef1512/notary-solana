"use client";

import { useState, useEffect } from "react";
import { useActiveAddress } from "@/components/ActiveAddressProvider";
import { getKaminoRiskAction, publishAttestationAction } from "@/app/actions";
import { WhatIfSimulator } from './WhatIfSimulator';

// Define the type we expect from getKaminoRiskAction
type KaminoRiskData = {
  obligationPubkey: string;
  depositedValue: number;
  borrowedValue: number;
  liquidationLtvThreshold: number;
  currentHealth: number | "Insufficient Data";
  drawdowns: Record<string, number | "Insufficient Data">;
  worstAssetSymbol: string | null;
  worstDrawdownValue: number | null;
  gapStressedHealth: number | "Insufficient Data";
  attestationStatus: { exists: boolean; attestationPda: string; decoded?: unknown } | null;
};

const ObligationCard = ({ obligation, activeAddress }: { obligation: KaminoRiskData, activeAddress: string }) => {
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [attestation, setAttestation] = useState(obligation.attestationStatus);

  const truncateAddress = (addr: string) => `${addr.slice(0, 4)}...${addr.slice(-4)}`;

  const handlePublish = async () => {
    setPublishing(true);
    setPublishError(null);
    try {
      const result = await publishAttestationAction(obligation.obligationPubkey, activeAddress);
      setAttestation({ exists: true, attestationPda: result.attestationPda });
    } catch (err: unknown) {
      setPublishError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setPublishing(false);
    }
  };

  const isPublishDisabled = 
    publishing || 
    obligation.currentHealth === "Insufficient Data" || 
    obligation.worstDrawdownValue === null || 
    obligation.gapStressedHealth === "Insufficient Data";

  return (
    <div className="border border-brand-border bg-brand-bg p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-brand-border pb-2">
        <div className="flex flex-col">
          <span className="text-[10px] text-brand-muted uppercase tracking-widest">OBLIGATION_PUBKEY</span>
          <span className="font-mono text-sm text-brand-text">{truncateAddress(obligation.obligationPubkey)}</span>
        </div>
        <div className="flex items-center gap-2">
          {attestation?.exists ? (
            <div className="flex items-center gap-3">
              <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono text-positive border border-positive uppercase">
                VERIFIED ON-CHAIN
              </span>
              <a 
                href={`https://explorer.solana.com/address/${attestation.attestationPda}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-accent hover:text-white text-[10px] font-mono uppercase underline tracking-wider"
              >
                View on-chain proof ↗
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {publishError && (
                <span className="text-negative text-xs font-mono max-w-[200px] text-right">{publishError}</span>
              )}
              <button
                onClick={handlePublish}
                disabled={isPublishDisabled}
                title={isPublishDisabled ? (publishing ? "" : "Cannot publish: insufficient risk data") : ""}
                className="px-3 py-1 border border-brand-accent text-brand-accent hover:bg-brand-accent hover:text-brand-bg disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-brand-accent disabled:cursor-not-allowed font-mono text-xs uppercase tracking-wider transition-colors"
              >
                {publishing ? "PUBLISHING..." : "Publish On-Chain"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grid of details */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex flex-col">
          <span className="text-[10px] text-brand-muted uppercase tracking-widest mb-1">DEPOSITED_VALUE</span>
          <span className="font-mono text-sm text-brand-text">
            ${obligation.depositedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-brand-muted uppercase tracking-widest mb-1">BORROWED_VALUE</span>
          <span className="font-mono text-sm text-brand-text">
            ${obligation.borrowedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-brand-muted uppercase tracking-widest mb-1">LIQUIDATION_THRESHOLD</span>
          <span className="font-mono text-sm text-brand-text">
            {(obligation.liquidationLtvThreshold * 100).toFixed(2)}%
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-brand-muted uppercase tracking-widest mb-1">CURRENT_HEALTH</span>
          <span className="font-mono text-sm text-brand-text">
            {obligation.currentHealth === "Insufficient Data" ? (
              <span className="text-brand-muted">N/A</span>
            ) : (
              (obligation.currentHealth as number).toFixed(2)
            )}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-brand-muted uppercase tracking-widest mb-1">WORST_ASSET_DRAWDOWN</span>
          <span className="font-mono text-sm text-brand-text">
            {obligation.worstAssetSymbol === null || obligation.worstDrawdownValue === null ? (
              <span className="text-brand-muted">Insufficient Data</span>
            ) : (
              `${obligation.worstAssetSymbol}: ${(obligation.worstDrawdownValue * 100).toFixed(2)}% drop`
            )}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-brand-muted uppercase tracking-widest mb-1">GAP_STRESSED_HEALTH</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-brand-text">
              {obligation.gapStressedHealth === "Insufficient Data" ? (
                <span className="text-brand-muted">N/A</span>
              ) : (
                (obligation.gapStressedHealth as number).toFixed(2)
              )}
            </span>
            {typeof obligation.gapStressedHealth === 'number' && obligation.gapStressedHealth < 1 && (
              <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono text-negative border border-negative uppercase">
                WARNING
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const CollateralRiskView = () => {
  const { activeAddress } = useActiveAddress();
  const [obligations, setObligations] = useState<KaminoRiskData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeAddress) {
      setLoading(true);
      setError(null);
      
      getKaminoRiskAction(activeAddress)
        .then((data) => {
          setObligations(data);
        })
        .catch((err) => {
          console.error(err);
          setError(err.message || 'Failed to fetch collateral risk data. Please try again later.');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setObligations([]);
      setError(null);
    }
  }, [activeAddress]);

  const SkeletonCard = () => (
    <div className="border border-brand-border bg-brand-bg p-4 flex flex-col gap-4 animate-pulse">
      <div className="flex justify-between items-center border-b border-brand-border pb-2">
        <div className="h-8 w-32 bg-brand-border rounded-sm"></div>
        <div className="h-8 w-24 bg-brand-border rounded-sm"></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="h-3 w-20 bg-brand-border rounded-sm"></div>
            <div className="h-4 w-16 bg-brand-border rounded-sm"></div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col items-center justify-start w-full">
      <div className="w-full max-w-6xl px-4 mt-6">
        {!activeAddress ? (
          <div className="flex items-center justify-center h-48 border border-brand-border bg-brand-card">
            <p className="text-brand-muted font-mono text-sm uppercase tracking-widest">Connect wallet or enter address to view terminal</p>
          </div>
        ) : (
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-brand-text uppercase tracking-widest">Kamino Lending Risk</h2>
              <span className="text-xs font-mono text-brand-muted">
                {loading ? 'UPDATING...' : `${obligations.length} OBLIGATIONS`}
              </span>
            </div>

            {error ? (
              <div className="flex items-center justify-center h-32 border border-negative bg-brand-card">
                <p className="text-negative font-mono text-sm uppercase">{error}</p>
              </div>
            ) : obligations.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center h-48 border border-brand-border bg-brand-card px-4">
                <p className="text-brand-muted font-mono text-sm uppercase tracking-widest mb-2 text-center">No Kamino lending positions found for this address</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {loading && obligations.length === 0 ? (
                  <>
                    <SkeletonCard />
                    <SkeletonCard />
                  </>
                ) : (
                  obligations.map((obligation) => (
                    <ObligationCard 
                      key={obligation.obligationPubkey} 
                      obligation={obligation} 
                      activeAddress={activeAddress}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        )}
        <WhatIfSimulator />
      </div>
    </div>
  );
};
