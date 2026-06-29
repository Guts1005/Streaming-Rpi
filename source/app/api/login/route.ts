import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getQuery, allQuery } from '@/lib/db';
import { signToken, setAuthCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }



    const sql = `SELECT * FROM users WHERE username = ?`;
    const user = await getQuery(sql, [username]) as any;

    if (!user) {
      return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 401 });
    }

    if (user.actv !== 'y') {
      return NextResponse.json({ error: 'USER_INACTIVE' }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, user.pw);

    if (!isMatch) {
      return NextResponse.json({ error: 'PASSWORD_MISMATCH' }, { status: 401 });
    }

    const validRoles = ['Admin', 'Sports', 'Surveyor', 'Site', 'admin', 'sports', 'surveyor', 'site'];
    const userRole = user.account_type || user.ac;
    if (!userRole || !validRoles.includes(userRole)) {
      return NextResponse.json({ error: 'ROLE_NOT_FOUND' }, { status: 403 });
    }
    
    // Normalize to capitalized for legacy frontend support
    const normalizedRole = userRole.charAt(0).toUpperCase() + userRole.slice(1).toLowerCase();

    let companyName = null;
    if (user.company_id) {
      try {
        const comp = await getQuery('SELECT cnm FROM ks_companies WHERE id = ?', [user.company_id]) as any;
        if (comp && comp.cnm) {
          companyName = comp.cnm;
        }
      } catch (e) {
        console.error("Failed to fetch company name:", e);
      }
    }

    let token;
    let selectedSiteId = null;
    let selectedSiteName = null;

    try {
      const userSites = await allQuery('SELECT id, site_name FROM ks_sites WHERE company_id = ?', [user.company_id]) as any[];
      if (userSites && userSites.length === 1) {
        selectedSiteId = userSites[0].id;
        selectedSiteName = userSites[0].site_name;
      }

      token = signToken({ 
        id: user.id, 
        username: user.username, 
        company_id: user.company_id, 
        ac: normalizedRole,
        account_type: user.account_type || normalizedRole,
        selected_site_id: selectedSiteId,
        selected_site_name: selectedSiteName
      });
    } catch (e) {
      return NextResponse.json({ error: 'SESSION_CREATION_FAILED' }, { status: 500 });
    }
    
    const response = NextResponse.json({ 
      success: true, 
      token: token,
      user: { 
        id: user.id, 
        username: user.username, 
        company_id: user.company_id, 
        company_name: companyName,
        ac: normalizedRole,
        account_type: user.account_type || normalizedRole,
        selected_site_id: selectedSiteId,
        selected_site_name: selectedSiteName
      } 
    });
    response.headers.append('Set-Cookie', setAuthCookie(token));

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: 'UNKNOWN_LOGIN_FAILURE' }, { status: 500 });
  }
}
