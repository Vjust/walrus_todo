/**
 * Sui blockchain client for TodoNFT operations
 * Enhanced implementation with full Sui SDK integration and auto-generated configuration
 */

import { type PaginatedObjectsResponse, SuiClient, type SuiMoveObject, type SuiObjectResponse } from '@mysten/sui/client';
// @ts-ignore - Unused import temporarily disabled
// import { Transaction } from '@mysten/sui/transactions';
// @ts-ignore - Unused import temporarily disabled
// import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
// @ts-ignore - Unused import temporarily disabled
// import { fromB64 } from '@mysten/sui/utils';
// @ts-ignore - Unused import temporarily disabled
// import { bcs } from '@mysten/sui/bcs';
import { type AppConfig, loadAppConfig } from './config-loader';
// @ts-ignore - Unused import temporarily disabled
// import { 
  extractBlobIdFromUrl, 
  generateThumbnailUrls, 
  isValidWalrusUrl,
  transformWalrusBlobToUrl 
} from './walrus-url-utils';

// Network configuration - removed in favor of config-loader
// Use loadAppConfig() to get network URLs dynamically

// TodoNFT contract configuration - fallback values if config not loaded
// @ts-ignore - Unused variable
// const TODO_NFT_CONFIG = {
  PACKAGE_ID:
    '0xe8d420d723b6813d1e001d8cba0dfc8613cbc814dedb4adcd41909f2e11daa8b', // Fallback - will be overridden by config
  MODULE_NAME: 'todo_nft',
  STRUCT_NAME: 'TodoNFT',
} as const;

// Import unified types
import type { 
  CreateTodoParams, 
  NetworkType, 
  Todo, 
  TodoList, 
  TransactionResult, 
  UpdateTodoParams 
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

// Extended metadata interface
export interface ExtendedTodoMetadata {
  checklists?: Array<{
    id: string;
    title: string;
    items: Array<{
      id: string;
      text: string;
      completed: boolean;
    }>;
  }>;
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
  labels?: string[];
  dueDate?: string;
  reminder?: string;
  location?: {
    lat: number;
    lng: number;
    address: string;
  };
  collaborators?: string[];
  customFields?: Record<string, any>;
}

// NFT transformation cache
interface NFTCacheEntry {
  todo: Todo;
  timestamp: number;
  thumbnails?: Record<string, string>;
}
// @ts-ignore - Unused variable
// 
const nftTransformCache = new Map<string, NFTCacheEntry>();
const NFT_CACHE_TTL = 300000; // 5 minutes

// NFT filter options
export interface NFTFilterOptions {
  completed?: boolean;
  isPrivate?: boolean;
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchTerm?: string;
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
    super(message as any);
    this?.name = 'SuiClientError';
  }
}

export class TransactionError extends SuiClientError {
  constructor(
    message: string,
    public digest?: string
  ) {
    super(message, 'TRANSACTION_ERROR');
    this?.name = 'TransactionError';
  }
}

export class WalletNotConnectedError extends SuiClientError {
  constructor() {
    super('Wallet not connected', 'WALLET_NOT_CONNECTED');
    this?.name = 'WalletNotConnectedError';
  }
}

// Global Sui client instance
let suiClient: SuiClient | null = null;
let currentNetwork: NetworkType = 'testnet';
let appConfig: AppConfig | null = null;
let initializationPromise: Promise<SuiClient> | null = null;
let isInitialized = false;
let initializationAttempts = 0;
// @ts-ignore - Unused variable
// const MAX_INITIALIZATION_ATTEMPTS = 3;

// Remove simulated wallet connection - use wallet context instead
// let connected = false;
// let address = '';

