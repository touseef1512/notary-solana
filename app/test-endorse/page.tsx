"use client";

import React, { useState } from 'react';
import { VersionedTransaction } from '@solana/web3.js';
import { Buffer } from 'buffer';

interface PhantomProvider {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  signAndSendTransaction: (tx: VersionedTransaction) => Promise<{ signature: string }>;
}

export default function TestEndorsePage() {
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState<{ title: string; description: string } | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getPhantom = (): PhantomProvider | null => {
    return (window as unknown as { solana?: PhantomProvider }).solana ?? null;
  };

  const connectPhantom = async () => {
    try {
      setError(null);
      const solana = getPhantom();
      if (!solana || !solana.isPhantom) {
        throw new Error('Phantom wallet not found');
      }
      const response = await solana.connect();
      setPubkey(response.publicKey.toString());
    } catch (err) {
      setError(`Connect error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const endorseAaplx = async () => {
    if (!pubkey) return;
    try {
      setError(null);
      setSignature(null);
      setActionInfo(null);

      const getRes = await fetch('/api/actions/verify/AAPLx');
      if (!getRes.ok) {
        throw new Error(`GET failed: ${getRes.status} ${getRes.statusText}`);
      }
      const getJson = await getRes.json();
      setActionInfo({ title: getJson.title, description: getJson.description });

      const postRes = await fetch('/api/actions/verify/AAPLx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: pubkey })
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

      const solana = getPhantom();
      if (!solana) {
        throw new Error('Phantom wallet not found');
      }
      const { signature } = await solana.signAndSendTransaction(versionedTx);

      setSignature(signature);
    } catch (err) {
      console.error('Full endorse error object:', err); setError(`Endorse error: ${JSON.stringify(err, Object.getOwnPropertyNames(err))} | logs: ${JSON.stringify((err as { logs?: unknown })?.logs ?? null)}`);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Test Endorse AAPLx</h1>

      <div style={{ marginBottom: '20px' }}>
        <button onClick={connectPhantom} style={{ padding: '10px 20px', cursor: 'pointer' }}>
          Connect Phantom
        </button>
        {pubkey && (
          <p>Connected: <strong>{pubkey}</strong></p>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button onClick={endorseAaplx} disabled={!pubkey} style={{ padding: '10px 20px', cursor: pubkey ? 'pointer' : 'not-allowed' }}>
          Endorse AAPLx
        </button>
      </div>

      {actionInfo && (
        <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc' }}>
          <h3>Action Info (GET)</h3>
          <p><strong>Title:</strong> {actionInfo.title}</p>
          <p><strong>Description:</strong> {actionInfo.description}</p>
        </div>
      )}

      {signature && (
        <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid green', backgroundColor: '#eaffea' }}>
          <h3>Transaction Successful</h3>
          <p><strong>Signature:</strong> {signature}</p>
          <p>
            <a href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`} target="_blank" rel="noopener noreferrer">
              View on Solana Explorer (Devnet)
            </a>
          </p>
        </div>
      )}

      {error && (
        <div style={{ padding: '10px', border: '1px solid red', backgroundColor: '#ffeaea', color: 'red' }}>
          <h3>Error</h3>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{error}</pre>
        </div>
      )}
    </div>
  );
}
