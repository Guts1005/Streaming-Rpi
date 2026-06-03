import { AccessToken } from "livekit-server-sdk";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const room = process.env.LIVEKIT_ROOM || "helmet-live";

  if (!apiKey || !apiSecret) {
    return Response.json(
      { error: "Missing LIVEKIT_API_KEY or LIVEKIT_API_SECRET" },
      { status: 500 },
    );
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity: `viewer-${crypto.randomUUID()}`,
    name: "Helmet Viewer",
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
