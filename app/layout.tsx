import type { Metadata } from "next";
import { Fira_Sans, IBM_Plex_Mono } from "next/font/google";
import '@solana/wallet-adapter-react-ui/styles.css';
import "./globals.css";
import { SolanaWalletProvider } from "@/components/WalletProvider";
import { ActiveAddressProvider } from "@/components/ActiveAddressProvider";

const firaSans = Fira_Sans({ 
  subsets: ["latin"], 
  weight: ["400", "500", "600", "700"],
  variable: "--font-fira-sans" 
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
      <body className={`${firaSans.variable} ${ibmPlexMono.variable} font-sans min-h-screen bg-brand-bg text-brand-text`}>
        <SolanaWalletProvider>
          <ActiveAddressProvider>
            {children}
          </ActiveAddressProvider>
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
