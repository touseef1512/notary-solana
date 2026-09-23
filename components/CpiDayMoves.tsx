"use client";

import React, { useState, useEffect } from "react";
import { getCpiDayMovesAction } from "@/app/actions";

type MoveRow = {
  ticker: string;
  moves: { date: string; movePercent: number }[];
  avgAbsMove: number | null;
  minMove?: number;
  maxMove?: number;
  error?: boolean;
};

type CpiData = {
  next: { date: string; daysUntil: number } | null;
  rows: MoveRow[];
};

export const CpiDayMoves = () => {
  const [data, setData] = useState<CpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getCpiDayMovesAction()
      .then(res => setData(res as CpiData))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00Z");
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  };

  return (
    <div className="border border-brand-border bg-brand-bg flex flex-col p-4">
      <h2 className="font-serif text-lg text-brand-text mb-2">CPI release days</h2>
      
      {loading ? (
        <div className="text-sm text-brand-muted p-4 text-center border border-brand-border">Loading...</div>
      ) : error ? (
        <div className="text-sm text-negative p-4 text-center border border-brand-border">Price history is unavailable right now.</div>
      ) : data ? (
        <>
          {data.next && (
            <p className="text-sm text-brand-text mb-4">
              Next CPI report: {formatDate(data.next.date)} at 8:30 AM ET {data.next.daysUntil === 0 ? "(today)" : `(in ${data.next.daysUntil} days)`}
            </p>
          )}

          <div className="overflow-x-auto border border-brand-border bg-brand-bg mb-2">
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-card border-b border-brand-border">
                <tr>
                  <th className="p-3 text-[10px] text-brand-muted font-normal">Stock</th>
                  <th className="p-3 text-[10px] text-brand-muted font-normal text-right">Average move on the last 5 CPI days</th>
                  <th className="p-3 text-[10px] text-brand-muted font-normal text-right">Range</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {data.rows.map(row => (
                  <tr key={row.ticker} className="hover:bg-brand-border/40 transition-colors">
                    <td className="p-3 text-brand-text font-bold">{row.ticker}</td>
                    
                    {row.error ? (
                      <td colSpan={2} className="p-3 text-brand-muted text-right text-xs">Unavailable</td>
                    ) : row.avgAbsMove === null || row.minMove === undefined || row.maxMove === undefined ? (
                      <td colSpan={2} className="p-3 text-brand-muted text-right text-xs">Not enough data</td>
                    ) : (
                      <>
                        <td className="p-3 text-right text-brand-text font-mono">
                          ±{row.avgAbsMove.toFixed(2)}%
                        </td>
                        <td className="p-3 text-right text-brand-text font-mono">
                          {row.minMove > 0 ? `+${row.minMove.toFixed(2)}` : row.minMove.toFixed(2)}% to {row.maxMove > 0 ? `+${row.maxMove.toFixed(2)}` : row.maxMove.toFixed(2)}%
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <p className="text-xs text-brand-muted">
            This is history, not a forecast. Each figure is the stock&apos;s move over the whole trading day on past CPI release days, not just the reaction to the report.
          </p>
        </>
      ) : null}
    </div>
  );
};
