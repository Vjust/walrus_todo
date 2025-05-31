// Service Worker for WalTodo
// Version: 1.0.0

const CACHE_NAME = 'waltodo-v1';
const STATIC_CACHE_NAME = 'waltodo-static-v1';
const DYNAMIC_CACHE_NAME = 'waltodo-dynamic-v1';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/favicon.ico',
  '/images/ocean-wave.svg',
  '/_next/static/css/',
  '/_next/static/js/',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching static assets');
      return cache.addAll(STATIC_ASSETS.filter(asset => !asset.includes('_next')));
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && 
              cacheName !== STATIC_CACHE_NAME && 
              cacheName !== DYNAMIC_CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // API calls - network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets - cache first
  if (url.pathname.startsWith('/_next/static/') || 
      url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|woff2?)$/)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Walrus content - network with cache fallback
  if (url.hostname.includes('walrus')) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE_NAME));
    return;
  }

  // HTML pages - network first
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Default - network first
  event.respondWith(networkFirst(request));
});

// Cache first strategy
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Fetch failed', error);
    return new Response('Network error', { status: 408 });
  }
}

// Network first strategy
async function networkFirst(request, cacheName = DYNAMIC_CACHE_NAME) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const cache = await caches.open(STATIC_CACHE_NAME);
      return cache.match('/offline.html') || new Response('Offline', { status: 503 });
    }

    return new Response('Network error', { status: 503 });
  }
}

// Background sync for offline todo creation
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-todos') {
    event.waitUntil(syncTodos());
  }
});

async function syncTodos() {
  try {
    // Get pending todos from IndexedDB
    const db = await openDB();
    const tx = db.transaction('pending-todos', 'readonly');
    const store = tx.objectStore('pending-todos');
    const todos = await store.getAll();

    // Send each todo to the server
    for (const todo of todos) {
      try {
        const response = await fetch('/api/v1/todos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(todo),
        });

        if (response.ok) {
          // Remove from pending if successful
          const deleteTx = db.transaction('pending-todos', 'readwrite');
          const deleteStore = deleteTx.objectStore('pending-todos');
          await deleteStore.delete(todo.id);
        }
      } catch (error) {
        console.error('Failed to sync todo:', error);
      }
    }
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

// Simple IndexedDB wrapper
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('waltodo', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending-todos')) {
        db.createObjectStore('pending-todos', { keyPath: 'id' });
      }
    };
  });
}

// Push notification support
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'WalTodo', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});