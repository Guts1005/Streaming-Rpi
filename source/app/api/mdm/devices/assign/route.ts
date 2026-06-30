import { NextResponse } from 'next/server';
import { runQuery, getQuery } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { device_id, site_id, api_base_url } = body;

    if (!device_id || !site_id) {
      return NextResponse.json({ error: 'device_id and site_id are required' }, { status: 400 });
    }

    // Now update the selected device with the new site_id and api_base_url
    await runQuery(
      `UPDATE ks_devices SET site_id = $1, api_base_url = COALESCE($2, api_base_url) WHERE id = $3`,
      [site_id, api_base_url || null, device_id]
    );

    return NextResponse.json({ success: true, message: 'Device assigned successfully.' });
  } catch (error) {
    console.error('Error assigning device:', error);
    return NextResponse.json({ error: 'Failed to assign device' }, { status: 500 });
  }
}
