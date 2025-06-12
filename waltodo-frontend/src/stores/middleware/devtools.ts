import { devtools } from 'zustand/middleware';

/**
 * Development tools configuration for Zustand stores
 */
export const createDevtoolsConfig = (name: string) => {
  return devtools(
    // Store creator function placeholder
    (...args: any[]) => args,
    {
      name: `WalTodo ${name}`,
      enabled: process.env?.NODE_ENV === 'development',
      anonymousActionType: `${name}/action`,
      serialize: {
        options: {
          undefined: true,
          function: true,
          symbol: true,
        },
      },
    }
  );
};

/**
 * Store names for devtools
 */
export const storeNames = {
  ui: 'UI Store',
  wallet: 'Wallet Store', 
  app: 'App Store',
  todos: 'Todos Store',
  createTodo: 'Create Todo Form',
  createTodoNFT: 'Create Todo NFT Form',
  navbar: 'Navbar Store',
  todoList: 'Todo List Store',
} as const;

/**
 * Action naming conventions for better debugging
 */
export const actionNames = {
  // UI actions
  ui: {
    openModal: 'UI/Open Modal',
    closeModal: 'UI/Close Modal',
    setLoading: 'UI/Set Loading',
    setError: 'UI/Set Error',
    updateForm: 'UI/Update Form',
    setTheme: 'UI/Set Theme',
  },
  
  // Wallet actions
  wallet: {
    connect: 'Wallet/Connect',
    disconnect: 'Wallet/Disconnect',
    setAccount: 'Wallet/Set Account',
    addTransaction: 'Wallet/Add Transaction',
    updateActivity: 'Wallet/Update Activity',
  },
  
  // App actions
  app: {
    setInitialized: 'App/Set Initialized',
    setHydrated: 'App/Set Hydrated',
    updateNetworkStatus: 'App/Update Network Status',
    toggleFeature: 'App/Toggle Feature',
  },
  
  // Todo actions
  todos: {
    addTodo: 'Todos/Add Todo',
    updateTodo: 'Todos/Update Todo',
    deleteTodo: 'Todos/Delete Todo',
    createList: 'Todos/Create List',
    setSyncStatus: 'Todos/Set Sync Status',
  },
} as const;

/**
 * Helper to create action with proper naming for devtools
 */
export const createAction = (storeName: keyof typeof actionNames, actionName: string) => {
  const storeActions = actionNames[storeName] as Record<string, string>;
  return storeActions[actionName] || `${storeName}/${actionName}`;
};

/**
 * Middleware configuration factory
 */
export const createStoreMiddleware = (name: string, enablePersistence = false) => {
  const middleware = [];
  
  // Always add devtools in development
  if (process.env?.NODE_ENV === 'development') {
    middleware.push((config: any) => devtools(config, { name: storeNames[name as keyof typeof storeNames] || name }));
  }
  
  return middleware;
};

/**
 * Debug utilities for store inspection
 */
export const debugUtils = {
  /**
   * Log store state changes
   */
  logStateChange: (storeName: string, prevState: any, nextState: any, action?: string) => {
    if (process.env?.NODE_ENV === 'development') {
      console.group(`🏪 ${storeName} State Change`);
      if (action) {
        console.log('Action:', action);
      }
      console.log('Previous State:', prevState);
      console.log('Next State:', nextState);
      console.log('Changes:', getDifferences(prevState, nextState));
      console.groupEnd();
    }
  },

  /**
   * Performance monitoring for store actions
   */
  measureAction: (storeName: string, actionName: string, fn: () => void) => {
    if (process.env?.NODE_ENV === 'development') {
      const start = performance.now();
      fn();
      const end = performance.now();
      const duration = end - start;
      
      if (duration > 16) { // Warn if action takes longer than one frame
        console.warn(`⚠️ Slow store action in ${storeName}: ${actionName} took ${duration.toFixed(2 as any)}ms`);
      }
    } else {
      fn();
    }
  },
};

/**
 * Helper to find differences between objects
 */
function getDifferences(obj1: any, obj2: any): Record<string, any> {
  const differences: Record<string, any> = {};
  
  for (const key in obj2) {
    if (obj1[key] !== obj2[key]) {
      differences[key] = {
        from: obj1[key],
        to: obj2[key],
      };
    }
  }
  
  return differences;
}