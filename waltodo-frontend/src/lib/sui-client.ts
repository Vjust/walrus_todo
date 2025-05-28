/**
 * Sui blockchain client for TodoNFT operations
 * Enhanced implementation with full Sui SDK integration and auto-generated configuration
 */

import { SuiClient, type SuiObjectResponse, type SuiMoveObject, type PaginatedObjectsResponse } from '@mysten/sui/client';
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

// Import unified types
import type { 
  Todo, 
  TodoList, 
  CreateTodoParams, 
  UpdateTodoParams, 
  TransactionResult, 
  NetworkType 
} from '@/types/todo-nft';

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

// Re-export for convenience
export type { 
  Todo, 
  TodoList, 
  CreateTodoParams, 
  UpdateTodoParams, 
  TransactionResult, 
  NetworkType 
};

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
let initializationPromise: Promise<SuiClient> | null = null;
let isInitialized = false;
let initializationAttempts = 0;
const MAX_INITIALIZATION_ATTEMPTS = 3;

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
  // Return existing promise if initialization is already in progress
  if (initializationPromise) {
    return initializationPromise;
  }

  // Return existing client if already initialized
  if (suiClient && isInitialized) {
    return suiClient;
  }

  initializationPromise = (async () => {
    try {
      appConfig = await loadAppConfig();
      const configNetwork = appConfig.network.name as NetworkType;
      
      currentNetwork = configNetwork;
      suiClient = new SuiClient({ url: appConfig.network.url });
      isInitialized = true;
      initializationAttempts = 0; // Reset attempts on success
      console.log(`Sui client initialized with config for ${configNetwork}`);
      return suiClient;
    } catch (error) {
      console.error('Failed to initialize Sui client with config:', error);
      // Only reset initializationPromise after a delay to prevent rapid retries
      setTimeout(() => {
        initializationPromise = null;
      }, 1000);
      throw error;
    }
  })();

  return initializationPromise;
}

/**
 * Initialize Sui client with network configuration (legacy)
 */
export async function initializeSuiClient(
  network: NetworkType = 'testnet'
): Promise<SuiClient> {
  // Return existing promise if initialization is already in progress
  if (initializationPromise) {
    return initializationPromise;
  }

  // Return existing client if already initialized and network matches
  if (suiClient && isInitialized && currentNetwork === network) {
    console.log(`Sui client already initialized for ${network}`);
    return suiClient;
  }

  // Try to load configuration first
  try {
    return await initializeSuiClientWithConfig();
  } catch (error) {
    console.warn(
      'Failed to load app config, using fallback network configuration'
    );
    
    initializationPromise = (async () => {
      try {
        currentNetwork = network;
        // Use the network URLs from the config-loader fallback
        const networkUrls = {
          mainnet: 'https://fullnode.mainnet.sui.io:443',
          testnet: 'https://fullnode.testnet.sui.io:443',
          devnet: 'https://fullnode.devnet.sui.io:443',
          localnet: 'http://127.0.0.1:9000',
        };
        suiClient = new SuiClient({ url: networkUrls[network] });
        isInitialized = true;
        initializationAttempts = 0; // Reset attempts on success
        console.log(`Sui client initialized with fallback config for ${network}`);
        return suiClient;
      } catch (fallbackError) {
        console.error('Failed to initialize Sui client with fallback:', fallbackError);
        // Only reset initializationPromise after a delay to prevent rapid retries
        setTimeout(() => {
          initializationPromise = null;
        }, 1000);
        throw fallbackError;
      }
    })();

    return initializationPromise;
  }
}

/**
 * Get or create Sui client instance with auto-initialization
 */
export async function getSuiClient(): Promise<SuiClient> {
  // If already initialized, return immediately
  if (suiClient && isInitialized) {
    return suiClient;
  }
  
  // If initialization is in progress, wait for it
  if (initializationPromise) {
    try {
      return await initializationPromise;
    } catch (error) {
      // Don't reset the promise immediately, let the initialization function handle it
      console.warn('Initialization promise failed, will retry if needed');
      throw error;
    }
  }
  
  // Check if too many attempts have been made
  if (initializationAttempts >= MAX_INITIALIZATION_ATTEMPTS) {
    throw new SuiClientError(`Sui client initialization failed after ${MAX_INITIALIZATION_ATTEMPTS} attempts`, 'INITIALIZATION_FAILED');
  }
  
  // Auto-initialize if not already done
  console.log(`Sui client not initialized, auto-initializing... (attempt ${initializationAttempts + 1})`);
  initializationAttempts++;
  
  try {
    return await ensureSuiClientInitialized();
  } catch (error) {
    console.error(`Sui client initialization attempt ${initializationAttempts} failed:`, error);
    if (initializationAttempts >= MAX_INITIALIZATION_ATTEMPTS) {
      throw new SuiClientError(`Failed to initialize Sui client after ${MAX_INITIALIZATION_ATTEMPTS} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`, 'INITIALIZATION_FAILED');
    }
    throw error;
  }
}

