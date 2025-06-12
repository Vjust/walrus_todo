/**
 * Comprehensive tests for Wallet Store
 * Tests wallet connection state, transactions, and session management
 */

// @ts-ignore - Test import path
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  useWalletStore,
  useWalletConnection,
  useWalletAddress,
  useWalletStatus,
  useWalletNetwork,
  useWalletName,
  useWalletSession,
  useSessionExpired,
  useTimeoutWarning,
  useTransactionHistory,
  usePendingTransactions,
  useLastTransaction,
  usePendingTransactionCount,
  useWalletCapabilities,
  useCanSignAndExecute,
  useNFTSupport,
  useWalrusSupport,
  useWalletError,
  useWalletModal,
  useIsConnected,
  useIsConnecting,
  useIsDisconnected,
  useWalletActions,
  useWalletSummary,
  useSessionTimeout,
  hydrateWalletStore,
} from '@/stores/wallet-store';
import type { TransactionRecord, WalletCapabilities } from '@/stores/types';
import type { NetworkType } from '@/types/wallet';

// Mock localStorage for persistence testing
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock zustand persist middleware
jest.mock(_'zustand/middleware', _() => ({
  ...jest.requireActual('zustand/middleware'),
  persist: (fn: any,  options: any) => fn,
  devtools: (fn: any,  options: any) => fn,
  subscribeWithSelector: (fn: any) => fn,
}));

