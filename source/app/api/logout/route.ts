import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.headers.append('Set-Cookie', clearAuthCookie());
  response.headers.append('Set-Cookie', `active_site_id=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`);
  return response;
}
