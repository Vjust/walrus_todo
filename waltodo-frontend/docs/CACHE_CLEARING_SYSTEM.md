# Automatic Cache Clearing System for Development

## Overview

The WalTodo frontend now includes an automatic cache clearing system that runs every time you start the development server with `pnpm dev`. This prevents issues with stale caches, service workers, and outdated assets.

## How It Works

### 1. **Automatic Cache Clearing on `pnpm dev`**

When you run `pnpm dev`, the following happens automatically:

1. **Server-side caches are cleared:**
   - `.next` directory (Next.js build cache)
   - `node_modules/.cache` (various tool caches)
   - Other common cache directories

2. **Browser caches are cleared:**
   - Service workers are unregistered
   - All browser caches are deleted
   - LocalStorage and SessionStorage are cleared (optional)

3. **A browser tab briefly opens** to clear service worker caches, then closes automatically

### 2. **Available Commands**

```bash
# Default - clears all caches before starting
pnpm dev

# Start without clearing caches
pnpm dev:no-clear

# Simple dev mode (no cache clearing, no port detection)
pnpm dev:simple
```

### 3. **Environment Variables**

```bash
# Disable automatic browser opening for cache clearing
AUTO_CLEAR_BROWSER=false pnpm dev

# The server-side caches will still be cleared
```

### 4. **Manual Cache Clearing**

You can manually clear caches by:

1. **Visit the cache clearing page:**
   ```
   http://localhost:3000/clear-cache.html
   ```

2. **Use URL parameter:**
   ```
   http://localhost:3000?clear-cache=true
   ```

3. **Run the cache clearing script directly:**
   ```bash
   node scripts/clear-dev-cache.js
   ```

## Implementation Details

### Files Created/Modified:

1. **`scripts/clear-dev-cache.js`**
   - Clears server-side caches (.next, node_modules/.cache)
   - Creates temporary HTML page for browser cache clearing

2. **`scripts/dev-with-cache-clear.js`**
   - Wrapper script that runs cache clearing before starting dev server
   - Optionally opens browser to clear service worker caches

3. **`src/app/ClientLayoutWrapper.tsx`**
   - Enhanced to automatically unregister service workers in development
   - Checks for cache clearing flags on page load

4. **`package.json`**
   - Updated `dev` script to use the cache clearing wrapper
   - Added `dev:no-clear` option to skip cache clearing

## Why This Helps

1. **Prevents "blank page" issues** caused by cached assets with wrong versions
2. **Eliminates service worker conflicts** during development
3. **Ensures fresh builds** after installing new dependencies
4. **Reduces debugging time** by eliminating cache-related issues

## Troubleshooting

### If the browser tab doesn't close automatically:
- This is normal on some systems
- Simply close it manually after seeing "✅ All caches cleared successfully!"

### If you still see cache issues:
1. Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows/Linux)
2. Open DevTools → Application → Storage → Clear site data
3. Use incognito/private browsing mode

### To disable automatic cache clearing:
```bash
# Use the no-clear variant
pnpm dev:no-clear

# Or set environment variable
AUTO_CLEAR_BROWSER=false pnpm dev
```

## Security Note

The cache clearing functionality is **only available in development mode**. In production builds:
- The clearing scripts are not included
- The special endpoints return 404
- Service workers function normally for offline support