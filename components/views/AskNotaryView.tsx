"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { askNotaryAction } from '@/app/actions';
import { Send, Terminal, ChevronDown } from 'lucide-react';
import { KNOWN_ASSETS } from '@/lib/known-assets';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export const AskNotaryView = () => {
  const { publicKey } = useWallet();
  const pubKeyString = publicKey?.toBase58();
  
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'System initialized. Ask Notary about yields, backing, or trust scores.'
    }
  ]);
  const [input, setInput] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const assetParam = selectedAsset === 'all' ? null : selectedAsset;
      const response = await askNotaryAction(userMessage, pubKeyString, assetParam);
      setMessages(prev => [...prev, { role: 'assistant', content: response.answer }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'ERR: Failed to communicate with Notary API. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-start w-full h-[calc(100vh-8rem)]">
      <div className="w-full max-w-4xl px-4 mt-2 flex flex-col h-full">
        
        <div className="mb-4 shrink-0">
          <h2 className="text-xl font-bold text-brand-text uppercase tracking-widest mb-2 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-brand-accent" />
            Ask Notary
          </h2>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-brand-muted text-sm max-w-2xl">
              Query on-chain data and corporate action analytics in plain text.
            </p>
            <div className="flex items-center gap-2">
              <label htmlFor="asset-select" className="text-xs font-mono uppercase tracking-widest text-brand-muted">Target Context:</label>
              <div className="relative">
                <select
                  id="asset-select"
                  value={selectedAsset}
                  onChange={(e) => setSelectedAsset(e.target.value)}
                  className="bg-[#050505] border border-brand-border text-brand-text py-1.5 pl-3 pr-8 font-mono text-sm focus:outline-none focus:border-brand-accent transition-colors appearance-none min-w-[140px] cursor-pointer"
                >
                  <option value="all">ALL ASSETS</option>
                  {KNOWN_ASSETS.map((asset) => (
                    <option key={asset.mintAddress} value={asset.mintAddress}>
                      {asset.symbol}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Chat History */}
        <div className="flex-1 min-h-0 overflow-y-auto border border-brand-border bg-[#050505] p-4 flex flex-col space-y-4">
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'self-end' : 'self-start'}`}
            >
              <span className={`text-[10px] mb-1 uppercase tracking-widest font-mono ${msg.role === 'user' ? 'text-brand-muted text-right' : 'text-brand-accent text-left'}`}>
                {msg.role === 'user' ? 'USER_INPUT' : 'NOTARY_SYS'}
              </span>
              <div 
                className={`p-3 font-mono text-sm whitespace-pre-wrap ${
                  msg.role === 'user' 
                    ? 'border border-brand-border bg-brand-card text-brand-text' 
                    : 'border border-brand-accent/30 bg-brand-bg text-brand-text'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="self-start flex flex-col max-w-[85%]">
              <span className="text-[10px] mb-1 uppercase tracking-widest font-mono text-brand-accent text-left">
                NOTARY_SYS
              </span>
              <div className="p-3 font-mono text-sm border border-brand-accent/30 bg-brand-bg text-brand-muted flex items-center gap-2">
                <div className="w-1.5 h-3 bg-brand-accent animate-pulse" /> Processing query...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSend} className="shrink-0 mt-4 flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. What is the trust score for AAPLx?"
            className="flex-1 bg-[#050505] border border-brand-border text-brand-text px-4 py-3 font-mono text-sm focus:outline-none focus:border-brand-accent transition-colors placeholder:text-brand-muted/50"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="bg-brand-accent text-[#050505] px-6 py-3 font-bold font-mono text-sm uppercase tracking-widest hover:bg-opacity-90 transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-brand-accent"
          >
            <Send className="w-4 h-4" />
            Execute
          </button>
        </form>

      </div>
    </div>
  );
};
