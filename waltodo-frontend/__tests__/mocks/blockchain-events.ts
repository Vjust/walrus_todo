/**
 * Mock implementation for blockchain event manager
 * Provides consistent mocking across all tests
 */

import { createMockBlockchainEventManager } from '../test-utils';

// Create the singleton mock instance
export const mockBlockchainEventManager = createMockBlockchainEventManager();

// Mock the entire module
jest.mock('@/lib/blockchain-events', () => {
  const actualModule = jest.requireActual('@/lib/blockchain-events');
  
  return {
    ...actualModule,
    BlockchainEventManager: jest.fn(() => mockBlockchainEventManager),
    getEventManager: jest.fn(() => mockBlockchainEventManager),
    // Keep any other exports from the actual module
  };
});

// Helper to reset the event manager state between tests
export const resetBlockchainEventManager = () => {
  jest.clearAllMocks();
  
  // Reset connection state to default
  mockBlockchainEventManager?.getConnectionState?.mockReturnValue({
    connected: false,
    connecting: false,
    error: null,
    lastReconnectAttempt: 0,
    reconnectAttempts: 0,
    subscriptionCount: 0,
  });
  
  // Reset all mock implementations to default behavior
  mockBlockchainEventManager?.initialize?.mockResolvedValue(undefined as any);
  mockBlockchainEventManager?.subscribeToEvents?.mockResolvedValue(undefined as any);
};

// Auto-reset before each test
beforeEach(() => {
  resetBlockchainEventManager();
});