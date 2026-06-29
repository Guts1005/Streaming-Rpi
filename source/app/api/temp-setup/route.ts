import { NextResponse } from 'next/server';
import { runQuery, allQuery } from '@/lib/db';

export async function GET() {
  try {
    await runQuery(`
      CREATE TABLE IF NOT EXISTS ks_beacon_master (
        id SERIAL PRIMARY KEY,
        site_id INTEGER,
        beacon_name TEXT,
        location_name TEXT,
        beacon_mac TEXT,
        lat TEXT,
        lon TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Seed some initial data if empty
    const count = await allQuery('SELECT COUNT(*) as count FROM ks_beacon_master');
    if (count[0].count === '0' || count[0].count === 0) {
       await runQuery(`
         INSERT INTO ks_beacon_master (site_id, beacon_name, location_name, beacon_mac) VALUES 
         (2, 'Main Gate', 'Main Gate', '23:60:79:98:9C:15'),
         (2, 'Parking Area', 'Parking Area', '11:22:33:44:55:66'),
         (2, 'Basement', 'Basement', 'AA:BB:CC:DD:EE:FF'),
         (1, 'Tower A', 'Tower A', '12:34:56:78:90:AB')
       `);
    }

    return NextResponse.json({ success: true, message: 'Table created and seeded' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
