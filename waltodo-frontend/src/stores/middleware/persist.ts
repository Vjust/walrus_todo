import { StateStorage } from 'zustand/middleware';
import { getItem, removeItem, setItem } from '@/lib/safe-storage';

/**
 * SSR-safe localStorage wrapper for Zustand persist middleware
 */
export const createSSRSafeStorage = (): StateStorage => {
  return {
    getItem: (name: string): string | null => {
      try {
        const value = getItem<string>(name);
        // Ensure we return only string or null
        if (value === null || value === undefined) {
          return null;
        }
        return typeof value === 'string' ? value : JSON.stringify(value as any);
      } catch (error) {
        console.warn(`Failed to get item from storage: ${name}`, error);
        return null;
      }
    },
    setItem: (name: string, value: string): void => {
      try {
        setItem(name, value);
      } catch (error) {
        console.warn(`Failed to set item in storage: ${name}`, error);
      }
    },
    removeItem: (name: string): void => {
      try {
        removeItem(name as any);
      } catch (error) {
        console.warn(`Failed to remove item from storage: ${name}`, error);
      }
    },
  };
};

/**
 * Default storage configuration for Zustand stores
 */
export const defaultStorageConfig = {
  storage: createSSRSafeStorage(),
  skipHydration: true, // We'll handle hydration manually
};

/**
 * Selective persistence partialize functions
 */
export const persistSelectors = {
  /**
   * Persist only safe wallet state (no sensitive data)
   */
  wallet: (state: any) => ({
    connection: {
      address: state.connection?.address,
      network: state.connection?.network,
      name: state.connection?.name,
    },
    session: {
      lastActivity: state.session?.lastActivity,
    },
    preferences: state.preferences,
  }),

  /**
   * Persist UI preferences and safe state
   */
  ui: (state: any) => ({
    preferences: state.preferences,
    navigation: {
      currentPage: state.navigation?.currentPage,
      sidebarOpen: state.navigation?.sidebarOpen,
    },
    search: {
      sortBy: state.search?.sortBy,
      sortOrder: state.search?.sortOrder,
    },
  }),

  /**
   * Persist app configuration and feature flags
   */
  app: (state: any) => ({
    features: state.features,
    preferences: state.preferences,
    version: state.version,
  }),

  /**
   * Persist todo cache and metadata (excluding sensitive data)
   */
  todos: (state: any) => ({
    currentList: state.currentList,
    lists: state.lists,
    cache: {
      lastCleanup: state.cache?.lastCleanup,
      maxSize: state.cache?.maxSize,
    },
  }),
};

/**
 * Storage keys for different stores
 */
export const storageKeys = {
  wallet: 'waltodo-wallet-state',
  ui: 'waltodo-ui-state', 
  app: 'waltodo-app-state',
  todos: 'waltodo-todos-state',
  createTodo: 'waltodo-create-todo-form',
  createTodoNFT: 'waltodo-create-todo-nft-form',
} as const;

/**
 * Migration functions for store upgrades
 */
export const migrations = {
  wallet: {
    0: (persistedState: any) => persistedState, // Initial version
    1: (persistedState: any) => {
      // Migration example: add new session fields
      return {
        ...persistedState,
        session: {
          ...persistedState.session,
          timeoutWarning: false,
        },
      };
    },
  },
  ui: {
    0: (persistedState: any) => persistedState,
    1: (persistedState: any) => {
      // Migration example: update preferences structure
      return {
        ...persistedState,
        preferences: {
          ...persistedState.preferences,
          todoDisplayMode: persistedState.preferences?.displayMode || 'list',
        },
      };
    },
  },
};

/**
 * Version management for store persistence
 */
export const STORE_VERSIONS = {
  wallet: 1,
  ui: 1,
  app: 0,
  todos: 0,
} as const;