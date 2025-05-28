/**
 * @waltodo/sui-client - Unified Sui client package
 * 
 * Provides both vanilla JavaScript functions for CLI usage and React hooks
 * for frontend usage. Wraps @mysten/dapp-kit functionality with WalTodo-specific
 * enhancements.
 */

// Export all types
export * from './types';

// Export configuration utilities
export * from './config';

// Export vanilla client for Node.js/CLI usage
export * from './vanilla';

// Conditional React exports (only available when React is present)
let reactExports: any = {};

try {
  // Check if React is available
  require.resolve('react');
  // If React is available, export React functionality
  reactExports = require('./react');
} catch (error) {
  // React not available, provide stub implementations
  console.debug('[SuiClient] React not available, skipping React exports');
}

// Export React functionality if available
export const {
  WalTodoWalletProvider,
  useWalTodoWallet,
  useExecuteTxn,
  useTransactionExecution,
  useCurrentAccount,
  useWalletConnection,
  useTodoNFTOperations,
  useAppConfig,
} = reactExports;

// Re-export commonly used types for convenience
export type {
  AppConfig,
  NetworkType,
  NetworkConfig,
  WalletAccount,
  TransactionResult,
  Todo,
  CreateTodoParams,
  UpdateTodoParams,
  SuiClientError,
  WalletNotConnectedError,
  TransactionError,
  NetworkError,
} from './types';