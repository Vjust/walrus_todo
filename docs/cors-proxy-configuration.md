# CORS and Proxy Configuration Guide

This guide explains the CORS and proxy configuration implemented for the WalTodo project to ensure seamless frontend-API connectivity during development.

## Overview

The configuration supports:
- Dynamic port ranges (3000-3010) for development flexibility
- Proper credential support for authenticated requests
- Optimized preflight request handling
- Development proxy for simplified API calls
- Comprehensive error handling and debugging

## API Server CORS Configuration

### Shared CORS Configuration

Both the standalone API (`apps/api`) and CLI API (`apps/cli`) use a shared CORS configuration located at:
- `apps/api/src/config/cors.ts`
- `apps/cli/src/api/config/cors.ts`

Key features:
```typescript
// Dynamic origin validation
origin: (origin, callback) => {
  // Allow localhost with any port in development
  if (isDevelopment && origin.includes('localhost')) {
    return callback(null, true);
  }
  // Check against configured origins
  // ...
}

// Full credential support
credentials: true

// Comprehensive headers
allowedHeaders: [
  'Content-Type',
  'Authorization',
  'X-API-Key',
  'X-Wallet-Address',
  'X-Request-ID',
  'Origin',
  'Accept',
  'Cache-Control',
]
```

### Preflight Request Handling

The API servers include enhanced preflight handling:
1. Express CORS middleware handles standard preflight
2. Custom `corsPreflightHandler` provides debugging and optimization
3. `corsErrorHandler` offers better error messages for CORS issues

## Frontend Configuration

### Next.js Proxy Setup

The frontend uses Next.js rewrites for API proxying in development:

```javascript
// next.config.js
async rewrites() {
  if (process.env.NODE_ENV !== 'development') {
    return [];
  }
  
  return [
    {
      source: '/api/v1/:path*',
      destination: 'http://localhost:3001/api/v1/:path*',
    },
    {
      source: '/healthz',
      destination: 'http://localhost:3001/healthz',
    },
  ];
}
```

### API Client Configuration

The API client (`src/lib/api-client.ts`) automatically detects whether to use proxy or direct API calls:

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';
const useProxy = isDevelopment && !process.env.NEXT_PUBLIC_API_URL;

if (useProxy) {
  // Use relative URL for proxy
  this.baseURL = '';
} else {
  // Use explicit API URL
  this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}
```

## Environment Configuration

### Development Environment

Create `.env.development` in the frontend:
```env
# Optional - if not set, proxy will be used
NEXT_PUBLIC_API_URL=http://localhost:3001

# Disable auth for easier development
NEXT_PUBLIC_API_AUTH_REQUIRED=false

# Enable debug logging
NEXT_PUBLIC_DEBUG=true
```

### API Environment

Configure the API server's CORS in `.env`:
```env
# Custom CORS origins (optional)
API_CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# API port
API_PORT=3001
```

## Usage Examples

### Starting Development Servers

1. Start the API server:
```bash
cd apps/api
pnpm dev
# API runs on http://localhost:3001
```

2. Start the frontend:
```bash
cd waltodo-frontend
pnpm dev
# Frontend runs on http://localhost:3000 (or next available port)
```

### Testing CORS

Test CORS configuration:
```bash
# Preflight request
curl -X OPTIONS http://localhost:3001/api/v1/todos \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v

# Actual request
curl -X GET http://localhost:3001/api/v1/todos \
  -H "Origin: http://localhost:3000" \
  -H "Content-Type: application/json" \
  -v
```

## Troubleshooting

### Common Issues

1. **CORS errors in browser console**
   - Check that the API server is running
   - Verify the origin is allowed in CORS config
   - Check browser network tab for preflight requests

2. **Proxy not working**
   - Ensure you're in development mode
   - Check Next.js console for rewrite logs
   - Verify API server is on expected port

3. **Authentication issues**
   - Check `X-API-Key` header is included
   - Verify credentials are allowed in CORS
   - Check cookie settings if using sessions

### Debug Mode

Enable CORS debugging by setting:
```env
LOG_LEVEL=debug
```

This will log all CORS requests and decisions to help troubleshoot issues.

## Production Considerations

For production:
1. Set explicit `API_CORS_ORIGINS` in environment
2. Disable development-only features
3. Use proper SSL/TLS certificates
4. Configure reverse proxy (nginx/caddy) if needed
5. Set appropriate cache headers

## Security Notes

- Never use `origin: true` in production
- Always validate origins against a whitelist
- Use HTTPS in production to prevent MITM attacks
- Regularly review and update allowed origins
- Monitor CORS errors for potential attacks