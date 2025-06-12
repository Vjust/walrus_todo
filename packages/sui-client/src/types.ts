/**
 * Shared types for Sui client package
 */

import { Transaction } from '@mysten/sui/transactions';
import { SuiClient as MyStenSuiClient } from '@mysten/sui/client';

// Network types
export type NetworkType = 'mainnet' | 'testnet' | 'devnet' | 'localnet';

// Configuration interfaces
export interface NetworkConfig {
  name: string;
  url: string;
  faucetUrl?: string;
  explorerUrl: string;
}

export interface WalrusConfig {
  networkUrl: string;
  publisherUrl: string;
  aggregatorUrl: string;
  apiPrefix: string;
}

export interface DeploymentConfig {
  packageId: string;
  digest: string;
  timestamp: string;
  deployerAddress: string;
}

export interface AppConfig {
  network: NetworkConfig;
  walrus: WalrusConfig;
  deployment: DeploymentConfig;
  contracts: {
    todoNft: {
      packageId: string;
      moduleName: string;
      structName: string;
    };
  };
  features: {
    aiEnabled: boolean;
    blockchainVerification: boolean;
    encryptedStorage: boolean;
  };
}

// Wallet types
export interface WalletAccount {
  address: string;
  publicKey?: string;
  chains?: string[];
}

export interface TransactionResult {
  digest: string;
  effects?: any;
  events?: any[];
  objectChanges?: any[];
  balanceChanges?: any[];
}

export interface WalletCapabilities {
  canSignTransaction: boolean;
  canSignMessage: boolean;
  canConnect: boolean;
}

// Error types
export class SuiClientError extends Error {
  constructor(
    message: string,
    public code?: string,
    public cause?: Error
  ) {
    super(message as any);
    this.name = 'SuiClientError';
  }
}

export class WalletNotConnectedError extends SuiClientError {
  constructor() {
    super('Wallet not connected', 'WALLET_NOT_CONNECTED');
  }
}

export class TransactionError extends SuiClientError {
  constructor(
    message: string,
    public transactionDigest?: string
  ) {
    super(message, 'TRANSACTION_ERROR');
  }
}

export class NetworkError extends SuiClientError {
  constructor(
    message: string,
    public networkName?: string
  ) {
    super(message, 'NETWORK_ERROR');
  }
}

// Todo-specific types
export interface Todo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  tags?: string[];
  dueDate?: string;
  blockchainStored: boolean;
  objectId?: string;
  imageUrl?: string;
  createdAt?: number;
  completedAt?: number;
  owner?: string;
  metadata?: string;
  isPrivate?: boolean;
}

export interface CreateTodoParams {
  title: string;
  description: string;
  imageUrl: string;
  metadata?: string;
  isPrivate?: boolean;
}

export interface UpdateTodoParams {
  objectId: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  metadata?: string;
}

// Client options
export interface SuiClientOptions {
  url?: string;
  transport?: any;
  rpcTimeout?: number;
  websocketTimeout?: number;
  faucetURL?: string;
}

// Export the MySten SuiClient type for type compatibility
export type SuiClientType = MyStenSuiClient;
export { Transaction };