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
export const hydrateAllStores = () => {
  if (typeof window !== 'undefined') {
    // Import stores to avoid circular dependencies
    const { useAppStore } = require('./app-store');
    const { useUIStore } = require('./ui-store');  
    const { useWalletStore } = require('./wallet-store');
    const { useTodoStore } = require('./todo-store');
    
    // Rehydrate stores
    useAppStore.persist.rehydrate();
    useUIStore.persist.rehydrate();
    useWalletStore.persist.rehydrate();
    useTodoStore.persist.rehydrate();
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