"use client";
import React, { useState } from 'react';

const KNOWN_TICKERS = new Set([
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA',
  'COIN', 'MSTR', 'PG', 'MCD', 'KO', 'JNJ'
]);

export const TickerLogo = ({ symbol, size = 24, className = '' }: { symbol: string, size?: number, className?: string }) => {
  const [error, setError] = useState(false);

  const baseSymbol = symbol.replace(/x$|on$/, '').toUpperCase();
  const hasLocalLogo = KNOWN_TICKERS.has(baseSymbol);

  if (!hasLocalLogo || error) {
    return (
      <div
        className={`rounded-full flex items-center justify-center bg-brand-border text-brand-text font-bold font-mono ${className}`}
        style={{ width: size, height: size, fontSize: Math.max(10, size * 0.45) }}
      >
        {baseSymbol.charAt(0)}
      </div>
    );
  }

  return (
    <img
      src={`/logos/${baseSymbol}.png`}
      alt={`${symbol} logo`}
      width={size}
      height={size}
      className={`rounded-full object-cover bg-white ${className}`}
      onError={() => setError(true)}
    />
  );
};
