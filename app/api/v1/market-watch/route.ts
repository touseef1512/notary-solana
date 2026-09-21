import { NextResponse } from 'next/server';
import { createRateLimiter } from '@/lib/api-rate-limit';

export const dynamic = 'force-dynamic';

const limiter = createRateLimiter(30, 60000);

export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || "unknown";
  const now = Date.now();
  
  const { allowed, retryAfterSeconds } = limiter(ip, now);
  if (!allowed) {
    return NextResponse.json(
      { error: "rate limited" }, 
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
    );
  }

  try {
    const { getStoredWatchState } = await import('@/lib/market-watch');
    const state = await getStoredWatchState();
    
    if (state === null) {
      return NextResponse.json(
        { error: "Market Watch data is not available right now." }, 
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { 
        baselineTs: state.baselineTs, 
        lastCheckedTs: state.lastCheckedTs, 
        count: state.entries.length, 
        entries: state.entries, 
        notes: "A record of the Kamino xStocks market listings Notary has seen, read from storage on each request, not a live chain read. firstSeenTs is when Notary first recorded an asset, not when Kamino listed it. removedTs is null while an asset is still listed. This is a record, not continuous monitoring, and not a recommendation or advice of any kind. Timestamps are Unix time." 
      }, 
      { headers: { 'Cache-Control': 'public, max-age=30' } }
    );
  } catch {
    return NextResponse.json({ error: "upstream error" }, { status: 500 });
  }
}
