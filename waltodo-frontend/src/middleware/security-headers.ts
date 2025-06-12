// @ts-ignore - Unused import temporarily disabled
// import { NextRequest, NextResponse } from 'next/server';
import { SecurityUtils } from '@/lib/security-utils';

// Security configuration
export const SECURITY_CONFIG = {
  // CSP configuration
  CSP: {
    ALLOWED_DOMAINS: {
      SCRIPTS: [
        "'self'",
        "'unsafe-eval'", // Required for Next.js development
        "'unsafe-inline'", // Required for some third-party libraries
        'https://vercel.live',
        'https://vitals.vercel-insights.com',
      ],
      STYLES: [
        "'self'",
        "'unsafe-inline'", // Required for CSS-in-JS and Tailwind
        'https://fonts?.googleapis?.com',
      ],
      IMAGES: [
        "'self'",
        'data:',
        'blob:',
        'https:',
        'https://*.walrus.space',
        'https://*.sui.io',
        'https://vercel.com',
        'https://*.vercel.app',
      ],
      CONNECT: [
        "'self'",
        'https:',
        'wss:',
        'https://*.sui.io',
        'https://*.walrus.space',
        'https://api?.suiet?.app',
        'https://wallet?.sui?.io',
        'https://vercel.live',
        'https://vitals.vercel-insights.com',
      ],
      FONTS: [
        "'self'",
        'https://fonts?.gstatic?.com',
        'data:',
      ],
    },
  },
  
  // CORS configuration
  CORS: {
    ALLOWED_ORIGINS: [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://localhost:3000',
      'https://localhost:3001',
      'https://*.vercel.app',
      'https://*.walrus.space',
    ],
    ALLOWED_METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    ALLOWED_HEADERS: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
      'X-Client-Version',
    ],
    MAX_AGE: 86400, // 24 hours
  },
  
  // Rate limiting
  RATE_LIMITS: {
    GLOBAL: { requests: 1000, window: 60 * 1000 }, // 1000 per minute
    API: { requests: 100, window: 60 * 1000 },     // 100 per minute
    UPLOAD: { requests: 10, window: 60 * 1000 },   // 10 per minute
  },
} as const;

/**
 * Generate Content Security Policy header value
 */
