/**
 * Common test utilities and mock implementations
 * This file centralizes frequently used test helpers and mocks
 */

import React from 'react';
import { render, renderHook as originalRenderHook, RenderHookOptions, RenderHookResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from '@testing-library/react';

// Types for blockchain events
export interface BlockchainEvent {
  type: 'created' | 'completed' | 'deleted' | 'updated';
  data: Record<string, any>;
  timestamp?: string;
}

export interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  error: Error | null;
  lastReconnectAttempt: number;
  reconnectAttempts: number;
  subscriptionCount: number;
}

// Create a properly typed blockchainEventManager mock
export const createMockBlockchainEventManager = () => {
  const listeners = new Map<string, Set<Function>>();
  
  return {
    initialize: jest.fn().mockResolvedValue(undefined),
    subscribeToEvents: jest.fn().mockResolvedValue(undefined),
    unsubscribeAll: jest.fn(),
    addEventListener: jest.fn((eventType: string, listener: Function) => {
      if (!listeners.has(eventType)) {
        listeners.set(eventType, new Set());
      }
      listeners.get(eventType)?.add(listener);
      
      return () => {
        listeners.get(eventType)?.delete(listener);
      };
    }),
    removeEventListener: jest.fn((eventType: string, listener: Function) => {
      listeners.get(eventType)?.delete(listener);
    }),
    getConnectionState: jest.fn(() => ({
      connected: false,
      connecting: false,
      error: null,
      lastReconnectAttempt: 0,
      reconnectAttempts: 0,
      subscriptionCount: 0,
    })),
    destroy: jest.fn(),
    // Helper to trigger events in tests
    __triggerEvent: (eventType: string, event: BlockchainEvent) => {
      listeners.get(eventType)?.forEach(listener => listener(event));
    },
    // Helper to get listener count
    __getListenerCount: (eventType: string) => listeners.get(eventType)?.size || 0,
  };
};

// Create a mock for blockchain event manager module
export const mockBlockchainEventManager = createMockBlockchainEventManager();

// Setup blockchain event manager mock globally
jest.mock('@/lib/blockchain-events', () => ({
  BlockchainEventManager: jest.fn(() => mockBlockchainEventManager),
  getEventManager: jest.fn(() => mockBlockchainEventManager),
}));

// Mock hooks related to blockchain events
export const createMockBlockchainHooks = () => {
  const mockUseBlockchainEvents = jest.fn(() => ({
    connectionState: mockBlockchainEventManager.getConnectionState(),
    isConnected: false,
    isConnecting: false,
    error: null,
    startSubscription: jest.fn().mockResolvedValue(undefined),
    stopSubscription: jest.fn(),
    restartSubscription: jest.fn().mockResolvedValue(undefined),
    addEventListener: mockBlockchainEventManager.addEventListener,
  }));

  const mockUseTodoEvents = jest.fn(() => ({
    recentEvents: [],
    clearRecentEvents: jest.fn(),
    connectionState: mockBlockchainEventManager.getConnectionState(),
    isConnected: false,
    isConnecting: false,
    error: null,
  }));

  const mockUseTodoStateSync = jest.fn(({ todos = [] }) => ({
    syncedTodos: todos,
    connectionState: mockBlockchainEventManager.getConnectionState(),
    isConnected: false,
    isConnecting: false,
    error: null,
  }));

  return {
    useBlockchainEvents: mockUseBlockchainEvents,
    useTodoEvents: mockUseTodoEvents,
    useTodoStateSync: mockUseTodoStateSync,
  };
};

// Safe renderHook that handles null results properly
type SafeRenderHookResult<Result, Props> = Omit<RenderHookResult<Result, Props>, 'result'> & {
  result: {
    current: Result;
  };
};

export function renderHookSafe<Result, Props>(
  renderCallback: (props: Props) => Result,
  options?: RenderHookOptions<Props>
): SafeRenderHookResult<Result, Props> {
  const result = originalRenderHook(renderCallback, options);
  
  // Ensure result.current is never undefined
  if (result.result.current === undefined) {
    throw new Error('Hook returned undefined. Ensure the hook always returns a value.');
  }
  
  return result as SafeRenderHookResult<Result, Props>;
}

// Create a test query client
export const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
        staleTime: 0,
      },
    },
    logger: {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  });
};

// Test wrapper with providers
export const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = createTestQueryClient();
  
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

// Common mock for wallet context
export const createMockWalletContext = (overrides = {}) => ({
  connected: false,
  connecting: false,
  address: null,
  chainId: null,
  name: null,
  error: null,
  transactionHistory: [],
  lastActivity: Date.now(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  switchNetwork: jest.fn(),
  trackTransaction: jest.fn().mockResolvedValue({ digest: 'mock-digest' }),
  setError: jest.fn(),
  resetActivityTimer: jest.fn(),
  ...overrides,
});

// Mock for useInactivityTimer
export const createMockInactivityTimer = (overrides = {}) => ({
  lastActivity: Date.now(),
  isActive: true,
  resetActivityTimer: jest.fn(),
  timeUntilTimeout: 30 * 60 * 1000, // 30 minutes
  ...overrides,
});

// Mock for localStorage
export const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    // Helper methods
    __getStore: () => ({ ...store }),
    __setStore: (newStore: Record<string, string>) => {
      store = { ...newStore };
    },
  };
};

// Helper to wait for async updates
export const waitForAsync = async (callback?: () => void) => {
  await act(async () => {
    callback?.();
    await new Promise(resolve => setTimeout(resolve, 0));
  });
};

// Mock Todo type for tests
export interface MockTodo {
  id: string;
  title: string;
  completed: boolean;
  priority?: string;
  blockchainStored?: boolean;
  objectId?: string;
  owner?: string;
  createdAt?: number;
  completedAt?: number;
}

// Create mock todo
export const createMockTodo = (overrides: Partial<MockTodo> = {}): MockTodo => ({
  id: 'mock-todo-' + Math.random().toString(36).substr(2, 9),
  title: 'Mock Todo',
  completed: false,
  priority: 'medium',
  blockchainStored: false,
  createdAt: Date.now(),
  ...overrides,
});

// Mock transaction result
export const createMockTransactionResult = (overrides = {}) => ({
  digest: 'mock-digest-' + Math.random().toString(36).substr(2, 9),
  ...overrides,
});

// Mock error helper
export const createMockError = (message = 'Mock error') => new Error(message);

// Re-export testing library utilities for convenience
export { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
export { renderHook } from '@testing-library/react';