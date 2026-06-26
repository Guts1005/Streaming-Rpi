import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

async function targetBase(request: NextRequest): Promise<string | null> {
  // Always resolve from DB, ignoring hardcoded Vercel env variables which break multi-device support


  const user = getUserFromRequest(request);
  if (!user) return null;

  // Check if a specific site or device is selected via cookie
  const activeSiteId = request.cookies.get('active_site_id')?.value;
  const activeDeviceId = request.cookies.get('active_device_id')?.value;
  let device;

  if (activeDeviceId && !isNaN(parseInt(activeDeviceId, 10))) {
    device = await getQuery('SELECT api_base_url FROM ks_devices WHERE id = $1 AND status = $2 LIMIT 1', [parseInt(activeDeviceId, 10), 'active']);
  } else if (activeSiteId && !isNaN(parseInt(activeSiteId, 10))) {
    device = await getQuery('SELECT api_base_url FROM ks_devices WHERE site_id = $1 AND status = $2 LIMIT 1', [parseInt(activeSiteId, 10), 'active']);
  } else {
    // Just grab the user's first active device
    device = await getQuery('SELECT api_base_url FROM ks_devices WHERE user_id = $1 AND status = $2 LIMIT 1', [(user as any).id, 'active']);
  }

  if (device && device.api_base_url) {
    return device.api_base_url.replace(/\/$/, "");
  }

  return null;
}

async function proxyDeviceRequest(request: NextRequest, context: RouteContext) {
  const base = await targetBase(request);
  if (!base) {
    return Response.json(
      { error: "No active device found for this account/site, or not paired." },
      { status: 404 },
    );
  }

  const { path = [] } = await context.params;
  const targetPath = path.map((part) => encodeURIComponent(part)).join("/");
  const targetUrl = `${base}/${targetPath}${request.nextUrl.search}`;

  // If this is a file download, redirect the browser directly to the device URL
  // This bypasses Vercel's 10-second timeout and 4.5MB response size limits
  if (path[0] === "download") {
    const redirectUrl = new URL(`${base}/api/${targetPath}${request.nextUrl.search}`);
    return Response.redirect(redirectUrl.toString(), 302);
  }

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const accept = request.headers.get("accept");
  const range = request.headers.get("range");
  if (contentType) headers.set("content-type", contentType);
  if (accept) headers.set("accept", accept);
  if (range) headers.set("range", range);
  
  // Bypass tunnel warning screens (ngrok, localtunnel, etc)
  headers.set("ngrok-skip-browser-warning", "1");
  headers.set("Bypass-Tunnel-Reminder", "true");
  


  const method = request.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();

  let upstream: Response;
  try {
    console.log(`[Proxy] Fetching targetUrl: ${targetUrl}`);
    upstream = await fetch(targetUrl, {
      method,
      headers,
      body,
      cache: "no-store",
    });
    console.log(`[Proxy] Response status: ${upstream.status}`);
  } catch (err: any) {
    console.error(`[Proxy] Fetch failed for ${targetUrl}:`, err);
    return Response.json(
      { error: `Could not reach device at ${base}: ${err.message}` },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  for (const key of ["content-type", "content-disposition", "cache-control", "accept-ranges", "content-range", "content-length"]) {
    const value = upstream.headers.get(key);
    if (value) responseHeaders.set(key, value);
  }
  responseHeaders.set("cache-control", "no-store");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyDeviceRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyDeviceRequest(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyDeviceRequest(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyDeviceRequest(request, context);
}
