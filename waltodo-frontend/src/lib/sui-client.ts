/**
 * Sui blockchain client for TodoNFT operations
 * Enhanced implementation with full Sui SDK integration and auto-generated configuration
 */

import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromB64 } from '@mysten/sui/utils';
import { bcs } from '@mysten/sui/bcs';
import { loadAppConfig, type AppConfig } from './config-loader';

// Network configuration - removed in favor of config-loader
// Use loadAppConfig() to get network URLs dynamically

// TodoNFT contract configuration - fallback values if config not loaded
const TODO_NFT_CONFIG = {
  PACKAGE_ID:
    '0xe8d420d723b6813d1e001d8cba0dfc8613cbc814dedb4adcd41909f2e11daa8b', // Fallback - will be overridden by config
  MODULE_NAME: 'todo_nft',
  STRUCT_NAME: 'TodoNFT',
} as const;

export type NetworkType = 'mainnet' | 'testnet' | 'devnet' | 'localnet';

export interface Todo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  tags?: string[];
  dueDate?: string;
  blockchainStored: boolean;
  objectId?: string; // Sui object ID when stored on chain
  imageUrl?: string;
  createdAt?: number;
  completedAt?: number;
  owner?: string;
  metadata?: string;
  isPrivate?: boolean;
}

export interface TodoList {
  name: string;
  todos: Todo[];
}

export interface SuiTodoNFT {
  id: {
    id: string;
  };
  title: string;
  description: string;
  image_url: string;
  completed: boolean;
  created_at: string;
  completed_at?: string;
  owner: string;
  metadata: string;
  is_private: boolean;
}

export interface TransactionResult {
  success: boolean;
  digest?: string;
  objectId?: string;
  error?: string;
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

// Error classes for better error handling
export class SuiClientError extends Error {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'SuiClientError';
  }
}

export class TransactionError extends SuiClientError {
  constructor(
    message: string,
    public digest?: string
  ) {
    super(message, 'TRANSACTION_ERROR');
    this.name = 'TransactionError';
  }
}

export class WalletNotConnectedError extends SuiClientError {
  constructor() {
    super('Wallet not connected', 'WALLET_NOT_CONNECTED');
    this.name = 'WalletNotConnectedError';
  }
}

// Global Sui client instance
let suiClient: SuiClient | null = null;
let currentNetwork: NetworkType = 'testnet';
let appConfig: AppConfig | null = null;

// Remove simulated wallet connection - use wallet context instead
// let connected = false;
// let address = '';

