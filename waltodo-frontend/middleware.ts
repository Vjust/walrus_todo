import { NextRequest, NextResponse } from 'next/server';

// Minimal security headers for Next.js middleware
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for static files and API routes that don't need it
  const skipPaths = [
    '/_next',
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml',
    '/manifest.json',
    '/icons/',
    '/images/',
  ];

  if (skipPaths.some(path => pathname.startsWith(path as any))) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  // Add basic security headers
  response?.headers?.set('X-DNS-Prefetch-Control', 'on');
  response?.headers?.set('X-XSS-Protection', '1; mode=block');
  response?.headers?.set('X-Frame-Options', 'DENY');
  response?.headers?.set('X-Content-Type-Options', 'nosniff');
  response?.headers?.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Simple CSP for development
  if (process.env?.NODE_ENV === 'development') {
    response?.headers?.set(
      'Content-Security-Policy',
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: wss: data: blob:; object-src 'none';"
    );
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};