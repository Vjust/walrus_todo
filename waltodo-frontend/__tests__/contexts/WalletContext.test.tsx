import React from 'react';
import { render, screen, waitFor, act, renderHookSafe, createLocalStorageMock } from '../test-utils';

// Mock the wallet modules before importing WalletContext
jest.mock('@mysten/dapp-kit', () => {
  const React = require('react');
  return {
    createNetworkConfig: () => ({ networkConfig: {} }),
    SuiClientProvider: ({ children }: any) => React.createElement(React.Fragment, null, children),
    WalletProvider: ({ children }: any) => React.createElement(React.Fragment, null, children),
    useCurrentAccount: () => null,
    useConnectWallet: () => ({ mutate: jest.fn(), isPending: false }),
    useDisconnectWallet: () => ({ mutate: jest.fn() }),
    useSignAndExecuteTransaction: () => ({ mutateAsync: jest.fn() }),
    useWallets: () => [],
  };
});

jest.mock('@mysten/sui', () => ({
  getFullnodeUrl: (network: string) => `https://fullnode.${network}.sui.io`,
  SuiClient: jest.fn(),
  Transaction: jest.fn(),
}));

// Mock sui-client before importing WalletContext
jest.mock('@/lib/sui-client', () => ({
  initializeSuiClient: jest.fn(),
  getSuiClient: jest.fn(() => ({ getObject: jest.fn() })),
  isSuiClientInitialized: jest.fn(() => true),
}));

// Mock react-query
jest.mock('@tanstack/react-query', () => {
  const React = require('react');
  return {
    QueryClient: jest.fn(() => ({ defaultOptions: {} })),
    QueryClientProvider: ({ children }: any) => React.createElement(React.Fragment, null, children),
    useQuery: jest.fn(() => ({ data: null, isLoading: false })),
    useMutation: jest.fn(() => ({ mutate: jest.fn() })),
  };
});

import { AppWalletProvider, useWalletContext } from '../../src/contexts/WalletContext';

// Create localStorage mock
const localStorageMock = createLocalStorageMock();

// Set up localStorage before tests
beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });
});

// Create a wrapper for testing hooks with the provider
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppWalletProvider>{children}</AppWalletProvider>
);

describe('WalletContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  it('should provide initial values', () => {
    const { result } = renderHookSafe(() => useWalletContext(), { wrapper });
    
    // Check initial values with proper null guards
    expect(result.current).toBeTruthy();
    expect(result.current!.connected).toBe(false);
    expect(result.current!.connecting).toBe(false);
    expect(result.current!.address).toBeNull();
    expect(result.current!.chainId).toBeNull();
    expect(result.current!.name).toBeNull();
    expect(result.current!.error).toBeNull();
    expect(result.current!.transactionHistory).toEqual([]);
    expect(result.current!.lastActivity).toBeDefined();
    
    // Check that functions are defined
    expect(typeof result.current!.connect).toBe('function');
    expect(typeof result.current!.disconnect).toBe('function');
    expect(typeof result.current!.switchNetwork).toBe('function');
    expect(typeof result.current!.trackTransaction).toBe('function');
    expect(typeof result.current!.setError).toBe('function');
    expect(typeof result.current!.resetActivityTimer).toBe('function');
  });

  it('should maintain stable function references between renders', async () => {
    const { result, rerender } = renderHookSafe(() => useWalletContext(), { wrapper });
    
    // Capture initial function references with null guards
    expect(result.current).toBeTruthy();
    const initialConnect = result.current!.connect;
    const initialDisconnect = result.current!.disconnect;
    const initialSwitchNetwork = result.current!.switchNetwork;
    const initialTrackTransaction = result.current!.trackTransaction;
    
    // Force a re-render
    rerender();
    
    // Check that function references haven't changed
    expect(result.current).toBeTruthy();
    expect(result.current!.connect).toBe(initialConnect);
    expect(result.current!.disconnect).toBe(initialDisconnect);
    expect(result.current!.switchNetwork).toBe(initialSwitchNetwork);
    expect(result.current!.trackTransaction).toBe(initialTrackTransaction);
  });

  it('should track transactions correctly', async () => {
    const { result } = renderHookSafe(() => useWalletContext(), { wrapper });
    
    // Mock transaction promise
    const mockTransaction = Promise.resolve({ digest: 'mock-tx-hash' });
    
    // Track the transaction with null guard
    let txResult;
    await act(async () => {
      expect(result.current).toBeTruthy();
      txResult = await result.current!.trackTransaction(mockTransaction, 'TestTransaction');
    });
    
    // Check result
    expect(txResult).toEqual({ digest: 'mock-tx-hash' });
    
    // Check transaction was added to history
    expect(result.current).toBeTruthy();
    expect(result.current!.transactionHistory).toHaveLength(1);
    expect(result.current!.transactionHistory[0]).toEqual(expect.objectContaining({
      id: expect.any(String),
      status: 'success',
      type: 'TestTransaction',
      details: { digest: 'mock-tx-hash' }
    }));
  });
  
  it('should handle failed transactions', async () => {
    const { result } = renderHookSafe(() => useWalletContext(), { wrapper });
    
    // Mock failed transaction promise
    const mockError = new Error('Transaction failed');
    const mockFailedTransaction = Promise.reject(mockError);
    
    // Track the transaction (expecting it to fail) with null guard
    await act(async () => {
      try {
        expect(result.current).toBeTruthy();
        await result.current!.trackTransaction(mockFailedTransaction, 'FailedTransaction');
      } catch (error) {
        // Expected to fail
      }
    });
    
    // Check transaction was added to history with error status
    expect(result.current).toBeTruthy();
    expect(result.current!.transactionHistory).toHaveLength(1);
    expect(result.current!.transactionHistory[0]).toEqual(expect.objectContaining({
      id: expect.any(String),
      status: 'failed',
      type: 'FailedTransaction',
      details: { error: 'Transaction failed' }
    }));
  });

  it('should handle error states', async () => {
    const { result } = renderHookSafe(() => useWalletContext(), { wrapper });
    
    // Set an error with null guard
    act(() => {
      expect(result.current).toBeTruthy();
      result.current!.setError('Test error');
    });
    
    // Check error state
    expect(result.current).toBeTruthy();
    expect(result.current!.error).toEqual(new Error('Test error'));
    
    // Clear error
    act(() => {
      expect(result.current).toBeTruthy();
      result.current!.setError(null);
    });
    
    // Check error cleared
    expect(result.current).toBeTruthy();
    expect(result.current!.error).toBeNull();
  });

  it('should update lastActivity on resetActivityTimer', async () => {
    const { result } = renderHookSafe(() => useWalletContext(), { wrapper });
    
    // Get initial lastActivity value with null guard
    expect(result.current).toBeTruthy();
    const initialLastActivity = result.current!.lastActivity;
    
    // Wait a bit to ensure time difference
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Reset activity timer
    act(() => {
      expect(result.current).toBeTruthy();
      result.current!.resetActivityTimer();
    });
    
    // Check lastActivity was updated
    expect(result.current).toBeTruthy();
    expect(result.current!.lastActivity).not.toBe(initialLastActivity);
    expect(result.current!.lastActivity).toBeGreaterThan(initialLastActivity);
  });
  
  // Tests for localStorage persistence would go here, but they require more complex mocking
  // of the useWallet hook from @suiet/wallet-kit
});