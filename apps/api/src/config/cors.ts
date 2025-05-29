import { CorsOptions } from 'cors';

/**
 * Shared CORS configuration for API servers
 * Supports dynamic port ranges for development flexibility
 */
export function getCorsConfig(env: string = 'development'): CorsOptions {
  const isDevelopment = env === 'development';
  
  // Development origins with dynamic port range support
  const devOrigins = [
    // Standard development ports
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004',
    'http://localhost:3005',
    'http://localhost:3006',
    'http://localhost:3007',
    'http://localhost:3008',
    'http://localhost:3009',
    'http://localhost:3010',
    // Local network access
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
    // Common local network IPs (update based on your network)
    'http://192.168.1.0:3000',
    'http://192.168.1.0:3001',
    'http://192.168.8.204:3000',
    'http://192.168.8.204:3001',
  ];

  // Production origins from environment
  const prodOrigins = process.env.API_CORS_ORIGINS?.split(',') || [];

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., mobile apps, Postman)
      if (!origin) {
        return callback(null, true);
      }

      // In development, be more permissive
      if (isDevelopment) {
        // Allow any localhost origin
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
          return callback(null, true);
        }
        // Check against dev origins list
        if (devOrigins.includes(origin)) {
          return callback(null, true);
        }
        // Allow local network IPs in development
        if (/^http:\/\/192\.168\.\d+\.\d+:\d+$/.test(origin)) {
          return callback(null, true);
        }
      }

      // Check against configured origins
      const allowedOrigins = isDevelopment ? devOrigins : prodOrigins;
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Reject unauthorized origins
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-Key',
      'X-Wallet-Address',
      'X-Request-ID',
      'Origin',
      'Accept',
      'Cache-Control',
    ],
    exposedHeaders: [
      'X-Total-Count',
      'X-Page-Count',
      'X-Request-ID',
      'X-Response-Time',
    ],
    maxAge: isDevelopment ? 3600 : 86400, // 1 hour in dev, 24 hours in prod
    preflightContinue: false,
    optionsSuccessStatus: 204,
  };

  return corsOptions;
}

/**
 * Simplified CORS for specific routes that need different settings
 */
export function getPublicCorsConfig(): CorsOptions {
  return {
    origin: true, // Allow all origins
    credentials: false,
    methods: ['GET'],
    maxAge: 3600,
  };
}