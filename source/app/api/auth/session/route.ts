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
    // Always fetch sites belonging to the logged-in user's company
    if (u.company_id) {
      u.sites = await allQuery("SELECT id, site_name FROM ks_sites WHERE company_id = $1 AND (actv = 'Y' OR actv = 'y') ORDER BY site_name", [parseInt(u.company_id, 10)]);
      if (u.sites.length === 0) {
        const insertRes = await getQuery("INSERT INTO ks_sites (site_name, company_id, actv) VALUES ($1, $2, 'Y') RETURNING id", [`${u.username}'s Project`, parseInt(u.company_id, 10)]);
        if (insertRes && insertRes.id) {
          u.sites = [{ id: insertRes.id, site_name: `${u.username}'s Project` }];
        }
      }
    } else {
      u.sites = [];
    }
    
    // Fetch devices for each site (existing logic)
    if (u.sites && u.sites.length > 0) {
      for (const site of u.sites) {
        site.devices = await allQuery('SELECT id, device_name, status FROM ks_devices WHERE site_id = $1', [site.id]);
      }
    }
    
    // Fetch all active devices scoped by company_id if available, otherwise fetch all
    if (u.company_id) {
      u.all_devices = await allQuery("SELECT id, device_name, status, site_id, company_id, mac_id, device_id, api_base_url FROM ks_devices WHERE (status != 'deleted' OR status IS NULL) AND (company_id = $1 OR company_id IS NULL)", [parseInt(u.company_id, 10)]);
    } else {
      u.all_devices = await allQuery("SELECT id, device_name, status, site_id, company_id, mac_id, device_id, api_base_url FROM ks_devices WHERE status != 'deleted' OR status IS NULL");
    }
  } catch (e) {
    u.sites = [];
    u.all_devices = [];
  }

  const response = NextResponse.json({ authenticated: true, user: u });
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}
