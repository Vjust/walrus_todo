import React from 'react';
import { render, screen, waitFor, act, renderHook } from '@testing-library/react';
import { AppWalletProvider, useWalletContext } from '../../src/contexts/WalletContext';
import { nanoid } from 'nanoid';

// Mock the nanoid package
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'mocked-nanoid-value')
}));

// Mock the Suiet wallet kit
jest.mock('@suiet/wallet-kit', () => {
  const mockWalletHook = {
    connected: false,
    connecting: false,
    account: null,
    wallet: null,
    networkId: null,
    select: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    executeMoveCall: jest.fn(),
    executeSerializedMoveCall: jest.fn(),
    signMessage: jest.fn(),
    signAndExecuteTransaction: jest.fn(),
    signTransaction: jest.fn(),
    on: jest.fn(),
    verifySignedMessage: jest.fn()
  };

  return {
    useWallet: jest.fn(() => mockWalletHook),
    WalletProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AllDefaultWallets: ['mock-wallet-1', 'mock-wallet-2']
  };
});

// Mock window.localStorage
const localStorageMock = (() => {
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
    })
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

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
    const { result } = renderHook(() => useWalletContext(), { wrapper });
    
    // Check initial values
    expect(result.current.connected).toBe(false);
    expect(result.current.connecting).toBe(false);
    expect(result.current.address).toBeNull();
    expect(result.current.chainId).toBeNull();
    expect(result.current.name).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.transactions).toEqual([]);
    expect(result.current.lastActivity).toBeDefined();
    
    // Check that functions are defined
    expect(typeof result.current.connect).toBe('function');
    expect(typeof result.current.disconnect).toBe('function');
    expect(typeof result.current.switchNetwork).toBe('function');
    expect(typeof result.current.trackTransaction).toBe('function');
    expect(typeof result.current.setError).toBe('function');
    expect(typeof result.current.resetActivityTimer).toBe('function');
  });

  it('should maintain stable function references between renders', async () => {
    const { result, rerender } = renderHook(() => useWalletContext(), { wrapper });
    
    // Capture initial function references
    const initialConnect = result.current.connect;
    const initialDisconnect = result.current.disconnect;
    const initialSwitchNetwork = result.current.switchNetwork;
    const initialTrackTransaction = result.current.trackTransaction;
    
    // Force a re-render
    rerender();
    
    // Check that function references haven't changed
    expect(result.current.connect).toBe(initialConnect);
    expect(result.current.disconnect).toBe(initialDisconnect);
    expect(result.current.switchNetwork).toBe(initialSwitchNetwork);
    expect(result.current.trackTransaction).toBe(initialTrackTransaction);
  });

  it('should track transactions correctly', async () => {
    const { result } = renderHook(() => useWalletContext(), { wrapper });
    
    // Mock transaction promise
    const mockTransaction = Promise.resolve({ digest: 'mock-tx-hash' });
    
    // Track the transaction
    let txResult;
    await act(async () => {
      txResult = await result.current.trackTransaction(mockTransaction, 'TestTransaction');
    });
    
    // Check result
    expect(txResult).toEqual({ digest: 'mock-tx-hash' });
    
    // Check transaction was added to history
    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0]).toEqual(expect.objectContaining({
      id: 'mocked-nanoid-value',
      status: 'success',
      type: 'TestTransaction',
      hash: 'mock-tx-hash'
    }));
  });
  
  it('should handle failed transactions', async () => {
    const { result } = renderHook(() => useWalletContext(), { wrapper });
    
    // Mock failed transaction promise
    const mockError = new Error('Transaction failed');
    const mockFailedTransaction = Promise.reject(mockError);
    
    // Track the transaction (expecting it to fail)
    await act(async () => {
      try {
        await result.current.trackTransaction(mockFailedTransaction, 'FailedTransaction');
      } catch (error) {
        // Expected to fail
      }
    });
    
    // Check transaction was added to history with error status
    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0]).toEqual(expect.objectContaining({
      id: 'mocked-nanoid-value',
      status: 'error',
      type: 'FailedTransaction',
      message: 'Transaction failed'
    }));
  });

  it('should handle error states', async () => {
    const { result } = renderHook(() => useWalletContext(), { wrapper });
    
    // Set an error
    act(() => {
      result.current.setError(new Error('Test error'));
    });
    
    // Check error state
    expect(result.current.error).toEqual(new Error('Test error'));
    
    // Clear error
    act(() => {
      result.current.setError(null);
    });
    
    // Check error cleared
    expect(result.current.error).toBeNull();
  });

  it('should update lastActivity on resetActivityTimer', async () => {
    const { result } = renderHook(() => useWalletContext(), { wrapper });
    
    // Get initial lastActivity value
    const initialLastActivity = result.current.lastActivity;
    
    // Wait a bit to ensure time difference
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Reset activity timer
    act(() => {
      result.current.resetActivityTimer();
    });
    
    // Check lastActivity was updated
    expect(result.current.lastActivity).not.toBe(initialLastActivity);
    expect(result.current.lastActivity).toBeGreaterThan(initialLastActivity);
  });
  
  // Tests for localStorage persistence would go here, but they require more complex mocking
  // of the useWallet hook from @suiet/wallet-kit
});