import { NextResponse } from 'next/server';
import { getKaminoPositions } from '@/lib/kamino';

export async function GET() {
  try {
    // Testing with a recent, healthy obligation in the xStocks market
    const testWallet = 'Fa7LNzj3SCV364hya9dx9evL29pC1awx24iHeCEwX6vU';
    const positions = await getKaminoPositions(testWallet);
    
    return NextResponse.json({
      success: true,
      wallet: testWallet,
      positions
    });
  } catch (error: unknown) {
    console.error('Error fetching Kamino positions:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
