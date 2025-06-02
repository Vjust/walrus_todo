// TodoNFT Service Worker - v1.0.0
// Optimized for Walrus Sites deployment

const CACHE_NAME = 'todonft-v1.0.0';
const STATIC_CACHE = 'todonft-static-v1.0.0';
const DYNAMIC_CACHE = 'todonft-dynamic-v1.0.0';

// Assets to cache immediately
const PRECACHE_ASSETS = [
  '/',
  '/create-nft/',
  '/dashboard/',
  '/nft-gallery/',
  '/nft-demo/',
  '/nft-stats/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Network first strategies for these routes
const NETWORK_FIRST_ROUTES = [
  '/api/',
  '/config/',
];

// Cache first strategies for these assets
const CACHE_FIRST_ASSETS = [
  '.js',
  '.css',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.svg',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('[SW] Install event');
  
  event.waitUntil(
    Promise.all([
      // Precache essential assets
      caches.open(STATIC_CACHE).then(cache => {
        console.log('[SW] Precaching static assets');
        return cache.addAll(PRECACHE_ASSETS);
      }),
      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activate event');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => {
              return cacheName !== STATIC_CACHE && 
                     cacheName !== DYNAMIC_CACHE &&
                     cacheName !== CACHE_NAME;
            })
            .map(cacheName => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      }),
      // Take control of all pages
      self.clients.claim()
    ])
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-HTTP requests
  if (!request.url.startsWith('http')) {
    return;
  }
  
  // Skip Chrome extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Handle different caching strategies
  if (isNetworkFirstRoute(request.url)) {
    event.respondWith(networkFirstStrategy(request));
  } else if (isCacheFirstAsset(request.url)) {
    event.respondWith(cacheFirstStrategy(request));
  } else {
    event.respondWith(staleWhileRevalidateStrategy(request));
  }
});

// Network first strategy (for API calls and dynamic content)
async function networkFirstStrategy(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // If successful, cache the response
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    
    // Fallback to cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If no cache, return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    
    throw error;
  }
}

// Cache first strategy (for static assets)
async function cacheFirstStrategy(request) {
  // Try cache first
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    // If not in cache, fetch from network
    const networkResponse = await fetch(request);
    
    // Cache the response for future use
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Failed to fetch asset:', request.url);
    throw error;
  }
}

// Stale while revalidate strategy (for pages)
async function staleWhileRevalidateStrategy(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  // Fetch in the background
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(error => {
    console.log('[SW] Background fetch failed:', request.url);
    throw error;
  });
  
  // Return cache immediately if available, otherwise wait for network
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    return await fetchPromise;
  } catch (error) {
    // Fallback to offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    throw error;
  }
}

// Helper functions
function isNetworkFirstRoute(url) {
  return NETWORK_FIRST_ROUTES.some(route => url.includes(route));
}

function isCacheFirstAsset(url) {
  return CACHE_FIRST_ASSETS.some(ext => url.includes(ext));
}

// Background sync for offline actions
self.addEventListener('sync', event => {
  if (event.tag === 'todo-sync') {
    event.waitUntil(syncTodos());
  }
});

async function syncTodos() {
  // Implement background sync for todos created while offline
  console.log('[SW] Syncing todos...');
  
  try {
    // Get pending todos from IndexedDB
    const pendingTodos = await getPendingTodos();
    
    if (pendingTodos.length > 0) {
      console.log(`[SW] Found ${pendingTodos.length} pending todos to sync`);
      
      // Sync each todo
      for (const todo of pendingTodos) {
        try {
          await syncTodo(todo);
        } catch (error) {
          console.error('[SW] Failed to sync todo:', todo.id, error);
        }
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

async function getPendingTodos() {
  // This would integrate with your IndexedDB implementation
  return [];
}

async function syncTodo(todo) {
  // This would sync the todo with your backend/blockchain
  console.log('[SW] Syncing todo:', todo.id);
}

// Push notifications
self.addEventListener('push', event => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: data.primaryKey,
    },
    actions: [
      {
        action: 'explore',
        title: 'View TodoNFT',
        icon: '/icons/view-icon.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/close-icon.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('TodoNFT', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/nft-gallery/')
    );
  } else if (event.action === 'close') {
    // Just close the notification
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

console.log('[SW] TodoNFT Service Worker loaded successfully');