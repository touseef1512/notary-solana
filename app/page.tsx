"use client";

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { getUpcomingAlertsAction } from '@/app/actions';
import type { AlertResult } from '@/lib/alerts';
import { 
  ShieldCheck, 
  WalletCards, 
  Trophy, 
  Landmark, 
  MessageSquare, 
  Bell, 
  FileDown, 
  Scale,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  BookOpen
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useActiveAddress } from '@/components/ActiveAddressProvider';
import { HoldingsView } from '@/components/views/HoldingsView';
import { TrustScoreView } from '@/components/views/TrustScoreView';
import { ReserveAttestationView } from '@/components/views/ReserveAttestationView';
import { AskNotaryView } from '@/components/views/AskNotaryView';
import { AlertsView } from '@/components/views/AlertsView';
import { TaxExportView } from '@/components/views/TaxExportView';
import { ComparatorView } from '@/components/views/ComparatorView';
import { TrustRegistryView } from '@/components/views/TrustRegistryView';

// The WalletMultiButton uses client-side APIs and can cause hydration errors if not loaded dynamically
const WalletMultiButtonDynamic = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

type TabId = 'holdings' | 'trust-score' | 'reserve' | 'ask' | 'alerts' | 'tax' | 'comparator' | 'registry';

interface NavItem {
  id: TabId;
  label: string;
  icon: React.FC<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'registry', label: 'Trust Registry', icon: BookOpen },
  { id: 'holdings', label: 'Holdings & Verification', icon: WalletCards },
  { id: 'trust-score', label: 'Trust Score & Leaderboard', icon: Trophy },
  { id: 'reserve', label: 'Reserve Attestation', icon: Landmark },
  { id: 'ask', label: 'Ask Notary', icon: MessageSquare },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'tax', label: 'Tax Export', icon: FileDown },
  { id: 'comparator', label: 'Comparator', icon: Scale },
];

