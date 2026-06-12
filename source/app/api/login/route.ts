import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getQuery } from '@/lib/db';
import { signToken, setAuthCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password, company_id } = await req.json();

    if (!username || !password || !company_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const user = await getQuery('SELECT * FROM users WHERE username = ? AND company_id = ? AND status = ?', [username, company_id, 'active']) as any;

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials or inactive user' }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = signToken({ id: user.id, username: user.username, company_id: user.company_id });
    
    const response = NextResponse.json({ success: true, user: { id: user.id, username: user.username, company_id: user.company_id } });
    response.headers.append('Set-Cookie', setAuthCookie(token));

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