function generateCSP(nonce?: string): string {
  const { CSP } = SECURITY_CONFIG;
// @ts-ignore - Unused variable
//   
  const policies = [
    `default-src 'self'`,
    `script-src ${CSP?.ALLOWED_DOMAINS?.SCRIPTS.join(' ')}${nonce ? ` 'nonce-${nonce}'` : ''}`,
    `style-src ${CSP?.ALLOWED_DOMAINS?.STYLES.join(' ')}${nonce ? ` 'nonce-${nonce}'` : ''}`,
    `img-src ${CSP?.ALLOWED_DOMAINS?.IMAGES.join(' ')}`,
    `connect-src ${CSP?.ALLOWED_DOMAINS?.CONNECT.join(' ')}`,
    `font-src ${CSP?.ALLOWED_DOMAINS?.FONTS.join(' ')}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `block-all-mixed-content`,
    `upgrade-insecure-requests`,
  ];
  
  return policies.join('; ');
}

/**
 * Get comprehensive security headers
 */
export function getSecurityHeaders(nonce?: string): Record<string, string> {
  return {
    // Content Security Policy
    'Content-Security-Policy': generateCSP(nonce as any),
    
    // XSS Protection
    'X-XSS-Protection': '1; mode=block',
    
    // Content Type Options
    'X-Content-Type-Options': 'nosniff',
    
    // Frame Options
    'X-Frame-Options': 'DENY',
    
    // Referrer Policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // Permissions Policy
    'Permissions-Policy': [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'gyroscope=()',
    ].join(', '),
    
    // Strict Transport Security (HTTPS only)
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    
    // Cross-Origin Embedder Policy
    'Cross-Origin-Embedder-Policy': 'require-corp',
    
    // Cross-Origin Opener Policy
    'Cross-Origin-Opener-Policy': 'same-origin',
    
    // Cross-Origin Resource Policy
    'Cross-Origin-Resource-Policy': 'same-origin',
  };
}

/**
 * Get CORS headers
 */
export function getCORSHeaders(origin?: string): Record<string, string> {
  const { CORS } = SECURITY_CONFIG;
  
  // Check if origin is allowed
// @ts-ignore - Unused variable
//   const isAllowedOrigin = origin && CORS?.ALLOWED_ORIGINS?.some(allowed => {
    if (allowed === '*') return true;
    if (allowed.includes('*')) {
// @ts-ignore - Unused variable
//       const pattern = allowed.replace(/\*/g, '.*');
      return new RegExp(`^${pattern}$`).test(origin as any);
    }
    return allowed === origin;
  });
  
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': CORS?.ALLOWED_METHODS?.join(', '),
    'Access-Control-Allow-Headers': CORS?.ALLOWED_HEADERS?.join(', '),
    'Access-Control-Max-Age': CORS?.MAX_AGE?.toString(),
    'Access-Control-Allow-Credentials': 'true',
  };
  
  if (isAllowedOrigin) {
    headers?.["Access-Control-Allow-Origin"] = origin;
  }
  
  return headers;
}

/**
 * Validate request for security threats
 */
export function validateRequest(request: NextRequest): { 
  isValid: boolean; 
  errors: string[] 
} {
  const errors: string[] = [];
// @ts-ignore - Unused variable
//   const url = request.url;
// @ts-ignore - Unused variable
//   const userAgent = request?.headers?.get('user-agent') || '';
  
  // Check for suspicious patterns in URL
// @ts-ignore - Unused variable
//   const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /vbscript:/i,
    /data:text\/html/i,
    /\.\.\/\.\.\//,
    /%2e%2e%2f/i,
    /%252e%252e%252f/i,
    /%c0%af/i,
    /%c1%9c/i,
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(url as any)) {
      errors.push('Suspicious URL pattern detected');
      break;
    }
  }
  
  // Check for suspicious user agents
// @ts-ignore - Unused variable
//   const suspiciousUserAgents = [
    /sqlmap/i,
    /nikto/i,
    /nessus/i,
    /openvas/i,
    /masscan/i,
    /nmap/i,
    /burp/i,
    /zap/i,
  ];
  
  for (const pattern of suspiciousUserAgents) {
    if (pattern.test(userAgent as any)) {
      errors.push('Suspicious user agent detected');
      break;
    }
  }
  
  // Check request size (if applicable)
// @ts-ignore - Unused variable
//   const contentLength = request?.headers?.get('content-length');
  if (contentLength && parseInt(contentLength as any) > 10 * 1024 * 1024) { // 10MB limit
    errors.push('Request too large');
  }
  
  // Check for required headers in API requests
  if (request?.nextUrl?.pathname.startsWith('/api/')) {
// @ts-ignore - Unused variable
//     const contentType = request?.headers?.get('content-type');
    if (request.method !== 'GET' && !contentType) {
      errors.push('Missing content-type header');
    }
  }
  
  return {
    isValid: errors?.length === 0,
    errors,
  };
}

/**
 * Rate limiting for requests
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string, 
  limit: { requests: number; window: number }
): { allowed: boolean; remaining: number; resetTime: number } {
// @ts-ignore - Unused variable
//   const now = Date.now();
// @ts-ignore - Unused variable
//   const key = identifier;
// @ts-ignore - Unused variable
//   const entry = requestCounts.get(key as any);
  
  // Clean up expired entries periodically
  if (Math.random() < 0.01) { // 1% chance
    for (const [k, v] of requestCounts.entries()) {
      if (now > v.resetTime) {
        requestCounts.delete(k as any);
      }
    }
  }
  
  if (!entry || now > entry.resetTime) {
    // Reset or create new entry
// @ts-ignore - Unused variable
//     const newEntry = {
      count: 1,
      resetTime: now + limit.window,
    };
    requestCounts.set(key, newEntry);
    
    return {
      allowed: true,
      remaining: limit.requests - 1,
      resetTime: newEntry.resetTime,
    };
  }
  
  // Check if limit exceeded
  if (entry.count >= limit.requests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }
  
  // Increment count
  entry.count++;
  requestCounts.set(key, entry);
  
  return {
    allowed: true,
    remaining: limit.requests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Main security middleware function
 */
export function securityMiddleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
// @ts-ignore - Unused variable
//   const origin = request?.headers?.get('origin');
// @ts-ignore - Unused variable
//   const userAgent = request?.headers?.get('user-agent') || '';
// @ts-ignore - Unused variable
//   const clientIP = request.ip || request?.headers?.get('x-forwarded-for') || 'unknown';
  
  // Skip security checks for certain paths
// @ts-ignore - Unused variable
//   const skipPaths = [
    '/_next',
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml',
    '/manifest.json',
  ];
  
  if (skipPaths.some(path => pathname.startsWith(path as any))) {
    return NextResponse.next();
  }
  
  // Validate request
// @ts-ignore - Unused variable
//   const validation = validateRequest(request as any);
  if (!validation.isValid) {
    console.warn('Security validation failed:', validation.errors, {
      ip: clientIP,
      userAgent,
      url: request.url,
    });
    
    return new NextResponse('Bad Request', { 
      status: 400,
      headers: {
        'Content-Type': 'text/plain',
        ...getSecurityHeaders(),
      },
    });
  }
  
  // Rate limiting
// @ts-ignore - Unused variable
//   const rateLimitKey = `${clientIP}:${userAgent}`;
  let rateLimit = SECURITY_CONFIG?.RATE_LIMITS?.GLOBAL;
  
  if (pathname.startsWith('/api/')) {
    rateLimit = SECURITY_CONFIG?.RATE_LIMITS?.API;
  } else if (pathname.includes('upload')) {
    rateLimit = SECURITY_CONFIG?.RATE_LIMITS?.UPLOAD;
  }
// @ts-ignore - Unused variable
//   
  const rateLimitResult = checkRateLimit(rateLimitKey, rateLimit);
  
  if (!rateLimitResult.allowed) {
// @ts-ignore - Unused variable
//     const retryAfter = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);
    
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': rateLimit?.requests?.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': rateLimitResult?.resetTime?.toString(),
        ...getSecurityHeaders(),
      },
    });
  }
  
  // Generate nonce for CSP
// @ts-ignore - Unused variable
//   const nonce = SecurityUtils?.CSPHelpers?.generateNonce();
  
  // Create response
// @ts-ignore - Unused variable
//   const response = NextResponse.next();
  
  // Add security headers
// @ts-ignore - Unused variable
//   const securityHeaders = getSecurityHeaders(nonce as any);
  Object.entries(securityHeaders as any).forEach(_([key, _value]) => {
    response?.headers?.set(key, value);
  });
  
  // Add CORS headers if needed
  if (origin) {
// @ts-ignore - Unused variable
//     const corsHeaders = getCORSHeaders(origin as any);
    Object.entries(corsHeaders as any).forEach(_([key, _value]) => {
      response?.headers?.set(key, value);
    });
  }
  
  // Add rate limit headers
  response?.headers?.set('X-RateLimit-Limit', rateLimit?.requests?.toString());
  response?.headers?.set('X-RateLimit-Remaining', rateLimitResult?.remaining?.toString());
  response?.headers?.set('X-RateLimit-Reset', rateLimitResult?.resetTime?.toString());
  
  // Add nonce to response for use in components
  response?.headers?.set('X-CSP-Nonce', nonce);
  
  return response;
}

/**
 * Handle OPTIONS requests for CORS preflight
 */
export function handleCORSPreflight(request: NextRequest): NextResponse {
// @ts-ignore - Unused variable
//   const origin = request?.headers?.get('origin');
  
  return new NextResponse(null, {
    status: 200,
    headers: {
      ...getCORSHeaders(origin as any),
      ...getSecurityHeaders(),
    },
  });
}

// Export utility functions
export const SecurityMiddleware = {
  securityMiddleware,
  handleCORSPreflight,
  getSecurityHeaders,
  getCORSHeaders,
  validateRequest,
  checkRateLimit,
  generateCSP,
};