"use client";

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { getNotaryAlertsAction } from '@/app/actions';
import type { NotaryAlert } from '@/lib/alert-engine';
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
  BookOpen,
  ShieldAlert,
  Code2,
  LineChart,
  Terminal,
  Home,
  Eye,
  Library,
  ArrowLeftRight
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useActiveAddress } from '@/components/ActiveAddressProvider';
import { HoldingsView } from '@/components/views/HoldingsView';
import { TrustScoreView } from '@/components/views/TrustScoreView';
import { ReserveAttestationView } from '@/components/views/ReserveAttestationView';
import { CollateralRiskView } from '@/components/views/CollateralRiskView';
import { AskNotaryView } from '@/components/views/AskNotaryView';
import { AlertsView } from '@/components/views/AlertsView';
import { ComparatorView } from '@/components/views/ComparatorView';
import { TrustRegistryView } from '@/components/views/TrustRegistryView';
import { AssetDirectoryView } from '@/components/views/AssetDirectoryView';
import { DeveloperApiView } from '@/components/views/DeveloperApiView';
import { PriceParityView } from '@/components/views/PriceParityView';
import { TodayView } from '@/components/views/TodayView';
import { PortfolioView } from '@/components/views/PortfolioView';
import { MarketWatchView } from '@/components/views/MarketWatchView';
import { WhatIfSimulator } from '@/components/views/WhatIfSimulator';
import { TradeView } from '@/components/views/TradeView';

// The WalletMultiButton uses client-side APIs and can cause hydration errors if not loaded dynamically
const WalletMultiButtonDynamic = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

type TabId = 'today' | 'portfolio' | 'loans' | 'markets' | 'trust' | 'developer' | 'alerts';

interface NavItem {
  id: TabId;
  label: string;
  icon: React.FC<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'today', label: 'Today', icon: Home },
  { id: 'portfolio', label: 'Portfolio', icon: WalletCards },
  { id: 'loans', label: 'Loans', icon: ShieldAlert },
  { id: 'markets', label: 'Markets', icon: LineChart },
  { id: 'trust', label: 'Trust', icon: ShieldCheck },
  { id: 'developer', label: 'Developers', icon: Code2 }
];

const SUB_NAV_ITEMS: Record<string, { id: string; label: string; icon: React.FC<{ className?: string }> }[]> = {
  portfolio: [{ id: 'holdings', label: 'Holdings', icon: WalletCards }, { id: 'tax', label: 'Tax Export', icon: FileDown }],
  loans: [{ id: 'collateral-risk', label: 'Collateral Risk', icon: ShieldAlert }, { id: 'what-if', label: 'What-If Simulator', icon: Scale }],
  markets: [{ id: 'price-parity', label: 'Price Parity', icon: LineChart }, { id: 'market-watch', label: 'Market Watch', icon: Eye }, { id: 'comparator', label: 'Comparator', icon: Scale }, { id: 'trade', label: 'Trade', icon: ArrowLeftRight }],
  trust: [{ id: 'registry', label: 'Trust Registry', icon: BookOpen }, { id: 'trust-score', label: 'Trust Score', icon: Trophy }, { id: 'reserve', label: 'Reserve Attestation', icon: Landmark }, { id: 'directory', label: 'Asset Directory', icon: Library }]
};

const TAB_LABELS: Record<TabId, string> = {
  today: 'Today', portfolio: 'Portfolio', loans: 'Loans', markets: 'Markets',
  trust: 'Trust', developer: 'Developers', alerts: 'Alerts'
};

