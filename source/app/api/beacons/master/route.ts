import { NextRequest, NextResponse } from 'next/server';
import { allQuery } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req) as any;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', beacons: [] }, { status: 401 });
    }

    const siteId = user.selected_site_id;
    if (!siteId) {
      // If no site is selected, return empty instead of querying all
      return NextResponse.json({ beacons: [] });
    }

    // Query ks_beacon_master for this specific site
    const query = `
      SELECT * 
      FROM ks_beacon_master 
      WHERE site_id = $1 
      ORDER BY beacon_name
    `;
    const beacons = await allQuery(query, [siteId]);

    return NextResponse.json({ beacons });
  } catch (error) {
    console.error('Error fetching beacons from db:', error);
    return NextResponse.json({ error: 'Internal Server Error', beacons: [] }, { status: 500 });
  }
}
