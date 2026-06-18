import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

function targetBase() {
  return (process.env.DEVICE_API_BASE || process.env.NEXT_PUBLIC_DEVICE_API_BASE || "").replace(/\/$/, "");
}

async function proxyDeviceRequest(request: NextRequest, context: RouteContext) {
  const base = targetBase();
  if (!base) {
    return Response.json(
      { error: "Missing DEVICE_API_BASE or NEXT_PUBLIC_DEVICE_API_BASE" },
      { status: 500 },
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
    upstream = await fetch(targetUrl, {
      method,
      headers,
      body,
      cache: "no-store",
    });
  } catch (err: any) {
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
