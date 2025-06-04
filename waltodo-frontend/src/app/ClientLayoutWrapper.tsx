'use client';

import { ReactNode, useEffect } from 'react';

interface ClientLayoutWrapperProps {
  children: ReactNode;
}

export function ClientLayoutWrapper({ children }: ClientLayoutWrapperProps) {
  useEffect(() => {
    // In development, automatically unregister service workers on page load
    if (process.env.NODE_ENV === 'development') {
      // Check URL parameter for cache clear flag
      const urlParams = new URLSearchParams(window.location.search);
      const shouldClear = urlParams.get('clear-cache') === 'true';
      
      if (shouldClear || sessionStorage.getItem('dev-clear-sw') === 'true') {
        // Clear the flag
        sessionStorage.removeItem('dev-clear-sw');
        
        // Remove URL parameter
        if (shouldClear) {
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('clear-cache');
          window.history.replaceState({}, document.title, newUrl.toString());
        }
        
        // Unregister all service workers
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(registrations => {
            registrations.forEach(registration => {
              registration.unregister();
              console.log('[Dev] Unregistered service worker:', registration.scope);
            });
          });
        }
        
        // Clear all caches
        if ('caches' in window) {
          caches.keys().then(cacheNames => {
            cacheNames.forEach(cacheName => {
              caches.delete(cacheName);
              console.log('[Dev] Deleted cache:', cacheName);
            });
          });
        }
      }
    }
    
    // Only register service worker in production
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').then(
        registration => console.log('Service Worker registered:', registration.scope),
        error => console.error('Service Worker registration failed:', error)
      );
    }
  }, []);
  
  return (
    <div>
      {children}
    </div>
  );
}