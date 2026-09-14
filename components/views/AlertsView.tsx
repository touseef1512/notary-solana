"use client";

import React, { useEffect, useState } from 'react';
import { getUpcomingAlertsAction } from '@/app/actions';
import type { AlertResult } from '@/lib/alerts';
import { BellRing } from 'lucide-react';

export const AlertsView = () => {
  const [alerts, setAlerts] = useState<AlertResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getUpcomingAlertsAction()
      .then(res => {
        if (!mounted) return;
        setAlerts(res);
      })
      .catch(err => {
        if (!mounted) return;
        console.error(err);
        setError("Failed to load upcoming alerts.");
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
      <td className="py-3 px-2"><div className="h-4 w-16 bg-brand-border rounded-sm text-right"></div></td>
      <td className="py-3 px-2"><div className="h-4 w-48 bg-brand-border rounded-sm"></div></td>
    </tr>
  );

  return (
    <div className="flex flex-col items-center justify-start w-full">
      <div className="w-full max-w-6xl px-4 mt-2 mb-6">
        <h2 className="text-xl font-bold text-brand-text uppercase tracking-widest mb-2 flex items-center gap-2">
          <BellRing className="w-5 h-5 text-brand-accent" />
          Proactive Alerts
        </h2>
        <p className="text-brand-muted text-sm mb-6 max-w-3xl">
          Track upcoming corporate actions (dividends, splits) and their estimated impact on trading conditions.
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
                  <th className="py-2.5 px-3 font-medium w-24">Symbol</th>
                  <th className="py-2.5 px-3 font-medium w-40">Next Event Date</th>
                  <th className="py-2.5 px-3 font-medium text-right w-24">Days Until</th>
                  <th className="py-2.5 px-3 font-medium text-left">Notes</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {loading ? (
                  <>
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                  </>
                ) : alerts?.map((item) => {
                  const noData = item.confidenceLevel === "no-data";
                  const estimated = item.confidenceLevel === "estimated";
                  
                  return (
                    <tr key={item.asset.symbol} className="border-b border-brand-border hover:bg-brand-card transition-colors">
                      <td className="py-2.5 px-3 font-bold text-brand-text uppercase">
                        {item.asset.symbol}
                      </td>
                      
                      <td className="py-2.5 px-3">
                        {noData ? (
                          <span className="text-brand-muted font-mono uppercase text-[10px]">Insufficient Data</span>
                        ) : (
                          <span className={`font-mono text-sm ${estimated ? 'text-brand-accent' : 'text-brand-text'}`}>
                            {item.nextEventDate}
                            {estimated && <span className="ml-2 text-[10px] text-brand-accent uppercase">(EST)</span>}
                          </span>
                        )}
                      </td>
                      
                      <td className="py-2.5 px-3 text-right">
                        {noData || item.daysUntil === null ? (
                          <span className="text-brand-muted font-mono uppercase text-[10px]">Insufficient Data</span>
                        ) : (
                          <span className={`font-mono text-base ${estimated ? 'text-brand-accent' : 'text-brand-text'}`}>
                            {item.daysUntil}
                          </span>
                        )}
                      </td>
                      
                      <td className="py-2.5 px-3 text-brand-muted text-xs font-mono max-w-[400px] truncate" title={item.note}>
                        {item.note}
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