// Safe storage check helper to avoid errors
const isStorageAvailable = () => {
  if (typeof window === 'undefined') return false;

  try {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Initialize Sui client with auto-generated configuration
 */
export async function initializeSuiClientWithConfig(): Promise<SuiClient> {
  appConfig = await loadAppConfig();
  currentNetwork = appConfig.network.name as NetworkType;
  suiClient = new SuiClient({ url: appConfig.network.url });
  return suiClient;
}

/**
 * Initialize Sui client with network configuration (legacy)
 */
export async function initializeSuiClient(
  network: NetworkType = 'testnet'
): Promise<SuiClient> {
  // Try to load configuration first
  try {
    return await initializeSuiClientWithConfig();
  } catch (error) {
    // Fallback to direct network URL from config
    console.warn(
      'Failed to load app config, using fallback network configuration'
    );
    currentNetwork = network;
    // Use the network URLs from the config-loader fallback
    const networkUrls = {
      mainnet: 'https://fullnode.mainnet.sui.io:443',
      testnet: 'https://fullnode.testnet.sui.io:443',
      devnet: 'https://fullnode.devnet.sui.io:443',
      localnet: 'http://127.0.0.1:9000',
    };
    suiClient = new SuiClient({ url: networkUrls[network] });
    return suiClient;
  }
}

/**
 * Get or create Sui client instance
 */
export function getSuiClient(): SuiClient {
  if (!suiClient) {
    throw new Error(
      'Sui client not initialized. Call initializeSuiClient() first.'
    );
  }
  return suiClient;
}

/**
 * Get current app configuration
 */
export function getAppConfig(): AppConfig | null {
  return appConfig;
}

/**
 * Get the current package ID from configuration
 */
export function getPackageId(): string {
  if (appConfig?.deployment.packageId) {
    return appConfig.deployment.packageId;
  }
  // Fallback to hardcoded config
  return TODO_NFT_CONFIG.PACKAGE_ID;
}

/**
 * Switch to a different network
 */
export function switchNetwork(network: NetworkType): Promise<SuiClient> {
  return initializeSuiClient(network);
}

/**
 * Get current network
 */
export function getCurrentNetwork(): NetworkType {
  return currentNetwork;
}

// Remove placeholder wallet connection - use actual wallet context

// Remove local wallet state check - use wallet context

// Remove local wallet address - use wallet context

// Remove local wallet disconnect - use wallet context

/**
 * Transform Sui object data to Todo interface
 */
function transformSuiObjectToTodo(suiObject: SuiObjectResponse): Todo | null {
  if (
    !suiObject.data?.content ||
    suiObject.data.content.dataType !== 'moveObject'
  ) {
    return null;
  }

  const moveObject = suiObject.data.content as SuiMoveObject;
  const fields = moveObject.fields as any;

  if (!fields) {
    return null;
  }

  try {
    return {
      id: suiObject.data.objectId,
      objectId: suiObject.data.objectId,
      title: fields.title || 'Untitled',
      description: fields.description || '',
      completed: fields.completed === true,
      priority: 'medium', // Default priority, can be enhanced with metadata parsing
      tags: [], // Can be parsed from metadata
      blockchainStored: true,
      imageUrl: fields.image_url,
      createdAt: fields.created_at ? parseInt(fields.created_at) : Date.now(),
      completedAt: fields.completed_at
        ? parseInt(fields.completed_at)
        : undefined,
      owner: fields.owner,
      metadata: fields.metadata || '',
      isPrivate: fields.is_private === true,
    };
  } catch (error) {
    console.error('Error transforming Sui object to Todo:', error);
    return null;
  }
}

/**
 * Get TodoNFTs owned by a specific address
 */
export async function getTodosFromBlockchain(
  ownerAddress: string
): Promise<Todo[]> {
  try {
    const client = getSuiClient();

    if (!ownerAddress) {
      throw new WalletNotConnectedError();
    }

    // Get all objects owned by the address
    const response: PaginatedObjectsResponse = await client.getOwnedObjects({
      owner: ownerAddress,
      filter: {
        StructType: `${TODO_NFT_CONFIG.PACKAGE_ID}::${TODO_NFT_CONFIG.MODULE_NAME}::${TODO_NFT_CONFIG.STRUCT_NAME}`,
      },
      options: {
        showContent: true,
        showOwner: true,
        showType: true,
      },
    });

    // Transform Sui objects to Todo format
    const todos: Todo[] = response.data
      .map(transformSuiObjectToTodo)
      .filter((todo): todo is Todo => todo !== null);

    return todos;
  } catch (error) {
    console.error('Error fetching todos from blockchain:', error);
    if (error instanceof SuiClientError) {
      throw error;
    }
    throw new SuiClientError(
      `Failed to fetch todos: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Create a TodoNFT transaction
 */
export function createTodoNFTTransaction(
  params: CreateTodoParams,
  senderAddress: string
): Transaction {
  const tx = new Transaction();
  tx.setSender(senderAddress);

  // Call the create_todo function from the smart contract
  tx.moveCall({
    target: `${TODO_NFT_CONFIG.PACKAGE_ID}::${TODO_NFT_CONFIG.MODULE_NAME}::create_todo`,
    arguments: [
      tx.pure(bcs.string().serialize(params.title)),
      tx.pure(bcs.string().serialize(params.description)),
      tx.pure(bcs.string().serialize(params.imageUrl)),
      tx.pure(bcs.string().serialize(params.metadata || '')),
      tx.pure(bcs.bool().serialize(params.isPrivate || false)),
    ],
  });

  return tx;
}

/**
 * Store todo on blockchain using transaction
 */
export async function storeTodoOnBlockchain(
  params: CreateTodoParams,
  signAndExecuteTransaction: (txb: Transaction) => Promise<{ digest: string; effects?: unknown }>,
  walletAddress: string
): Promise<TransactionResult> {
  try {
    if (!walletAddress) {
      throw new WalletNotConnectedError();
    }

    // Create transaction block
    const tx = createTodoNFTTransaction(params, walletAddress);

    // Execute transaction through wallet
    const result = await signAndExecuteTransaction(tx);

    if (result.digest) {
      // Get the created object ID from transaction effects
      const client = getSuiClient();
      const txResponse = await client.getTransactionBlock({
        digest: result.digest,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      // Find the created TodoNFT object
      const createdObject = txResponse.objectChanges?.find(
        change =>
          change.type === 'created' &&
          change.objectType?.includes(TODO_NFT_CONFIG.STRUCT_NAME)
      );

      return {
        success: true,
        digest: result.digest,
        objectId: (createdObject as any)?.objectId,
      };
    }

    return { success: false, error: 'Transaction failed without digest' };
  } catch (error) {
    console.error('Error storing todo on blockchain:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create an update TodoNFT transaction
 */
export function updateTodoNFTTransaction(
  params: UpdateTodoParams,
  senderAddress: string
): Transaction {
  const tx = new Transaction();
  tx.setSender(senderAddress);

  // Call the update_todo function from the smart contract
  tx.moveCall({
    target: `${TODO_NFT_CONFIG.PACKAGE_ID}::${TODO_NFT_CONFIG.MODULE_NAME}::update_todo`,
    arguments: [
      tx.object(params.objectId),
      tx.pure(bcs.string().serialize(params.title || '')),
      tx.pure(bcs.string().serialize(params.description || '')),
      tx.pure(bcs.string().serialize(params.imageUrl || '')),
      tx.pure(bcs.string().serialize(params.metadata || '')),
    ],
  });

  return tx;
}

/**
 * Complete TodoNFT transaction
 */
export function completeTodoNFTTransaction(
  objectId: string,
  senderAddress: string
): Transaction {
  const tx = new Transaction();
  tx.setSender(senderAddress);

  // Call the complete_todo function from the smart contract
  tx.moveCall({
    target: `${TODO_NFT_CONFIG.PACKAGE_ID}::${TODO_NFT_CONFIG.MODULE_NAME}::complete_todo`,
    arguments: [tx.object(objectId)],
  });

  return tx;
}

/**
 * Delete TodoNFT transaction
 */
export function deleteTodoNFTTransaction(
  objectId: string,
  senderAddress: string
): Transaction {
  const tx = new Transaction();
  tx.setSender(senderAddress);

  // Call the delete_todo function from the smart contract
  tx.moveCall({
    target: `${TODO_NFT_CONFIG.PACKAGE_ID}::${TODO_NFT_CONFIG.MODULE_NAME}::delete_todo`,
    arguments: [tx.object(objectId)],
  });

  return tx;
}

/**
 * Update todo on blockchain
 */
export async function updateTodoOnBlockchain(
  params: UpdateTodoParams,
  signAndExecuteTransaction: (txb: Transaction) => Promise<{ digest: string; effects?: unknown }>,
  walletAddress: string
): Promise<TransactionResult> {
  try {
    if (!walletAddress) {
      throw new WalletNotConnectedError();
    }

    // Create transaction block
    const tx = updateTodoNFTTransaction(params, walletAddress);

    // Execute transaction through wallet
    const result = await signAndExecuteTransaction(tx);

    return {
      success: !!result.digest,
      digest: result.digest,
      error: result.digest ? undefined : 'Transaction failed',
    };
  } catch (error) {
    console.error('Error updating todo on blockchain:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Complete todo on blockchain
 */
export async function completeTodoOnBlockchain(
  objectId: string,
  signAndExecuteTransaction: (txb: Transaction) => Promise<{ digest: string; effects?: unknown }>,
  walletAddress: string
): Promise<TransactionResult> {
  try {
    if (!walletAddress) {
      throw new WalletNotConnectedError();
    }

    // Create transaction block
    const tx = completeTodoNFTTransaction(objectId, walletAddress);

    // Execute transaction through wallet
    const result = await signAndExecuteTransaction(tx);

    return {
      success: !!result.digest,
      digest: result.digest,
      error: result.digest ? undefined : 'Transaction failed',
    };
  } catch (error) {
    console.error('Error completing todo on blockchain:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete todo on blockchain
 */
export async function deleteTodoOnBlockchain(
  objectId: string,
  signAndExecuteTransaction: (txb: Transaction) => Promise<{ digest: string; effects?: unknown }>,
  walletAddress: string
): Promise<TransactionResult> {
  try {
    if (!walletAddress) {
      throw new WalletNotConnectedError();
    }

    // Create transaction block
    const tx = deleteTodoNFTTransaction(objectId, walletAddress);

    // Execute transaction through wallet
    const result = await signAndExecuteTransaction(tx);

    return {
      success: !!result.digest,
      digest: result.digest,
      error: result.digest ? undefined : 'Transaction failed',
    };
  } catch (error) {
    console.error('Error deleting todo on blockchain:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get a specific TodoNFT by object ID
 */
export async function getTodoByObjectId(
  objectId: string
): Promise<Todo | null> {
  try {
    const client = getSuiClient();
    const response = await client.getObject({
      id: objectId,
      options: {
        showContent: true,
        showOwner: true,
        showType: true,
      },
    });

    return transformSuiObjectToTodo(response);
  } catch (error) {
    console.error('Error fetching todo by object ID:', error);
    throw new SuiClientError(
      `Failed to fetch todo: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Batch fetch multiple TodoNFTs by object IDs
 */
export async function getTodosByObjectIds(
  objectIds: string[]
): Promise<Todo[]> {
  try {
    const client = getSuiClient();
    const response = await client.multiGetObjects({
      ids: objectIds,
      options: {
        showContent: true,
        showOwner: true,
        showType: true,
      },
    });

    return response
      .map(transformSuiObjectToTodo)
      .filter((todo): todo is Todo => todo !== null);
  } catch (error) {
    console.error('Error batch fetching todos:', error);
    throw new SuiClientError(
      `Failed to batch fetch todos: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get transaction status and details
 */
export async function getTransactionStatus(digest: string) {
  try {
    const client = getSuiClient();
    const response = await client.getTransactionBlock({
      digest,
      options: {
        showEffects: true,
        showEvents: true,
        showObjectChanges: true,
      },
    });

    return {
      status: response.effects?.status?.status || 'unknown',
      digest: response.digest,
      timestamp: response.timestampMs,
      objectChanges: response.objectChanges,
      events: response.events,
    };
  } catch (error) {
    console.error('Error getting transaction status:', error);
    throw new SuiClientError(
      `Failed to get transaction status: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
