import { NextRequest, NextResponse } from 'next/server';
import { runQuery, getQuery, allQuery } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const u = user as any;
    if (!u.company_id) {
       return NextResponse.json({ error: 'User does not belong to any company' }, { status: 400 });
    }

    const company_id = u.company_id;

    const devices = await allQuery(
      `SELECT d.id, d.device_id, d.device_name, d.company_id, d.site_id, d.mac_id, s.site_name 
       FROM ks_devices d
       LEFT JOIN ks_sites s ON d.site_id = s.id
       WHERE d.company_id = ? 
       ORDER BY d.device_name`,
      [company_id]
    );

    return NextResponse.json({ success: true, data: devices });
  } catch (error) {
    console.error('Error fetching devices:', error);
    return NextResponse.json({ error: 'Failed to fetch devices' }, { status: 500 });
  }
}
