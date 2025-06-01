// Advanced Service Worker for WalTodo with Intelligent Content Delivery
// Version: 2.0.0 - Content Delivery Optimization

const CACHE_VERSION = '2.0.0';
const CACHE_NAME = `waltodo-v${CACHE_VERSION}`;
const STATIC_CACHE_NAME = `waltodo-static-v${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `waltodo-dynamic-v${CACHE_VERSION}`;
const WALRUS_CACHE_NAME = `waltodo-walrus-v${CACHE_VERSION}`;
const IMAGE_CACHE_NAME = `waltodo-images-v${CACHE_VERSION}`;
const API_CACHE_NAME = `waltodo-api-v${CACHE_VERSION}`;

// Cache configuration with TTL strategies
const CACHE_CONFIG = {
  static: {
    ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxEntries: 100
  },
  dynamic: {
    ttl: 1 * 60 * 60 * 1000, // 1 hour
    maxEntries: 50
  },
  walrus: {
    ttl: 30 * 24 * 60 * 60 * 1000, // 30 days (immutable content)
    maxEntries: 500
  },
  images: {
    ttl: 14 * 24 * 60 * 60 * 1000, // 14 days
    maxEntries: 200
  },
  api: {
    ttl: 5 * 60 * 1000, // 5 minutes
    maxEntries: 50
  }
};

// Performance monitoring
const PERFORMANCE_METRICS = {
  cacheHits: 0,
  cacheMisses: 0,
  networkRequests: 0,
  walrusRequests: 0,
  preloadedAssets: 0,
  backgroundRefreshes: 0,
  fallbackUsed: 0
};

// Critical assets to cache immediately with intelligent preloading
const CRITICAL_ASSETS = [
  '/',
  '/dashboard',
  '/nfts',
  '/manifest.json',
  '/favicon.ico',
  '/images/ocean-wave.svg',
  '/offline.html'
];

// Assets to preload based on usage patterns
const PRELOAD_PATTERNS = [
  /_next\/static\/css\/.*\.css$/,
  /_next\/static\/js\/.*\.js$/,
  /\/icons\/.*\.(png|svg|ico)$/,
  /\/images\/.*\.(png|jpg|jpeg|svg|webp)$/
];

// Walrus content patterns for intelligent caching
const WALRUS_PATTERNS = [
  /https:\/\/.*walrus.*\/v1\//,
  /\/walrus\//,
  /blob_id=/
];

// Content types that should be cached differently
const CONTENT_TYPE_STRATEGIES = {
  'application/json': 'networkFirst',
  'text/html': 'staleWhileRevalidate',
  'text/css': 'cacheFirst',
  'application/javascript': 'cacheFirst',
  'image/': 'cacheFirst',
  'font/': 'cacheFirst'
};

// Install event - intelligent asset caching with preloading
self.addEventListener('install', (event) => {
  console.log('[SW] Installing version', CACHE_VERSION);
  
  event.waitUntil(
    Promise.all([
      // Cache critical assets immediately
      caches.open(STATIC_CACHE_NAME).then(async (cache) => {
        console.log('[SW] Caching critical assets');
        const assetsToCache = CRITICAL_ASSETS.filter(asset => !asset.includes('_next'));
        
        // Add assets one by one to handle failures gracefully
        const results = await Promise.allSettled(
          assetsToCache.map(asset => 
            fetch(asset)
              .then(response => response.ok ? cache.put(asset, response) : null)
              .catch(() => null)
          )
        );
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        console.log(`[SW] Cached ${successful}/${assetsToCache.length} critical assets`);
        
        PERFORMANCE_METRICS.preloadedAssets = successful;
        return cache;
      }),
      
      // Initialize performance tracking
      initializePerformanceTracking(),
      
      // Set up cache cleanup
      scheduleInitialCleanup()
    ])
  );
  
  self.skipWaiting();
});

// Activate event - intelligent cache cleanup and migration
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating version', CACHE_VERSION);
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches with migration support
      caches.keys().then(async (cacheNames) => {
        const currentCaches = [
          CACHE_NAME,
          STATIC_CACHE_NAME, 
          DYNAMIC_CACHE_NAME,
          WALRUS_CACHE_NAME,
          IMAGE_CACHE_NAME,
          API_CACHE_NAME
        ];
        
        const deletionPromises = cacheNames
          .filter(cacheName => !currentCaches.includes(cacheName))
          .map(async (cacheName) => {
            console.log('[SW] Deleting old cache:', cacheName);
            
            // Try to migrate useful content before deletion
            if (cacheName.includes('walrus') && cacheName !== WALRUS_CACHE_NAME) {
              await migrateWalrusCache(cacheName);
            }
            
            return caches.delete(cacheName);
          });
        
        await Promise.all(deletionPromises);
        console.log(`[SW] Cleaned up ${deletionPromises.length} old caches`);
      }),
      
      // Initialize cache headers and metadata
      initializeCacheMetadata(),
      
      // Start background preloading
      startBackgroundPreloading()
    ])
  );
  
  self.clients.claim();
});

// Fetch event - advanced caching strategies with intelligent routing
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip non-HTTP protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Track request for analytics
  PERFORMANCE_METRICS.networkRequests++;
  
  // Route to appropriate caching strategy
  const strategy = determineStrategy(request, url);
  
  switch (strategy) {
    case 'walrus':
      PERFORMANCE_METRICS.walrusRequests++;
      event.respondWith(handleWalrusContent(request));
      break;
      
    case 'static':
      event.respondWith(cacheFirst(request, STATIC_CACHE_NAME));
      break;
      
    case 'image':
      event.respondWith(handleImageContent(request));
      break;
      
    case 'api':
      event.respondWith(handleApiContent(request));
      break;
      
    case 'html':
      event.respondWith(staleWhileRevalidate(request));
      break;
      
    case 'dynamic':
      event.respondWith(networkFirst(request, DYNAMIC_CACHE_NAME));
      break;
      
    default:
      event.respondWith(networkFirst(request));
  }
});

// Strategy determination based on request characteristics
function determineStrategy(request, url) {
  // Walrus content detection
  if (WALRUS_PATTERNS.some(pattern => pattern.test(url.href))) {
    return 'walrus';
  }
  
  // Static assets (JS, CSS, fonts)
  if (url.pathname.startsWith('/_next/static/') || 
      url.pathname.match(/\.(js|css|woff2?|ttf|eot)$/)) {
    return 'static';
  }
  
  // Images
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|avif)$/)) {
    return 'image';
  }
  
  // API endpoints
  if (url.pathname.startsWith('/api/') || 
      url.pathname.includes('/v1/') || 
      request.headers.get('accept')?.includes('application/json')) {
    return 'api';
  }
  
  // HTML pages
  if (request.headers.get('accept')?.includes('text/html')) {
    return 'html';
  }
  
  return 'dynamic';
}

// Helper functions for cache management
function getCacheConfig(cacheName) {
  if (cacheName.includes('static')) return CACHE_CONFIG.static;
  if (cacheName.includes('walrus')) return CACHE_CONFIG.walrus;
  if (cacheName.includes('images')) return CACHE_CONFIG.images;
  if (cacheName.includes('api')) return CACHE_CONFIG.api;
  return CACHE_CONFIG.dynamic;
}

function addCacheHeaders(response, cacheStatus) {
  const headers = new Headers(response.headers);
  headers.set('X-Cache-Status', cacheStatus);
  headers.set('X-Cache-Version', CACHE_VERSION);
  headers.set('X-SW-Cache-Date', new Date().toISOString());
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function refreshCacheInBackground(request, cache) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const headers = new Headers(response.headers);
      headers.set('sw-cached-date', Date.now().toString());
      headers.set('sw-cache-version', CACHE_VERSION);
      
      const modifiedResponse = new Response(await response.clone().arrayBuffer(), {
        status: response.status,
        statusText: response.statusText,
        headers
      });
      
      await cache.put(request, modifiedResponse);
      PERFORMANCE_METRICS.backgroundRefreshes++;
    }
  } catch (error) {
    console.error('[SW] Background refresh failed:', error);
  }
}

async function enforceMaxEntries(cache, cacheName) {
  const config = getCacheConfig(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > config.maxEntries) {
    // Remove oldest entries
    const entriesToDelete = keys.length - config.maxEntries;
    for (let i = 0; i < entriesToDelete; i++) {
      await cache.delete(keys[i]);
    }
  }
}

async function findFallbackResponse(request) {
  const cacheNames = await caches.keys();
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const response = await cache.match(request);
    if (response) {
      PERFORMANCE_METRICS.fallbackUsed++;
      return response;
    }
  }
  
  return null;
}

// Enhanced cache first strategy with TTL and versioning
async function cacheFirst(request, cacheName = STATIC_CACHE_NAME) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // Check TTL if metadata exists
    const cacheDate = cachedResponse.headers.get('sw-cached-date');
    if (cacheDate) {
      const config = getCacheConfig(cacheName);
      const age = Date.now() - parseInt(cacheDate);
      
      if (age > config.ttl) {
        console.log('[SW] Cache expired for:', request.url);
        // Background refresh while serving stale content
        refreshCacheInBackground(request, cache);
      }
    }
    
    PERFORMANCE_METRICS.cacheHits++;
    return addCacheHeaders(cachedResponse, 'HIT');
  }
  
  PERFORMANCE_METRICS.cacheMisses++;
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      
      // Add cache metadata
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cached-date', Date.now().toString());
      headers.set('sw-cache-version', CACHE_VERSION);
      
      const modifiedResponse = new Response(await responseToCache.arrayBuffer(), {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers
      });
      
      await cache.put(request, modifiedResponse);
      await enforceMaxEntries(cache, cacheName);
    }
    return addCacheHeaders(networkResponse, 'MISS');
  } catch (error) {
    console.error('[SW] Fetch failed:', error);
    
    // Try to serve from other caches as fallback
    const fallbackResponse = await findFallbackResponse(request);
    if (fallbackResponse) {
      return addCacheHeaders(fallbackResponse, 'FALLBACK');
    }
    
    return new Response('Network error', { 
      status: 408, 
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Stale while revalidate strategy
async function staleWhileRevalidate(request, cacheName = DYNAMIC_CACHE_NAME) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  // Always try to fetch fresh content in background
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      const headers = new Headers(response.headers);
      headers.set('sw-cached-date', Date.now().toString());
      headers.set('sw-cache-version', CACHE_VERSION);
      
      cache.put(request, new Response(response.clone().body, {
        status: response.status,
        statusText: response.statusText,
        headers
      }));
    }
    return response;
  }).catch(() => null);
  
  // Return cached version immediately if available
  if (cachedResponse) {
    PERFORMANCE_METRICS.cacheHits++;
    // Don't wait for background fetch
    fetchPromise.catch(() => {});
    return addCacheHeaders(cachedResponse, 'STALE');
  }
  
  // No cache available, wait for network
  PERFORMANCE_METRICS.cacheMisses++;
  const networkResponse = await fetchPromise;
  
  if (networkResponse) {
    return addCacheHeaders(networkResponse, 'FRESH');
  }
  
  return new Response('Content not available', { status: 503 });
}

// Enhanced network first strategy
async function networkFirst(request, cacheName = DYNAMIC_CACHE_NAME) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      const headers = new Headers(networkResponse.headers);
      headers.set('sw-cached-date', Date.now().toString());
      headers.set('sw-cache-version', CACHE_VERSION);
      
      const modifiedResponse = new Response(await networkResponse.clone().arrayBuffer(), {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers
      });
      
      cache.put(request, modifiedResponse);
      await enforceMaxEntries(cache, cacheName);
    }
    
    return addCacheHeaders(networkResponse, 'FRESH');
  } catch (error) {
    console.error('[SW] Network first failed:', error);
    
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      PERFORMANCE_METRICS.fallbackUsed++;
      return addCacheHeaders(cachedResponse, 'FALLBACK');
    }

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const cache = await caches.open(STATIC_CACHE_NAME);
      const offlinePage = await cache.match('/offline.html');
      if (offlinePage) {
        return addCacheHeaders(offlinePage, 'OFFLINE');
      }
    }

    return new Response('Network error', { status: 503 });
  }
}

// Specialized image content handler
async function handleImageContent(request) {
  const cache = await caches.open(IMAGE_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    const cacheDate = cachedResponse.headers.get('sw-cached-date');
    if (cacheDate) {
      const age = Date.now() - parseInt(cacheDate);
      const config = getCacheConfig(IMAGE_CACHE_NAME);
      
      // Images are cached for longer periods
      if (age <= config.ttl) {
        PERFORMANCE_METRICS.cacheHits++;
        return addCacheHeaders(cachedResponse, 'HIT');
      }
    }
  }
  
  // Use cache-first with background refresh for images
  return cacheFirst(request, IMAGE_CACHE_NAME);
}

// API content handler with short TTL
async function handleApiContent(request) {
  const cache = await caches.open(API_CACHE_NAME);
  
  try {
    // Network first for API calls
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const headers = new Headers(networkResponse.headers);
      headers.set('sw-cached-date', Date.now().toString());
      headers.set('sw-cache-version', CACHE_VERSION);
      
      const modifiedResponse = new Response(await networkResponse.clone().arrayBuffer(), {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers
      });
      
      // Only cache successful API responses
      if (networkResponse.status < 400) {
        cache.put(request, modifiedResponse);
        await enforceMaxEntries(cache, API_CACHE_NAME);
      }
    }
    
    return addCacheHeaders(networkResponse, 'FRESH');
  } catch (error) {
    // Fallback to cache for API calls
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      const cacheDate = cachedResponse.headers.get('sw-cached-date');
      if (cacheDate) {
        const age = Date.now() - parseInt(cacheDate);
        const config = getCacheConfig(API_CACHE_NAME);
        
        // Only serve stale API responses for a short time
        if (age <= config.ttl) {
          PERFORMANCE_METRICS.fallbackUsed++;
          return addCacheHeaders(cachedResponse, 'STALE');
        }
      }
    }
    
    return new Response('API unavailable', { 
      status: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Service temporarily unavailable' })
    });
  }
}

// Enhanced Walrus content handler with intelligent caching
async function handleWalrusContent(request) {
  const url = new URL(request.url);
  const blobId = extractBlobId(url.pathname);
  
  if (!blobId) {
    return networkFirst(request);
  }

  // Try IndexedDB cache first (persistent across SW updates)
  try {
    const db = await openWalrusCache();
    const tx = db.transaction('cache', 'readonly');
    const store = tx.objectStore('cache');
    const cached = await store.get(blobId);
    
    if (cached) {
      // Check if cache is still valid
      const age = Date.now() - cached.timestamp;
      const config = getCacheConfig(WALRUS_CACHE_NAME);
      
      if (age <= config.ttl) {
        // Convert base64 back to blob
        const binaryString = atob(cached.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        PERFORMANCE_METRICS.cacheHits++;
        
        return new Response(bytes, {
          status: 200,
          headers: {
            'Content-Type': cached.contentType || 'application/octet-stream',
            'X-Cache-Status': 'HIT-IDB',
            'X-Cache-Version': CACHE_VERSION,
            'Cache-Control': 'public, max-age=2592000' // 30 days
          },
        });
      }
    }
  } catch (error) {
    console.warn('[SW] IndexedDB cache read failed:', error);
  }

  // Try network fetch
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful Walrus responses in IndexedDB
      cacheWalrusResponse(blobId, networkResponse.clone()).catch(console.error);
      
      return new Response(networkResponse.body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: new Headers({
          ...networkResponse.headers,
          'X-Cache-Status': 'MISS',
          'X-Cache-Version': CACHE_VERSION
        })
      });
    }
  } catch (error) {
    console.error('[SW] Walrus network fetch failed:', error);
  }

  // No cache or network available
  PERFORMANCE_METRICS.cacheMisses++;
  return new Response('Walrus content not available offline', { 
    status: 503,
    headers: { 'Content-Type': 'text/plain' }
  });
}

// Cache Walrus response in IndexedDB
async function cacheWalrusResponse(blobId, response) {
  try {
    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
    const db = await openWalrusCache();
    const tx = db.transaction('cache', 'readwrite');
    const store = tx.objectStore('cache');
    
    const cacheEntry = {
      id: blobId,
      data: base64,
      contentType: response.headers.get('content-type') || 'application/octet-stream',
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      size: arrayBuffer.byteLength
    };
    
    await store.put(cacheEntry);
    
    // Cleanup old entries if needed
    await cleanupWalrusCache(store);
    
  } catch (error) {
    console.error('[SW] Failed to cache Walrus response:', error);
  }
}

// Cleanup old Walrus cache entries
async function cleanupWalrusCache(store) {
  const config = getCacheConfig(WALRUS_CACHE_NAME);
  const allEntries = await store.getAll();
  
  if (allEntries.length > config.maxEntries) {
    // Sort by last accessed time
    allEntries.sort((a, b) => a.lastAccessed - b.lastAccessed);
    
    // Remove oldest entries
    const toDelete = allEntries.slice(0, allEntries.length - config.maxEntries);
    for (const entry of toDelete) {
      await store.delete(entry.id);
    }
  }
}

// Initialize performance tracking
async function initializePerformanceTracking() {
  // Store performance metrics in IndexedDB
  try {
    const db = await openPerformanceDB();
    const tx = db.transaction('metrics', 'readwrite');
    const store = tx.objectStore('metrics');
    
    await store.put({
      id: 'session-start',
      timestamp: Date.now(),
      version: CACHE_VERSION,
      metrics: { ...PERFORMANCE_METRICS }
    });
  } catch (error) {
    console.error('[SW] Failed to initialize performance tracking:', error);
  }
}

// Schedule initial cleanup
async function scheduleInitialCleanup() {
  // Clean up expired cache entries on activation
  setTimeout(async () => {
    try {
      await cleanupExpiredCaches();
      console.log('[SW] Initial cache cleanup completed');
    } catch (error) {
      console.error('[SW] Initial cleanup failed:', error);
    }
  }, 5000); // Wait 5 seconds after activation
}

// Migrate Walrus cache from old version
async function migrateWalrusCache(oldCacheName) {
  try {
    const oldCache = await caches.open(oldCacheName);
    const newCache = await caches.open(WALRUS_CACHE_NAME);
    const keys = await oldCache.keys();
    
    let migrated = 0;
    for (const request of keys) {
      const response = await oldCache.match(request);
      if (response) {
        await newCache.put(request, response);
        migrated++;
      }
    }
    
    console.log(`[SW] Migrated ${migrated} Walrus cache entries`);
  } catch (error) {
    console.error('[SW] Cache migration failed:', error);
  }
}

// Initialize cache metadata
async function initializeCacheMetadata() {
  // Set up cache metadata for monitoring
  const cacheNames = [STATIC_CACHE_NAME, DYNAMIC_CACHE_NAME, WALRUS_CACHE_NAME, IMAGE_CACHE_NAME, API_CACHE_NAME];
  
  for (const cacheName of cacheNames) {
    try {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      console.log(`[SW] Cache ${cacheName}: ${keys.length} entries`);
    } catch (error) {
      console.error(`[SW] Failed to initialize cache ${cacheName}:`, error);
    }
  }
}

// Start background preloading
async function startBackgroundPreloading() {
  // Preload critical assets that match patterns
  setTimeout(async () => {
    try {
      await preloadCriticalAssets();
      console.log('[SW] Background preloading completed');
    } catch (error) {
      console.error('[SW] Background preloading failed:', error);
    }
  }, 10000); // Start preloading 10 seconds after activation
}

// Preload critical assets
async function preloadCriticalAssets() {
  const cache = await caches.open(STATIC_CACHE_NAME);
  
  // Get list of assets from the current page
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    try {
      // Send message to client to get critical resources
      client.postMessage({
        type: 'REQUEST_CRITICAL_RESOURCES'
      });
    } catch (error) {
      console.error('[SW] Failed to request critical resources:', error);
    }
  }
}

// Clean up expired caches
async function cleanupExpiredCaches() {
  const cacheNames = await caches.keys();
  
  for (const cacheName of cacheNames) {
    try {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      
      let cleaned = 0;
      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          const cacheDate = response.headers.get('sw-cached-date');
          if (cacheDate) {
            const age = Date.now() - parseInt(cacheDate);
            const config = getCacheConfig(cacheName);
            
            if (age > config.ttl) {
              await cache.delete(request);
              cleaned++;
            }
          }
        }
      }
      
      if (cleaned > 0) {
        console.log(`[SW] Cleaned ${cleaned} expired entries from ${cacheName}`);
      }
    } catch (error) {
      console.error(`[SW] Cleanup failed for ${cacheName}:`, error);
    }
  }
}

// Extract blob ID from Walrus URL path
function extractBlobId(pathname) {
  const match = pathname.match(/\/v1\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// Open Walrus cache database
function openWalrusCache() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('walrus-cache', 2);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create cache store
      if (!db.objectStoreNames.contains('cache')) {
        const cacheStore = db.createObjectStore('cache', { keyPath: 'id' });
        cacheStore.createIndex('by-timestamp', 'timestamp', { unique: false });
        cacheStore.createIndex('by-last-accessed', 'lastAccessed', { unique: false });
      }
      
      // Create metadata store
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' });
      }
    };
  });
}

// Open performance database
function openPerformanceDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('sw-performance', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('metrics')) {
        const metricsStore = db.createObjectStore('metrics', { keyPath: 'id' });
        metricsStore.createIndex('by-timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// Background sync for offline operations
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-performance') {
    event.waitUntil(syncPerformanceMetrics());
  } else if (event.tag === 'sync-cache-cleanup') {
    event.waitUntil(cleanupExpiredCaches());
  }
});

async function syncPerformanceMetrics() {
  try {
    const db = await openPerformanceDB();
    const tx = db.transaction('metrics', 'readwrite');
    const store = tx.objectStore('metrics');
    
    await store.put({
      id: `metrics-${Date.now()}`,
      timestamp: Date.now(),
      version: CACHE_VERSION,
      metrics: { ...PERFORMANCE_METRICS }
    });
    
    console.log('[SW] Performance metrics synced');
  } catch (error) {
    console.error('[SW] Performance sync failed:', error);
  }
}

// Message handling for client communication
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'GET_PERFORMANCE_METRICS':
      event.ports[0].postMessage({
        type: 'PERFORMANCE_METRICS',
        data: PERFORMANCE_METRICS
      });
      break;
      
    case 'PRELOAD_ASSETS':
      if (data && Array.isArray(data.urls)) {
        preloadAssets(data.urls).then(() => {
          event.ports[0].postMessage({
            type: 'PRELOAD_COMPLETE',
            data: { success: true }
          });
        }).catch(error => {
          event.ports[0].postMessage({
            type: 'PRELOAD_COMPLETE',
            data: { success: false, error: error.message }
          });
        });
      }
      break;
      
    case 'CLEAR_CACHE':
      if (data && data.cacheName) {
        clearSpecificCache(data.cacheName).then(() => {
          event.ports[0].postMessage({
            type: 'CACHE_CLEARED',
            data: { success: true }
          });
        });
      }
      break;
  }
});

// Preload specific assets
async function preloadAssets(urls) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
          PERFORMANCE_METRICS.preloadedAssets++;
        }
      } catch (error) {
        console.error('[SW] Preload failed for:', url, error);
      }
    })
  );
  
  const successful = results.filter(r => r.status === 'fulfilled').length;
  console.log(`[SW] Preloaded ${successful}/${urls.length} assets`);
}

// Clear specific cache
async function clearSpecificCache(cacheName) {
  try {
    const success = await caches.delete(cacheName);
    console.log(`[SW] Cache ${cacheName} cleared:`, success);
    return success;
  } catch (error) {
    console.error(`[SW] Failed to clear cache ${cacheName}:`, error);
    return false;
  }
}

// Periodic cleanup scheduler
setInterval(() => {
  cleanupExpiredCaches().catch(console.error);
}, 60 * 60 * 1000); // Run every hour

// Performance metrics reporting
setInterval(() => {
  console.log('[SW] Performance Metrics:', PERFORMANCE_METRICS);
}, 5 * 60 * 1000); // Log every 5 minutes

console.log('[SW] Advanced Service Worker loaded with version', CACHE_VERSION);