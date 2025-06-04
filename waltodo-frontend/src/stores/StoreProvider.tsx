'use client';

import { useEffect, useRef } from 'react';
import { useAppStore, useTodoStore, useUIStore, useWalletStore } from './index';
import { detectEnvironment, manageTodoCache, updateMemoryUsage } from './index';

/**
 * Store initialization and hydration provider
 * This component handles SSR-safe store initialization and ongoing management
 */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false);
  const intervalRefs = useRef<NodeJS.Timeout[]>([]);
  
  useEffect(() => {
    if (initialized.current || typeof window === 'undefined') {return;}
    
    console.log('🏪 Initializing Zustand stores...');
    
    // Initialize app store first
    const appActions = useAppStore.getState();
    
    // Detect and set environment
    const env = detectEnvironment();
    appActions.setEnvironment(env);
    
    // Hydrate all stores
    try {
      useAppStore.persist.rehydrate();
      useUIStore.persist.rehydrate();
      useWalletStore.persist.rehydrate();
      useTodoStore.persist.rehydrate();
      
      console.log('✅ Store hydration completed');
    } catch (error) {
      console.warn('⚠️ Store hydration failed:', error);
    }
    
    // Mark as hydrated and initialized
    appActions.setHydrated(true);
    appActions.setInitialized(true);
    
    // Set up performance monitoring
    const performanceInterval = setInterval(() => {
      updateMemoryUsage();
    }, 30000); // Every 30 seconds
    intervalRefs.current.push(performanceInterval);
    
    // Set up cache management
    const cacheInterval = setInterval(() => {
      manageTodoCache();
    }, 60 * 60 * 1000); // Every hour
    intervalRefs.current.push(cacheInterval);
    
    // Set up session timeout checking for wallet
    const sessionInterval = setInterval(() => {
      const walletState = useWalletStore.getState();
      if (walletState.connection.status === 'connected') {
        const timeSinceActivity = Date.now() - walletState.session.lastActivity;
        const warningTime = (walletState.session.autoDisconnectTime || 30 * 60 * 1000) - 5 * 60 * 1000;
        
        if (timeSinceActivity >= warningTime && !walletState.session.timeoutWarning) {
          walletState.setTimeoutWarning(true);
        }
        
        if (timeSinceActivity >= (walletState.session.autoDisconnectTime || 30 * 60 * 1000)) {
          walletState.setSessionExpired(true);
        }
      }
    }, 60000); // Every minute
    intervalRefs.current.push(sessionInterval);
    
    // Set up network health monitoring
    const networkInterval = setInterval(async () => {
      const { updateNetworkStatus } = useAppStore.getState();
      
      // Check different services with appropriate endpoints
      const checks = [
        { service: 'sui' as const, url: 'https://fullnode.testnet.sui.io' },
        { service: 'walrus' as const, url: 'https://publisher.walrus-testnet.walrus.space' },
        { service: 'api' as const, url: `${window.location.origin  }/api/health` },
      ];
      
      for (const { service, url } of checks) {
        try {
          const start = performance.now();
          const response = await fetch(url, { 
            method: 'HEAD', 
            cache: 'no-cache',
            signal: AbortSignal.timeout(5000)
          });
          const latency = performance.now() - start;
          const status = response.ok ? 'healthy' : 'degraded';
          
          updateNetworkStatus(service, status, latency);
        } catch (error) {
          updateNetworkStatus(service, 'offline', 0);
        }
      }
    }, 2 * 60 * 1000); // Every 2 minutes
    intervalRefs.current.push(networkInterval);
    
    // Set up activity tracking for wallet
    const trackActivity = () => {
      const walletState = useWalletStore.getState();
      if (walletState.connection.status === 'connected') {
        walletState.updateActivity();
      }
    };
    
    // Track user activity
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      document.addEventListener(event, trackActivity, { passive: true });
    });
    
    // Cleanup function
    const cleanup = () => {
      intervalRefs.current.forEach(interval => clearInterval(interval));
      intervalRefs.current = [];
      
      activityEvents.forEach(event => {
        document.removeEventListener(event, trackActivity);
      });
    };
    
    initialized.current = true;
    
    return cleanup;
  }, []);
  
  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      intervalRefs.current.forEach(interval => clearInterval(interval));
    };
  }, []);
  
  return <>{children}</>;
}

/**
 * Hook to check if stores are ready
 */
export function useStoresReady() {
  const initialized = useAppStore(state => state.initialized);
  const hydrated = useAppStore(state => state.hydrated);
  
  return {
    ready: initialized && hydrated,
    initialized,
    hydrated,
  };
}

/**
 * Hook for development utilities
 */
export function useStoreDevtools() {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  return {
    exportLogs: async () => {
      try {
        const { debugStores } = await import('./middleware/logger');
        return debugStores.exportLogs();
      } catch (error) {
        console.warn('Failed to load logger middleware:', error);
        return [];
      }
    },
    clearLogs: async () => {
      try {
        const { debugStores } = await import('./middleware/logger');
        debugStores.clearLogs();
      } catch (error) {
        console.warn('Failed to load logger middleware:', error);
      }
    },
    getStats: async () => {
      try {
        const { debugStores } = await import('./middleware/logger');
        return debugStores.getStats();
      } catch (error) {
        console.warn('Failed to load logger middleware:', error);
        return {};
      }
    },
    stores: {
      app: useAppStore.getState(),
      ui: useUIStore.getState(),
      wallet: useWalletStore.getState(),
      todos: useTodoStore.getState(),
    },
  };
}

/**
 * Debug component for development
 */
export function StoreDebugPanel() {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  const devtools = useStoreDevtools();
  const { ready, initialized, hydrated } = useStoresReady();
  
  if (!devtools) {return null;}
  
  return (
    <div 
      style={{
        position: 'fixed',
        bottom: 0,
        right: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '10px',
        fontSize: '12px',
        zIndex: 9999,
        borderTopLeftRadius: '8px',
        maxWidth: '300px',
      }}
    >
      <div><strong>Store Status:</strong></div>
      <div>Ready: {ready ? '✅' : '❌'}</div>
      <div>Initialized: {initialized ? '✅' : '❌'}</div>
      <div>Hydrated: {hydrated ? '✅' : '❌'}</div>
      
      <div style={{ marginTop: '10px' }}>
        <button 
          onClick={() => console.log('Store Stats:', devtools.getStats())}
          style={{ marginRight: '5px', fontSize: '10px' }}
        >
          Log Stats
        </button>
        <button 
          onClick={() => console.log('Store Data:', devtools.stores)}
          style={{ marginRight: '5px', fontSize: '10px' }}
        >
          Log Stores
        </button>
        <button 
          onClick={devtools.clearLogs}
          style={{ fontSize: '10px' }}
        >
          Clear Logs
        </button>
      </div>
    </div>
  );
}