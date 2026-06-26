import { NextResponse } from 'next/server';
import { getQuery, runQuery } from '@/lib/db';

export async function GET(request: Request) {
  try {
    // const sessionToken = request.cookies.get('token')?.value;
    // if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getQuery("SELECT id, username, company_id FROM users ORDER BY id DESC LIMIT 1");
    if (!user) return NextResponse.json({ error: "No users" });
    
    let siteId;
    const site = await getQuery("SELECT id FROM ks_sites WHERE user_id = $1 LIMIT 1", [user.id]);
    if (!site) {
       const insert = await getQuery("INSERT INTO ks_sites (user_id, company_id, site_name) VALUES ($1, $2, $3) RETURNING id", [user.id, user.company_id, user.username + "'s Helmet"]);
       siteId = insert.id;
    } else {
       siteId = site.id;
    }
    
    await getQuery("UPDATE ks_devices SET api_base_url = 'http://192.168.0.138'");
    
    return NextResponse.json({ success: true, message: `All devices updated to NGINX port 80` });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
