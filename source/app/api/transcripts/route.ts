import { NextResponse } from 'next/server';
import { Pool } from 'pg';

let connString = process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING || "";
if (connString.includes('?')) {
  connString = connString.split('?')[0];
}

const pool = new Pool({
  connectionString: connString,
  ssl: { rejectUnauthorized: false },
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoName = searchParams.get('video_name');

  if (!videoName) {
    return NextResponse.json({ error: 'video_name is required' }, { status: 400 });
  }

  try {
    const result = await pool.query(
      'SELECT transcript, summary, created_at FROM ks_transcripts WHERE video_name = $1',
      [videoName]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({
      found: true,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error fetching transcript:', err);
    return NextResponse.json({ error: 'Failed to fetch transcript' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { video_name, site_id, transcript, summary } = body;

    if (!video_name || !transcript || !summary || site_id === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO ks_transcripts (video_name, site_id, transcript, summary)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (video_name) DO UPDATE 
       SET transcript = EXCLUDED.transcript,
           summary = EXCLUDED.summary,
           created_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [video_name, site_id, transcript, summary]
    );

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error saving transcript:', err);
    return NextResponse.json({ error: 'Failed to save transcript' }, { status: 500 });
  }
}
