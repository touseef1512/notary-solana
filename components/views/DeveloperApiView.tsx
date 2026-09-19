"use client";

import React, { useState, useEffect } from "react";

export const DeveloperApiView = () => {
  const [origin, setOrigin] = useState("");
  
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [registryData, setRegistryData] = useState<unknown | null>(null);

  const [attestationInput, setAttestationInput] = useState("7BACsXdze3FporEnXEbuSHStPPQ58tpZuWb7jgsUYmV");
  const [attestationLoading, setAttestationLoading] = useState(false);
  const [attestationStatus, setAttestationStatus] = useState<number | null>(null);
  const [attestationData, setAttestationData] = useState<unknown | null>(null);

  const [schemaFields, setSchemaFields] = useState<string[]>([]);
  const [units, setUnits] = useState<string | null>(null);
  const [guideFailed, setGuideFailed] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    
    fetch("/api/v1/registry")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed");
        return await res.json() as unknown;
      })
      .then((data: unknown) => {
        if (
          data !== null &&
          typeof data === 'object' &&
          'schema' in data &&
          data.schema !== null &&
          typeof data.schema === 'object' &&
          'fieldNames' in data.schema &&
          Array.isArray(data.schema.fieldNames)
        ) {
          setSchemaFields(data.schema.fieldNames.map(String));
        } else {
          setGuideFailed(true);
        }
        
        if (
          data !== null &&
          typeof data === 'object' &&
          'units' in data &&
          typeof data.units === 'string'
        ) {
          setUnits(data.units);
        }
      })
      .catch(() => setGuideFailed(true));
  }, []);

  const handleTryRegistry = async () => {
    setRegistryLoading(true);
    setRegistryError(null);
    setRegistryData(null);
    try {
      const res = await fetch("/api/v1/registry");
      const data = await res.json() as unknown;
      if (!res.ok) {
        setRegistryError(`Status ${res.status}`);
      }
      setRegistryData(data);
    } catch (err: unknown) {
      setRegistryError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setRegistryLoading(false);
    }
  };

  const handleTryAttestation = async () => {
    if (!attestationInput) return;
    setAttestationLoading(true);
    setAttestationStatus(null);
    setAttestationData(null);
    try {
      const res = await fetch(`/api/v1/attestation/${attestationInput}`);
      setAttestationStatus(res.status);
      const data = await res.json() as unknown;
      setAttestationData(data);
    } catch (err: unknown) {
      setAttestationStatus(500);
      setAttestationData({ error: err instanceof Error ? err.message : "Network error" });
    } finally {
      setAttestationLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-start w-full">
      <div className="w-full max-w-6xl px-4 mt-6 flex flex-col gap-8">
        
        <div className="border border-brand-border bg-brand-bg p-4 flex flex-col gap-4">
          <p className="font-mono text-sm text-brand-text">
            Notary publishes Kamino collateral-risk attestations on Solana (devnet) via the Solana Attestation Service. Any program can read them.
          </p>
        </div>

        <div className="border border-brand-border bg-brand-bg p-4 flex flex-col gap-4">
          <h2 className="text-sm font-bold text-brand-accent uppercase tracking-widest">Endpoints</h2>
          
          <div className="flex flex-col gap-2 border border-brand-border p-4 bg-brand-card">
            <h3 className="text-xs font-bold text-brand-text uppercase tracking-widest">GET /api/v1/registry</h3>
            <p className="text-xs font-mono text-brand-muted">Returns the current SAS configuration and schema layout.</p>
            {origin && (
              <pre className="text-xs text-brand-accent bg-[#050505] p-2 mt-2 overflow-x-auto border border-brand-border">
                curl {origin}/api/v1/registry
              </pre>
            )}
            
            <div className="mt-4">
              <button 
                onClick={handleTryRegistry}
                disabled={registryLoading}
                className="px-3 py-1 border border-brand-accent text-brand-accent hover:bg-brand-accent hover:text-brand-bg disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-brand-accent font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer w-24"
              >
                {registryLoading ? "FETCHING..." : "Try it"}
              </button>
            </div>
            
            {registryError && (
              <div className="mt-2 text-negative text-xs font-mono">{registryError}</div>
            )}
            {registryData !== null && (
              <pre className="mt-2 text-xs font-mono text-brand-text bg-[#050505] p-4 border border-brand-border overflow-x-auto max-h-64 overflow-y-auto">
                {String(JSON.stringify(registryData, null, 2))}
              </pre>
            )}
          </div>

          <div className="flex flex-col gap-2 border border-brand-border p-4 bg-brand-card">
            <h3 className="text-xs font-bold text-brand-text uppercase tracking-widest">GET /api/v1/attestation/&#123;obligation&#125;</h3>
            <p className="text-xs font-mono text-brand-muted">Returns a decoded point-in-time risk attestation for a specific Kamino obligation.</p>
            {origin && (
              <pre className="text-xs text-brand-accent bg-[#050505] p-2 mt-2 overflow-x-auto border border-brand-border">
                curl {origin}/api/v1/attestation/7BACsXdze3FporEnXEbuSHStPPQ58tpZuWb7jgsUYmV
              </pre>
            )}
            
            <div className="mt-4 flex gap-2">
              <input 
                type="text" 
                value={attestationInput}
                onChange={(e) => setAttestationInput(e.target.value)}
                className="bg-[#050505] border border-brand-border text-brand-text px-3 py-1 font-mono text-xs flex-1 focus:border-brand-accent focus:outline-none"
              />
              <button 
                onClick={handleTryAttestation}
                disabled={attestationLoading || !attestationInput}
                className="px-3 py-1 border border-brand-accent text-brand-accent hover:bg-brand-accent hover:text-brand-bg disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-brand-accent font-mono text-xs uppercase tracking-wider transition-colors whitespace-nowrap cursor-pointer"
              >
                {attestationLoading ? "FETCHING..." : "Try it"}
              </button>
            </div>
            
            {attestationStatus !== null && (
              <div className="mt-2">
                <span className={`text-[10px] uppercase tracking-widest font-mono px-1.5 py-0.5 border ${attestationStatus === 200 ? 'border-positive text-positive' : 'border-negative text-negative'}`}>
                  HTTP {attestationStatus}
                </span>
              </div>
            )}
            {attestationData !== null && (
              <pre className="mt-2 text-xs font-mono text-brand-text bg-[#050505] p-4 border border-brand-border overflow-x-auto max-h-64 overflow-y-auto">
                {String(JSON.stringify(attestationData, null, 2))}
              </pre>
            )}
          </div>
        </div>

        <div className="border border-brand-border bg-brand-bg p-4 flex flex-col gap-4">
          <h2 className="text-sm font-bold text-brand-accent uppercase tracking-widest">Field Guide</h2>
          {guideFailed ? (
            <span className="text-brand-muted font-mono text-sm uppercase">Insufficient Data</span>
          ) : schemaFields.length > 0 ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {schemaFields.map((field) => (
                  <div key={field} className="font-mono text-xs text-brand-text bg-brand-card p-2 border border-brand-border">
                    {field}
                  </div>
                ))}
              </div>
              {units && (
                <p className="font-mono text-xs text-brand-text">
                  {units}
                </p>
              )}
            </div>
          ) : (
            <span className="text-brand-muted font-mono text-sm uppercase">LOADING...</span>
          )}
        </div>

        <div className="border border-brand-border bg-brand-bg p-4 flex flex-col gap-2">
          <h2 className="text-sm font-bold text-brand-accent uppercase tracking-widest">Caveats</h2>
          <p className="font-mono text-sm text-brand-text">
            Devnet only. Values are point-in-time snapshots; check computedAtUnixTs. Large integers are returned as strings. Gap-stress figures use a static last-observed weekend gap, not a prediction. Attestations exist only for obligations that have been published. Requests are rate limited per client.
          </p>
        </div>

        <div className="border border-brand-border bg-brand-bg p-4 flex flex-col gap-2 mb-12">
          <p className="font-mono text-sm text-brand-muted">
            See <code className="text-brand-text bg-[#050505] px-1 py-0.5 border border-brand-border">scripts/consumer-demo.ts</code> for an example consumer that reads the chain directly using only sas-lib.
          </p>
        </div>

      </div>
    </div>
  );
};
