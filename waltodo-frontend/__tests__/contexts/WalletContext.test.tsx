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
const wrapper = ({ children }: { children: any }) => (
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
  
  it('should handle network switching', async () => {
    const { result } = renderHookSafe(() => useWalletContext(), { wrapper });
    
    expect(result.current).toBeTruthy();
    
    // Test network switching
    await act(async () => {
      await result.current!.switchNetwork('testnet');
    });
    
    // Function should complete without throwing
    expect(result.current).toBeTruthy();
  });

  it('should manage connection state consistently', async () => {
    const { result } = renderHookSafe(() => useWalletContext(), { wrapper });
    
    expect(result.current).toBeTruthy();
    expect(result.current!.connected).toBe(false);
    expect(result.current!.connecting).toBe(false);
    
    // Test connection attempt
    await act(async () => {
      await result.current!.connect();
    });
    
    // Connection state should be handled by the mocked hooks
    expect(result.current).toBeTruthy();
    expect(typeof result.current!.connected).toBe('boolean');
  });

  it('should maintain transaction history integrity', async () => {
    const { result } = renderHookSafe(() => useWalletContext(), { wrapper });
    
    expect(result.current).toBeTruthy();
    expect(result.current!.transactionHistory).toEqual([]);
    
    // Add multiple transactions
    const tx1 = Promise.resolve({ digest: 'tx1' });
    const tx2 = Promise.resolve({ digest: 'tx2' });
    
    await act(async () => {
      await result.current!.trackTransaction(tx1, 'Transaction1');
      await result.current!.trackTransaction(tx2, 'Transaction2');
    });
    
    expect(result.current!.transactionHistory).toHaveLength(2);
    
    // Check transaction order (should be newest first)
    expect(result.current!.transactionHistory[0].type).toBe('Transaction2');
    expect(result.current!.transactionHistory[1].type).toBe('Transaction1');
  });

  it('should handle localStorage operations safely', () => {
    const { result } = renderHookSafe(() => useWalletContext(), { wrapper });
    
    expect(result.current).toBeTruthy();
    
    // The context should not crash when localStorage operations occur
    act(() => {
      localStorageMock.setItem('test-key', 'test-value');
    });
    
    expect(localStorageMock.getItem('test-key')).toBe('test-value');
    expect(result.current).toBeTruthy();
  });

  it('should handle provider unmounting gracefully', () => {
    const TestComponent = () => {
      const wallet = useWalletContext();
      return <div>{wallet ? 'Wallet Connected' : 'No Wallet'}</div>;
    };
    
    const { unmount } = render(<TestComponent />, { wrapper });
    
    expect(screen.getByText('Wallet Connected')).toBeInTheDocument();
    
    // Should unmount without errors
    expect(() => unmount()).not.toThrow();
  });

  it('should provide consistent typing', () => {
    const { result } = renderHookSafe(() => useWalletContext(), { wrapper });
    
    expect(result.current).toBeTruthy();
    
    // Type checks for all properties
    expect(typeof result.current!.connected).toBe('boolean');
    expect(typeof result.current!.connecting).toBe('boolean');
    expect(result.current!.address === null || typeof result.current!.address === 'string').toBe(true);
    expect(result.current!.chainId === null || typeof result.current!.chainId === 'string').toBe(true);
    expect(result.current!.name === null || typeof result.current!.name === 'string').toBe(true);
    expect(result.current!.error === null || result.current!.error instanceof Error).toBe(true);
    expect(Array.isArray(result.current!.transactionHistory)).toBe(true);
    expect(typeof result.current!.lastActivity).toBe('number');
    
    // Function type checks
    expect(typeof result.current!.connect).toBe('function');
    expect(typeof result.current!.disconnect).toBe('function');
    expect(typeof result.current!.switchNetwork).toBe('function');
    expect(typeof result.current!.trackTransaction).toBe('function');
    expect(typeof result.current!.setError).toBe('function');
    expect(typeof result.current!.resetActivityTimer).toBe('function');
  });

  it('should handle edge cases in transaction tracking', async () => {
    const { result } = renderHookSafe(() => useWalletContext(), { wrapper });
    
    expect(result.current).toBeTruthy();
    
    // Test with null transaction
    await act(async () => {
      try {
        await result.current!.trackTransaction(null as any, 'NullTransaction');
      } catch (error) {
        // Expected to fail gracefully
      }
    });
    
    // Test with undefined transaction type
    const mockTx = Promise.resolve({ digest: 'test' });
    await act(async () => {
      await result.current!.trackTransaction(mockTx, undefined as any);
    });
    
    // Should handle edge cases without crashing
    expect(result.current).toBeTruthy();
  });

  // Test component integration
  it('should work with component consumers', () => {
    const TestConsumer = () => {
      const wallet = useWalletContext();
      
      if (!wallet) {
        return <div>No wallet context</div>;
      }
      
      return (
        <div>
          <div data-testid="connected">{wallet.connected ? 'Connected' : 'Disconnected'}</div>
          <div data-testid="address">{wallet.address || 'No address'}</div>
          <div data-testid="tx-count">{wallet.transactionHistory.length}</div>
          <button onClick={() => wallet.connect()}>Connect</button>
          <button onClick={() => wallet.disconnect()}>Disconnect</button>
        </div>
      );
    };
    
    render(<TestConsumer />, { wrapper });
    
    expect(screen.getByTestId('connected')).toHaveTextContent('Disconnected');
    expect(screen.getByTestId('address')).toHaveTextContent('No address');
    expect(screen.getByTestId('tx-count')).toHaveTextContent('0');
    expect(screen.getByText('Connect')).toBeInTheDocument();
    expect(screen.getByText('Disconnect')).toBeInTheDocument();
  });

  // Tests for localStorage persistence would go here, but they require more complex mocking
  // of the useWallet hook from @suiet/wallet-kit
});