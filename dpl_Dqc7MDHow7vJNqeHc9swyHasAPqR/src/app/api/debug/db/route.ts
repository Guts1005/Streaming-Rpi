import { NextResponse } from 'next/server';
import { getQuery, allQuery } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(request) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const decoded = verifyToken(token);
  if (!decoded || decoded.username !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
  }

  try {
    const userCountRow = await getQuery('SELECT COUNT(*) as count FROM users');
    const adminUser = await getQuery('SELECT * FROM users WHERE username = ? AND company_id = ?', ['admin', 'HQ']);
    
    return NextResponse.json({
      database_type: 'SQLite (better-sqlite3)',
      file_path: '/tmp/helmet.db',
      user_count: userCountRow.count,
      admin_user_exists: !!adminUser,
      admin_details: adminUser ? { username: adminUser.username, company_id: adminUser.company_id } : null,
      survives_redeployments: false,
      evidence: 'Fetched from live deployed environment'
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