export default function AppShell() {
  const [activeTab, setActiveTab] = useState<TabId>('holdings');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const [alerts, setAlerts] = useState<AlertResult[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { connected } = useWallet();
  const { isViewMode, activeAddress, setViewAddress } = useActiveAddress();
  const [viewInput, setViewInput] = useState('');

  useEffect(() => {
    setMounted(true);
    let isSubscribed = true;
    getUpcomingAlertsAction()
      .then(res => {
        if (!isSubscribed) return;
        const qualifying = res.filter(a => a.confidenceLevel !== "no-data" && a.daysUntil !== null && a.daysUntil <= 90);
        qualifying.sort((a, b) => (a.daysUntil || 0) - (b.daysUntil || 0));
        setAlerts(qualifying);
      })
      .catch(console.error);
    return () => { isSubscribed = false; };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsDropdownOpen(false);
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isDropdownOpen]);

  const renderContent = () => {
    switch (activeTab) {
      case 'holdings':
        return <HoldingsView />;
      case 'trust-score':
        return <TrustScoreView />;
      case 'reserve':
        return <ReserveAttestationView />;
      case 'registry':
        return <TrustRegistryView />;
      case 'ask':
        return <AskNotaryView />;
      case 'alerts':
        return <AlertsView />;
      case 'tax':
        return <TaxExportView />;
      case 'comparator':
        return <ComparatorView />;
      default:
        return <HoldingsView />;
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-brand-bg text-brand-text">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed md:static inset-y-0 left-0 z-50 bg-brand-card border-r border-brand-border 
          transform transition-all duration-300 ease-in-out motion-reduce:transition-none
          flex flex-col h-full
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${isDesktopCollapsed ? 'w-72 md:w-16' : 'w-72'}
        `}
      >
        <div className={`h-16 flex items-center border-b border-brand-border shrink-0 justify-between md:justify-start ${isDesktopCollapsed ? 'md:justify-center px-6 md:px-0' : 'px-6'}`}>
          <div className={`flex items-center gap-2 text-xl font-bold text-brand-text ${isDesktopCollapsed ? 'md:hidden' : ''}`}>
            <ShieldCheck className="w-6 h-6 text-brand-accent shrink-0" />
            <span className="tracking-tight">NOTARY</span>
          </div>
          <div className={`hidden items-center justify-center w-full ${isDesktopCollapsed ? 'md:flex' : 'md:hidden'}`}>
            <ShieldCheck className="w-6 h-6 text-brand-accent shrink-0" />
          </div>
          <button 
            className="md:hidden text-brand-muted hover:text-brand-text cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-accent p-1"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto md:overflow-visible py-6 space-y-1 flex flex-col">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <div key={item.id} className="relative group">
                <button
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`
                    w-full flex items-center px-4 py-3 text-left cursor-pointer text-sm uppercase tracking-wider
                    transition-colors duration-150 motion-reduce:transition-none rounded-none
                    focus:outline-none
                    ${isActive 
                      ? 'border-l-2 border-brand-accent text-brand-text bg-brand-bg/50' 
                      : 'border-l-2 border-transparent text-brand-muted hover:text-brand-text hover:bg-brand-bg/30'
                    }
                    ${isDesktopCollapsed ? 'md:justify-center md:px-0' : 'gap-3'}
                  `}
                >
                  <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand-accent' : 'text-brand-muted'}`} />
                  <span className={`truncate ${isDesktopCollapsed ? 'md:hidden' : ''}`}>{item.label}</span>
                </button>
                
                {/* Custom Tooltip */}
                {isDesktopCollapsed && (
                  <div className="hidden md:block absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-1.5 bg-brand-card border border-brand-border text-brand-text font-mono text-xs uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                    {item.label}
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Desktop Toggle Button */}
          <div className="hidden md:flex px-4 pt-2">
            <button
              onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
              className={`
                w-full flex items-center p-2 text-brand-muted hover:text-brand-accent hover:bg-brand-bg/30 transition-colors border border-transparent hover:border-brand-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-accent rounded-none
                ${isDesktopCollapsed ? 'justify-center' : 'justify-start gap-3'}
              `}
              aria-label={isDesktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isDesktopCollapsed ? <ChevronRight className="w-4 h-4 shrink-0" /> : <ChevronLeft className="w-4 h-4 shrink-0" />}
              {!isDesktopCollapsed && <span className="text-sm uppercase tracking-wider">Collapse</span>}
            </button>
          </div>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {isViewMode && (
          <div className="w-full bg-brand-accent/20 border-b border-brand-accent p-2 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 px-4 md:px-8">
              <AlertTriangle className="w-4 h-4 text-brand-accent" />
              <span className="text-brand-accent font-bold text-xs uppercase tracking-widest font-mono">
                Viewing (Read-Only): {activeAddress?.slice(0,4)}...{activeAddress?.slice(-4)}
              </span>
            </div>
            <div className="px-4 md:px-8">
              <button 
                onClick={() => { setViewAddress(null); setViewInput(''); }}
                className="text-brand-accent hover:text-white text-[10px] font-mono uppercase underline tracking-wider cursor-pointer"
              >
                Exit View Mode
              </button>
            </div>
          </div>
        )}
        
        {/* Top Bar */}
        <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-brand-border bg-brand-bg sticky top-0 z-30 shrink-0">
          <div className="flex items-center">
            <button 
              className="md:hidden mr-4 text-brand-muted hover:text-brand-text cursor-pointer focus:outline-none p-1"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <h2 className="text-sm uppercase tracking-widest font-semibold text-brand-text hidden sm:block">
              {NAV_ITEMS.find(i => i.id === activeTab)?.label}
            </h2>
          </div>
          
          <div className="flex items-center gap-6">
            {!connected && !isViewMode && (
              <div className="hidden md:flex items-center gap-2 mr-4">
                <input 
                  type="text" 
                  placeholder="Enter Solana Address to View"
                  value={viewInput}
                  onChange={(e) => setViewInput(e.target.value)}
                  className="bg-[#050505] border border-brand-border text-brand-text px-3 py-1 font-mono text-xs w-64 focus:border-brand-accent focus:outline-none placeholder:text-brand-muted/50"
                />
                <button
                  onClick={() => {
                    const trimmed = viewInput.trim();
                    if (trimmed.length >= 32 && trimmed.length <= 44) {
                      setViewAddress(trimmed);
                    } else {
                      alert("Please enter a valid base58 Solana address");
                    }
                  }}
                  className="bg-brand-card border border-brand-border hover:bg-[#1a1a1a] px-3 py-1 text-xs font-mono text-brand-muted hover:text-brand-text transition-colors uppercase cursor-pointer"
                >
                  View
                </button>
              </div>
            )}

            <div className="hidden md:flex items-center gap-2 px-2 py-1 border border-brand-border bg-brand-card">
              <div className="w-2 h-2 rounded-full bg-brand-accent animate-pulse" />
              <span className="font-mono text-xs text-brand-accent uppercase">NETWORK: DEVNET</span>
            </div>

            <div className="relative" ref={dropdownRef}>
              <button 
                className="relative text-brand-muted hover:text-brand-text focus:outline-none cursor-pointer p-1"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                aria-label="Toggle alerts dropdown"
              >
                <Bell className="w-5 h-5" />
                {alerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-negative text-[9px] font-mono font-bold text-white">
                    {alerts.length}
                  </span>
                )}
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-[#141414] border border-brand-border shadow-[0_4px_20px_rgba(0,0,0,0.5)] z-50 flex flex-col">
                  <div className="p-3 border-b border-brand-border bg-[#0A0A0A]">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-brand-text">Upcoming Alerts (90 Days)</h3>
                  </div>
                  
                  <div className="max-h-80 overflow-y-auto">
                    {alerts.length === 0 ? (
                      <div className="p-6 text-center text-brand-muted text-xs font-mono uppercase">
                        No upcoming events within 90 days.
                      </div>
                    ) : (
                      alerts.map((alert) => (
                        <div key={alert.asset.mintAddress} className="flex justify-between items-center p-3 border-b border-brand-border hover:bg-[#1A1A1A] transition-colors">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-brand-text uppercase">{alert.asset.symbol}</span>
                            <span className="text-[10px] text-brand-muted font-mono uppercase tracking-wider">Dividend</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className={`font-mono text-xs ${alert.confidenceLevel === 'estimated' ? 'text-brand-accent' : 'text-brand-text'}`}>
                              {alert.nextEventDate}
                              {alert.confidenceLevel === 'estimated' && <span className="ml-1 text-[10px] text-brand-accent uppercase">(EST)</span>}
                            </span>
                            <span className="text-[10px] text-brand-muted font-mono uppercase mt-0.5">
                              {alert.daysUntil} days
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  <button
                    className="p-3 text-[11px] font-mono uppercase tracking-widest text-brand-accent hover:bg-[#1A1A1A] transition-colors cursor-pointer w-full text-center focus:outline-none"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setActiveTab('alerts');
                    }}
                  >
                    View all in Alerts
                  </button>
                </div>
              )}
            </div>

            {mounted && <WalletMultiButtonDynamic />}
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-6xl mx-auto w-full">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
