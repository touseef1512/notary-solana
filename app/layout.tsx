import type { Metadata } from "next";
import { Public_Sans, Fraunces, IBM_Plex_Mono } from "next/font/google";
import '@solana/wallet-adapter-react-ui/styles.css';
import '@dialectlabs/blinks/index.css';
import "./globals.css";
import { SolanaWalletProvider } from "@/components/WalletProvider";
import { ActiveAddressProvider } from "@/components/ActiveAddressProvider";

export const maxDuration = 60;

const publicSans = Public_Sans({ 
  subsets: ["latin"], 
  weight: ["400", "500", "600", "700"],
  variable: "--font-public-sans" 
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces"
});

const ibmPlexMono = IBM_Plex_Mono({ 
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono"
});

export const metadata: Metadata = {
  title: "Notary",
  description: "On-chain trust/verification app for tokenized equities on Solana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${publicSans.variable} ${fraunces.variable} ${ibmPlexMono.variable} font-sans min-h-screen bg-brand-bg text-brand-text`}>
        <SolanaWalletProvider>
          <ActiveAddressProvider>
            {children}
          </ActiveAddressProvider>
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