/**
 * Get Sui client instance synchronously (throws if not initialized)
 */
export function getSuiClientSync(): SuiClient {
  if (!suiClient || !isInitialized) {
    throw new SuiClientError(
      'Sui client not initialized. Use getSuiClient() for async initialization or ensure initializeSuiClient() was called first.',
      'CLIENT_NOT_INITIALIZED'
    );
  }
  return suiClient;
}

/**
 * Check if Sui client is initialized
 */
export function isSuiClientInitialized(): boolean {
  return isInitialized && suiClient !== null;
}

/**
 * Safe check for client initialization without throwing errors
 */
export function isSuiClientReady(): boolean {
  try {
    return isSuiClientInitialized() && !initializationPromise;
  } catch (error) {
    return false;
  }
}

/**
 * Get initialization promise if client is currently being initialized
 */
export function getSuiClientInitializationPromise(): Promise<SuiClient> | null {
  return initializationPromise;
}

/**
 * Get current initialization state for debugging
 */
export function getSuiClientState() {
  return {
    isInitialized,
    currentNetwork,
    hasClient: !!suiClient,
    hasPromise: !!initializationPromise,
    attempts: initializationAttempts
  };
}

/**
 * Initialize Sui client and return a promise that resolves when ready
 */
export async function ensureSuiClientInitialized(network: NetworkType = 'testnet'): Promise<SuiClient> {
  if (isSuiClientInitialized()) {
    return suiClient!;
  }
  
  if (initializationPromise) {
    return initializationPromise;
  }
  
  return initializeSuiClient(network);
}

/**
 * Reset initialization state - useful for error recovery
 */
export function resetSuiClientInitialization(): void {
  console.log('Resetting Sui client initialization state');
  suiClient = null;
  isInitialized = false;
  initializationPromise = null;
  initializationAttempts = 0;
  appConfig = null;
}

/**
 * Safe wrapper for Sui client operations with automatic retry
 */
export async function withSuiClient<T>(
  operation: (client: SuiClient) => Promise<T>,
  maxRetries: number = 2
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const client = await getSuiClient();
      return await operation(client);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // If it's an initialization error and we have retries left, reset and try again
      if (attempt < maxRetries - 1 && 
          (lastError.message.includes('not initialized') || 
           lastError.message.includes('initialization failed'))) {
        console.warn(`Sui operation failed (attempt ${attempt + 1}), resetting and retrying...`);
        resetSuiClientInitialization();
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      // If we're out of retries or it's not an initialization error, throw
      if (attempt === maxRetries - 1) {
        break;
      }
    }
  }
  
  throw lastError!;
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
    if (!ownerAddress) {
      throw new WalletNotConnectedError();
    }

    return await withSuiClient(async (client) => {
      // Get all objects owned by the address
      const response: PaginatedObjectsResponse = await client.getOwnedObjects({
        owner: ownerAddress,
        filter: {
          StructType: `${getPackageId()}::${TODO_NFT_CONFIG.MODULE_NAME}::${TODO_NFT_CONFIG.STRUCT_NAME}`,
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
    });
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
    target: `${getPackageId()}::${TODO_NFT_CONFIG.MODULE_NAME}::create_todo`,
    arguments: [
      tx.pure(bcs.string().serialize(params.title)),
      tx.pure(bcs.string().serialize(params.description)),
      tx.pure(bcs.string().serialize(params.imageUrl || '')),
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
      const objectId = await withSuiClient(async (client) => {
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

        return (createdObject as any)?.objectId;
      });

      return {
        success: true,
        digest: result.digest,
        objectId,
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
    target: `${getPackageId()}::${TODO_NFT_CONFIG.MODULE_NAME}::update_todo`,
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
    target: `${getPackageId()}::${TODO_NFT_CONFIG.MODULE_NAME}::complete_todo`,
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
    target: `${getPackageId()}::${TODO_NFT_CONFIG.MODULE_NAME}::delete_todo`,
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
    return await withSuiClient(async (client) => {
      const response = await client.getObject({
        id: objectId,
        options: {
          showContent: true,
          showOwner: true,
          showType: true,
        },
      });

      return transformSuiObjectToTodo(response);
    });
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
    return await withSuiClient(async (client) => {
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
    });
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
    return await withSuiClient(async (client) => {
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
    });
  } catch (error) {
    console.error('Error getting transaction status:', error);
    throw new SuiClientError(
      `Failed to get transaction status: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
