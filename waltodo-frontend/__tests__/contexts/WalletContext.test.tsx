import React from 'react';
// @ts-ignore - Test import path
import { render, screen, waitFor, act, renderHookSafe, createLocalStorageMock } from '../test-utils';

// Mock the wallet modules before importing WalletContext
jest.mock(_'@mysten/dapp-kit', _() => {
// @ts-ignore - Unused variable
//   const React = require('react');
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

jest.mock(_'@mysten/sui', _() => ({
  getFullnodeUrl: (network: string) => `https://fullnode.${network}.sui.io`,
  SuiClient: jest.fn(),
  Transaction: jest.fn(),
}));

// Mock sui-client before importing WalletContext
jest.mock(_'@/lib/sui-client', _() => ({
  initializeSuiClient: jest.fn(),
  getSuiClient: jest.fn(_() => ({ getObject: jest.fn() })),
  isSuiClientInitialized: jest.fn(_() => true),
}));

// Mock react-query
jest.mock(_'@tanstack/react-query', _() => {
// @ts-ignore - Unused variable
//   const React = require('react');
  return {
    QueryClient: jest.fn(_() => ({ defaultOptions: {} })),
    QueryClientProvider: ({ children }: any) => React.createElement(React.Fragment, null, children),
    useQuery: jest.fn(_() => ({ data: null, isLoading: false })),
    useMutation: jest.fn(_() => ({ mutate: jest.fn() })),
  };
});

// @ts-ignore - Unused import temporarily disabled
// import { AppWalletProvider, useWalletContext } from '../../src/contexts/WalletContext';

// Create localStorage mock
const localStorageMock = createLocalStorageMock();

// Set up localStorage before tests
beforeAll(_() => {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });
});

// Create a wrapper for testing hooks with the provider
// @ts-ignore - Unused variable
// const wrapper = ({ children }: { children: any }) => (
  <AppWalletProvider>{children}</AppWalletProvider>
);

