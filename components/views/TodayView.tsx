"use client";

import React from "react";
import type { NotaryAlert } from "@/lib/alert-engine";
import { ChevronRight } from "lucide-react";
import { CpiDayMoves } from "@/components/CpiDayMoves";

interface TodayViewProps {
  alerts: NotaryAlert[];
  onNavigate: (tabId: string) => void;
}

export const TodayView: React.FC<TodayViewProps> = ({ alerts, onNavigate }) => {
  const hasCritical = alerts.some((a) => a.severity === "critical");

  return (
    <div className="flex flex-col items-center justify-start w-full">
      <div className="w-full max-w-4xl px-4 mt-6 flex flex-col gap-6">
        
        {/* Top Panel */}
        <div className="p-6 border border-brand-border bg-brand-card rounded-[4px] flex items-center justify-center text-center">
          <h1 className="font-serif text-2xl text-brand-text">
            {hasCritical ? (
              <>
                One of your loans needs <span className="text-brand-critical">attention</span> today.
              </>
            ) : alerts.length > 0 ? (
              <>
                Everything&apos;s fine right now — {alerts.length} thing{alerts.length === 1 ? "" : "s"} worth knowing about.
              </>
            ) : (
              <>
                Everything&apos;s fine — nothing needs your attention right now.
              </>
            )}
          </h1>
        </div>

        {/* Alerts List */}
        {alerts.length > 0 && (
          <div className="border border-brand-border bg-brand-bg flex flex-col">
            {alerts.slice(0, 5).map((alert, idx) => {
              const isCritical = alert.severity === "critical";
              return (
                <div 
                  key={alert.obligationPubkey ?? alert.assetSymbol ?? idx} 
                  className={`flex justify-between items-center p-4 ${idx < alerts.slice(0, 5).length - 1 ? "border-b border-brand-border" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    {isCritical ? (
                      <div className="w-2 h-2 rounded-full bg-brand-critical shrink-0" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-transparent shrink-0" />
                    )}
                    <div className="flex flex-col gap-1">
                      <span className="font-sans text-brand-text">{alert.title}</span>
                      <span className="font-sans text-sm text-brand-muted">{alert.note}</span>
                    </div>
                  </div>
                  {alert.daysUntil !== null && (
                    <div className="font-mono text-brand-muted text-sm shrink-0 ml-4">
                      {alert.daysUntil} days
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <CpiDayMoves />

        {/* Quick Links */}
        <div className="flex flex-col sm:flex-row gap-6 mt-4 justify-center items-center">
          <button 
            onClick={() => onNavigate("portfolio")}
            className="flex items-center gap-1 text-brand-text hover:text-brand-accent transition-colors font-sans text-sm"
          >
            See your holdings
            <ChevronRight className="w-4 h-4" />
          </button>
          <button 
            onClick={() => onNavigate("loans")}
            className="flex items-center gap-1 text-brand-text hover:text-brand-accent transition-colors font-sans text-sm"
          >
            Check your loans
            <ChevronRight className="w-4 h-4" />
          </button>
          <button 
            onClick={() => onNavigate("markets")}
            className="flex items-center gap-1 text-brand-text hover:text-brand-accent transition-colors font-sans text-sm"
          >
            Compare markets
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
