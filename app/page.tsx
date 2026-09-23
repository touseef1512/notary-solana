import Link from 'next/link';
import { KNOWN_ASSETS } from '@/lib/known-assets';
import { getAssetTrustRiskProfilesAction, getReserveAttestationsAction } from '@/app/actions';

export default async function LandingPage() {
  const assetsTracked = KNOWN_ASSETS.length.toString();
  
  let averageTrustScore = "Insufficient data";
  let validScoresCount = 0;
  try {
    const profiles = await getAssetTrustRiskProfilesAction();
    const validScores = profiles.map(p => p.trustScore).filter((s): s is number => s !== null);
    validScoresCount = validScores.length;
    if (validScores.length > 0) {
      const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
      averageTrustScore = `${avg.toFixed(0)}%`;
    }
  } catch {
    // Fallback already set, do nothing
  }

  let reserveChecks = "Insufficient data";
  try {
    const attestations = await getReserveAttestationsAction();
    const active = attestations.filter(a => a.hasLiveAttestation).length;
    reserveChecks = active.toString();
  } catch {
    // Fallback already set, do nothing
  }

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex flex-col font-sans">
      {/* STICKY TOP NAV */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 border-b border-brand-border bg-brand-bg">
        <div className="flex items-center gap-2 text-brand-text">
          <svg width="24" height="24" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-brand-accent">
            <circle cx="250" cy="250" r="230" stroke="currentColor" strokeWidth="20" strokeDasharray="120 120"/>
            <circle cx="250" cy="250" r="190" stroke="currentColor" strokeWidth="10"/>
          </svg>
          <span className="font-serif text-lg font-bold">Notary</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#how-it-works" className="text-sm text-brand-muted hover:text-brand-text hidden md:block">How it works</a>
          <a href="#features" className="text-sm text-brand-muted hover:text-brand-text hidden md:block">Features</a>
          <a href="#developers" className="text-sm text-brand-muted hover:text-brand-text hidden md:block">Developers</a>
          <Link 
            href="/app" 
            className="px-4 py-1.5 bg-brand-accent text-brand-card font-sans font-semibold text-sm transition-opacity hover:opacity-90"
          >
            Open the app
          </Link>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="flex-1 flex flex-col justify-center items-start px-6 md:px-12 lg:px-24 py-20 relative overflow-hidden">
        
        {/* Animated seal motif */}
        <div className="absolute right-[-10%] top-[10%] md:right-10 md:top-1/2 md:-translate-y-1/2 opacity-20 pointer-events-none motion-safe:animate-[spin_40s_linear_infinite] motion-reduce:animate-none text-brand-accent">
          <svg width="500" height="500" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="250" cy="250" r="230" stroke="currentColor" strokeWidth="2" strokeDasharray="12 12"/>
            <circle cx="250" cy="250" r="190" stroke="currentColor" strokeWidth="1"/>
            <circle cx="250" cy="250" r="150" stroke="currentColor" strokeWidth="6" strokeDasharray="40 20"/>
            <circle cx="250" cy="250" r="100" stroke="currentColor" strokeWidth="1" strokeDasharray="5 5"/>
          </svg>
        </div>

        <div className="max-w-3xl relative z-10">
          <h1 className="font-serif text-5xl md:text-7xl font-bold mb-6 text-brand-text leading-tight">
            Your tokenized-stock loan can go underwater while the market is closed. Notary tells you first.
          </h1>
          <p className="font-sans text-xl md:text-2xl text-brand-muted mb-10 max-w-2xl">
            Real-time notices, margin-call warnings, unified statements, and pre-trade checks for tokenized-stock holders on Solana — delivered before you would have found out yourself, through the app or Telegram.
          </p>
          <Link 
            href="/app" 
            className="inline-block px-8 py-4 bg-brand-accent text-brand-card font-sans font-semibold text-lg transition-opacity hover:opacity-90"
          >
            Open the app
          </Link>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="border-y border-brand-border bg-brand-card">
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col md:flex-row">
          <div className="flex-1 py-8 md:border-r border-brand-border md:pr-6 border-b md:border-b-0">
            <div className="font-mono text-4xl text-brand-text mb-2">{assetsTracked}</div>
            <div className="font-sans text-sm text-brand-muted">Assets tracked</div>
          </div>
          <div className="flex-1 py-8 md:border-r border-brand-border md:px-6 border-b md:border-b-0">
            <div className={`text-4xl text-brand-text mb-2 ${averageTrustScore === "Insufficient data" ? "font-sans text-lg" : "font-mono"}`}>
              {averageTrustScore}
            </div>
            <div className="font-sans text-sm text-brand-muted">Average trust score</div>
            {validScoresCount > 0 && (
              <div className="font-sans text-[10px] text-brand-muted mt-1">
                across {validScoresCount} of {assetsTracked} assets
              </div>
            )}
          </div>
          <div className="flex-1 py-8 md:pl-6">
            <div className={`text-4xl text-brand-text mb-2 ${reserveChecks === "Insufficient data" ? "font-sans text-lg" : "font-mono"}`}>
              {reserveChecks}
            </div>
            <div className="font-sans text-sm text-brand-muted">On-chain reserve checks</div>
          </div>
        </div>
      </section>

      {/* THE PROBLEM */}
      <section id="how-it-works" className="py-24 px-6 md:px-12 lg:px-24 border-b border-brand-border">
        <div className="max-w-4xl">
          <h2 className="font-sans text-3xl font-bold mb-6 text-brand-text">The problem</h2>
          <p className="font-sans text-lg text-brand-muted leading-relaxed mb-4">
            Tokenized stock dividends apply as a silent balance rebase, not a visible transaction. Meanwhile, tokens trade 24/7 on Kamino while the underlying stock market is closed approximately 135 hours a week.
          </p>
          <p className="font-sans text-lg text-brand-muted leading-relaxed mb-4">
            This means a loan collateral risk can move while nobody is watching. Notary checks this continuously and tells you before it matters.
          </p>
        </div>
      </section>

      {/* EXPANDED FIVE PILLARS */}
      <section id="features" className="py-24 px-6 md:px-12 lg:px-24">
        <div className="max-w-4xl">
          <h2 className="font-sans text-3xl font-bold mb-12 text-brand-text">What Notary does</h2>
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
              <h3 className="font-sans font-bold text-xl text-brand-text">Notices</h3>
              <p className="font-sans text-brand-muted">
                Dividend and corporate-action alerts delivered proactively via the Telegram bot or the in-app Today screen, not something you have to remember to check.
              </p>
            </div>
            <div className="border-b border-brand-border w-full"></div>
            <div className="flex flex-col gap-2">
              <h3 className="font-sans font-bold text-xl text-brand-text">Margin calls</h3>
              <p className="font-sans text-brand-muted">
                Live Kamino health factor plus a gap-stressed health factor that re-checks your position against the worst historical weekend price gap for your collateral. You see liquidation risk before Monday market open, not after.
              </p>
            </div>
            <div className="border-b border-brand-border w-full"></div>
            <div className="flex flex-col gap-2">
              <h3 className="font-sans font-bold text-xl text-brand-text">Statements</h3>
              <p className="font-sans text-brand-muted">
                One unified statement combining verified holdings, loan positions, and optional tax cost-basis data. Includes a plain-language summary up top and a SHA-256 fingerprint for integrity checking.
              </p>
            </div>
            <div className="border-b border-brand-border w-full"></div>
            <div className="flex flex-col gap-2">
              <h3 className="font-sans font-bold text-xl text-brand-text">Pre-trade checks</h3>
              <p className="font-sans text-brand-muted">
                Price-parity comparison against the real stock last close plus a live trade-cost simulator showing slippage before you buy.
              </p>
            </div>
            <div className="border-b border-brand-border w-full"></div>
            <div className="flex flex-col gap-2">
              <h3 className="font-sans font-bold text-xl text-brand-text">Verifiable trust</h3>
              <p className="font-sans text-brand-muted">
                Every risk check can be published as an on-chain attestation via the Solana Attestation Service, independently checkable by anyone — not just a claim Notary makes about itself.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ASK, DO NOT DIG */}
      <section className="py-12 px-6 md:px-12 lg:px-24 bg-brand-card border-y border-brand-border">
        <div className="max-w-4xl">
          <h2 className="font-sans text-3xl font-bold mb-6 text-brand-text">Ask, do not dig</h2>
          <p className="font-sans text-lg text-brand-muted leading-relaxed">
            A chat interface in the app and via Telegram that answers questions about specific holdings, trust scores, and loan risk directly. It uses the same verified data as the rest of the product, so users do not have to interpret raw numbers themselves.
          </p>
        </div>
      </section>

      {/* BUILT TO BE CHECKED, NOT TRUSTED */}
      <section id="developers" className="py-24 px-6 md:px-12 lg:px-24">
        <div className="max-w-4xl">
          <h2 className="font-sans text-3xl font-bold mb-6 text-brand-text">Built to be checked, not trusted</h2>
          <p className="font-sans text-lg text-brand-muted leading-relaxed mb-8">
            Every attestation and the trust registry are available at documented public endpoints, so any developer or AI agent can verify Notary claims independently rather than taking them on faith.
          </p>
          <Link 
            href="/app" 
            className="inline-block px-6 py-3 bg-brand-accent text-brand-card font-sans font-semibold text-sm transition-opacity hover:opacity-90"
          >
            Open the app
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-auto border-t border-brand-border bg-brand-card py-12 px-6 md:px-12 lg:px-24">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <p className="font-sans text-sm text-brand-muted max-w-2xl">
            Notary is not a brokerage and never holds your funds or places trades. Attestations are published on Solana devnet. This is not investment, legal, or tax advice.
          </p>
          <Link 
            href="/app" 
            className="inline-block px-6 py-3 bg-brand-accent text-brand-card font-sans font-semibold text-sm transition-opacity hover:opacity-90 shrink-0"
          >
            Open the app
          </Link>
        </div>
      </footer>
    </div>
  );
}
