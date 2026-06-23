import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { getQuery } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  // Backwards compatibility for existing legacy sessions
  const u = user as any;
  if (!u.company_name && u.company_id) {
    try {
      if (u.username === 'admin' && u.company_id === '8.0') {
        u.company_name = 'Aspire Smart Vision';
      } else {
        const comp = await getQuery('SELECT cnm FROM ks_companies WHERE id = ?', [u.company_id]) as any;
        if (comp && comp.cnm) {
          u.company_name = comp.cnm;
        }
      }
    } catch (e) {
      console.error("Failed to fetch company name in session route:", e);
    }
  }

  return NextResponse.json({ authenticated: true, user: u });
}
