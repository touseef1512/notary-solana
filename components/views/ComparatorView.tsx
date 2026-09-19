"use client";

import React, { useState } from 'react';
import { generateSettlementComparison } from '@/lib/comparator';
import type { SettlementComparison } from '@/lib/comparator';
import { Scale, Calendar, AlertTriangle } from 'lucide-react';
import { PlainNote } from '@/components/PlainNote';

export const ComparatorView = () => {
  // Use today's date as default
  const today = new Date().toISOString().split('T')[0];
  const [eventDate, setEventDate] = useState<string>(today);
  const [eventType, setEventType] = useState<"dividend" | "split">("dividend");

  // Since it's purely synchronous, we can just compute it on every render
  const result: SettlementComparison = generateSettlementComparison(eventDate || today, eventType);

  return (
    <div className="flex flex-col items-center justify-start w-full">
      <div className="w-full max-w-4xl px-4 mt-2 mb-6">
        <PlainNote text="This compares how long a dividend or stock split takes to settle in traditional finance versus on Solana, for a date and event type you choose. It shows timelines only and does not predict prices." />
        <h2 className="text-xl font-bold text-brand-text uppercase tracking-widest mb-2 flex items-center gap-2">
          <Scale className="w-5 h-5 text-brand-accent" />
          Settlement Comparator
        </h2>
        <p className="text-brand-muted text-sm mb-6 max-w-3xl">
          Compare the settlement timelines of corporate actions between traditional finance (T+1) and tokenized assets on Solana (T+0).
        </p>

        <div className="border border-brand-border bg-brand-bg p-6 max-w-2xl mx-auto mb-8">
          <form className="flex flex-col gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* Event Date Input */}
              <div className="flex flex-col gap-2">
                <label htmlFor="comp-date" className="text-xs font-mono uppercase tracking-widest text-brand-muted">Event Date (Ex-Date)</label>
                <input
                  id="comp-date"
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full bg-brand-card border border-brand-border text-brand-text px-4 py-3 font-mono text-sm focus:outline-none focus:border-brand-accent transition-colors"
                />
              </div>

              {/* Event Type Segmented Control */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-mono uppercase tracking-widest text-brand-muted">Event Type</label>
                <div className="flex border border-brand-border bg-brand-card w-full h-[46px]">
                  <button
                    type="button"
                    onClick={() => setEventType('dividend')}
                    className={`flex-1 font-mono text-sm uppercase tracking-widest transition-colors ${
                      eventType === 'dividend' 
                        ? 'bg-brand-accent text-[#050505] font-bold' 
                        : 'text-brand-muted hover:text-brand-text'
                    }`}
                  >
                    Dividend
                  </button>
                  <button
                    type="button"
                    onClick={() => setEventType('split')}
                    className={`flex-1 font-mono text-sm uppercase tracking-widest transition-colors ${
                      eventType === 'split' 
                        ? 'bg-brand-accent text-[#050505] font-bold border-l border-brand-border' 
                        : 'text-brand-muted hover:text-brand-text border-l border-brand-border'
                    }`}
                  >
                    Split
                  </button>
                </div>
              </div>

            </div>
          </form>
        </div>

        {/* Results */}
        <div className="max-w-2xl mx-auto">
          {result.isEventDateWeekendOrHoliday && (
            <div className="mb-4 p-3 border border-brand-accent bg-brand-card flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-brand-accent shrink-0 mt-0.5" />
              <p className="text-brand-muted text-xs font-mono">
                <strong className="text-brand-accent block mb-1">NON-BUSINESS DAY EVENT</strong>
                The selected event date falls on a weekend or U.S. market holiday. In traditional finance, T+0 processing will not begin until the next valid business day.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Traditional Card */}
            <div className="border border-brand-border bg-brand-bg flex flex-col h-full">
              <div className="bg-brand-card border-b border-brand-border p-3">
                <h3 className="text-xs font-mono uppercase tracking-widest text-brand-muted text-center">Traditional (T+1)</h3>
              </div>
              <div className="p-6 flex flex-col items-center justify-center flex-1">
                <Calendar className="w-8 h-8 text-brand-muted mb-4 opacity-50" />
                <span className="text-2xl font-mono text-brand-text mb-1">
                  {result.traditionalSettlementDate}
                </span>
                <span className="text-xs font-mono uppercase text-brand-muted text-center max-w-[200px]">
                  Requires clearing houses and correspondent banks.
                </span>
              </div>
            </div>

            {/* Solana Card */}
            <div className="border border-brand-accent bg-brand-bg flex flex-col h-full shadow-[0_0_15px_rgba(255,159,28,0.1)]">
              <div className="bg-brand-accent p-3">
                <h3 className="text-xs font-mono uppercase tracking-widest text-[#050505] font-bold text-center">Solana (T+0)</h3>
              </div>
              <div className="p-6 flex flex-col items-center justify-center flex-1">
                <Scale className="w-8 h-8 text-brand-accent mb-4" />
                <span className="text-2xl font-mono text-brand-accent font-bold mb-1">
                  {result.solanaSettlementDate}
                </span>
                <span className="text-xs font-mono uppercase text-brand-muted text-center max-w-[200px]">
                  Instant atomic settlement on the global state machine.
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
