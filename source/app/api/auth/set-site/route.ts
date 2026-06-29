import { NextRequest, NextResponse } from 'next/server';
import { getQuery } from '@/lib/db';
import { signToken, setAuthCookie, getUserFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req) as any;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { site_id } = await req.json();
    if (!site_id) {
      return NextResponse.json({ error: 'Missing site_id' }, { status: 400 });
    }

    // Verify the site belongs to the user's company
    const siteQuery = 'SELECT id, site_name FROM ks_sites WHERE id = ? AND company_id = ?';
    const siteRecord = await getQuery(siteQuery, [site_id, user.company_id]) as any;

    if (!siteRecord) {
      return NextResponse.json({ error: 'Invalid site selection or permission denied' }, { status: 403 });
    }

    // Prepare new payload (preserve old payload fields and update selected site)
    const newPayload = {
      ...user,
      selected_site_id: siteRecord.id,
      selected_site_name: siteRecord.site_name
    };

    // Remove JWT specific fields before re-signing
    delete newPayload.iat;
    delete newPayload.exp;

    const newToken = signToken(newPayload);

    const response = NextResponse.json({ 
      success: true, 
      message: 'Site updated successfully',
      selected_site_id: siteRecord.id,
      selected_site_name: siteRecord.site_name
    });

    response.headers.append('Set-Cookie', setAuthCookie(newToken));
    return response;
  } catch (error: any) {
    console.error('Set site error:', error);
    return NextResponse.json({ error: 'Failed to update site' }, { status: 500 });
  }
}
