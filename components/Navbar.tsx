"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

// The WalletMultiButton uses client-side APIs and can cause hydration errors if not loaded dynamically
const WalletMultiButtonDynamic = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

export const Navbar = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-slate-100 hover:text-indigo-400 transition-colors">
          <ShieldCheck className="w-6 h-6 text-indigo-500" />
          <span>Notary</span>
        </Link>
        <div className="flex items-center gap-4">
          {mounted && <WalletMultiButtonDynamic />}
        </div>
      </div>
    </nav>
  );
};
