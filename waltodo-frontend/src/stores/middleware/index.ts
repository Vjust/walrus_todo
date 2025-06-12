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
  enableDevtools: process.env?.NODE_ENV === 'development',
  enablePersistence: true,
  enableLogging: process.env?.NODE_ENV === 'development',
  enableSubscriptions: true,
  enableImmer: true,
} as const;

/**
 * Middleware factory for creating stores with consistent configuration
 */
export const createStoreWithMiddleware = async <T>(
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
  
  try {
    // Apply middleware in reverse order (innermost first)
    if (options.immer !== false && defaultMiddleware.enableImmer) {
      const { immer } = await import('zustand/middleware/immer');
      config = immer(config as any);
    }
    
    if (options.logger !== false && defaultMiddleware.enableLogging) {
      const { logger } = await import('./logger');
      config = logger(name, config);
    }
    
    if (options.subscriptions !== false && defaultMiddleware.enableSubscriptions) {
      const { subscribeWithSelector } = await import('zustand/middleware');
      config = subscribeWithSelector(config as any);
    }
    
    if (options.persist !== false && defaultMiddleware.enablePersistence) {
      const [
        { persist },
        { defaultStorageConfig, persistSelectors, storageKeys }
      ] = await Promise.all([
        import('zustand/middleware'),
        import('./persist')
      ]);
      
      const storeName = name.toLowerCase().replace(/\s+/g, '-');
      const persistConfig = {
        name: storageKeys[storeName as keyof typeof storageKeys] || `waltodo-${storeName}`,
        ...defaultStorageConfig,
        partialize: persistSelectors[storeName as keyof typeof persistSelectors] || ((state: any) => state),
      };
      
      config = persist(config, persistConfig);
    }
    
    if (options.devtools !== false && defaultMiddleware.enableDevtools) {
      const [
        { devtools },
        { storeNames }
      ] = await Promise.all([
        import('zustand/middleware'),
        import('./devtools')
      ]);
      
      config = devtools(config, {
        name: storeNames[name as keyof typeof storeNames] || name,
        enabled: process.env?.NODE_ENV === 'development',
      });
    }
  } catch (error) {
    console.warn('Failed to apply middleware:', error);
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
export const initializeStores = async () => {
  if (typeof window !== 'undefined') {
    try {
      // Import hydration functions
      const { hydrateAllStores } = await import('../index');
      
      // Hydrate all stores
      await hydrateAllStores();
      
      // Initialize environment detection
      const { detectEnvironment, useAppStore } = await import('../app-store');
      
      const env = detectEnvironment();
      useAppStore.getState().setEnvironment(env as any);
      useAppStore.getState().setInitialized(true as any);
      
      console.log('🏪 All Zustand stores initialized');
    } catch (error) {
      console.warn('Failed to initialize stores:', error);
    }
  }
};