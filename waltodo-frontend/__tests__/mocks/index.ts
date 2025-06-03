/**
 * Central mock setup file
 * Import this file in tests that need consistent mocking
 */

import React from 'react';

// Import all mock modules
import './blockchain-events';
import './wallet-context';
import './sui-client';

// Export commonly used mocks and helpers
export { mockBlockchainEventManager, resetBlockchainEventManager } from './blockchain-events';
export { mockWalletContextValue, updateMockWalletContext, resetMockWalletContext } from './wallet-context';
export { mockInitializeSuiClient, mockIsSuiClientInitialized, mockGetSuiClient, resetSuiClientMocks } from './sui-client';

// Mock other common modules
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => `mock-id-${Math.random().toString(36).substr(2, 9)}`),
}));

jest.mock('@mysten/sui/client', () => ({
  getFullnodeUrl: jest.fn((network: string) => `https://fullnode.${network}.sui.io`),
  SuiClient: jest.fn(),
}));

jest.mock('@mysten/sui/transactions', () => ({
  Transaction: jest.fn(),
  TransactionBlock: jest.fn(),
}));

jest.mock('@mysten/dapp-kit', () => ({
  createNetworkConfig: jest.fn(() => ({
    networkConfig: {
      testnet: { url: 'https://fullnode.testnet.sui.io' },
      devnet: { url: 'https://fullnode.devnet.sui.io' },
      mainnet: { url: 'https://fullnode.mainnet.sui.io' },
    },
  })),
  SuiClientProvider: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  WalletProvider: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  useCurrentAccount: jest.fn(() => null),
  useConnectWallet: jest.fn(() => ({
    mutate: jest.fn(),
    isPending: false,
  })),
  useDisconnectWallet: jest.fn(() => ({
    mutate: jest.fn(),
  })),
  useSignAndExecuteTransaction: jest.fn(() => ({
    mutateAsync: jest.fn().mockResolvedValue({ digest: 'mock-digest' }),
  })),
  ConnectModal: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  useWallets: jest.fn(() => []),
}));

jest.mock('@tanstack/react-query', () => ({
  QueryClient: jest.fn(() => ({
    defaultOptions: {},
  })),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  useQuery: jest.fn(),
  useMutation: jest.fn(),
}));

// Mock hooks/useInactivityTimer  
jest.mock('@/hooks/useInactivityTimer', () => ({
  useInactivityTimer: jest.fn(() => ({
    lastActivity: Date.now(),
    isActive: true,
    resetActivityTimer: jest.fn(),
    timeUntilTimeout: 30 * 60 * 1000,
  })),
}));