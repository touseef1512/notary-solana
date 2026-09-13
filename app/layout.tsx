import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SolanaWalletProvider } from "@/components/WalletProvider";
import { Navbar } from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

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
      <body className={`${inter.className} min-h-screen bg-slate-950 text-slate-50`}>
        <SolanaWalletProvider>
          <Navbar />
          <main className="container mx-auto p-4 pt-8">
            {children}
          </main>
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
