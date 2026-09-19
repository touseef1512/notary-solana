import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getAttestationStatus } from '@/lib/sas-attestation';

// best-effort per server instance, not a global limit
const rateLimitCache = new Map<string, { count: number, resetAt: number }>();
const responseCache = new Map<string, { body: Record<string, unknown>, status: number, expiresAt: number, statusRaw: Awaited<ReturnType<typeof getAttestationStatus>> }>();

function convertBigInts(obj: Record<string, unknown>): Record<string, unknown> {
  const converted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'bigint') {
      converted[key] = value.toString();
    } else {
      converted[key] = value;
    }
  }
  return converted;
}

export async function GET(request: Request, { params }: { params: { obligation: string } }) {
  try {
    new PublicKey(params.obligation);
  } catch {
    return NextResponse.json({ error: "Invalid obligation pubkey" }, { status: 400 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || "unknown";
  const now = Date.now();

  if (rateLimitCache.size > 1000) {
    rateLimitCache.forEach((val, key) => {
      if (now > val.resetAt) rateLimitCache.delete(key);
    });
  }

  let rateLimit = rateLimitCache.get(ip);
  if (!rateLimit || now > rateLimit.resetAt) {
    rateLimit = { count: 0, resetAt: now + 60000 };
  }
  rateLimit.count++;
  rateLimitCache.set(ip, rateLimit);

  if (rateLimit.count > 30) {
    return NextResponse.json({ error: "rate limited" }, { status: 429, headers: { 'Retry-After': '30' } });
  }

  const cached = responseCache.get(params.obligation);
  if (cached && now < cached.expiresAt) {
    const body = { ...cached.body };
    if (cached.status === 200 && cached.statusRaw && cached.statusRaw.decoded && cached.statusRaw.decoded['computedAtUnixTs'] !== undefined) {
      const parsed = Number(cached.statusRaw.decoded['computedAtUnixTs']);
      if (!Number.isNaN(parsed)) {
        body['ageSeconds'] = Math.floor(Date.now() / 1000) - parsed;
      }
    }
    return NextResponse.json(body, {
      status: cached.status,
      headers: cached.status === 200 ? { 'Cache-Control': 'public, max-age=30' } : undefined
    });
  }

  try {
    const status = await getAttestationStatus(params.obligation);
    
    if (!status.exists) {
      const body = { error: "not found" };
      if (!responseCache.has(params.obligation) && responseCache.size >= 500) {
        const oldestKey = responseCache.keys().next().value;
        if (oldestKey !== undefined) responseCache.delete(oldestKey);
      }
      responseCache.set(params.obligation, { body, status: 404, expiresAt: now + 30000, statusRaw: status });
      return NextResponse.json(body, { status: 404 });
    }

    const decodedRaw = status.decoded || {};
    const decoded = convertBigInts(decodedRaw);

    const computedAtRaw = decodedRaw['computedAtUnixTs'];
    let ageSeconds: number | null = null;
    if (computedAtRaw !== undefined && computedAtRaw !== null) {
      const parsed = Number(computedAtRaw);
      if (!Number.isNaN(parsed)) {
        ageSeconds = Math.floor(Date.now() / 1000) - parsed;
      }
    }

    const responseBody = {
      ...decoded,
      attestationPda: status.attestationPda,
      explorerUrl: `https://explorer.solana.com/address/${status.attestationPda}?cluster=devnet`,
      ageSeconds,
      notes: "Attestations are point-in-time snapshots; check computedAtUnixTs. Large integer fields are returned as strings."
    };

    if (!responseCache.has(params.obligation) && responseCache.size >= 500) {
      const oldestKey = responseCache.keys().next().value;
      if (oldestKey !== undefined) responseCache.delete(oldestKey);
    }
    responseCache.set(params.obligation, { body: responseBody, status: 200, expiresAt: now + 30000, statusRaw: status });

    return NextResponse.json(responseBody, {
      headers: {
        'Cache-Control': 'public, max-age=30'
      }
    });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ error: "upstream error" }, { status: 500 });
  }
}
