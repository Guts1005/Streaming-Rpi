import { NextRequest, NextResponse } from 'next/server';
import { runQuery, allQuery } from '@/lib/db';
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
      `SELECT d.id, d.device_id, d.device_name, d.company_id, d.site_id, d.mac_id, d.active, s.site_name 
       FROM ks_devices d
       LEFT JOIN ks_sites s ON d.site_id = s.id
       WHERE d.company_id = $1 
       ORDER BY d.device_name`,
      [company_id]
    );

    return NextResponse.json({ success: true, data: devices });
  } catch (error) {
    console.error('Error fetching devices:', error);
    return NextResponse.json({ error: 'Failed to fetch devices' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
    const body = await req.json();
    const { device_name, device_id, mac_id, site_id, active } = body;

    if (!device_name || !device_id || !mac_id || !site_id) {
      return NextResponse.json({ error: 'Device Name, Device ID, MAC ID, and Site are required.' }, { status: 400 });
    }

    // Check uniqueness
    const existingDeviceId = await allQuery('SELECT id FROM ks_devices WHERE device_id = $1', [device_id]);
    if (existingDeviceId.length > 0) {
      return NextResponse.json({ error: 'Device ID is already in use.' }, { status: 400 });
    }

    const existingMacId = await allQuery('SELECT id FROM ks_devices WHERE mac_id = $1', [mac_id]);
    if (existingMacId.length > 0) {
      return NextResponse.json({ error: 'MAC ID is already in use.' }, { status: 400 });
    }

    await runQuery(
      `INSERT INTO ks_devices (company_id, device_name, device_id, mac_id, site_id, active)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [company_id, device_name, device_id, mac_id, site_id, active || 'Y']
    );

    return NextResponse.json({ success: true, message: 'Device added successfully.' });
  } catch (error) {
    console.error('Error adding device:', error);
    return NextResponse.json({ error: 'Failed to add device' }, { status: 500 });
  }
}