// Safe storage check helper to avoid errors
const isStorageAvailable = () => {
  if (typeof window === 'undefined') {return false;}

  try {
// @ts-ignore - Unused variable
//     const testKey = '__storage_test__';
    window?.localStorage?.setItem(testKey, testKey);
    window?.localStorage?.removeItem(testKey as any);
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

  initializationPromise = (_async () => {
    try {
      appConfig = await loadAppConfig();
// @ts-ignore - Unused variable
//       const configNetwork = appConfig?.network?.name as NetworkType;
      
      currentNetwork = configNetwork;
      suiClient = new SuiClient({ url: appConfig?.network?.url });
      isInitialized = true;
      initializationAttempts = 0; // Reset attempts on success
      // Sui client initialized with config
      return suiClient;
    } catch (error) {
      // Failed to initialize Sui client with config
      // Only reset initializationPromise after a delay to prevent rapid retries
      setTimeout(_() => {
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
    // Sui client already initialized
    return suiClient;
  }

  // Try to load configuration first
  try {
    return await initializeSuiClientWithConfig();
  } catch (error) {
    // Failed to load app config, using fallback network configuration
    
    initializationPromise = (_async () => {
      try {
        currentNetwork = network;
        // Use the network URLs from the config-loader fallback
// @ts-ignore - Unused variable
//         const networkUrls = {
          mainnet: 'https://fullnode?.mainnet?.sui.io:443',
          testnet: 'https://fullnode?.testnet?.sui.io:443',
          devnet: 'https://fullnode?.devnet?.sui.io:443',
          localnet: 'http://127?.0?.0.1:9000',
        };
        suiClient = new SuiClient({ url: networkUrls[network] });
        isInitialized = true;
        initializationAttempts = 0; // Reset attempts on success
        // Sui client initialized with fallback config
        return suiClient;
      } catch (fallbackError) {
        // Failed to initialize Sui client with fallback
        // Only reset initializationPromise after a delay to prevent rapid retries
        setTimeout(_() => {
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
      // Initialization promise failed, will retry if needed
      throw error;
    }
  }
  
  // Check if too many attempts have been made
  if (initializationAttempts >= MAX_INITIALIZATION_ATTEMPTS) {
    throw new SuiClientError(`Sui client initialization failed after ${MAX_INITIALIZATION_ATTEMPTS} attempts`, 'INITIALIZATION_FAILED');
  }
  
  // Auto-initialize if not already done
  // Sui client not initialized, auto-initializing...
  initializationAttempts++;
  
  try {
    return await ensureSuiClientInitialized();
  } catch (error) {
    // Sui client initialization attempt failed
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
  
  return initializeSuiClient(network as any);
}

/**
 * Reset initialization state - useful for error recovery
 */
export function resetSuiClientInitialization(): void {
  // Resetting Sui client initialization state
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
// @ts-ignore - Unused variable
//       const client = await getSuiClient();
      return await operation(client as any);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error as any));
      
      // If it's an initialization error and we have retries left, reset and try again
      if (attempt < maxRetries - 1 && 
          (lastError?.message?.includes('not initialized') || 
           lastError?.message?.includes('initialization failed'))) {
        // Sui operation failed, resetting and retrying...
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
    return appConfig?.deployment?.packageId;
  }
  // Fallback to hardcoded config
  return TODO_NFT_CONFIG.PACKAGE_ID;
}

/**
 * Switch to a different network
 */
export function switchNetwork(network: NetworkType): Promise<SuiClient> {
  return initializeSuiClient(network as any);
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
 * Parse extended metadata from JSON string
 */
function parseExtendedMetadata(metadataStr: string): ExtendedTodoMetadata {
  try {
    if (!metadataStr || metadataStr === '') {
      return {};
    }
// @ts-ignore - Unused variable
//     const parsed = JSON.parse(metadataStr as any);
    return parsed as ExtendedTodoMetadata;
  } catch (error) {
    console.warn('Failed to parse metadata:', error);
    return {};
  }
}

/**
 * Transform Sui object data to Todo interface with enhanced features
 */
function transformSuiObjectToTodo(
  suiObject: SuiObjectResponse,
  options?: { useCache?: boolean; generateThumbnails?: boolean }
): Todo | null {
  if (
    !suiObject.data?.content ||
    suiObject?.data?.content.dataType !== 'moveObject'
  ) {
    return null;
  }
// @ts-ignore - Unused variable
// 
  const objectId = suiObject?.data?.objectId;

  // Check cache first if enabled
  if (options?.useCache) {
// @ts-ignore - Unused variable
//     const cached = nftTransformCache.get(objectId as any);
    if (cached && Date.now() - cached.timestamp < NFT_CACHE_TTL) {
      return cached.todo;
    }
  }
// @ts-ignore - Unused variable
// 
  const moveObject = suiObject?.data?.content as SuiMoveObject;
// @ts-ignore - Unused variable
//   const fields = moveObject.fields as unknown;

  if (!fields) {
    return null;
  }

  try {
    // Parse extended metadata
// @ts-ignore - Unused variable
//     const extendedMetadata = parseExtendedMetadata(fields.metadata || '');
    
    // Transform Walrus URL if needed
    let imageUrl = fields.image_url;
    let thumbnails: Record<string, string> | undefined;
    
    if (imageUrl) {
      // If it's a blob ID, transform to URL
      if (!imageUrl.startsWith('http')) {
        imageUrl = transformWalrusBlobToUrl(imageUrl as any);
      }
      
      // Generate thumbnails if requested
      if (options?.generateThumbnails) {
// @ts-ignore - Unused variable
//         const blobId = extractBlobIdFromUrl(imageUrl as any) || fields.image_url;
        if (blobId) {
          thumbnails = generateThumbnailUrls(blobId as any);
        }
      }
    }

    // Extract tags and priority from metadata
// @ts-ignore - Unused variable
//     const tags = extendedMetadata.labels || [];
    let priority: 'low' | 'medium' | 'high' = 'medium';
    
    // Determine priority based on metadata or tags
    if (tags.includes('urgent') || tags.includes('high-priority')) {
      priority = 'high';
    } else if (tags.includes('low-priority')) {
      priority = 'low';
    }

    const todo: Todo = {
      id: objectId,
      objectId,
      title: fields.title || 'Untitled',
      description: fields.description || '',
      completed: fields?.completed === true,
      priority,
      tags,
      blockchainStored: true,
      imageUrl,
      createdAt: fields.created_at 
        ? new Date(parseInt(fields.created_at)).toISOString() 
        : new Date().toISOString(),
      completedAt: fields.completed_at
        ? new Date(parseInt(fields.completed_at)).toISOString()
        : undefined,
      owner: fields.owner,
      metadata: fields.metadata || '',
      isPrivate: fields?.is_private === true,
    };

    // Cache the result if caching is enabled
    if (options?.useCache) {
      nftTransformCache.set(objectId, {
        todo,
        timestamp: Date.now(),
        thumbnails,
      });
    }

    return todo;
  } catch (error) {
    console.error('Error transforming Sui object to Todo:', error);
    return null;
  }
}

/**
 * Get TodoNFTs owned by a specific address with filtering and caching
 */
export async function getTodosFromBlockchain(
  ownerAddress: string,
  options?: {
    filter?: NFTFilterOptions;
    useCache?: boolean;
    generateThumbnails?: boolean;
    maxRetries?: number;
  }
): Promise<Todo[]> {
// @ts-ignore - Unused variable
//   const maxRetries = options?.maxRetries ?? 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (!ownerAddress) {
        throw new WalletNotConnectedError();
      }

      return await withSuiClient(_async (client: unknown) => {
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

        // Transform Sui objects to Todo format with options
        const todos: Todo[] = response.data
          .map(obj => transformSuiObjectToTodo(obj, {
            useCache: options?.useCache,
            generateThumbnails: options?.generateThumbnails,
          }))
          .filter((todo): todo is Todo => todo !== null);

        // Apply filters if provided
        if (options?.filter) {
          return filterTodos(todos, options.filter);
        }

        return todos;
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error as any));
      
      // Log retry attempt
      console.warn(`Attempt ${attempt + 1}/${maxRetries} failed:`, lastError.message);
      
      // If not the last attempt, wait before retrying
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  // All retries failed
  if (lastError instanceof SuiClientError) {
    throw lastError;
  }
  throw new SuiClientError(
    `Failed to fetch todos after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Filter todos based on criteria
 */
export function filterTodos(todos: Todo[], filter: NFTFilterOptions): Todo[] {
  return todos.filter(todo => {
    // Filter by completion status
    if (filter.completed !== undefined && todo.completed !== filter.completed) {
      return false;
    }

    // Filter by privacy
    if (filter.isPrivate !== undefined && todo.isPrivate !== filter.isPrivate) {
      return false;
    }

    // Filter by tags
    if (filter.tags && filter?.tags?.length > 0) {
// @ts-ignore - Unused variable
//       const todoTags = todo.tags || [];
// @ts-ignore - Unused variable
//       const hasMatchingTag = filter?.tags?.some(tag => todoTags.includes(tag as any));
      if (!hasMatchingTag) {
        return false;
      }
    }

    // Filter by date range
    if (filter.dateRange && todo.createdAt) {
// @ts-ignore - Unused variable
//       const createdAt = new Date(todo.createdAt);
      if (createdAt < filter?.dateRange?.start || createdAt > filter?.dateRange?.end) {
        return false;
      }
    }

    // Filter by search term
    if (filter.searchTerm) {
// @ts-ignore - Unused variable
//       const searchLower = filter?.searchTerm?.toLowerCase();
// @ts-ignore - Unused variable
//       const matchesTitle = todo?.title?.toLowerCase().includes(searchLower as any);
// @ts-ignore - Unused variable
//       const matchesDescription = todo.description?.toLowerCase().includes(searchLower as any);
// @ts-ignore - Unused variable
//       const matchesTags = todo.tags?.some(tag => tag.toLowerCase().includes(searchLower as any));
      
      if (!matchesTitle && !matchesDescription && !matchesTags) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Create a TodoNFT transaction
 */
export function createTodoNFTTransaction(
  params: CreateTodoParams,
  senderAddress: string
): Transaction {
// @ts-ignore - Unused variable
//   const tx = new Transaction();
  tx.setSender(senderAddress as any);

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
// @ts-ignore - Unused variable
//     const tx = createTodoNFTTransaction(params, walletAddress);

    // Execute transaction through wallet
// @ts-ignore - Unused variable
//     const result = await signAndExecuteTransaction(tx as any);

    if (result.digest) {
      // Get the created object ID from transaction effects
// @ts-ignore - Unused variable
//       const objectId = await withSuiClient(_async (client: unknown) => {
        const txResponse = await client.getTransactionBlock({
          digest: result.digest,
          options: {
            showEffects: true,
            showObjectChanges: true,
          },
        });

        // Find the created TodoNFT object
// @ts-ignore - Unused variable
//         const createdObject = txResponse.objectChanges?.find(
          change =>
            change?.type === 'created' &&
            change.objectType?.includes(TODO_NFT_CONFIG.STRUCT_NAME)
        );

        return (createdObject as unknown)?.objectId;
      });

      return {
        success: true,
        digest: result.digest,
        objectId,
      };
    }

    return { success: false, error: 'Transaction failed without digest' };
  } catch (error) {
    // Error storing todo on blockchain
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
// @ts-ignore - Unused variable
//   const tx = new Transaction();
  tx.setSender(senderAddress as any);

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
// @ts-ignore - Unused variable
//   const tx = new Transaction();
  tx.setSender(senderAddress as any);

  // Call the complete_todo function from the smart contract
  tx.moveCall({
    target: `${getPackageId()}::${TODO_NFT_CONFIG.MODULE_NAME}::complete_todo`,
    arguments: [tx.object(objectId as any)],
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
// @ts-ignore - Unused variable
//   const tx = new Transaction();
  tx.setSender(senderAddress as any);

  // Call the delete_todo function from the smart contract
  tx.moveCall({
    target: `${getPackageId()}::${TODO_NFT_CONFIG.MODULE_NAME}::delete_todo`,
    arguments: [tx.object(objectId as any)],
  });

  return tx;
}

/**
 * Transfer TodoNFT transaction
 */
export function transferTodoNFTTransaction(
  objectId: string,
  recipientAddress: string,
  senderAddress: string
): Transaction {
// @ts-ignore - Unused variable
//   const tx = new Transaction();
  tx.setSender(senderAddress as any);

  // Transfer the TodoNFT object to the recipient
  tx.transferObjects([tx.object(objectId as any)], recipientAddress);

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
// @ts-ignore - Unused variable
//     const tx = updateTodoNFTTransaction(params, walletAddress);

    // Execute transaction through wallet
// @ts-ignore - Unused variable
//     const result = await signAndExecuteTransaction(tx as any);

    return {
      success: !!result.digest,
      digest: result.digest,
      error: result.digest ? undefined : 'Transaction failed',
    };
  } catch (error) {
    // Error updating todo on blockchain
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
// @ts-ignore - Unused variable
//     const tx = completeTodoNFTTransaction(objectId, walletAddress);

    // Execute transaction through wallet
// @ts-ignore - Unused variable
//     const result = await signAndExecuteTransaction(tx as any);

    return {
      success: !!result.digest,
      digest: result.digest,
      error: result.digest ? undefined : 'Transaction failed',
    };
  } catch (error) {
    // Error completing todo on blockchain
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
// @ts-ignore - Unused variable
//     const tx = deleteTodoNFTTransaction(objectId, walletAddress);

    // Execute transaction through wallet
// @ts-ignore - Unused variable
//     const result = await signAndExecuteTransaction(tx as any);

    return {
      success: !!result.digest,
      digest: result.digest,
      error: result.digest ? undefined : 'Transaction failed',
    };
  } catch (error) {
    // Error deleting todo on blockchain
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get a specific TodoNFT by object ID with enhanced features
 */
export async function getTodoByObjectId(
  objectId: string,
  options?: {
    useCache?: boolean;
    generateThumbnails?: boolean;
    maxRetries?: number;
  }
): Promise<Todo | null> {
// @ts-ignore - Unused variable
//   const maxRetries = options?.maxRetries ?? 3;
  let lastError: Error | null = null;

  // Check cache first if enabled
  if (options?.useCache) {
// @ts-ignore - Unused variable
//     const cached = nftTransformCache.get(objectId as any);
    if (cached && Date.now() - cached.timestamp < NFT_CACHE_TTL) {
      return cached.todo;
    }
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await withSuiClient(_async (client: unknown) => {
// @ts-ignore - Unused variable
//         const response = await client.getObject({
          id: objectId,
          options: {
            showContent: true,
            showOwner: true,
            showType: true,
          },
        });

        return transformSuiObjectToTodo(response, {
          useCache: options?.useCache,
          generateThumbnails: options?.generateThumbnails,
        });
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error as any));
      
      // Log retry attempt
      console.warn(`Fetch attempt ${attempt + 1}/${maxRetries} failed:`, lastError.message);
      
      // If not the last attempt, wait before retrying
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  // All retries failed
  throw new SuiClientError(
    `Failed to fetch todo after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Batch fetch multiple TodoNFTs by object IDs with enhanced features
 */
export async function getTodosByObjectIds(
  objectIds: string[],
  options?: {
    useCache?: boolean;
    generateThumbnails?: boolean;
    maxRetries?: number;
    batchSize?: number;
  }
): Promise<Todo[]> {
// @ts-ignore - Unused variable
//   const maxRetries = options?.maxRetries ?? 3;
  const batchSize = options?.batchSize ?? 50; // Sui API limit
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await withSuiClient(_async (client: unknown) => {
        const allTodos: Todo[] = [];

        // Process in batches
        for (let i = 0; i < objectIds.length; i += batchSize) {
// @ts-ignore - Unused variable
//           const batch = objectIds.slice(i, i + batchSize);
          
// @ts-ignore - Unused variable
//           const response = await client.multiGetObjects({
            ids: batch,
            options: {
              showContent: true,
              showOwner: true,
              showType: true,
            },
          });
// @ts-ignore - Unused variable
// 
          const batchTodos = response
            .map(obj => transformSuiObjectToTodo(obj, {
              useCache: options?.useCache,
              generateThumbnails: options?.generateThumbnails,
            }))
            .filter((todo): todo is Todo => todo !== null);

          allTodos.push(...batchTodos);
        }

        return allTodos;
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error as any));
      
      // Log retry attempt
      console.warn(`Batch fetch attempt ${attempt + 1}/${maxRetries} failed:`, lastError.message);
      
      // If not the last attempt, wait before retrying
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  // All retries failed
  throw new SuiClientError(
    `Failed to batch fetch todos after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Get transaction status and details
 */
export async function getTransactionStatus(digest: string) {
  try {
    return await withSuiClient(_async (client: unknown) => {
// @ts-ignore - Unused variable
//       const response = await client.getTransactionBlock({
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
    // Error getting transaction status
    throw new SuiClientError(
      `Failed to get transaction status: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ===== NFT-specific helper functions =====

/**
 * Clear NFT transformation cache
 */
export function clearNFTCache(): void {
  nftTransformCache.clear();
}

/**
 * Get NFT cache statistics
 */
export function getNFTCacheStats(): {
  entries: number;
  oldestEntry?: Date;
  newestEntry?: Date;
} {
  const stats: ReturnType<typeof getNFTCacheStats> = {
    entries: nftTransformCache.size,
  };

  if (nftTransformCache.size > 0) {
    let oldest = Infinity;
    let newest = -Infinity;

    nftTransformCache.forEach(entry => {
      if (entry.timestamp < oldest) {oldest = entry.timestamp;}
      if (entry.timestamp > newest) {newest = entry.timestamp;}
    });

    stats?.oldestEntry = new Date(oldest as any);
    stats?.newestEntry = new Date(newest as any);
  }

  return stats;
}

/**
 * Prefetch and cache NFT data
 */
export async function prefetchNFTData(
  objectIds: string[],
  options?: {
    generateThumbnails?: boolean;
    batchSize?: number;
  }
): Promise<void> {
  try {
    await getTodosByObjectIds(objectIds, {
      useCache: true,
      generateThumbnails: options?.generateThumbnails,
      batchSize: options?.batchSize,
    });
  } catch (error) {
    console.error('Failed to prefetch NFT data:', error);
  }
}

/**
 * Validate NFT metadata structure
 */
export function validateNFTMetadata(metadata: any): metadata is ExtendedTodoMetadata {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }

  // Basic validation - can be extended based on requirements
// @ts-ignore - Unused variable
//   const validKeys = [
    'checklists',
    'attachments',
    'labels',
    'dueDate',
    'reminder',
    'location',
    'collaborators',
    'customFields',
  ];
// @ts-ignore - Unused variable
// 
  const keys = Object.keys(metadata as any);
  return keys.every(key => validKeys.includes(key as any));
}

/**
 * Create metadata for TodoNFT
 */
export function createNFTMetadata(data: Partial<ExtendedTodoMetadata>): string {
  try {
    // Clean and validate data
    const metadata: ExtendedTodoMetadata = {};

    if (data.checklists) {metadata?.checklists = data.checklists;}
    if (data.attachments) {metadata?.attachments = data.attachments;}
    if (data.labels) {metadata?.labels = data.labels;}
    if (data.dueDate) {metadata?.dueDate = data.dueDate;}
    if (data.reminder) {metadata?.reminder = data.reminder;}
    if (data.location) {metadata?.location = data.location;}
    if (data.collaborators) {metadata?.collaborators = data.collaborators;}
    if (data.customFields) {metadata?.customFields = data.customFields;}

    return JSON.stringify(metadata as any);
  } catch (error) {
    console.error('Failed to create NFT metadata:', error);
    return '{}';
  }
}

/**
 * Extract image URL from NFT data with fallback
 */
export function extractNFTImageUrl(
  nftData: any,
  fallbackUrl?: string
): string | undefined {
// @ts-ignore - Unused variable
//   const imageUrl = nftData?.image_url || nftData?.imageUrl || nftData?.image;
  
  if (!imageUrl) {
    return fallbackUrl;
  }

  // Transform blob ID to URL if needed
  if (!imageUrl.startsWith('http')) {
    return transformWalrusBlobToUrl(imageUrl as any);
  }

  return imageUrl;
}

/**
 * Get NFT by various identifiers (object ID, title, etc.)
 */
export async function findNFT(
  identifier: string,
  ownerAddress: string,
  searchBy: 'objectId' | 'title' | 'any' = 'any'
): Promise<Todo | null> {
  try {
    // If searching by object ID, try direct fetch first
    if (searchBy === 'objectId' || (searchBy === 'any' && identifier.startsWith('0x'))) {
      try {
// @ts-ignore - Unused variable
//         const todo = await getTodoByObjectId(identifier as any);
        if (todo && todo?.owner === ownerAddress) {
          return todo;
        }
      } catch {
        // Continue to search in owned objects
      }
    }

    // Search in owned objects
// @ts-ignore - Unused variable
//     const todos = await getTodosFromBlockchain(ownerAddress, {
      useCache: true,
    });

    return todos.find(todo => {
      if (searchBy === 'objectId') {
        return todo?.objectId === identifier;
      } else if (searchBy === 'title') {
        return todo?.title?.toLowerCase() === identifier.toLowerCase();
      } else {
        // Search by any field
        return (
          todo?.objectId === identifier ||
          todo?.title?.toLowerCase() === identifier.toLowerCase() ||
          todo?.id === identifier
        );
      }
    }) || null;
  } catch (error) {
    console.error('Failed to find NFT:', error);
    return null;
  }
}

/**
 * Sort todos by various criteria
 */
export function sortTodos(
  todos: Todo[],
  sortBy: 'createdAt' | 'title' | 'priority' | 'dueDate' = 'createdAt',
  order: 'asc' | 'desc' = 'desc'
): Todo[] {
// @ts-ignore - Unused variable
//   const sorted = [...todos].sort(_(a, _b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'createdAt':
// @ts-ignore - Unused variable
//         const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
// @ts-ignore - Unused variable
//         const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        comparison = aTime - bTime;
        break;
      case 'title':
        comparison = a?.title?.localeCompare(b.title);
        break;
      case 'priority':
// @ts-ignore - Unused variable
//         const priorityOrder = { high: 3, medium: 2, low: 1 };
        comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
        break;
      case 'dueDate':
        if (!a.dueDate && !b.dueDate) {comparison = 0;}
        else if (!a.dueDate) {comparison = 1;}
        else if (!b.dueDate) {comparison = -1;}
        else {comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();}
        break;
    }

    return order === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Group todos by various criteria
 */
export function groupTodos(
  todos: Todo[],
  groupBy: 'date' | 'priority' | 'status' | 'tags'
): Record<string, Todo[]> {
  const groups: Record<string, Todo[]> = {};

  todos.forEach(todo => {
    let key: string;

    switch (groupBy) {
      case 'date':
        key = todo.createdAt ? new Date(todo.createdAt).toLocaleDateString() : 'No Date';
        break;
      case 'priority':
        key = todo.priority;
        break;
      case 'status':
        key = todo.completed ? 'completed' : 'pending';
        break;
      case 'tags':
        // Group by first tag or 'untagged'
        key = todo.tags?.[0] || 'untagged';
        break;
    }

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(todo as any);
  });

  return groups;
}
