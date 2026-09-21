import { NextResponse } from 'next/server';
import { buildAssetDirectory } from '@/lib/asset-directory';
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
    const entries = buildAssetDirectory();
    return NextResponse.json(
      { 
        count: entries.length, 
        assets: entries, 
        notes: "Static list of the tokenized stocks Notary knows about. inKaminoMarket comes from the lending market reserve list verified on Sep 20, not a live read. inTrustRegistry means Notary tries to check the reserves behind the token, not that reserve data exists. Not a recommendation or advice of any kind." 
      }, 
      { headers: { 'Cache-Control': 'public, max-age=60' } }
    );
  } catch {
    return NextResponse.json({ error: "upstream error" }, { status: 500 });
  }
}
