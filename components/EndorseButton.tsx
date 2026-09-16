"use client";

import React, { useState } from 'react';
import { VersionedTransaction, Connection } from '@solana/web3.js';
import { Buffer } from 'buffer';

interface PhantomProvider {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  signAndSendTransaction: (tx: VersionedTransaction) => Promise<{ signature: string }>;
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
}

interface EndorseButtonProps {
  symbol: string;
}

export const EndorseButton = ({ symbol }: EndorseButtonProps) => {
  const [open, setOpen] = useState(false);
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState<{ title: string; description: string } | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<{ value: { err: unknown; logs: string[] | null } } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getPhantom = (): PhantomProvider | null => {
    return (window as unknown as { solana?: PhantomProvider }).solana ?? null;
  };

  const endorse = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSignature(null);
      setActionInfo(null);
      setSimulation(null);

      const solana = getPhantom();
      if (!solana || !solana.isPhantom) {
        throw new Error('Phantom wallet not found');
      }

      const connectRes = await solana.connect();
      const currentPubkey = connectRes.publicKey.toString();
      setPubkey(currentPubkey);

      const getRes = await fetch(`/api/actions/verify/${symbol}`);
      if (!getRes.ok) {
        throw new Error(`GET failed: ${getRes.status} ${getRes.statusText}`);
      }
      const getJson = await getRes.json();
      setActionInfo({ title: getJson.title, description: getJson.description });

      const postRes = await fetch(`/api/actions/verify/${symbol}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: currentPubkey })
      });
      if (!postRes.ok) {
        throw new Error(`POST failed: ${postRes.status} ${postRes.statusText}`);
      }
      const postJson = await postRes.json();

      const transactionBase64 = postJson.transaction;
      if (!transactionBase64) {
        throw new Error('No transaction in response');
      }

      const txBuffer = Buffer.from(transactionBase64, 'base64');
      const versionedTx = VersionedTransaction.deserialize(txBuffer);

      const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
      const simResult = await connection.simulateTransaction(versionedTx);
      console.log('Simulation result:', JSON.stringify(simResult, null, 2));
      setSimulation(simResult);

      if (simResult.value.err) {
        throw new Error(`Simulation failed: ${JSON.stringify(simResult.value.err)} | Logs: ${simResult.value.logs ? simResult.value.logs.join('\\n') : 'none'}`);
      }

      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      versionedTx.message.recentBlockhash = blockhash;

      const signedTx = await solana.signTransaction(versionedTx);
      const sig = await connection.sendRawTransaction(signedTx.serialize(), { skipPreflight: true });
      await connection.confirmTransaction(sig, 'confirmed');

      setSignature(sig);
    } catch (err) {
      console.error('Full endorse error object:', err);
      setError(`Endorse error: ${JSON.stringify(err, Object.getOwnPropertyNames(err))} | logs: ${JSON.stringify((err as { logs?: unknown })?.logs ?? null)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    endorse();
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider border border-brand-accent text-brand-accent hover:bg-brand-accent hover:text-brand-bg transition-colors"
      >
        Endorse
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setOpen(false)}>
          <div className="max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="bg-brand-card border border-brand-border p-6 text-brand-muted font-mono text-sm max-h-[80vh] overflow-y-auto">
              
              {actionInfo && (
                <div className="mb-4 pb-4 border-b border-brand-border/50">
                  <h3 className="text-white font-medium mb-2 text-lg">{actionInfo.title}</h3>
                  <p className="text-brand-muted/80">{actionInfo.description}</p>
                </div>
              )}

              {pubkey && (
                <div className="text-xs text-brand-muted/60 mb-2">
                  Connected: {pubkey.slice(0, 4)}..{pubkey.slice(-4)}
                </div>
              )}

              {isLoading && (
                <div className="text-center py-4 border border-brand-border/50 bg-black/20 rounded">Processing... Please check your wallet.</div>
              )}

              {signature && (
                <div className="text-green-400 p-4 border border-green-400/30 bg-green-400/10 rounded mb-4 break-all">
                  <p className="mb-2 font-medium">Transaction Successful!</p>
                  <p className="text-xs mb-2">Signature: {signature}</p>
                  <a 
                    href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-white underline hover:text-brand-accent text-xs"
                  >
                    View on Solana Explorer (Devnet)
                  </a>
                </div>
              )}

              {error && (
                <div className="text-red-400 p-4 border border-red-400/30 bg-red-400/10 rounded mb-4 overflow-x-auto text-xs">
                  <p className="font-medium mb-1 text-sm">Error</p>
                  <pre className="whitespace-pre-wrap">{error}</pre>
                </div>
              )}

              {simulation && !!simulation.value.err && (
                <div className="text-orange-400 p-4 border border-orange-400/30 bg-orange-400/10 rounded mb-4 overflow-x-auto text-xs">
                  <p className="font-medium mb-1 text-sm">Simulation Error</p>
                  <pre className="whitespace-pre-wrap">{JSON.stringify(simulation.value.err, null, 2)}</pre>
                  {simulation.value.logs && (
                    <div className="mt-2">
                      <p className="font-medium mb-1">Logs:</p>
                      <pre className="whitespace-pre-wrap">{simulation.value.logs.join('\n')}</pre>
                    </div>
                  )}
                </div>
              )}

              <button 
                onClick={() => setOpen(false)}
                className="mt-6 w-full px-4 py-2 border border-brand-border text-brand-muted hover:bg-brand-border/50 transition-colors uppercase tracking-wider text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
