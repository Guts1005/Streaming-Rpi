import { NextRequest, NextResponse } from 'next/server';
import { allQuery, runQuery } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const site_id = searchParams.get('site_id');

    let query = 'SELECT * FROM ks_beacons_master';
    let params: any[] = [];
    
    if (site_id) {
      query += ' WHERE site_id = ?';
      params.push(parseInt(site_id, 10));
    }

    const beacons = await allQuery(query, params);
    return NextResponse.json({ success: true, data: beacons });
  } catch (error: any) {
    console.error('Error fetching beacon master data:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
