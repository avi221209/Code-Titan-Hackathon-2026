import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  _context: { params: Promise<{ id: string }> }
) {
  return NextResponse.json({ error: 'not_implemented' }, { status: 501 });
}

export async function POST(
  _request: Request,
  _context: { params: Promise<{ id: string }> }
) {
  return NextResponse.json({ error: 'not_implemented' }, { status: 501 });
}
