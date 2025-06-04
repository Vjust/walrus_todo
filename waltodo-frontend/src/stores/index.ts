// Export all Zustand stores
export * from './createTodoNFTStore';
export * from './createTodoStore';
export * from './navbarStore';

// Legacy store with potential naming conflict
export { 
  useTodoListStore,
  TodoListStoreState,
  TodoListStoreActions 
} from './todoListStore';

// New comprehensive stores
export * from './ui-store';
export * from './wallet-store';
export * from './app-store';
export * from './todo-store';

// Type exports for convenience
export type { TodoTemplate } from './createTodoNFTStore';
export type * from './types';

// Middleware exports
export * from './middleware/persist';
export * from './middleware/devtools';
export * from './middleware/logger';

// Performance monitoring
export * from './performance-monitor';

// Store hydration utilities
export { hydrateUIStore } from './ui-store';
export { hydrateWalletStore } from './wallet-store';
export { hydrateAppStore } from './app-store';
export { hydrateTodoStore } from './todo-store';

// Utility functions
export { detectEnvironment, measurePerformance, updateMemoryUsage, checkNetworkHealth } from './app-store';
export { manageTodoCache } from './todo-store';

/**
 * Hydrate all stores - call this in your app initialization
 */
export const hydrateAllStores = async () => {
  if (typeof window !== 'undefined') {
    try {
      // Use dynamic imports to avoid circular dependencies
      const [
        { useAppStore },
        { useUIStore },  
        { useWalletStore },
        { useTodoStore }
      ] = await Promise.all([
        import('./app-store'),
        import('./ui-store'),
        import('./wallet-store'),
        import('./todo-store')
      ]);
      
      // Rehydrate stores
      useAppStore.persist.rehydrate();
      useUIStore.persist.rehydrate();
      useWalletStore.persist.rehydrate();
      useTodoStore.persist.rehydrate();
    } catch (error) {
      console.warn('Failed to hydrate stores:', error);
    }
  }
};

/**
 * Store names for debugging and devtools
 */
export const STORE_NAMES = {
  UI: 'ui-store',
  WALLET: 'wallet-store',
  APP: 'app-store',
  TODOS: 'todo-store',
  CREATE_TODO: 'createTodoStore',
  CREATE_TODO_NFT: 'createTodoNFTStore',
  NAVBAR: 'navbarStore',
  TODO_LIST: 'todoListStore',
} as const;

/**
 * Performance debugging utilities (development only)
 */
export const storeDebugUtils = process.env.NODE_ENV === 'development' ? {
  logPerformanceSummary: async () => {
    try {
      const { debugPerformance } = await import('./performance-monitor');
      console.table(debugPerformance.getSummary()?.storeStats || []);
    } catch (error) {
      console.warn('Failed to load performance monitor:', error);
    }
  },
  logSlowActions: async () => {
    try {
      const { debugPerformance } = await import('./performance-monitor');
      console.table(debugPerformance.getSlowActions() || []);
    } catch (error) {
      console.warn('Failed to load performance monitor:', error);
    }
  },
  clearPerformanceData: async () => {
    try {
      const { debugPerformance } = await import('./performance-monitor');
      debugPerformance.clearMetrics();
    } catch (error) {
      console.warn('Failed to load performance monitor:', error);
    }
  },
  setThreshold: async (ms: number) => {
    try {
      const { debugPerformance } = await import('./performance-monitor');
      debugPerformance.setThreshold(ms);
    } catch (error) {
      console.warn('Failed to load performance monitor:', error);
    }
  },
} : {};