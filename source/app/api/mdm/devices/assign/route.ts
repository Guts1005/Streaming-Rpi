import { NextResponse } from 'next/server';
import { runQuery, getQuery } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { device_id, site_id } = body;

    if (!device_id || !site_id) {
      return NextResponse.json({ error: 'device_id and site_id are required' }, { status: 400 });
    }

    // Now update the selected device with the new site_id
    await runQuery(
      `UPDATE ks_devices SET site_id = ? WHERE id = ?`,
      [site_id, device_id]
    );

    return NextResponse.json({ success: true, message: 'Device assigned successfully.' });
  } catch (error) {
    console.error('Error assigning device:', error);
    return NextResponse.json({ error: 'Failed to assign device' }, { status: 500 });
  }
}
