import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Handle the dev cache clear page
  if (request.nextUrl?.pathname === '/_dev-clear-cache.html') {
    // Only allow in development
    if (process?.env?.NODE_ENV !== 'development') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/_dev-clear-cache.html',
};