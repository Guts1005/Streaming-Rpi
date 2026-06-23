import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const roomName = 'helmet-live';
    const participantName = `dashboard-user-${Math.floor(Math.random() * 100000)}`;

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'LiveKit API credentials are not configured' },
        { status: 500 }
      );
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
    });

    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });

    const token = await at.toJwt();

    const url = process.env.LIVEKIT_URL;

    return NextResponse.json({ token, url });
  } catch (error: any) {
    console.error('Error generating LiveKit token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}