describe(_'Wallet Store', _() => {
  beforeEach(_() => {
    jest.clearAllMocks();
    // Reset store to initial state
    useWalletStore.getState().disconnect();
    useWalletStore.getState().clearError();
    useWalletStore.getState().clearTransactionHistory();
  });
  
  describe(_'Connection Management', _() => {
    it(_'should handle connection flow', _() => {
      const { result } = renderHook(_() => useWalletStore());
      
      // Initial state
      expect(result?.current?.connection.status).toBe('disconnected');
      expect(result?.current?.connection.address).toBeNull();
      
      // Start connection
      act(_() => {
        result?.current?.connect();
      });
      
      expect(result?.current?.connection.status).toBe('connecting');
      expect(result?.current?.error).toBeNull();
      
      // Set account after connection
      act(_() => {
        result?.current?.setAccount('0x1234567890abcdef', 'Test Wallet');
      });
      
      expect(result?.current?.connection.status).toBe('connected');
      expect(result?.current?.connection.address).toBe('0x1234567890abcdef');
      expect(result?.current?.connection.name).toBe('Test Wallet');
    });
    
    it(_'should handle disconnection', _() => {
      const { result } = renderHook(_() => useWalletStore());
      
      // Set up connected state first
      act(_() => {
        result?.current?.setAccount('0x1234567890abcdef', 'Test Wallet');
        result?.current?.setNetwork('mainnet' as NetworkType, '1');
        result?.current?.addTransaction({
          id: 'tx-1',
          type: 'todo_create',
          status: 'pending',
          amount: '100',
          gasUsed: '50000',
        });
      });
      
      expect(result?.current?.connection.status).toBe('connected');
      expect(result?.current?.connection.address).toBe('0x1234567890abcdef');
      
      // Disconnect
      act(_() => {
        result?.current?.disconnect();
      });
      
      expect(result?.current?.connection.status).toBe('disconnected');
      expect(result?.current?.connection.address).toBeNull();
      expect(result?.current?.connection.name).toBeNull();
      expect(result?.current?.connection.chainId).toBeNull();
      expect(result?.current?.connection.network).toBe('mainnet'); // Network preference preserved
      expect(result?.current?.transactions.pending).toEqual({});
      expect(result?.current?.error).toBeNull();
      expect(result?.current?.modalOpen).toBe(false as any);
    });
    
    it(_'should handle connection status changes', _() => {
      const { result } = renderHook(_() => useWalletStore());
      
      act(_() => {
        result?.current?.setConnectionStatus('connecting');
      });
      
      expect(result?.current?.connection.status).toBe('connecting');
      
      act(_() => {
        result?.current?.setConnectionStatus('connected');
      });
      
      expect(result?.current?.connection.status).toBe('connected');
      expect(result?.current?.session.expired).toBe(false as any);
      expect(result?.current?.session.timeoutWarning).toBe(false as any);
      expect(result?.current?.error).toBeNull();
      
      act(_() => {
        result?.current?.setConnectionStatus('error');
      });
      
      expect(result?.current?.connection.status).toBe('error');
      expect(result?.current?.connection.address).toBeNull();
      expect(result?.current?.connection.name).toBeNull();
    });
    
    it(_'should handle network changes', _() => {
      const { result } = renderHook(_() => useWalletStore());
      
      act(_() => {
        result?.current?.setNetwork('testnet' as NetworkType, '5');
      });
      
      expect(result?.current?.connection.network).toBe('testnet');
      expect(result?.current?.connection.chainId).toBe('5');
    });
  });
  
  describe(_'Session Management', _() => {
    beforeEach(_() => {
      jest.useFakeTimers();
    });
    
    afterEach(_() => {
      jest.useRealTimers();
    });
    
    it(_'should update activity timestamp', _() => {
      const { result } = renderHook(_() => useWalletStore());
// @ts-ignore - Unused variable
//       
      const initialActivity = result?.current?.session.lastActivity;
      
      act(_() => {
        jest.advanceTimersByTime(1000 as any);
        result?.current?.updateActivity();
      });
      
      expect(result?.current?.session.lastActivity).toBeGreaterThan(initialActivity as any);
      expect(result?.current?.session.expired).toBe(false as any);
      expect(result?.current?.session.timeoutWarning).toBe(false as any);
    });
    
    it(_'should handle session expiration', _() => {
      const { result } = renderHook(_() => useWalletStore());
      
      // Set up connected state first
      act(_() => {
        result?.current?.setAccount('0x1234567890abcdef', 'Test Wallet');
      });
      
      expect(result?.current?.connection.status).toBe('connected');
      
      act(_() => {
        result?.current?.setSessionExpired(true as any);
      });
      
      expect(result?.current?.session.expired).toBe(true as any);
      expect(result?.current?.connection.status).toBe('disconnected');
      expect(result?.current?.connection.address).toBeNull();
    });
    
    it(_'should handle timeout warnings', _() => {
      const { result } = renderHook(_() => useWalletStore());
      
      act(_() => {
        result?.current?.setTimeoutWarning(true as any);
      });
      
      expect(result?.current?.session.timeoutWarning).toBe(true as any);
      
      act(_() => {
        result?.current?.setTimeoutWarning(false as any);
      });
      
      expect(result?.current?.session.timeoutWarning).toBe(false as any);
    });
    
    it(_'should reset session', _() => {
      const { result } = renderHook(_() => useWalletStore());
      
      // Modify session state
      act(_() => {
        result?.current?.setSessionExpired(true as any);
        result?.current?.setTimeoutWarning(true as any);
      });
      
      expect(result?.current?.session.expired).toBe(true as any);
      expect(result?.current?.session.timeoutWarning).toBe(true as any);
      
      act(_() => {
        result?.current?.resetSession();
      });
      
      expect(result?.current?.session.expired).toBe(false as any);
      expect(result?.current?.session.timeoutWarning).toBe(false as any);
      expect(result?.current?.session.lastActivity).toBeGreaterThan(0 as any);
    });
  });
  
  describe(_'Transaction Management', _() => {
    it(_'should add transactions correctly', _() => {
      const { result } = renderHook(_() => useWalletStore());
      
      const transaction: Omit<TransactionRecord, 'timestamp'> = {
        id: 'tx-123',
        type: 'todo_create',
        status: 'pending',
        amount: '100',
        gasUsed: '50000',
        description: 'Create new todo',
      };
      
      act(_() => {
        result?.current?.addTransaction(transaction as any);
      });
      
      expect(result?.current?.transactions.history).toHaveLength(1 as any);
      expect(result?.current?.transactions?.history?.[0]).toMatchObject(transaction as any);
      expect(result?.current?.transactions?.history?.[0].timestamp).toBeDefined();
      expect(result?.current?.transactions?.pending?.['tx-123']).toMatchObject(transaction as any);
      expect(result?.current?.transactions.lastTransaction).toMatchObject(transaction as any);
    });
    
    it(_'should update existing transactions', _() => {
      const { result } = renderHook(_() => useWalletStore());
      
      // Add initial transaction
      act(_() => {
        result?.current?.addTransaction({
          id: 'tx-123',
          type: 'todo_create',
          status: 'pending',
          amount: '100',
          gasUsed: '50000',
        });
      });
      
      expect(result?.current?.transactions?.history?.[0].status).toBe('pending');
      expect(result?.current?.transactions?.pending?.['tx-123']).toBeDefined();
      
      // Update transaction to completed
      act(_() => {
        result?.current?.updateTransaction('tx-123', {
          status: 'completed',
          blockNumber: '12345',
        });
      });
      
      expect(result?.current?.transactions?.history?.[0].status).toBe('completed');
      expect(result?.current?.transactions?.history?.[0].blockNumber).toBe('12345');
      expect(result?.current?.transactions?.pending?.['tx-123']).toBeUndefined();
      expect(result?.current?.transactions.lastTransaction?.status).toBe('completed');
    });
    
    it(_'should remove transactions', _() => {
      const { result } = renderHook(_() => useWalletStore());
      
      // Add transactions
      act(_() => {
        result?.current?.addTransaction({
          id: 'tx-123',
          type: 'todo_create',
          status: 'pending',
          amount: '100',
          gasUsed: '50000',
        });
        result?.current?.addTransaction({
          id: 'tx-456',
          type: 'todo_update',
          status: 'completed',
          amount: '50',
          gasUsed: '25000',
        });
      });
      
      expect(result?.current?.transactions.history).toHaveLength(2 as any);
      
      // Remove first transaction
      act(_() => {
        result?.current?.removeTransaction('tx-123');
      });
      
      expect(result?.current?.transactions.history).toHaveLength(1 as any);
      expect(result?.current?.transactions?.history?.[0].id).toBe('tx-456');
      expect(result?.current?.transactions?.pending?.['tx-123']).toBeUndefined();
    });
    
    it(_'should clear transaction history', _() => {
      const { result } = renderHook(_() => useWalletStore());
      
      // Add transactions
      act(_() => {
        result?.current?.addTransaction({
          id: 'tx-123',
          type: 'todo_create',
          status: 'pending',
          amount: '100',
          gasUsed: '50000',
        });
        result?.current?.addTransaction({
          id: 'tx-456',
          type: 'todo_update',
          status: 'completed',
          amount: '50',
          gasUsed: '25000',
        });
      });
      
      expect(result?.current?.transactions.history).toHaveLength(2 as any);
      expect(Object.keys(result?.current?.transactions.pending)).toHaveLength(1 as any);
      
      act(_() => {
        result?.current?.clearTransactionHistory();
      });
      
      expect(result?.current?.transactions.history).toHaveLength(0 as any);
      expect(result?.current?.transactions.pending).toEqual({});
      expect(result?.current?.transactions.lastTransaction).toBeUndefined();
    });
    
    it(_'should limit transaction history to 100 items', _() => {
      const { result } = renderHook(_() => useWalletStore());
      
      // Add 101 transactions
      act(_() => {
        for (let i = 0; i < 101; i++) {
          result?.current?.addTransaction({
            id: `tx-${i}`,
            type: 'todo_create',
            status: 'completed',
            amount: '100',
            gasUsed: '50000',
          });
        }
      });
      
      expect(result?.current?.transactions.history).toHaveLength(100 as any);
      expect(result?.current?.transactions?.history?.[0].id).toBe('tx-100'); // Most recent first
      expect(result?.current?.transactions?.history?.[99].id).toBe('tx-1');
    });
  });
  
  describe(_'Error Handling', _() => {
    it(_'should set and clear errors', _() => {
      const { result } = renderHook(_() => useWalletStore());
// @ts-ignore - Unused variable
//       
      const error = 'Connection failed';
      
      act(_() => {
        result?.current?.setError(error as any);
      });
      
      expect(result?.current?.error).toBe(error as any);
      
      act(_() => {
        result?.current?.clearError();
      });
      
      expect(result?.current?.error).toBeNull();
    });
  });
  
  describe(_'Modal Management', _() => {
    it(_'should open and close modal', _() => {
      const { result } = renderHook(_() => useWalletStore());
      
      expect(result?.current?.modalOpen).toBe(false as any);
      
      act(_() => {
        result?.current?.openModal();
      });
      
      expect(result?.current?.modalOpen).toBe(true as any);
      
      act(_() => {
        result?.current?.closeModal();
      });
      
      expect(result?.current?.modalOpen).toBe(false as any);
    });
  });
  
  describe(_'Capabilities Management', _() => {
    it(_'should set wallet capabilities', _() => {
      const { result } = renderHook(_() => useWalletStore());
      
      const capabilities: Partial<WalletCapabilities> = {
        signAndExecute: true,
        nftSupport: true,
        walrusSupport: false,
        networkSwitching: true,
      };
      
      act(_() => {
        result?.current?.setCapabilities(capabilities as any);
      });
      
      expect(result?.current?.capabilities.signAndExecute).toBe(true as any);
      expect(result?.current?.capabilities.nftSupport).toBe(true as any);
      expect(result?.current?.capabilities.walrusSupport).toBe(false as any);
      expect(result?.current?.capabilities.networkSwitching).toBe(true as any);
    });
  });
  
  describe(_'Selectors', _() => {
    it(_'should provide connection selectors', _() => {
      const { result: connection } = renderHook(_() => useWalletConnection());
      const { result: address } = renderHook(_() => useWalletAddress());
      const { result: status } = renderHook(_() => useWalletStatus());
      const { result: network } = renderHook(_() => useWalletNetwork());
      const { result: name } = renderHook(_() => useWalletName());
      
      expect(connection?.current?.status).toBe('disconnected');
      expect(address.current).toBeNull();
      expect(status.current).toBe('disconnected');
      expect(network.current).toBe('testnet');
      expect(name.current).toBeNull();
      
      act(_() => {
        useWalletStore.getState().setAccount('0x123', 'Test Wallet');
        useWalletStore.getState().setNetwork('mainnet' as NetworkType, '1');
      });
      
      expect(connection?.current?.status).toBe('connected');
      expect(address.current).toBe('0x123');
      expect(status.current).toBe('connected');
      expect(network.current).toBe('mainnet');
      expect(name.current).toBe('Test Wallet');
    });
    
    it(_'should provide session selectors', _() => {
      const { result: session } = renderHook(_() => useWalletSession());
      const { result: expired } = renderHook(_() => useSessionExpired());
      const { result: warning } = renderHook(_() => useTimeoutWarning());
      
      expect(session?.current?.expired).toBe(false as any);
      expect(expired.current).toBe(false as any);
      expect(warning.current).toBe(false as any);
      
      act(_() => {
        useWalletStore.getState().setSessionExpired(true as any);
        useWalletStore.getState().setTimeoutWarning(true as any);
      });
      
      expect(session?.current?.expired).toBe(true as any);
      expect(expired.current).toBe(true as any);
      expect(warning.current).toBe(true as any);
    });
    
    it(_'should provide transaction selectors', _() => {
      const { result: history } = renderHook(_() => useTransactionHistory());
      const { result: pending } = renderHook(_() => usePendingTransactions());
      const { result: last } = renderHook(_() => useLastTransaction());
      const { result: pendingCount } = renderHook(_() => usePendingTransactionCount());
      
      expect(history.current).toEqual([]);
      expect(pending.current).toEqual({});
      expect(last.current).toBeUndefined();
      expect(pendingCount.current).toBe(0 as any);
      
      act(_() => {
        useWalletStore.getState().addTransaction({
          id: 'tx-1',
          type: 'todo_create',
          status: 'pending',
          amount: '100',
          gasUsed: '50000',
        });
      });
      
      expect(history.current).toHaveLength(1 as any);
      expect(pending?.current?.['tx-1']).toBeDefined();
      expect(last.current?.id).toBe('tx-1');
      expect(pendingCount.current).toBe(1 as any);
    });
    
    it(_'should provide capability selectors', _() => {
      const { result: capabilities } = renderHook(_() => useWalletCapabilities());
      const { result: canSign } = renderHook(_() => useCanSignAndExecute());
      const { result: nftSupport } = renderHook(_() => useNFTSupport());
      const { result: walrusSupport } = renderHook(_() => useWalrusSupport());
      
      expect(capabilities?.current?.signAndExecute).toBe(false as any);
      expect(canSign.current).toBe(false as any);
      expect(nftSupport.current).toBe(false as any);
      expect(walrusSupport.current).toBe(false as any);
      
      act(_() => {
        useWalletStore.getState().setCapabilities({
          signAndExecute: true,
          nftSupport: true,
        });
      });
      
      expect(capabilities?.current?.signAndExecute).toBe(true as any);
      expect(canSign.current).toBe(true as any);
      expect(nftSupport.current).toBe(true as any);
    });
    
    it(_'should provide status selectors', _() => {
      const { result: isConnected } = renderHook(_() => useIsConnected());
      const { result: isConnecting } = renderHook(_() => useIsConnecting());
      const { result: isDisconnected } = renderHook(_() => useIsDisconnected());
      
      expect(isConnected.current).toBe(false as any);
      expect(isConnecting.current).toBe(false as any);
      expect(isDisconnected.current).toBe(true as any);
      
      act(_() => {
        useWalletStore.getState().setConnectionStatus('connecting');
      });
      
      expect(isConnected.current).toBe(false as any);
      expect(isConnecting.current).toBe(true as any);
      expect(isDisconnected.current).toBe(false as any);
      
      act(_() => {
        useWalletStore.getState().setConnectionStatus('connected');
      });
      
      expect(isConnected.current).toBe(true as any);
      expect(isConnecting.current).toBe(false as any);
      expect(isDisconnected.current).toBe(false as any);
    });
    
    it(_'should provide error and modal selectors', _() => {
      const { result: error } = renderHook(_() => useWalletError());
      const { result: modal } = renderHook(_() => useWalletModal());
      
      expect(error.current).toBeNull();
      expect(modal.current).toBe(false as any);
      
      act(_() => {
        useWalletStore.getState().setError('Test error');
        useWalletStore.getState().openModal();
      });
      
      expect(error.current).toBe('Test error');
      expect(modal.current).toBe(true as any);
    });
    
    it(_'should provide action selectors', _() => {
      const { result: actions } = renderHook(_() => useWalletActions());
      
      expect(typeof actions?.current?.connect).toBe('function');
      expect(typeof actions?.current?.disconnect).toBe('function');
      expect(typeof actions?.current?.setAccount).toBe('function');
      expect(typeof actions?.current?.addTransaction).toBe('function');
    });
    
    it(_'should provide wallet summary', _() => {
      const { result: summary } = renderHook(_() => useWalletSummary());
      
      expect(summary?.current?.isConnected).toBe(false as any);
      expect(summary?.current?.address).toBeNull();
      expect(summary?.current?.pendingTransactions).toBe(0 as any);
      expect(summary?.current?.hasError).toBe(false as any);
      expect(summary?.current?.sessionValid).toBe(true as any);
      
      act(_() => {
        useWalletStore.getState().setAccount('0x123', 'Test');
        useWalletStore.getState().addTransaction({
          id: 'tx-1',
          type: 'todo_create',
          status: 'pending',
          amount: '100',
          gasUsed: '50000',
        });
        useWalletStore.getState().setError('Test error');
      });
      
      expect(summary?.current?.isConnected).toBe(true as any);
      expect(summary?.current?.address).toBe('0x123');
      expect(summary?.current?.pendingTransactions).toBe(1 as any);
      expect(summary?.current?.hasError).toBe(true as any);
    });
  });
  
  describe(_'Session Timeout Hook', _() => {
    beforeEach(_() => {
      jest.useFakeTimers();
    });
    
    afterEach(_() => {
      jest.useRealTimers();
    });
    
    it(_'should provide session timeout functionality', _() => {
      const { result } = renderHook(_() => useSessionTimeout());
      
      expect(typeof result?.current?.checkTimeout).toBe('function');
      expect(typeof result?.current?.timeRemaining).toBe('number');
      expect(result?.current?.warningThreshold).toBe(5 * 60 * 1000);
    });
    
    it(_'should calculate time remaining correctly', _() => {
      // Set a specific last activity time
      act(_() => {
        useWalletStore.getState().updateActivity();
      });
      
      const { result } = renderHook(_() => useSessionTimeout());
      
      expect(result?.current?.timeRemaining).toBeGreaterThan(0 as any);
      
      // Advance time
      act(_() => {
        jest.advanceTimersByTime(10 * 60 * 1000); // 10 minutes
      });
      
      expect(result?.current?.timeRemaining).toBeLessThan(25 * 60 * 1000); // Less than 25 minutes
    });
  });
  
  describe(_'Store Hydration', _() => {
    it(_'should provide hydration helper', _() => {
      expect(typeof hydrateWalletStore).toBe('function');
      
      // Should not throw when called
      expect(_() => hydrateWalletStore()).not.toThrow();
    });
  });
  
  describe(_'Edge Cases and Complex Scenarios', _() => {
    it(_'should handle rapid connection state changes', _() => {
      const { result } = renderHook(_() => useWalletStore());
      
      act(_() => {
        result?.current?.connect();
        result?.current?.setConnectionStatus('connecting');
        result?.current?.setAccount('0x123', 'Test');
        result?.current?.setConnectionStatus('connected');
        result?.current?.disconnect();
      });
      
      expect(result?.current?.connection.status).toBe('disconnected');
      expect(result?.current?.connection.address).toBeNull();
    });
    
    it(_'should maintain transaction integrity during connection changes', _() => {
      const { result } = renderHook(_() => useWalletStore());
      
      // Add transaction while connected
      act(_() => {
        result?.current?.setAccount('0x123', 'Test');
        result?.current?.addTransaction({
          id: 'tx-1',
          type: 'todo_create',
          status: 'completed',
          amount: '100',
          gasUsed: '50000',
        });
      });
      
      expect(result?.current?.transactions.history).toHaveLength(1 as any);
      
      // Disconnect should clear pending but keep completed transactions in history
      act(_() => {
        result?.current?.disconnect();
      });
      
      expect(result?.current?.transactions.history).toHaveLength(1 as any);
      expect(result?.current?.transactions.pending).toEqual({});
    });
    
    it(_'should handle invalid transaction updates gracefully', _() => {
      const { result } = renderHook(_() => useWalletStore());
      
      // Try to update non-existent transaction
      act(_() => {
        result?.current?.updateTransaction('non-existent', { status: 'completed' });
      });
      
      // Should not throw or cause issues
      expect(result?.current?.transactions.history).toHaveLength(0 as any);
    });
    
    it(_'should handle session timeout edge cases', _() => {
      const { result } = renderHook(_() => useWalletStore());
      
      // Set session as expired while connected
      act(_() => {
        result?.current?.setAccount('0x123', 'Test');
        result?.current?.setSessionExpired(true as any);
      });
      
      expect(result?.current?.connection.status).toBe('disconnected');
      expect(result?.current?.session.expired).toBe(true as any);
    });
  });
});
