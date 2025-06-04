#!/usr/bin/env node

/**
 * Clear development caches before starting Next.js dev server
 * This script clears:
 * - .next directory (Next.js build cache)
 * - node_modules/.cache (various build tool caches)
 * - Browser service worker caches (via a special endpoint)
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('🧹 Clearing development caches...\n');

// Clear Next.js cache
const nextCachePath = path.join(__dirname, '..', '.next');
if (fs.existsSync(nextCachePath)) {
  console.log('✓ Removing .next directory...');
  fs.rmSync(nextCachePath, { recursive: true, force: true });
}

// Clear node_modules cache
const nodeModulesCachePath = path.join(__dirname, '..', 'node_modules', '.cache');
if (fs.existsSync(nodeModulesCachePath)) {
  console.log('✓ Removing node_modules/.cache directory...');
  fs.rmSync(nodeModulesCachePath, { recursive: true, force: true });
}

// Clear any custom cache directories
const customCachePaths = [
  '.cache',
  'cache',
  '.parcel-cache',
  '.webpack-cache'
];

customCachePaths.forEach(cachePath => {
  const fullPath = path.join(__dirname, '..', cachePath);
  if (fs.existsSync(fullPath)) {
    console.log(`✓ Removing ${cachePath} directory...`);
    fs.rmSync(fullPath, { recursive: true, force: true });
  }
});

console.log('\n✅ All development caches cleared!\n');

// Create a temporary HTML file that will clear browser caches
const clearBrowserCacheHTML = `<!DOCTYPE html>
<html>
<head>
    <title>Clearing Browser Cache...</title>
    <meta charset="utf-8">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #f3f4f6;
        }
        .container {
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            max-width: 500px;
        }
        h1 { color: #1f2937; margin-bottom: 20px; }
        p { color: #6b7280; line-height: 1.6; }
        .spinner {
            border: 3px solid #f3f4f6;
            border-top: 3px solid #3b82f6;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .success { color: #10b981; font-weight: 600; }
        .error { color: #ef4444; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧹 Clearing Browser Caches</h1>
        <div class="spinner"></div>
        <p id="status">Clearing service workers and caches...</p>
    </div>
    
    <script>
        (async function() {
            const statusEl = document.getElementById('status');
            let cleared = false;
            
            try {
                // Clear service workers
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (let registration of registrations) {
                        await registration.unregister();
                        console.log('Unregistered service worker:', registration.scope);
                    }
                }
                
                // Clear all caches
                if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    await Promise.all(
                        cacheNames.map(cacheName => {
                            console.log('Deleting cache:', cacheName);
                            return caches.delete(cacheName);
                        })
                    );
                }
                
                // Clear storage
                try {
                    localStorage.clear();
                    sessionStorage.clear();
                } catch (e) {
                    console.warn('Could not clear storage:', e);
                }
                
                cleared = true;
                statusEl.innerHTML = '<span class="success">✅ All caches cleared successfully!</span>';
                
                // Auto-close after success
                setTimeout(() => {
                    if (window.location.port === '3000' || window.location.port === '3001' || window.location.port === '3002') {
                        window.close();
                    }
                }, 1500);
                
            } catch (error) {
                console.error('Error clearing caches:', error);
                statusEl.innerHTML = '<span class="error">❌ Error clearing caches. Please clear manually in DevTools.</span>';
            }
            
            // Send message to parent if in iframe
            if (window.parent !== window) {
                window.parent.postMessage({ type: 'cache-cleared', success: cleared }, '*');
            }
        })();
    </script>
</body>
</html>`;

// Write the temporary clear cache HTML
const clearCacheHtmlPath = path.join(__dirname, '..', 'public', '_dev-clear-cache.html');
fs.writeFileSync(clearCacheHtmlPath, clearBrowserCacheHTML);

// Function to clean up the temporary file
const cleanupTempFile = () => {
  if (fs.existsSync(clearCacheHtmlPath)) {
    fs.unlinkSync(clearCacheHtmlPath);
  }
};

// Clean up on exit
process.on('exit', cleanupTempFile);
process.on('SIGINT', () => {
  cleanupTempFile();
  process.exit();
});

console.log('📝 Note: Browser caches will be cleared automatically when the dev server starts.');
console.log('    A temporary page will open and close to clear service workers.\n');