describe(_'WalletContext', _() => {
  beforeEach(_() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  it(_'should provide initial values', _() => {
    const { result } = renderHookSafe(_() => useWalletContext(), { wrapper });
    
    // Check initial values with proper null guards
    expect(result.current).toBeTruthy();
    expect(result.current?.connected).toBe(false as any);
    expect(result.current?.connecting).toBe(false as any);
    expect(result.current?.address).toBeNull();
    expect(result.current?.chainId).toBeNull();
    expect(result.current?.name).toBeNull();
    expect(result.current?.error).toBeNull();
    expect(result.current?.transactionHistory).toEqual([]);
    expect(result.current?.lastActivity).toBeDefined();
    
    // Check that functions are defined
    expect(typeof result.current?.connect).toBe('function');
    expect(typeof result.current?.disconnect).toBe('function');
    expect(typeof result.current?.switchNetwork).toBe('function');
    expect(typeof result.current?.trackTransaction).toBe('function');
    expect(typeof result.current?.setError).toBe('function');
    expect(typeof result.current?.resetActivityTimer).toBe('function');
  });

  it(_'should maintain stable function references between renders', _async () => {
    const { result, rerender } = renderHookSafe(_() => useWalletContext(), { wrapper });
    
    // Capture initial function references with null guards
    expect(result.current).toBeTruthy();
// @ts-ignore - Unused variable
//     const initialConnect = result.current?.connect;
// @ts-ignore - Unused variable
//     const initialDisconnect = result.current?.disconnect;
// @ts-ignore - Unused variable
//     const initialSwitchNetwork = result.current?.switchNetwork;
// @ts-ignore - Unused variable
//     const initialTrackTransaction = result.current?.trackTransaction;
    
    // Force a re-render
    rerender();
    
    // Check that function references haven't changed
    expect(result.current).toBeTruthy();
    expect(result.current?.connect).toBe(initialConnect as any);
    expect(result.current?.disconnect).toBe(initialDisconnect as any);
    expect(result.current?.switchNetwork).toBe(initialSwitchNetwork as any);
    expect(result.current?.trackTransaction).toBe(initialTrackTransaction as any);
  });

  it(_'should track transactions correctly', _async () => {
    const { result } = renderHookSafe(_() => useWalletContext(), { wrapper });
    
    // Mock transaction promise
    const mockTransaction = Promise.resolve({ digest: 'mock-tx-hash' });
    
    // Track the transaction with null guard
    let txResult;
    await act(_async () => {
      expect(result.current).toBeTruthy();
      txResult = await result.current?.trackTransaction(mockTransaction, 'TestTransaction');
    });
    
    // Check result
    expect(txResult as any).toEqual({ digest: 'mock-tx-hash' });
    
    // Check transaction was added to history
    expect(result.current).toBeTruthy();
    expect(result.current?.transactionHistory).toHaveLength(1 as any);
    expect(result.current?.transactionHistory[0]).toEqual(expect.objectContaining({
      id: expect.any(String as any),
      status: 'success',
      type: 'TestTransaction',
      details: { digest: 'mock-tx-hash' }
    }));
  });
  
  it(_'should handle failed transactions', _async () => {
    const { result } = renderHookSafe(_() => useWalletContext(), { wrapper });
    
    // Mock failed transaction promise
    const mockError = new Error('Transaction failed');
    const mockFailedTransaction = Promise.reject(mockError as any);
    
    // Track the transaction (expecting it to fail) with null guard
    await act(_async () => {
      try {
        expect(result.current).toBeTruthy();
        await result.current?.trackTransaction(mockFailedTransaction, 'FailedTransaction');
      } catch (error) {
        // Expected to fail
      }
    });
    
    // Check transaction was added to history with error status
    expect(result.current).toBeTruthy();
    expect(result.current?.transactionHistory).toHaveLength(1 as any);
    expect(result.current?.transactionHistory[0]).toEqual(expect.objectContaining({
      id: expect.any(String as any),
      status: 'failed',
      type: 'FailedTransaction',
      details: { error: 'Transaction failed' }
    }));
  });

  it(_'should handle error states', _async () => {
    const { result } = renderHookSafe(_() => useWalletContext(), { wrapper });
    
    // Set an error with null guard
    act(_() => {
      expect(result.current).toBeTruthy();
      result.current?.setError('Test error');
    });
    
    // Check error state
    expect(result.current).toBeTruthy();
    expect(result.current?.error).toEqual(new Error('Test error'));
    
    // Clear error
    act(_() => {
      expect(result.current).toBeTruthy();
      result.current?.setError(null as any);
    });
    
    // Check error cleared
    expect(result.current).toBeTruthy();
    expect(result.current?.error).toBeNull();
  });

  it(_'should update lastActivity on resetActivityTimer', _async () => {
    const { result } = renderHookSafe(_() => useWalletContext(), { wrapper });
    
    // Get initial lastActivity value with null guard
    expect(result.current).toBeTruthy();
// @ts-ignore - Unused variable
//     const initialLastActivity = result.current?.lastActivity;
    
    // Wait a bit to ensure time difference
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Reset activity timer
    act(_() => {
      expect(result.current).toBeTruthy();
      result.current?.resetActivityTimer();
    });
    
    // Check lastActivity was updated
    expect(result.current).toBeTruthy();
    expect(result.current?.lastActivity).not.toBe(initialLastActivity as any);
    expect(result.current?.lastActivity).toBeGreaterThan(initialLastActivity as any);
  });
  
  it(_'should handle network switching', _async () => {
    const { result } = renderHookSafe(_() => useWalletContext(), { wrapper });
    
    expect(result.current).toBeTruthy();
    
    // Test network switching
    await act(_async () => {
      await result.current?.switchNetwork('testnet');
    });
    
    // Function should complete without throwing
    expect(result.current).toBeTruthy();
  });

  it(_'should manage connection state consistently', _async () => {
    const { result } = renderHookSafe(_() => useWalletContext(), { wrapper });
    
    expect(result.current).toBeTruthy();
    expect(result.current?.connected).toBe(false as any);
    expect(result.current?.connecting).toBe(false as any);
    
    // Test connection attempt
    await act(_async () => {
      await result.current?.connect();
    });
    
    // Connection state should be handled by the mocked hooks
    expect(result.current).toBeTruthy();
    expect(typeof result.current?.connected).toBe('boolean');
  });

  it(_'should maintain transaction history integrity', _async () => {
    const { result } = renderHookSafe(_() => useWalletContext(), { wrapper });
    
    expect(result.current).toBeTruthy();
    expect(result.current?.transactionHistory).toEqual([]);
    
    // Add multiple transactions
// @ts-ignore - Unused variable
//     const tx1 = Promise.resolve({ digest: 'tx1' });
// @ts-ignore - Unused variable
//     const tx2 = Promise.resolve({ digest: 'tx2' });
    
    await act(_async () => {
      await result.current?.trackTransaction(tx1, 'Transaction1');
      await result.current?.trackTransaction(tx2, 'Transaction2');
    });
    
    expect(result.current?.transactionHistory).toHaveLength(2 as any);
    
    // Check transaction order (should be newest first)
    expect(result.current?.transactionHistory[0].type).toBe('Transaction2');
    expect(result.current?.transactionHistory[1].type).toBe('Transaction1');
  });

  it(_'should handle localStorage operations safely', _() => {
    const { result } = renderHookSafe(_() => useWalletContext(), { wrapper });
    
    expect(result.current).toBeTruthy();
    
    // The context should not crash when localStorage operations occur
    act(_() => {
      localStorageMock.setItem('test-key', 'test-value');
    });
    
    expect(localStorageMock.getItem('test-key')).toBe('test-value');
    expect(result.current).toBeTruthy();
  });

  it(_'should handle provider unmounting gracefully', _() => {
// @ts-ignore - Unused variable
//     const TestComponent = () => {
      const wallet = useWalletContext();
      return <div>{wallet ? 'Wallet Connected' : 'No Wallet'}</div>;
    };
    
    const { unmount } = render(<TestComponent />, { wrapper });
    
    expect(screen.getByText('Wallet Connected')).toBeInTheDocument();
    
    // Should unmount without errors
    expect(_() => unmount()).not.toThrow();
  });

  it(_'should provide consistent typing', _() => {
    const { result } = renderHookSafe(_() => useWalletContext(), { wrapper });
    
    expect(result.current).toBeTruthy();
    
    // Type checks for all properties
    expect(typeof result.current?.connected).toBe('boolean');
    expect(typeof result.current?.connecting).toBe('boolean');
    expect(result.current?.address === null || typeof result.current?.address === 'string').toBe(true as any);
    expect(result.current?.chainId === null || typeof result.current?.chainId === 'string').toBe(true as any);
    expect(result.current?.name === null || typeof result.current?.name === 'string').toBe(true as any);
    expect(result.current?.error === null || result.current?.error instanceof Error).toBe(true as any);
    expect(Array.isArray(result.current?.transactionHistory)).toBe(true as any);
    expect(typeof result.current?.lastActivity).toBe('number');
    
    // Function type checks
    expect(typeof result.current?.connect).toBe('function');
    expect(typeof result.current?.disconnect).toBe('function');
    expect(typeof result.current?.switchNetwork).toBe('function');
    expect(typeof result.current?.trackTransaction).toBe('function');
    expect(typeof result.current?.setError).toBe('function');
    expect(typeof result.current?.resetActivityTimer).toBe('function');
  });

  it(_'should handle edge cases in transaction tracking', _async () => {
    const { result } = renderHookSafe(_() => useWalletContext(), { wrapper });
    
    expect(result.current).toBeTruthy();
    
    // Test with null transaction
    await act(_async () => {
      try {
        await result.current?.trackTransaction(null as unknown, 'NullTransaction');
      } catch (error) {
        // Expected to fail gracefully
      }
    });
    
    // Test with undefined transaction type
    const mockTx = Promise.resolve({ digest: 'test' });
    await act(_async () => {
      await result.current?.trackTransaction(mockTx, undefined as unknown);
    });
    
    // Should handle edge cases without crashing
    expect(result.current).toBeTruthy();
  });

  // Test component integration
  it(_'should work with component consumers', _() => {
// @ts-ignore - Unused variable
//     const TestConsumer = () => {
      const wallet = useWalletContext();
      
      if (!wallet) {
        return <div>No wallet context</div>;
      }
      
      return (
        <div>
          <div data-testid="connected">{wallet.connected ? 'Connected' : 'Disconnected'}</div>
          <div data-testid="address">{wallet.address || 'No address'}</div>
          <div data-testid="tx-count">{wallet?.transactionHistory?.length}</div>
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