import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isAuth = request.cookies.has('carsigo-auth');

  if (path.startsWith('/admin') && !isAuth) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (path === '/login' && isAuth) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/login'],
};