import { NextResponse } from 'next/server';
import { runQuery, getQuery } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const company_id = searchParams.get('company_id');

    if (!company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const devices = await runQuery(
      `SELECT id, device_id, device_name, company_id, site_id, mac_id 
       FROM ks_devices 
       WHERE company_id = ? 
       ORDER BY device_name`,
      [company_id]
    );

    return NextResponse.json({ success: true, data: devices });
  } catch (error) {
    console.error('Error fetching devices:', error);
    return NextResponse.json({ error: 'Failed to fetch devices' }, { status: 500 });
  }
}
