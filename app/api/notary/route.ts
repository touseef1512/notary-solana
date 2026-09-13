import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: 'Notary API stub' });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ message: 'Notary API POST stub', received: body });
}
