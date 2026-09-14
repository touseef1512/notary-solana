import { NextRequest, NextResponse } from 'next/server';
import { KNOWN_ASSETS } from '@/lib/known-assets';
import { computeTrustScore } from '@/lib/trust-score';
import { getSolanaConnection } from '@/lib/solana';
import { Transaction, TransactionInstruction, PublicKey } from '@solana/web3.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Content-Encoding, Accept-Encoding',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}

export async function GET(req: NextRequest, { params }: { params: { symbol: string } }) {
  try {
    const symbol = params.symbol;
    const asset = KNOWN_ASSETS.find(a => a.symbol.toLowerCase() === symbol.toLowerCase());
    
    if (!asset) {
      return NextResponse.json({ message: `Asset ${symbol} not found.` }, { status: 404, headers: CORS_HEADERS });
    }

    const result = await computeTrustScore(asset);
    
    let verifiedEvents = 0;
    if (result.breakdown) {
      verifiedEvents = result.breakdown.filter(e => e.independentlyVerified).length;
    }

    let verdictString = "";
    if (result.trustScore === null) {
      verdictString = "Insufficient Data";
    } else {
      verdictString = `Trust Score: ${result.trustScore.toFixed(0)}% (${verifiedEvents} verified event${verifiedEvents === 1 ? '' : 's'})`;
    }

    let description = `Notary verification for ${asset.name} (${asset.symbol}).\n\nVerdict: ${verdictString}`;

    if (asset.notarizationSignature) {
      description += `\n\nOn-chain proof: https://explorer.solana.com/tx/${asset.notarizationSignature}?cluster=devnet`;
    }

    // Attempt to construct an absolute URL to an icon. If we can't reliably get the origin, use a placeholder or assume relative works if client resolves it (though actions spec prefers absolute).
    // Using an external placeholder icon for safety, as requested: "an absolute URL, reuse an existing app icon/logo asset"
    // Since we don't know the exact domain (could be localhost, codespaces, vercel), req.nextUrl.origin is best.
    const iconUrl = new URL('/favicon.ico', req.nextUrl.origin).toString();

    const payload = {
      title: `Notary: ${asset.symbol} Verification`,
      icon: iconUrl,
      description,
      label: "Endorse this verification on-chain",
    };

    return NextResponse.json(payload, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("Error in GET /api/actions/verify:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function POST(req: NextRequest, { params }: { params: { symbol: string } }) {
  try {
    const symbol = params.symbol;
    const asset = KNOWN_ASSETS.find(a => a.symbol.toLowerCase() === symbol.toLowerCase());
    
    if (!asset) {
      return NextResponse.json({ message: `Asset ${symbol} not found.` }, { status: 404, headers: CORS_HEADERS });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400, headers: CORS_HEADERS });
    }

    if (!body.account) {
      return NextResponse.json({ message: "Missing 'account' in request body." }, { status: 400, headers: CORS_HEADERS });
    }

    let visitorPubkey: PublicKey;
    try {
      visitorPubkey = new PublicKey(body.account);
    } catch {
      return NextResponse.json({ message: "Invalid 'account' provided." }, { status: 400, headers: CORS_HEADERS });
    }

    const result = await computeTrustScore(asset);
    
    let verdictStr = "";
    if (result.trustScore === null) {
      verdictStr = "Insufficient Data";
    } else {
      verdictStr = `${result.trustScore.toFixed(0)}%`;
    }

    // Memo program v2
    const memoProgramId = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
    
    const memoData = {
      endorse: asset.symbol,
      verdict: verdictStr,
      ts: Math.floor(Date.now() / 1000)
    };
    
    const instruction = new TransactionInstruction({
      keys: [{ pubkey: visitorPubkey, isSigner: true, isWritable: true }],
      programId: memoProgramId,
      data: Buffer.from(JSON.stringify(memoData), 'utf-8'),
    });

    const transaction = new Transaction().add(instruction);
    const connection = getSolanaConnection('devnet');
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = visitorPubkey;

    const base64Tx = transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');

    return NextResponse.json({
      transaction: base64Tx,
      message: `Successfully endorsed ${asset.symbol} verification.`
    }, { headers: CORS_HEADERS });

  } catch (error) {
    console.error("Error in POST /api/actions/verify:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500, headers: CORS_HEADERS });
  }
}
