import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;

  // Protect all routes except /login, /api/login, /api/logout, /api/device, /api/token
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') || 
                      request.nextUrl.pathname.startsWith('/api/login') ||
                      request.nextUrl.pathname.startsWith('/api/logout');

  const isDeviceRoute = request.nextUrl.pathname.startsWith('/api/device');
  const isTokenRoute = request.nextUrl.pathname.startsWith('/api/token');

  if (!token && !isAuthRoute && !isDeviceRoute && !isTokenRoute) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
