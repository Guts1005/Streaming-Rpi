import { AccessToken } from "livekit-server-sdk";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const room = process.env.LIVEKIT_ROOM || "helmet-live";
  const identity = request.nextUrl.searchParams.get("identity") || `viewer-${crypto.randomUUID()}`;
  const name = request.nextUrl.searchParams.get("name") || "Helmet Viewer";

  if (!apiKey || !apiSecret) {
    return Response.json(
      { error: "Missing LIVEKIT_API_KEY or LIVEKIT_API_SECRET" },
      { status: 500 },
    );
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
  });

  token.addGrant({
    room,
    roomJoin: true,
    canSubscribe: true,
    canPublish: true,
    canPublishData: true,
  });

  return Response.json({ token: await token.toJwt() });
}
