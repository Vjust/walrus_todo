/**
 * Tests for React hooks and components
 */

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  WalTodoWalletProvider,
  useWalTodoWallet,
  useCurrentAccount,
  useExecuteTxn,
  useWalletConnection,
  useTransactionExecution,
  useTodoNFTOperations,
  useAppConfig,
} from '../react';

// Mock the dependencies
jest.mock('@mysten/dapp-kit', () => ({
  createNetworkConfig: jest.fn(() => ({ networkConfig: {} })),
  SuiClientProvider: ({ children }: any) => <div data-testid="sui-client-provider">{children}</div>,
  WalletProvider: ({ children }: any) => <div data-testid="wallet-provider">{children}</div>,
  useCurrentAccount: jest.fn(() => ({ address: '0x123' })),
  useConnectWallet: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useDisconnectWallet: jest.fn(() => ({ mutate: jest.fn() })),
  useSignAndExecuteTransaction: jest.fn(() => ({ 
    mutateAsync: jest.fn().mockResolvedValue({ 
      digest: 'test-digest',
      effects: { status: { status: 'success' } }
    })
  })),
  ConnectModal: ({ children, open }: any) => open ? <div data-testid="connect-modal">{children}</div> : null,
  useWallets: jest.fn(() => []),
  useSuiClient: jest.fn(() => ({
    getOwnedObjects: jest.fn().mockResolvedValue({ data: [] }),
    getObject: jest.fn(),
    getTransactionBlock: jest.fn(),
  })),
}));

jest.mock('@mysten/sui/client', () => ({
  getFullnodeUrl: jest.fn((network: string) => `https://fullnode.${network}.sui.io:443`),
}));

jest.mock('@mysten/sui/transactions', () => ({
  Transaction: jest.fn().mockImplementation(() => ({
    setSender: jest.fn(),
    moveCall: jest.fn(),
    object: jest.fn(),
    pure: jest.fn(),
  })),
}));

jest.mock('@mysten/sui/bcs', () => ({
  bcs: {
    string: () => ({ serialize: jest.fn((val) => val) }),
    bool: () => ({ serialize: jest.fn((val) => val) }),
  },
}));

jest.mock('@tanstack/react-query', () => ({
  QueryClient: jest.fn().mockImplementation(() => ({})),
  QueryClientProvider: ({ children }: any) => <div data-testid="query-client-provider">{children}</div>,
}));

// Mock config loading
jest.mock('../config', () => ({
  loadAppConfig: jest.fn().mockResolvedValue({
    network: { name: 'testnet', url: 'https://fullnode.testnet.sui.io:443' },
    contracts: {
      todoNft: {
        packageId: '0xtest',
        moduleName: 'todo_nft',
        structName: 'TodoNFT',
      },
    },
    features: { aiEnabled: true },
    deployment: { packageId: '0xtest', deployerAddress: '0xdeployer' },
    walrus: { networkUrl: '', publisherUrl: '', aggregatorUrl: '', apiPrefix: '' },
  }),
}));

// Mock compatibility functions
jest.mock('../compatibility', () => ({
  normalizeTransactionResult: jest.fn((result) => result),
  normalizeOwnedObjectsResponse: jest.fn((response) => response || { data: [] }),
  checkVersionCompatibility: jest.fn(),
  ReactCompatibility: {
    useSafeCurrentAccount: jest.fn((hook) => hook()),
    useSafeWalletConnection: jest.fn((hook) => hook()),
    useSafeTransactionExecution: jest.fn((hook) => hook()),
  },
}));

// Test component to access hooks
function TestComponent() {
  const wallet = useWalTodoWallet();
  const account = useCurrentAccount();
  const executeTxn = useExecuteTxn();
  const connection = useWalletConnection();
  const transactionExecution = useTransactionExecution();
  const todoOps = useTodoNFTOperations();
  const config = useAppConfig();

  return (
    <div>
      <div data-testid="connected">{wallet.connected ? 'true' : 'false'}</div>
      <div data-testid="account">{account?.address || 'none'}</div>
      <div data-testid="execute-available">{typeof executeTxn === 'function' ? 'true' : 'false'}</div>
      <div data-testid="connection-available">{typeof connection.connect === 'function' ? 'true' : 'false'}</div>
      <div data-testid="transaction-execution-available">{typeof transactionExecution.executeTransaction === 'function' ? 'true' : 'false'}</div>
      <div data-testid="todo-ops-available">{typeof todoOps.createTodoNFT === 'function' ? 'true' : 'false'}</div>
      <div data-testid="config-loading">{config.loading ? 'true' : 'false'}</div>
    </div>
  );
}

