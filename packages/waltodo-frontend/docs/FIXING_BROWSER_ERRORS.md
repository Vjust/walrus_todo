# Fixing Browser Context and Security Errors

This guide addresses common browser security and context errors that may occur when running the Walrus Todo frontend application.

## Common Errors and Solutions

### 1. Storage Access Errors

**Error**: `Access to storage is not allowed from this context`

**Causes**:
- Application is running in an iframe with restricted permissions
- Browser privacy settings blocking third-party storage
- Application served over HTTP instead of HTTPS
- Content Security Policy restrictions

**Solutions**:

1. **Use HTTPS locally**:
   ```bash
   # Create a local certificate
   openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes
   
   # Update package.json to use HTTPS
   "scripts": {
     "dev": "next dev --experimental-https",
     "dev:https": "next dev --experimental-https-key key.pem --experimental-https-cert cert.pem"
   }
   ```

2. **Configure browser settings**:
   - Chrome: Settings → Privacy and security → Cookies → Allow all cookies
   - Firefox: Settings → Privacy & Security → Cookies and Site Data → Accept all cookies
   - Safari: Preferences → Privacy → Uncheck "Prevent cross-site tracking"

3. **Use the storage fallback**:
   The application now includes an in-memory fallback when localStorage is unavailable.

### 2. Wallet Connection Errors

**Error**: `WalletNotSelectedError`

**Causes**:
- Wallet extension not installed
- Wallet not initialized before connection attempt
- Page loaded before wallet injection

**Solutions**:

1. **Install required wallet extensions**:
   - For Sui: Install Sui Wallet, Suiet, or Martian
   - For Solana: Install Phantom wallet

2. **Wait for wallet initialization**:
   The application now includes proper wallet detection and error messages.

3. **Refresh the page**:
   Sometimes wallet extensions need a page refresh to properly inject.

### 3. Clipboard Access Errors

**Error**: `Copy to clipboard is not supported in this browser`

**Causes**:
- Non-secure context (HTTP instead of HTTPS)
- Browser doesn't support clipboard API
- Permissions not granted

**Solutions**:

1. **Use HTTPS**:
   Clipboard API requires a secure context (HTTPS or localhost)

2. **Grant permissions**:
   When prompted, allow clipboard access

3. **Use fallback method**:
   The application now includes a fallback clipboard method for older browsers

## Recommended Development Setup

### 1. Using Local HTTPS

```bash
# Install mkcert for local certificates
brew install mkcert # macOS
mkcert -install

# Create certificates
cd packages/frontend-v2
mkcert localhost 127.0.0.1 ::1

# Update next.config.js
module.exports = {
  server: {
    https: {
      key: fs.readFileSync('./localhost-key.pem'),
      cert: fs.readFileSync('./localhost.pem'),
    },
  },
}
```

### 2. Using Environment Variables

Create a `.env.local` file:

```bash
# Copy example configuration
cp .env.local.example .env.local

# Update values as needed
NEXT_PUBLIC_ENABLE_WALLET_WARNING=true
NEXT_PUBLIC_ENABLE_STORAGE_FALLBACK=true
```

### 3. Using Docker for HTTPS

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build

# Use nginx for HTTPS
FROM nginx:alpine
COPY --from=0 /app/.next/static /usr/share/nginx/html/_next/static
COPY nginx.conf /etc/nginx/nginx.conf
COPY cert.pem /etc/nginx/cert.pem
COPY key.pem /etc/nginx/key.pem
```

## Testing in Different Contexts

### 1. Direct Browser Access
```bash
# HTTP (may have restrictions)
http://localhost:3001

# HTTPS (recommended)
https://localhost:3001
```

### 2. Iframe Testing
```html
<!-- test-iframe.html -->
<iframe src="http://localhost:3001" 
        allow="clipboard-read; clipboard-write; storage-access"
        width="100%" 
        height="600">
</iframe>
```

### 3. Cross-Origin Testing
```javascript
// Set CORS headers in next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE' },
        ],
      },
    ]
  },
}
```

## Browser-Specific Solutions

### Chrome/Edge
- Enable clipboard: `chrome://flags/#clipboard-unsanitized-content`
- Allow storage: `chrome://settings/content/cookies`

### Firefox
- Enable clipboard: `about:config` → `dom.allow_cut_copy` → true
- Allow storage: `about:preferences#privacy`

### Safari
- Enable clipboard: Preferences → Websites → Use of clipboard
- Allow storage: Preferences → Privacy → Website tracking

## Production Deployment

For production, ensure:

1. **Use HTTPS**: Deploy to a service that provides HTTPS by default (Vercel, Netlify, etc.)
2. **Set proper headers**: Configure Content Security Policy and CORS headers
3. **Handle errors gracefully**: Implement proper error boundaries and fallbacks
4. **Test across browsers**: Verify functionality in all target browsers

## Environment Detection

The application now includes automatic detection of:
- Storage availability
- Secure context
- Iframe context
- Clipboard support

A warning banner will appear when running in a restricted context, providing guidance to users.

## Troubleshooting

1. **Check browser console**: Look for specific error messages
2. **Verify wallet installation**: Ensure wallet extensions are properly installed
3. **Test in incognito mode**: Rule out extension conflicts
4. **Check network tab**: Verify all resources load correctly
5. **Use browser developer tools**: Check storage, cookies, and permissions

## Additional Resources

- [MDN: Secure Contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts)
- [Chrome Storage Access API](https://developers.google.com/web/updates/2020/07/storage-access-api)
- [Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API)
- [Wallet Adapter Documentation](https://github.com/solana-labs/wallet-adapter)