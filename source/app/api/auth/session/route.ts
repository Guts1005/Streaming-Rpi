import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { getQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const u = user as any;
  
  // ALWAYS fetch the latest company name dynamically
  if (u.company_id) {
    try {
      const compIdInt = parseInt(u.company_id, 10);
      if (!isNaN(compIdInt)) {
        const comp = await getQuery('SELECT cnm FROM ks_companies WHERE id = $1', [compIdInt]) as any;
        if (comp && comp.cnm) {
          u.company_name = comp.cnm;
        }
      }
    } catch (e) {
      console.error("Failed to fetch company name in session route:", e);
    }
  }

  try {
    const { allQuery } = await import('@/lib/db');
    // For admins, maybe load all sites, but for now just load user's sites or sites matching company
    if (u.ac === 'Admin') {
       u.sites = await allQuery('SELECT id, site_name FROM ks_sites WHERE company_id = $1', [parseInt(u.company_id, 10)]);
    } else {
       u.sites = await allQuery('SELECT id, site_name FROM ks_sites WHERE user_id = $1', [u.id]);
    }
    
    // Fetch devices for each site
    if (u.sites && u.sites.length > 0) {
      for (const site of u.sites) {
        site.devices = await allQuery('SELECT id, device_name, status FROM ks_devices WHERE site_id = $1', [site.id]);
      }
    }
  } catch (e) {
    u.sites = [];
  }

  const response = NextResponse.json({ authenticated: true, user: u });
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}
