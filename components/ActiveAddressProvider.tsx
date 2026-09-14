"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

interface ActiveAddressContextType {
  activeAddress: string | undefined;
  isViewMode: boolean;
  setViewAddress: (address: string | null) => void;
  viewAddress: string | null;
}

const ActiveAddressContext = createContext<ActiveAddressContextType>({
  activeAddress: undefined,
  isViewMode: false,
  setViewAddress: () => {},
  viewAddress: null,
});

export const useActiveAddress = () => useContext(ActiveAddressContext);

export const ActiveAddressProvider = ({ children }: { children: ReactNode }) => {
  const { publicKey, connected } = useWallet();
  const [viewAddress, setViewAddress] = useState<string | null>(null);

  const pubKeyString = publicKey?.toBase58();
  
  // Real wallet takes priority
  const activeAddress = connected && pubKeyString ? pubKeyString : (viewAddress || undefined);
  const isViewMode = !connected && !!viewAddress;

  return (
    <ActiveAddressContext.Provider value={{ activeAddress, isViewMode, setViewAddress, viewAddress }}>
      {children}
    </ActiveAddressContext.Provider>
  );
};