export default function AppShell() {
  const [activeTab, setActiveTab] = useState<TabId>('today');
  const [subTab, setSubTab] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const [alerts, setAlerts] = useState<NotaryAlert[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAskNotaryOpen, setIsAskNotaryOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipRemoved, setTooltipRemoved] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const inTimer = setTimeout(() => setShowTooltip(true), 300);
    const outTimer = setTimeout(() => {
      setShowTooltip(false);
      setTimeout(() => setTooltipRemoved(true), 300);
    }, 4300);
    return () => {
      clearTimeout(inTimer);
      clearTimeout(outTimer);
    };
  }, []);

  useEffect(() => {
    if (isAskNotaryOpen) {
      setShowTooltip(false);
      setTooltipRemoved(true);
    }
  }, [isAskNotaryOpen]);
  
  const { connected } = useWallet();
  const { isViewMode, activeAddress, setViewAddress } = useActiveAddress();
  const [viewInput, setViewInput] = useState('');

  useEffect(() => {
    setMounted(true);
    let isSubscribed = true;
    getNotaryAlertsAction(activeAddress ?? undefined)
      .then(res => {
        if (!isSubscribed) return;
        const qualifying = res.filter(a => {
          if (a.kind === 'dividend-event') {
            return a.daysUntil !== null && a.daysUntil <= 90;
          }
          if (a.kind === 'liquidation-risk') {
            return true;
          }
          return true;
        });
        qualifying.sort((a, b) => {
          if (a.severity === 'critical' && b.severity !== 'critical') return -1;
          if (b.severity === 'critical' && a.severity !== 'critical') return 1;
          if (a.daysUntil === null && b.daysUntil === null) return 0;
          if (a.daysUntil === null) return 1;
          if (b.daysUntil === null) return -1;
          return a.daysUntil - b.daysUntil;
        });
        setAlerts(qualifying);
      })
      .catch(console.error);
    return () => { isSubscribed = false; };
  }, [activeAddress]);

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
      case 'today':
        return (
          <TodayView 
            alerts={alerts}
            onNavigate={(id) => { 
              const match = NAV_ITEMS.find((n) => n.id === id); 
              if (match) {
                setActiveTab(match.id);
                setSubTab(SUB_NAV_ITEMS[match.id] ? SUB_NAV_ITEMS[match.id][0].id : '');
              }
            }} 
          />
        );
      case 'portfolio':
        return <PortfolioView subTab={subTab} />;
      case 'loans':
        return subTab === 'what-if' ? <WhatIfSimulator /> : <CollateralRiskView />;
      case 'markets':
        if (subTab === 'trade') return <TradeView />;
        if (subTab === 'market-watch') return <MarketWatchView />;
        if (subTab === 'comparator') return <ComparatorView />;
        return <PriceParityView />;
      case 'trust':
        if (subTab === 'trust-score') return <TrustScoreView />;
        if (subTab === 'reserve') return <ReserveAttestationView />;
        if (subTab === 'directory') return <AssetDirectoryView />;
        return <TrustRegistryView />;
      case 'developer':
        return <DeveloperApiView />;
      case 'alerts':
        return <AlertsView />;
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
          <Link href="/" className={`flex items-center gap-2 text-xl font-bold text-brand-text ${isDesktopCollapsed ? 'md:hidden' : ''}`}>
            <ShieldCheck className="w-6 h-6 text-brand-accent shrink-0" />
            <span className="tracking-tight">NOTARY</span>
          </Link>
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
                    setSubTab(SUB_NAV_ITEMS[item.id] ? SUB_NAV_ITEMS[item.id][0].id : '');
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
              {TAB_LABELS[activeTab]}
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
                  className="bg-brand-bg border border-brand-border text-brand-text px-3 py-1 font-mono text-xs w-64 focus:border-brand-accent focus:outline-none placeholder:text-brand-muted/50"
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
                  className="bg-brand-card border border-brand-border hover:bg-brand-border/40 px-3 py-1 text-xs font-mono text-brand-muted hover:text-brand-text transition-colors uppercase cursor-pointer"
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
                <div className="absolute right-0 mt-2 w-80 bg-brand-card border border-brand-border z-50 flex flex-col">
                  <div className="p-3 border-b border-brand-border bg-brand-card">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-brand-text">Upcoming Alerts (90 Days)</h3>
                  </div>
                  
                  <div className="max-h-80 overflow-y-auto">
                    {alerts.length === 0 ? (
                      <div className="p-6 text-center text-brand-muted text-xs font-mono uppercase">
                        No upcoming events within 90 days.
                      </div>
                    ) : (
                      alerts.map((alert) => {
                        const isCritical = alert.severity === 'critical';
                        return (
                          <div key={alert.obligationPubkey ?? alert.assetSymbol} className={`flex justify-between items-center p-3 border-b ${isCritical ? 'border-negative bg-negative/5' : 'border-brand-border hover:bg-brand-border/40'} transition-colors`}>
                            <div className="flex flex-col">
                              <span className={`text-sm font-bold uppercase ${isCritical ? 'text-negative' : 'text-brand-accent'}`}>{alert.title}</span>
                              <span className="text-[10px] text-brand-muted font-mono uppercase tracking-wider max-w-[200px] truncate" title={alert.note}>{alert.note}</span>
                            </div>
                            <div className="flex flex-col items-end">
                              {alert.daysUntil !== null && (
                                <span className="text-[10px] text-brand-muted font-mono uppercase mt-0.5">
                                  {alert.daysUntil} days
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  
                  <button
                    className="p-3 text-[11px] font-mono uppercase tracking-widest text-brand-accent hover:bg-brand-border/40 transition-colors cursor-pointer w-full text-center focus:outline-none"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setActiveTab('alerts');
                      setSubTab('');
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
            {SUB_NAV_ITEMS[activeTab] && (
              <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-brand-border">
                {SUB_NAV_ITEMS[activeTab].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSubTab(item.id)}
                    className={`
                      flex items-center gap-2 px-3 py-1.5 text-xs font-mono uppercase tracking-wider
                      transition-colors cursor-pointer border
                      ${subTab === item.id 
                        ? 'border-brand-accent bg-brand-accent/10 text-brand-accent' 
                        : 'border-transparent text-brand-muted hover:text-brand-text hover:bg-brand-bg/30'
                      }
                    `}
                  >
                    <item.icon className="w-3 h-3" />
                    {item.label}
                  </button>
                ))}
              </div>
            )}
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Persistent Floating Ask Notary */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {isAskNotaryOpen && (
          <div className="mb-4 w-[400px] h-[600px] max-h-[calc(100vh-100px)] max-w-[calc(100vw-32px)] bg-brand-bg border border-brand-border shadow-md flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-3 border-b border-brand-border bg-brand-card shrink-0">
              <span className="font-bold font-mono text-sm uppercase tracking-widest text-brand-text flex items-center gap-2">
                <Terminal className="w-4 h-4 text-brand-accent"/> Ask Notary
              </span>
              <button onClick={() => setIsAskNotaryOpen(false)} className="text-brand-muted hover:text-brand-text p-1 cursor-pointer focus:outline-none">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden relative bg-brand-bg">
              <AskNotaryView />
            </div>
          </div>
        )}
        <div className="relative">
          {!tooltipRemoved && (
            <div 
              className={`absolute bottom-full right-0 mb-3 whitespace-nowrap bg-brand-card border border-brand-border text-brand-text text-xs px-3 py-1.5 rounded shadow-md pointer-events-none transition-all duration-300 ${
                showTooltip ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}
            >
              Ask Notary about your holdings
              {/* Speech bubble pointer */}
              <div className="absolute top-full right-5 -mt-[1px] border-4 border-transparent border-t-brand-border" />
              <div className="absolute top-full right-5 mt-[-2px] border-4 border-transparent border-t-brand-card" />
            </div>
          )}
          <button
            onClick={() => setIsAskNotaryOpen(!isAskNotaryOpen)}
            className="w-14 h-14 rounded-full bg-brand-accent text-brand-bg shadow-md hover:opacity-90 transition-opacity flex items-center justify-center focus:outline-none cursor-pointer"
            aria-label="Ask Notary"
          >
            {isAskNotaryOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
          </button>
        </div>
      </div>
    </div>
  );
}
