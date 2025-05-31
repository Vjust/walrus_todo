/**
 * Mock implementation for wallet context
 * Provides consistent wallet mocking across all tests
 */

import React from 'react';
import { createMockWalletContext } from '../test-utils';

// Create the default mock wallet context
export const mockWalletContextValue = createMockWalletContext();

// Mock the wallet context module
jest.mock('@/contexts/WalletContext', () => ({
  useWalletContext: jest.fn(() => mockWalletContextValue),
  AppWalletProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-wallet-provider">{children}</div>
  ),
}));

// Helper to update wallet context for specific tests
export const updateMockWalletContext = (updates: Partial<typeof mockWalletContextValue>) => {
  Object.assign(mockWalletContextValue, updates);
};

// Helper to reset wallet context to defaults
export const resetMockWalletContext = () => {
  Object.assign(mockWalletContextValue, createMockWalletContext());
};

// Auto-reset before each test
beforeEach(() => {
  resetMockWalletContext();
});