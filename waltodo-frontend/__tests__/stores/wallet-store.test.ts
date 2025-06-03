/**
 * Comprehensive tests for Wallet Store
 * Tests wallet connection state, transactions, and session management
 */

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
jest.mock('zustand/middleware', () => ({
  ...jest.requireActual('zustand/middleware'),
  persist: (fn: any, options: any) => fn,
  devtools: (fn: any, options: any) => fn,
  subscribeWithSelector: (fn: any) => fn,
}));

describe('Wallet Store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store to initial state
    useWalletStore.getState().disconnect();
    useWalletStore.getState().clearError();
    useWalletStore.getState().clearTransactionHistory();
  });
  
  describe('Connection Management', () => {
    it('should handle connection flow', () => {
      const { result } = renderHook(() => useWalletStore());
      
      // Initial state
      expect(result.current.connection.status).toBe('disconnected');
      expect(result.current.connection.address).toBeNull();
      
      // Start connection
      act(() => {
        result.current.connect();
      });
      
      expect(result.current.connection.status).toBe('connecting');
      expect(result.current.error).toBeNull();
      
      // Set account after connection
      act(() => {
        result.current.setAccount('0x1234567890abcdef', 'Test Wallet');
      });
      
      expect(result.current.connection.status).toBe('connected');
      expect(result.current.connection.address).toBe('0x1234567890abcdef');
      expect(result.current.connection.name).toBe('Test Wallet');
    });
    
    it('should handle disconnection', () => {
      const { result } = renderHook(() => useWalletStore());
      
      // Set up connected state first
      act(() => {
        result.current.setAccount('0x1234567890abcdef', 'Test Wallet');
        result.current.setNetwork('mainnet' as NetworkType, '1');
        result.current.addTransaction({
          id: 'tx-1',
          type: 'todo_create',
          status: 'pending',
          amount: '100',
          gasUsed: '50000',
        });
      });
      
      expect(result.current.connection.status).toBe('connected');
      expect(result.current.connection.address).toBe('0x1234567890abcdef');
      
      // Disconnect
      act(() => {
        result.current.disconnect();
      });
      
      expect(result.current.connection.status).toBe('disconnected');
      expect(result.current.connection.address).toBeNull();
      expect(result.current.connection.name).toBeNull();
      expect(result.current.connection.chainId).toBeNull();
      expect(result.current.connection.network).toBe('mainnet'); // Network preference preserved
      expect(result.current.transactions.pending).toEqual({});
      expect(result.current.error).toBeNull();
      expect(result.current.modalOpen).toBe(false);
    });
    
    it('should handle connection status changes', () => {
      const { result } = renderHook(() => useWalletStore());
      
      act(() => {
        result.current.setConnectionStatus('connecting');
      });
      
      expect(result.current.connection.status).toBe('connecting');
      
      act(() => {
        result.current.setConnectionStatus('connected');
      });
      
      expect(result.current.connection.status).toBe('connected');
      expect(result.current.session.expired).toBe(false);
      expect(result.current.session.timeoutWarning).toBe(false);
      expect(result.current.error).toBeNull();
      
      act(() => {
        result.current.setConnectionStatus('error');
      });
      
      expect(result.current.connection.status).toBe('error');
      expect(result.current.connection.address).toBeNull();
      expect(result.current.connection.name).toBeNull();
    });
    
    it('should handle network changes', () => {
      const { result } = renderHook(() => useWalletStore());
      
      act(() => {
        result.current.setNetwork('testnet' as NetworkType, '5');
      });
      
      expect(result.current.connection.network).toBe('testnet');
      expect(result.current.connection.chainId).toBe('5');
    });
  });
  
  describe('Session Management', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    
    afterEach(() => {
      jest.useRealTimers();
    });
    
    it('should update activity timestamp', () => {
      const { result } = renderHook(() => useWalletStore());
      
      const initialActivity = result.current.session.lastActivity;
      
      act(() => {
        jest.advanceTimersByTime(1000);
        result.current.updateActivity();
      });
      
      expect(result.current.session.lastActivity).toBeGreaterThan(initialActivity);
      expect(result.current.session.expired).toBe(false);
      expect(result.current.session.timeoutWarning).toBe(false);
    });
    
    it('should handle session expiration', () => {
      const { result } = renderHook(() => useWalletStore());
      
      // Set up connected state first
      act(() => {
        result.current.setAccount('0x1234567890abcdef', 'Test Wallet');
      });
      
      expect(result.current.connection.status).toBe('connected');
      
      act(() => {
        result.current.setSessionExpired(true);
      });
      
      expect(result.current.session.expired).toBe(true);
      expect(result.current.connection.status).toBe('disconnected');
      expect(result.current.connection.address).toBeNull();
    });
    
    it('should handle timeout warnings', () => {
      const { result } = renderHook(() => useWalletStore());
      
      act(() => {
        result.current.setTimeoutWarning(true);
      });
      
      expect(result.current.session.timeoutWarning).toBe(true);
      
      act(() => {
        result.current.setTimeoutWarning(false);
      });
      
      expect(result.current.session.timeoutWarning).toBe(false);
    });
    
    it('should reset session', () => {
      const { result } = renderHook(() => useWalletStore());
      
      // Modify session state
      act(() => {
        result.current.setSessionExpired(true);
        result.current.setTimeoutWarning(true);
      });
      
      expect(result.current.session.expired).toBe(true);
      expect(result.current.session.timeoutWarning).toBe(true);
      
      act(() => {
        result.current.resetSession();
      });
      
      expect(result.current.session.expired).toBe(false);
      expect(result.current.session.timeoutWarning).toBe(false);
      expect(result.current.session.lastActivity).toBeGreaterThan(0);
    });
  });
  
  describe('Transaction Management', () => {
    it('should add transactions correctly', () => {
      const { result } = renderHook(() => useWalletStore());
      
      const transaction: Omit<TransactionRecord, 'timestamp'> = {
        id: 'tx-123',
        type: 'todo_create',
        status: 'pending',
        amount: '100',
        gasUsed: '50000',
        description: 'Create new todo',
      };
      
      act(() => {
        result.current.addTransaction(transaction);
      });
      
      expect(result.current.transactions.history).toHaveLength(1);
      expect(result.current.transactions.history[0]).toMatchObject(transaction);
      expect(result.current.transactions.history[0].timestamp).toBeDefined();
      expect(result.current.transactions.pending['tx-123']).toMatchObject(transaction);
      expect(result.current.transactions.lastTransaction).toMatchObject(transaction);
    });
    
    it('should update existing transactions', () => {
      const { result } = renderHook(() => useWalletStore());
      
      // Add initial transaction
      act(() => {
        result.current.addTransaction({
          id: 'tx-123',
          type: 'todo_create',
          status: 'pending',
          amount: '100',
          gasUsed: '50000',
        });
      });
      
      expect(result.current.transactions.history[0].status).toBe('pending');
      expect(result.current.transactions.pending['tx-123']).toBeDefined();
      
      // Update transaction to completed
      act(() => {
        result.current.updateTransaction('tx-123', {
          status: 'completed',
          blockNumber: '12345',
        });
      });
      
      expect(result.current.transactions.history[0].status).toBe('completed');
      expect(result.current.transactions.history[0].blockNumber).toBe('12345');
      expect(result.current.transactions.pending['tx-123']).toBeUndefined();
      expect(result.current.transactions.lastTransaction?.status).toBe('completed');
    });
    
    it('should remove transactions', () => {
      const { result } = renderHook(() => useWalletStore());
      
      // Add transactions
      act(() => {
        result.current.addTransaction({
          id: 'tx-123',
          type: 'todo_create',
          status: 'pending',
          amount: '100',
          gasUsed: '50000',
        });
        result.current.addTransaction({
          id: 'tx-456',
          type: 'todo_update',
          status: 'completed',
          amount: '50',
          gasUsed: '25000',
        });
      });
      
      expect(result.current.transactions.history).toHaveLength(2);
      
      // Remove first transaction
      act(() => {
        result.current.removeTransaction('tx-123');
      });
      
      expect(result.current.transactions.history).toHaveLength(1);
      expect(result.current.transactions.history[0].id).toBe('tx-456');
      expect(result.current.transactions.pending['tx-123']).toBeUndefined();
    });
    
    it('should clear transaction history', () => {
      const { result } = renderHook(() => useWalletStore());
      
      // Add transactions
      act(() => {
        result.current.addTransaction({
          id: 'tx-123',
          type: 'todo_create',
          status: 'pending',
          amount: '100',
          gasUsed: '50000',
        });
        result.current.addTransaction({
          id: 'tx-456',
          type: 'todo_update',
          status: 'completed',
          amount: '50',
          gasUsed: '25000',
        });
      });
      
      expect(result.current.transactions.history).toHaveLength(2);
      expect(Object.keys(result.current.transactions.pending)).toHaveLength(1);
      
      act(() => {
        result.current.clearTransactionHistory();
      });
      
      expect(result.current.transactions.history).toHaveLength(0);
      expect(result.current.transactions.pending).toEqual({});
      expect(result.current.transactions.lastTransaction).toBeUndefined();
    });
    
    it('should limit transaction history to 100 items', () => {
      const { result } = renderHook(() => useWalletStore());
      
      // Add 101 transactions
      act(() => {
        for (let i = 0; i < 101; i++) {
          result.current.addTransaction({
            id: `tx-${i}`,
            type: 'todo_create',
            status: 'completed',
            amount: '100',
            gasUsed: '50000',
          });
        }
      });
      
      expect(result.current.transactions.history).toHaveLength(100);
      expect(result.current.transactions.history[0].id).toBe('tx-100'); // Most recent first
      expect(result.current.transactions.history[99].id).toBe('tx-1');
    });
  });
  
  describe('Error Handling', () => {
    it('should set and clear errors', () => {
      const { result } = renderHook(() => useWalletStore());
      
      const error = 'Connection failed';
      
      act(() => {
        result.current.setError(error);
      });
      
      expect(result.current.error).toBe(error);
      
      act(() => {
        result.current.clearError();
      });
      
      expect(result.current.error).toBeNull();
    });
  });
  
  describe('Modal Management', () => {
    it('should open and close modal', () => {
      const { result } = renderHook(() => useWalletStore());
      
      expect(result.current.modalOpen).toBe(false);
      
      act(() => {
        result.current.openModal();
      });
      
      expect(result.current.modalOpen).toBe(true);
      
      act(() => {
        result.current.closeModal();
      });
      
      expect(result.current.modalOpen).toBe(false);
    });
  });
  
  describe('Capabilities Management', () => {
    it('should set wallet capabilities', () => {
      const { result } = renderHook(() => useWalletStore());
      
      const capabilities: Partial<WalletCapabilities> = {
        signAndExecute: true,
        nftSupport: true,
        walrusSupport: false,
        networkSwitching: true,
      };
      
      act(() => {
        result.current.setCapabilities(capabilities);
      });
      
      expect(result.current.capabilities.signAndExecute).toBe(true);
      expect(result.current.capabilities.nftSupport).toBe(true);
      expect(result.current.capabilities.walrusSupport).toBe(false);
      expect(result.current.capabilities.networkSwitching).toBe(true);
    });
  });
  
  describe('Selectors', () => {
    it('should provide connection selectors', () => {
      const { result: connection } = renderHook(() => useWalletConnection());
      const { result: address } = renderHook(() => useWalletAddress());
      const { result: status } = renderHook(() => useWalletStatus());
      const { result: network } = renderHook(() => useWalletNetwork());
      const { result: name } = renderHook(() => useWalletName());
      
      expect(connection.current.status).toBe('disconnected');
      expect(address.current).toBeNull();
      expect(status.current).toBe('disconnected');
      expect(network.current).toBe('testnet');
      expect(name.current).toBeNull();
      
      act(() => {
        useWalletStore.getState().setAccount('0x123', 'Test Wallet');
        useWalletStore.getState().setNetwork('mainnet' as NetworkType, '1');
      });
      
      expect(connection.current.status).toBe('connected');
      expect(address.current).toBe('0x123');
      expect(status.current).toBe('connected');
      expect(network.current).toBe('mainnet');
      expect(name.current).toBe('Test Wallet');
    });
    
    it('should provide session selectors', () => {
      const { result: session } = renderHook(() => useWalletSession());
      const { result: expired } = renderHook(() => useSessionExpired());
      const { result: warning } = renderHook(() => useTimeoutWarning());
      
      expect(session.current.expired).toBe(false);
      expect(expired.current).toBe(false);
      expect(warning.current).toBe(false);
      
      act(() => {
        useWalletStore.getState().setSessionExpired(true);
        useWalletStore.getState().setTimeoutWarning(true);
      });
      
      expect(session.current.expired).toBe(true);
      expect(expired.current).toBe(true);
      expect(warning.current).toBe(true);
    });
    
    it('should provide transaction selectors', () => {
      const { result: history } = renderHook(() => useTransactionHistory());
      const { result: pending } = renderHook(() => usePendingTransactions());
      const { result: last } = renderHook(() => useLastTransaction());
      const { result: pendingCount } = renderHook(() => usePendingTransactionCount());
      
      expect(history.current).toEqual([]);
      expect(pending.current).toEqual({});
      expect(last.current).toBeUndefined();
      expect(pendingCount.current).toBe(0);
      
      act(() => {
        useWalletStore.getState().addTransaction({
          id: 'tx-1',
          type: 'todo_create',
          status: 'pending',
          amount: '100',
          gasUsed: '50000',
        });
      });
      
      expect(history.current).toHaveLength(1);
      expect(pending.current['tx-1']).toBeDefined();
      expect(last.current?.id).toBe('tx-1');
      expect(pendingCount.current).toBe(1);
    });
    
    it('should provide capability selectors', () => {
      const { result: capabilities } = renderHook(() => useWalletCapabilities());
      const { result: canSign } = renderHook(() => useCanSignAndExecute());
      const { result: nftSupport } = renderHook(() => useNFTSupport());
      const { result: walrusSupport } = renderHook(() => useWalrusSupport());
      
      expect(capabilities.current.signAndExecute).toBe(false);
      expect(canSign.current).toBe(false);
      expect(nftSupport.current).toBe(false);
      expect(walrusSupport.current).toBe(false);
      
      act(() => {
        useWalletStore.getState().setCapabilities({
          signAndExecute: true,
          nftSupport: true,
        });
      });
      
      expect(capabilities.current.signAndExecute).toBe(true);
      expect(canSign.current).toBe(true);
      expect(nftSupport.current).toBe(true);
    });
    
    it('should provide status selectors', () => {
      const { result: isConnected } = renderHook(() => useIsConnected());
      const { result: isConnecting } = renderHook(() => useIsConnecting());
      const { result: isDisconnected } = renderHook(() => useIsDisconnected());
      
      expect(isConnected.current).toBe(false);
      expect(isConnecting.current).toBe(false);
      expect(isDisconnected.current).toBe(true);
      
      act(() => {
        useWalletStore.getState().setConnectionStatus('connecting');
      });
      
      expect(isConnected.current).toBe(false);
      expect(isConnecting.current).toBe(true);
      expect(isDisconnected.current).toBe(false);
      
      act(() => {
        useWalletStore.getState().setConnectionStatus('connected');
      });
      
      expect(isConnected.current).toBe(true);
      expect(isConnecting.current).toBe(false);
      expect(isDisconnected.current).toBe(false);
    });
    
    it('should provide error and modal selectors', () => {
      const { result: error } = renderHook(() => useWalletError());
      const { result: modal } = renderHook(() => useWalletModal());
      
      expect(error.current).toBeNull();
      expect(modal.current).toBe(false);
      
      act(() => {
        useWalletStore.getState().setError('Test error');
        useWalletStore.getState().openModal();
      });
      
      expect(error.current).toBe('Test error');
      expect(modal.current).toBe(true);
    });
    
    it('should provide action selectors', () => {
      const { result: actions } = renderHook(() => useWalletActions());
      
      expect(typeof actions.current.connect).toBe('function');
      expect(typeof actions.current.disconnect).toBe('function');
      expect(typeof actions.current.setAccount).toBe('function');
      expect(typeof actions.current.addTransaction).toBe('function');
    });
    
    it('should provide wallet summary', () => {
      const { result: summary } = renderHook(() => useWalletSummary());
      
      expect(summary.current.isConnected).toBe(false);
      expect(summary.current.address).toBeNull();
      expect(summary.current.pendingTransactions).toBe(0);
      expect(summary.current.hasError).toBe(false);
      expect(summary.current.sessionValid).toBe(true);
      
      act(() => {
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
      
      expect(summary.current.isConnected).toBe(true);
      expect(summary.current.address).toBe('0x123');
      expect(summary.current.pendingTransactions).toBe(1);
      expect(summary.current.hasError).toBe(true);
    });
  });
  
  describe('Session Timeout Hook', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    
    afterEach(() => {
      jest.useRealTimers();
    });
    
    it('should provide session timeout functionality', () => {
      const { result } = renderHook(() => useSessionTimeout());
      
      expect(typeof result.current.checkTimeout).toBe('function');
      expect(typeof result.current.timeRemaining).toBe('number');
      expect(result.current.warningThreshold).toBe(5 * 60 * 1000);
    });
    
    it('should calculate time remaining correctly', () => {
      // Set a specific last activity time
      act(() => {
        useWalletStore.getState().updateActivity();
      });
      
      const { result } = renderHook(() => useSessionTimeout());
      
      expect(result.current.timeRemaining).toBeGreaterThan(0);
      
      // Advance time
      act(() => {
        jest.advanceTimersByTime(10 * 60 * 1000); // 10 minutes
      });
      
      expect(result.current.timeRemaining).toBeLessThan(25 * 60 * 1000); // Less than 25 minutes
    });
  });
  
  describe('Store Hydration', () => {
    it('should provide hydration helper', () => {
      expect(typeof hydrateWalletStore).toBe('function');
      
      // Should not throw when called
      expect(() => hydrateWalletStore()).not.toThrow();
    });
  });
  
  describe('Edge Cases and Complex Scenarios', () => {
    it('should handle rapid connection state changes', () => {
      const { result } = renderHook(() => useWalletStore());
      
      act(() => {
        result.current.connect();
        result.current.setConnectionStatus('connecting');
        result.current.setAccount('0x123', 'Test');
        result.current.setConnectionStatus('connected');
        result.current.disconnect();
      });
      
      expect(result.current.connection.status).toBe('disconnected');
      expect(result.current.connection.address).toBeNull();
    });
    
    it('should maintain transaction integrity during connection changes', () => {
      const { result } = renderHook(() => useWalletStore());
      
      // Add transaction while connected
      act(() => {
        result.current.setAccount('0x123', 'Test');
        result.current.addTransaction({
          id: 'tx-1',
          type: 'todo_create',
          status: 'completed',
          amount: '100',
          gasUsed: '50000',
        });
      });
      
      expect(result.current.transactions.history).toHaveLength(1);
      
      // Disconnect should clear pending but keep completed transactions in history
      act(() => {
        result.current.disconnect();
      });
      
      expect(result.current.transactions.history).toHaveLength(1);
      expect(result.current.transactions.pending).toEqual({});
    });
    
    it('should handle invalid transaction updates gracefully', () => {
      const { result } = renderHook(() => useWalletStore());
      
      // Try to update non-existent transaction
      act(() => {
        result.current.updateTransaction('non-existent', { status: 'completed' });
      });
      
      // Should not throw or cause issues
      expect(result.current.transactions.history).toHaveLength(0);
    });
    
    it('should handle session timeout edge cases', () => {
      const { result } = renderHook(() => useWalletStore());
      
      // Set session as expired while connected
      act(() => {
        result.current.setAccount('0x123', 'Test');
        result.current.setSessionExpired(true);
      });
      
      expect(result.current.connection.status).toBe('disconnected');
      expect(result.current.session.expired).toBe(true);
    });
  });
});
