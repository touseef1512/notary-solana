"use client";

import React, { useState, useEffect } from "react";
import { getParityAssets } from "@/lib/parity-assets";
import { getMarketStatus, formatDuration } from "@/lib/market-hours";
import { getTradeCostAction, getNotaryAlertsAction } from "@/app/actions";
import { getNextCpi } from "@/lib/event-calendar";
import { KNOWN_ASSETS } from "@/lib/known-assets";

interface BeforeYouTradeProps {
  symbol: string;
  mint: string;
  sizeUsd: number;
  issuer: string;
  gapPercent: number | null;
  liquidity: number | null;
  closeDate: string | null;
}

export const BeforeYouTrade: React.FC<BeforeYouTradeProps> = ({
  mint,
  sizeUsd,
  issuer,
  gapPercent,
  liquidity,
  closeDate,
}) => {
  // a) Token address
  const asset = getParityAssets().find((a) => a.mintAddress === mint);
  const tokenAddressStatus = asset
    ? `Matches Notary's registry: ${asset.name}, issued by ${issuer}`
    : `Not in Notary's registry. Verify the address with the issuer before trading.`;

  // b) US market
  const [marketStatusStr, setMarketStatusStr] = useState<string>("Checking...");
  useEffect(() => {
    const status = getMarketStatus(new Date());
    if (status.isOpen) {
      setMarketStatusStr(`Open, closes in ${formatDuration(status.minutesUntilChange)}. Gap to the last close includes normal price movement.`);
    } else {
      setMarketStatusStr(`Closed, opens in ${formatDuration(status.minutesUntilChange)}. Tokens keep trading, so a gap to the last close can be normal.`);
    }
  }, []);

  // c) Gap to underlying close
  let gapStatus = "Not available";
  if (gapPercent !== null && closeDate !== null) {
    gapStatus = `${gapPercent > 0 ? "+" : ""}${gapPercent.toFixed(2)}% vs close on ${closeDate}`;
  } else if (gapPercent !== null) {
    gapStatus = `${gapPercent > 0 ? "+" : ""}${gapPercent.toFixed(2)}%`;
  }

  // d) Liquidity
  let liquidityStatus = "Not available";
  if (liquidity !== null) {
    const formatted = "$" + liquidity.toLocaleString(undefined, { maximumFractionDigits: 0 });
    if (liquidity < 100000) {
      liquidityStatus = `${formatted} (Thin liquidity)`;
    } else {
      liquidityStatus = formatted;
    }
  }

  // e) Estimated price impact
  const [impactStatus, setImpactStatus] = useState<string>("Checking...");
  const fetchImpact = React.useCallback(() => {
    setImpactStatus("Checking...");
    getTradeCostAction(mint, sizeUsd)
      .then((res) => {
        if (res.status === "ok") {
          setImpactStatus(`${res.impactPercent!.toFixed(2)}%`);
        } else if (res.status === "no_route") {
          setImpactStatus("No route found at this size");
        } else if (res.status === "rate_limited") {
          setImpactStatus("Rate limited. Try again in a moment.");
        } else {
          setImpactStatus("Quote unavailable");
        }
      })
      .catch(() => {
        setImpactStatus("Quote unavailable");
      });
  }, [mint, sizeUsd]);

  useEffect(() => {
    fetchImpact();
  }, [fetchImpact]);

  // f) Dividend and trading pause
  const [dividendStatus, setDividendStatus] = useState<string>("Checking...");
  useEffect(() => {
    const checkDividend = async () => {
      try {
        const knownAsset = KNOWN_ASSETS.find((a) => a.mintAddress === mint);
        if (!knownAsset) {
          setDividendStatus("No dividend projection tracked for this token.");
          return;
        }

        const alerts = await getNotaryAlertsAction();
        const divAlert = alerts.find(
          (a) => a.assetSymbol === knownAsset.symbol && a.title.startsWith("Upcoming Dividend")
        );

        if (divAlert && typeof divAlert.daysUntil === "number") {
          setDividendStatus(`Projected in ${divAlert.daysUntil} days. Projected from past payouts, not a confirmed declaration. Expect a brief trading pause of about 20 minutes around the date.`);
        } else if (divAlert) {
          setDividendStatus("A dividend is projected, but the date is not available. It is projected from past payouts, not a confirmed declaration.");
        } else {
          setDividendStatus("No dividend projection tracked for this token.");
        }
      } catch {
        setDividendStatus("Dividend data is unavailable right now.");
      }
    };
    checkDividend();
  }, [mint]);

  // g) Economic calendar
  const [cpiStatus, setCpiStatus] = useState<{ text: string; urgent: boolean } | null>(null);
  useEffect(() => {
    const nextCpi = getNextCpi(new Date());
    if (nextCpi) {
      const d = new Date(nextCpi.date + "T00:00:00Z");
      const formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      setCpiStatus({
        text: `Next CPI report: ${formattedDate} at 8:30 AM ET (in ${nextCpi.daysUntil} days)`,
        urgent: nextCpi.daysUntil <= 2
      });
    }
  }, []);

  return (
    <div className="flex flex-col mt-4">
      <h3 className="font-sans font-bold text-xl text-brand-text mb-4">Before you trade</h3>
      <div className="flex flex-col mb-4 divide-y divide-brand-border">
        {/* Row a: Token address */}
        <div className="flex justify-between items-start py-3 text-sm">
          <span className="text-brand-muted pr-4 whitespace-nowrap">Token address</span>
          <span className="text-brand-text text-right">{tokenAddressStatus}</span>
        </div>
        
        {/* Row b: US market */}
        <div className="flex justify-between items-start py-3 text-sm">
          <span className="text-brand-muted pr-4 whitespace-nowrap">US market</span>
          <span className="text-brand-text text-right">{marketStatusStr}</span>
        </div>

        {/* Row c: Gap to underlying close */}
        <div className="flex justify-between items-start py-3 text-sm">
          <span className="text-brand-muted pr-4 whitespace-nowrap">Gap to underlying close</span>
          <span className="text-brand-text text-right font-mono">{gapStatus}</span>
        </div>

        {/* Row d: Liquidity */}
        <div className="flex justify-between items-start py-3 text-sm">
          <span className="text-brand-muted pr-4 whitespace-nowrap">Liquidity</span>
          <span className="text-brand-text text-right font-mono">{liquidityStatus}</span>
        </div>

        {/* Row e: Estimated price impact */}
        <div className="flex justify-between items-start py-3 text-sm">
          <span className="text-brand-muted pr-4 whitespace-nowrap">Estimated price impact at ${sizeUsd.toLocaleString()}</span>
          <div className="flex flex-col items-end text-right">
            <span className="text-brand-text font-mono">{impactStatus}</span>
            {impactStatus.startsWith("Rate limited") && (
              <button 
                onClick={fetchImpact}
                className="text-[9px] uppercase border border-brand-accent text-brand-accent px-1.5 py-0.5 hover:bg-brand-accent hover:text-brand-bg mt-1"
              >
                Retry
              </button>
            )}
          </div>
        </div>

        {/* Row f: Dividend and trading pause */}
        <div className="flex justify-between items-start py-3 text-sm">
          <span className="text-brand-muted pr-4 whitespace-nowrap">Dividend and trading pause</span>
          <span className="text-brand-text text-right">{dividendStatus}</span>
        </div>

        {/* Row g: Economic calendar */}
        {cpiStatus && (
          <div className="flex justify-between items-start py-3 text-sm">
            <span className="text-brand-muted pr-4 whitespace-nowrap">Economic calendar</span>
            <span className={`text-right ${cpiStatus.urgent ? 'text-brand-accent' : 'text-brand-text'}`}>
              {cpiStatus.text}
            </span>
          </div>
        )}
      </div>
      <p className="text-xs text-brand-muted mb-4">
        This is a summary of market data and public schedules. It is not advice, and Notary does not execute trades or hold funds.
      </p>
    </div>
  );
};
