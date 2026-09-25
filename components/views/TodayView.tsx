"use client";

import React, { useEffect, useState } from "react";
import type { NotaryAlert } from "@/lib/alert-engine";
import { ChevronRight, Send } from "lucide-react";
import { CpiDayMoves } from "@/components/CpiDayMoves";
import { useActiveAddress } from "@/components/ActiveAddressProvider";
import { checkTelegramLinkAction } from "@/app/actions";

interface TodayViewProps {
  alerts: NotaryAlert[];
  onNavigate: (tabId: string) => void;
}

export const TodayView: React.FC<TodayViewProps> = ({ alerts, onNavigate }) => {
  const hasCritical = alerts.some((a) => a.severity === "critical");
  const { activeAddress } = useActiveAddress();
  const [isLinked, setIsLinked] = useState(false);

  useEffect(() => {
    if (activeAddress) {
      checkTelegramLinkAction(activeAddress).then(setIsLinked).catch(console.error);
    } else {
      setIsLinked(false);
    }
  }, [activeAddress]);

  type ProcessedAlert = NotaryAlert & { isDividendGroup?: boolean; underlyingTicker?: string; allSymbols?: string[] };
  const processedAlerts: ProcessedAlert[] = [];
  
  for (const alert of alerts) {
    if (alert.kind === "dividend-event" && alert.assetSymbol) {
      const underlying = alert.assetSymbol.replace(/x$/, "").replace(/on$/, "");
      const existing = processedAlerts.find(a => a.isDividendGroup && a.underlyingTicker === underlying && a.daysUntil === alert.daysUntil);
      if (existing) {
        if (existing.allSymbols && !existing.allSymbols.includes(alert.assetSymbol)) {
          existing.allSymbols.push(alert.assetSymbol);
        }
      } else {
        processedAlerts.push({
          ...alert,
          isDividendGroup: true,
          underlyingTicker: underlying,
          allSymbols: [alert.assetSymbol]
        });
      }
    } else {
      processedAlerts.push(alert);
    }
  }

  const displayAlerts = processedAlerts.slice(0, 5);
  const hasDividends = displayAlerts.some(a => a.kind === "dividend-event");

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
            ) : processedAlerts.length > 0 ? (
              <>
                All clear for now — {processedAlerts.length} thing{processedAlerts.length === 1 ? "" : "s"} worth knowing before they matter.
              </>
            ) : (
              <>
                Everything&apos;s fine — nothing needs your attention right now.
              </>
            )}
          </h1>
        </div>

        {/* Telegram Card */}
        {!isLinked && (
          <div className="p-4 border border-brand-border bg-brand-card rounded-[4px] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col gap-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <Send className="w-5 h-5 text-brand-accent shrink-0" />
                <h2 className="font-sans text-brand-text font-bold">Get notices on Telegram</h2>
              </div>
              <p className="font-sans text-sm text-brand-muted">Get your daily briefing and risk alerts sent directly to Telegram.</p>
            </div>
            <a 
              href="https://t.me/the_notary_bot?start=app" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-3 py-1 border border-brand-accent bg-brand-accent text-brand-bg hover:opacity-90 transition-opacity font-sans text-sm shrink-0"
            >
              Open in Telegram
            </a>
          </div>
        )}

        {/* Alerts List */}
        {processedAlerts.length > 0 && (
          <div className="flex flex-col gap-2">
            {hasDividends && (
              <div className="text-xs text-brand-muted font-sans px-2">
                Dividend dates below are projected from historical cadence, not confirmed. Expect a brief trading pause around each date.
              </div>
            )}
            <div className="border border-brand-border bg-brand-bg flex flex-col">
              {displayAlerts.map((alert, idx) => {
                const isCritical = alert.severity === "critical";
                return (
                  <div 
                    key={alert.obligationPubkey ?? alert.assetSymbol ?? idx} 
                    className={`flex justify-between items-center p-4 ${idx < displayAlerts.length - 1 ? "border-b border-brand-border" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      {isCritical ? (
                        <div className="w-2 h-2 rounded-full bg-brand-critical shrink-0" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-transparent shrink-0" />
                      )}
                      <div className="flex flex-col gap-1">
                        {alert.isDividendGroup ? (
                          <>
                            <span className="font-sans text-brand-text">{alert.underlyingTicker} dividend</span>
                            {alert.allSymbols && alert.allSymbols.length > 0 && (
                              <span className="font-sans text-xs text-brand-muted">
                                Affects {alert.allSymbols.join(", ")}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="font-sans text-brand-text">{alert.title}</span>
                            <span className="font-sans text-sm text-brand-muted">{alert.note}</span>
                          </>
                        )}
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
