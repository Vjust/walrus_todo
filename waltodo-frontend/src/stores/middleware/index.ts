/**
 * Middleware exports for Zustand stores
 */

export * from './persist';
export * from './devtools';
export * from './logger';

// Re-export commonly used middleware from zustand
export { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
export { immer } from 'zustand/middleware/immer';

/**
 * Default middleware configuration for new stores
 */
export const defaultMiddleware = {
  enableDevtools: process.env.NODE_ENV === 'development',
  enablePersistence: true,
  enableLogging: process.env.NODE_ENV === 'development',
  enableSubscriptions: true,
  enableImmer: true,
} as const;

/**
 * Middleware factory for creating stores with consistent configuration
 */
export const createStoreWithMiddleware = <T>(
  name: string,
  storeConfig: any,
  options: {
    persist?: boolean;
    devtools?: boolean;
    logger?: boolean;
    subscriptions?: boolean;
    immer?: boolean;
  } = {}
) => {
  let config = storeConfig;
  
  // Apply middleware in reverse order (innermost first)
  if (options.immer !== false && defaultMiddleware.enableImmer) {
    const { immer } = require('zustand/middleware/immer');
    config = immer(config);
  }
  
  if (options.logger !== false && defaultMiddleware.enableLogging) {
    const { logger } = require('./logger');
    config = logger(name, config);
  }
  
  if (options.subscriptions !== false && defaultMiddleware.enableSubscriptions) {
    const { subscribeWithSelector } = require('zustand/middleware');
    config = subscribeWithSelector(config);
  }
  
  if (options.persist !== false && defaultMiddleware.enablePersistence) {
    const { persist } = require('zustand/middleware');
    const { defaultStorageConfig, persistSelectors, storageKeys } = require('./persist');
    
    const storeName = name.toLowerCase().replace(/\s+/g, '-');
    const persistConfig = {
      name: storageKeys[storeName as keyof typeof storageKeys] || `waltodo-${storeName}`,
      ...defaultStorageConfig,
      partialize: persistSelectors[storeName as keyof typeof persistSelectors] || ((state: any) => state),
    };
    
    config = persist(config, persistConfig);
  }
  
  if (options.devtools !== false && defaultMiddleware.enableDevtools) {
    const { devtools } = require('zustand/middleware');
    const { storeNames } = require('./devtools');
    
    config = devtools(config, {
      name: storeNames[name as keyof typeof storeNames] || name,
      enabled: process.env.NODE_ENV === 'development',
    });
  }
  
  return config;
};

/**
 * SSR-safe store creation helper
 */
export const createSSRSafeStore = <T>(
  storeCreator: () => T,
  fallbackState?: Partial<T>
): T => {
  if (typeof window === 'undefined') {
    // Return fallback state on server
    return (fallbackState || {}) as T;
  }
  
  return storeCreator();
};

/**
 * Store initialization helper for Next.js apps
 */
export const initializeStores = () => {
  if (typeof window !== 'undefined') {
    // Import hydration functions
    const { hydrateAllStores } = require('../index');
    
    // Hydrate all stores
    hydrateAllStores();
    
    // Initialize environment detection
    const { detectEnvironment } = require('../app-store');
    const { useAppStore } = require('../app-store');
    
    const env = detectEnvironment();
    useAppStore.getState().setEnvironment(env);
    useAppStore.getState().setInitialized(true);
    
    console.log('🏪 All Zustand stores initialized');
  }
};