import { NextRequest, NextResponse } from 'next/server';
import { setAuthCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const response = NextResponse.json({ success: true, message: 'Account switched successfully' });
    
    // Set the new token as the active cookie
    response.headers.append('Set-Cookie', setAuthCookie(token));
    
    // Clear active_site_id to avoid unauthorized access to the previous user's site
    response.headers.append('Set-Cookie', `active_site_id=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`);

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: 'UNKNOWN_ERROR' }, { status: 500 });
  }
}
