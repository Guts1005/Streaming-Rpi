import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.GEMINI_API_KEY_TRANSCRIPT || '';
  if (!key) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }
  return NextResponse.json({ key });
}