describe('React Components and Hooks', () => {
  describe('WalTodoWalletProvider', () => {
    it('should render provider components', () => {
      render(
        <WalTodoWalletProvider>
          <div data-testid="child">Test Child</div>
        </WalTodoWalletProvider>
      );

      expect(screen.getByTestId('query-client-provider')).toBeInTheDocument();
      expect(screen.getByTestId('sui-client-provider')).toBeInTheDocument();
      expect(screen.getByTestId('wallet-provider')).toBeInTheDocument();
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('should accept custom props', () => {
      render(
        <WalTodoWalletProvider defaultNetwork="devnet" autoConnect={false}>
          <div data-testid="child">Test Child</div>
        </WalTodoWalletProvider>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });

  describe('Hooks', () => {
    it('should provide all required hooks', async () => {
      render(
        <WalTodoWalletProvider>
          <TestComponent />
        </WalTodoWalletProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true');
        expect(screen.getByTestId('account')).toHaveTextContent('0x123');
        expect(screen.getByTestId('execute-available')).toHaveTextContent('true');
        expect(screen.getByTestId('connection-available')).toHaveTextContent('true');
        expect(screen.getByTestId('transaction-execution-available')).toHaveTextContent('true');
        expect(screen.getByTestId('todo-ops-available')).toHaveTextContent('true');
      });
    });
  });

  describe('Error Boundaries', () => {
    it('should handle hook errors gracefully', () => {
      // Mock an error in the dApp kit hook
      const mockError = jest.fn(() => {
        throw new Error('Hook error');
      });
      
      jest.doMock('@mysten/dapp-kit', () => ({
        ...jest.requireActual('@mysten/dapp-kit'),
        useCurrentAccount: mockError,
      }));

      // The component should still render without crashing
      expect(() => {
        render(
          <WalTodoWalletProvider>
            <TestComponent />
          </WalTodoWalletProvider>
        );
      }).not.toThrow();
    });
  });

  describe('useTransactionExecution', () => {
    function TransactionTestComponent() {
      const { executeTransaction, isExecuting, lastError } = useTransactionExecution();
      
      const handleExecute = async () => {
        try {
          // Mock transaction
          const mockTx = { setSender: jest.fn() } as any;
          await executeTransaction(mockTx);
        } catch (error) {
          // Expected for wallet not connected
        }
      };

      return (
        <div>
          <div data-testid="is-executing">{isExecuting ? 'true' : 'false'}</div>
          <div data-testid="last-error">{lastError || 'none'}</div>
          <button data-testid="execute-btn" onClick={handleExecute}>Execute</button>
        </div>
      );
    }

    it('should handle transaction execution states', async () => {
      render(
        <WalTodoWalletProvider>
          <TransactionTestComponent />
        </WalTodoWalletProvider>
      );

      expect(screen.getByTestId('is-executing')).toHaveTextContent('false');
      expect(screen.getByTestId('last-error')).toHaveTextContent('none');
    });
  });

  describe('useAppConfig', () => {
    function ConfigTestComponent() {
      const { config, loading, error } = useAppConfig();
      
      return (
        <div>
          <div data-testid="config-loading">{loading ? 'true' : 'false'}</div>
          <div data-testid="config-error">{error || 'none'}</div>
          <div data-testid="config-network">{config?.network?.name || 'none'}</div>
        </div>
      );
    }

    it('should load configuration', async () => {
      render(
        <WalTodoWalletProvider>
          <ConfigTestComponent />
        </WalTodoWalletProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('config-network')).toHaveTextContent('testnet');
      });
    });
  });
});