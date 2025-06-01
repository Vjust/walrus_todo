/**
 * Service for managing local todo data and NFT operations
 * Integrates with Sui blockchain and Walrus storage
 */

import type { Todo, TodoList, TodoNFTMetadata, NFTCategory } from '@/types/todo-nft';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { PublicKey } from '@solana/web3.js';
import safeStorage, { isUsingFallbackStorage } from './safe-storage';
import { loadNetworkConfig, type AppConfig } from './config-loader';
import { walrusClient } from './walrus-client';

// Runtime configuration state
let runtimeConfig: AppConfig | null = null;

// NFT cache for frequently accessed items
const nftCache = new Map<string, { todo: Todo; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Transaction status tracking
const transactionStatusMap = new Map<string, {
  status: 'pending' | 'success' | 'failed';
  message?: string;
  timestamp: number;
}>();


// Image processing options
export interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

// Batch operation interface
export interface BatchNFTOperation {
  type: 'create' | 'transfer' | 'update';
  todos?: Omit<Todo, 'id' | 'blockchainStored'>[];
  todoIds?: string[];
  toAddress?: string;
  metadata?: Partial<TodoNFTMetadata>;
}

/**
 * Load runtime configuration for current network
 */
async function ensureConfigLoaded(): Promise<AppConfig> {
  if (!runtimeConfig) {
    const network = typeof window !== 'undefined' 
      ? (process.env.NEXT_PUBLIC_NETWORK || 'testnet')
      : 'testnet';
    
    runtimeConfig = await loadNetworkConfig(network);
    
    // Fallback config if load fails
    if (!runtimeConfig) {
      runtimeConfig = {
        network: {
          name: 'testnet',
          url: 'https://fullnode.testnet.sui.io',
          explorerUrl: 'https://testnet.suiexplorer.com',
        },
        walrus: {
          networkUrl: 'https://wal.testnet.sui.io',
          publisherUrl: 'https://publisher-testnet.walrus.space',
          aggregatorUrl: 'https://aggregator-testnet.walrus.space',
          apiPrefix: 'https://api-testnet.walrus.tech/1.0',
        },
        deployment: {
          packageId: '0xd6f97fc85796ee23adf60504a620631a0eea6947f85c4ca51e02245e9a4b57d7',
          digest: 'unknown',
          timestamp: new Date().toISOString(),
          deployerAddress: '0xca793690985183dc8e2180fd059d76f3b0644f5c2ecd3b01cdebe7d40b0cca39',
        },
        contracts: {
          todoNft: {
            packageId: '0xd6f97fc85796ee23adf60504a620631a0eea6947f85c4ca51e02245e9a4b57d7',
            moduleName: 'todo_nft',
            structName: 'TodoNFT',
          },
        },
        features: {
          aiEnabled: false,
          blockchainVerification: false,
          encryptedStorage: false,
        },
      };
    }
  }
  return runtimeConfig;
}

// Define wallet-aware service types
export interface WalletSigner {
  signTransaction?: (transaction: Transaction) => Promise<any>;
  signAndExecuteTransaction?: (transaction: Transaction) => Promise<any>;
  address?: string;
  publicKey?: PublicKey | string | null;
}

// Default data used when no data exists in storage
const defaultTodoLists: Record<string, TodoList> = {
  default: {
    name: 'Default',
    todos: [
      {
        id: '1',
        title: 'Set up blockchain wallet',
        completed: false,
        priority: 'high',
        tags: ['setup', 'blockchain'],
        blockchainStored: true,
        objectId: '0xabc123',
      },
      {
        id: '2',
        title: 'Design oceanic UI components',
        description: 'Create reusable Tailwind components with ocean theme',
        completed: true,
        priority: 'medium',
        tags: ['design', 'frontend'],
        blockchainStored: false,
      },
      {
        id: '3',
        title: 'Implement Sui blockchain connectivity',
        completed: false,
        priority: 'high',
        dueDate: '2023-12-01',
        blockchainStored: false,
      },
    ],
  },
  work: {
    name: 'Work',
    todos: [
      {
        id: '4',
        title: 'Test NFT todo transfers',
        completed: false,
        priority: 'medium',
        tags: ['testing', 'blockchain'],
        blockchainStored: false,
      },
    ],
  },
  personal: {
    name: 'Personal',
    todos: [],
  },
  shopping: {
    name: 'Shopping',
    todos: [],
  },
};

// Create a typed storage helper for wallet-scoped todo lists
// Structure: { [walletAddress]: { [listName]: TodoList } }
const walletTodoStorage = safeStorage.createTyped<
  Record<string, Record<string, TodoList>>
>('walrusTodoLists', {});

// Current in-memory reference to all wallet todo lists
let allWalletTodos: Record<string, Record<string, TodoList>> = {};

// Helper function to get wallet-specific storage key
function getWalletKey(address?: string): string {
  if (!address) return 'anonymous';
  return address.toLowerCase();
}

/**
 * Try to load todo lists from storage for all wallets
 */
function loadAllWalletTodos(): void {
  try {
    const storedTodos = walletTodoStorage.get();
    if (storedTodos && typeof storedTodos === 'object') {
      allWalletTodos = storedTodos;
    }

    if (isUsingFallbackStorage()) {
      console.info(
        `Using memory storage. Data will not persist between sessions.`
      );
    }
  } catch (e) {
    console.warn('Failed to load wallet todos from storage:', e);
  }
}

/**
 * Save all wallet todo lists to storage
 */
function saveAllWalletTodos(): void {
  try {
    walletTodoStorage.set(allWalletTodos);
  } catch (e) {
    console.warn('Failed to save wallet todos to storage:', e);
  }
}

/**
 * Get todos for a specific wallet, initializing with defaults if first time
 */
function getWalletTodos(address?: string): Record<string, TodoList> {
  const walletKey = getWalletKey(address);

  // Load from storage if not in memory
  if (!allWalletTodos[walletKey]) {
    loadAllWalletTodos();
  }

  // Initialize with default todos for new wallets
  if (!allWalletTodos[walletKey]) {
    allWalletTodos[walletKey] = { ...defaultTodoLists };
    saveAllWalletTodos();
  }

  return allWalletTodos[walletKey];
}

/**
 * Get all todo lists for a specific wallet
 */
export function getTodoLists(walletAddress?: string): string[] {
  const walletTodos = getWalletTodos(walletAddress);
  return Object.keys(walletTodos);
}

/**
 * Get a specific todo list for a wallet
 */
export function getTodoList(
  listName: string,
  walletAddress?: string
): TodoList | null {
  const walletTodos = getWalletTodos(walletAddress);
  return walletTodos[listName] || null;
}

/**
 * Get todos for a specific list and wallet
 */
export function getTodos(listName: string, walletAddress?: string): Todo[] {
  const walletTodos = getWalletTodos(walletAddress);
  return walletTodos[listName]?.todos || [];
}

/**
 * Add a new todo to a list for a specific wallet
 */
export function addTodo(
  listName: string,
  todo: Omit<Todo, 'id' | 'blockchainStored'>,
  walletAddress?: string
): Todo {
  const walletKey = getWalletKey(walletAddress);
  const walletTodos = getWalletTodos(walletAddress);

  if (!walletTodos[listName]) {
    walletTodos[listName] = {
      name: listName,
      todos: [],
    };
  }

  const newTodo: Todo = {
    ...todo,
    id: Date.now().toString(),
    blockchainStored: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  walletTodos[listName].todos.push(newTodo);

  // Update the global state
  allWalletTodos[walletKey] = walletTodos;

  // Save changes
  saveAllWalletTodos();

  return newTodo;
}

/**
 * Update an existing todo for a specific wallet
 */
export function updateTodo(
  listName: string,
  updatedTodo: Todo,
  walletAddress?: string
): boolean {
  const walletKey = getWalletKey(walletAddress);
  const walletTodos = getWalletTodos(walletAddress);

  if (!walletTodos[listName]) return false;

  const index = walletTodos[listName].todos.findIndex(
    todo => todo.id === updatedTodo.id
  );
  if (index === -1) return false;

  walletTodos[listName].todos[index] = {
    ...updatedTodo,
    updatedAt: new Date().toISOString(),
  };

  // Update the global state
  allWalletTodos[walletKey] = walletTodos;

  // Save changes
  saveAllWalletTodos();

  return true;
}

/**
 * Delete a todo for a specific wallet
 */
export function deleteTodo(
  listName: string,
  todoId: string,
  walletAddress?: string
): boolean {
  const walletKey = getWalletKey(walletAddress);
  const walletTodos = getWalletTodos(walletAddress);

  if (!walletTodos[listName]) return false;

  const initialLength = walletTodos[listName].todos.length;
  walletTodos[listName].todos = walletTodos[listName].todos.filter(
    todo => todo.id !== todoId
  );

  // Update the global state
  allWalletTodos[walletKey] = walletTodos;

  // Save changes
  saveAllWalletTodos();

  return walletTodos[listName].todos.length !== initialLength;
}

/**
 * Create a new todo list for a specific wallet
 */
export function createTodoList(
  listName: string,
  walletAddress?: string
): boolean {
  const walletKey = getWalletKey(walletAddress);
  const walletTodos = getWalletTodos(walletAddress);

  if (walletTodos[listName]) return false;

  walletTodos[listName] = {
    name: listName,
    todos: [],
  };

  // Update the global state
  allWalletTodos[walletKey] = walletTodos;

  // Save changes
  saveAllWalletTodos();

  return true;
}

/**
 * Delete a todo list for a specific wallet
 */
export function deleteTodoList(
  listName: string,
  walletAddress?: string
): boolean {
  const walletKey = getWalletKey(walletAddress);
  const walletTodos = getWalletTodos(walletAddress);

  if (!walletTodos[listName] || listName === 'default') return false;

  delete walletTodos[listName];

  // Update the global state
  allWalletTodos[walletKey] = walletTodos;

  // Save changes
  saveAllWalletTodos();

  return true;
}

/**
 * Mark a todo as stored on blockchain for a specific wallet
 */
export function markTodoAsBlockchainStored(
  listName: string,
  todoId: string,
  objectId: string,
  walletAddress?: string
): boolean {
  const walletKey = getWalletKey(walletAddress);
  const walletTodos = getWalletTodos(walletAddress);

  if (!walletTodos[listName]) return false;

  const todoIndex = walletTodos[listName].todos.findIndex(
    todo => todo.id === todoId
  );
  if (todoIndex === -1) return false;

  walletTodos[listName].todos[todoIndex].blockchainStored = true;
  walletTodos[listName].todos[todoIndex].objectId = objectId;

  // Update the global state
  allWalletTodos[walletKey] = walletTodos;

  // Save changes
  saveAllWalletTodos();

  return true;
}

/**
 * Store a todo on the blockchain using wallet signer
 */
export async function storeTodoOnBlockchain(
  listName: string,
  todoId: string,
  signer?: WalletSigner,
  walletAddress?: string
): Promise<string | null> {
  const walletTodos = getWalletTodos(walletAddress);

  if (!walletTodos[listName]) return null;

  const todo = walletTodos[listName].todos.find(t => t.id === todoId);
  if (!todo) return null;

  // If no signer provided, operate in read-only mode
  if (!signer || !signer.signAndExecuteTransaction) {
    console.warn('No wallet signer available - running in read-only mode');
    return null;
  }

  try {
    // Load runtime configuration
    const config = await ensureConfigLoaded();

    // First, upload the todo data to Walrus
    const todoData = {
      title: todo.title,
      description: todo.description || '',
      priority: todo.priority,
      tags: todo.tags,
      dueDate: todo.dueDate,
      createdAt: new Date().toISOString(),
      localId: todo.id,
    };

    console.log('Uploading todo data to Walrus...');
    const walrusResult = await walrusClient.uploadJson(todoData, { epochs: 5 });
    console.log('Walrus upload successful:', walrusResult.blobId);

    // Create a transaction for storing the todo
    const tx = new Transaction();

    // Convert todo data to bytes for the Move contract
    const titleBytes = new TextEncoder().encode(todo.title);
    const descriptionBytes = new TextEncoder().encode(todo.description || '');
    // Use the Walrus blob URL as the image URL (storing metadata there)
    const imageUrlBytes = new TextEncoder().encode(
      walrusClient.getBlobUrl(walrusResult.blobId)
    );
    const metadataBytes = new TextEncoder().encode(
      JSON.stringify({
        priority: todo.priority,
        tags: todo.tags,
        dueDate: todo.dueDate,
        walrusBlobId: walrusResult.blobId,
      })
    );

    // Call the create_todo_nft function from the deployed contract
    tx.moveCall({
      target: `${config.deployment.packageId}::todo_nft::create_todo_nft`,
      arguments: [
        tx.pure.vector('u8', Array.from(titleBytes)),
        tx.pure.vector('u8', Array.from(descriptionBytes)),
        tx.pure.vector('u8', Array.from(imageUrlBytes)),
        tx.pure.vector('u8', Array.from(metadataBytes)),
        tx.pure.bool(false), // is_private
      ],
    });

    console.log('Executing transaction for todo:', todo.title);

    // Execute the transaction
    const result = await signer.signAndExecuteTransaction(tx);

    // Extract the created object ID from the transaction result
    const objectId = result.effects?.created?.[0]?.reference?.objectId || null;

    if (objectId) {
      // Mark the todo as stored
      markTodoAsBlockchainStored(listName, todoId, objectId, walletAddress);
      console.log('Todo NFT created with ID:', objectId);
    }

    return objectId;
  } catch (error) {
    console.error('Failed to store todo on blockchain:', error);
    return null;
  }
}

/**
 * Retrieve todos from blockchain storage
 */
export async function retrieveTodosFromBlockchain(
  address?: string
): Promise<Todo[]> {
  if (!address) {
    console.warn('No address provided - cannot retrieve blockchain todos');
    return [];
  }

  try {
    // Load runtime configuration
    const config = await ensureConfigLoaded();

    // Create a Sui client to query the blockchain
    const client = new SuiClient({ url: config.network.url });

    // Query for TodoNFT objects owned by the address
    const objects = await client.getOwnedObjects({
      owner: address,
      filter: {
        StructType: `${config.deployment.packageId}::todo_nft::TodoNFT`,
      },
      options: {
        showContent: true,
        showType: true,
      },
    });

    // Convert blockchain objects to Todo format
    const todos: Todo[] = [];

    for (const obj of objects.data) {
      if (obj.data?.content?.dataType === 'moveObject') {
        const fields = obj.data.content.fields as any;

        // Parse metadata if available
        let metadata = {
          priority: 'medium' as const,
          tags: [] as string[],
          dueDate: undefined as string | undefined,
          walrusBlobId: undefined as string | undefined,
        };
        try {
          if (fields.metadata) {
            metadata = JSON.parse(fields.metadata);
          }
        } catch (e) {
          console.warn('Failed to parse todo metadata:', e);
        }

        // If there's a Walrus blob ID, we can fetch additional data
        if (metadata.walrusBlobId) {
          try {
            const walrusData = await walrusClient.downloadJson(
              metadata.walrusBlobId
            );
            console.log('Fetched Walrus data for todo:', walrusData);
          } catch (e) {
            console.warn('Failed to fetch Walrus data:', e);
          }
        }

        todos.push({
          id: obj.data.objectId,
          title: fields.title || '',
          description: fields.description || '',
          completed: fields.completed || false,
          priority: metadata.priority,
          tags: metadata.tags,
          dueDate: metadata.dueDate,
          blockchainStored: true,
          objectId: obj.data.objectId,
        });
      }
    }

    console.log(
      `Retrieved ${todos.length} todos from blockchain for address:`,
      address
    );
    return todos;
  } catch (error) {
    console.error('Failed to retrieve todos from blockchain:', error);
    return [];
  }
}

/**
 * Complete a todo on the blockchain
 */
export async function completeTodoOnBlockchain(
  listName: string,
  todoId: string,
  signer?: WalletSigner,
  walletAddress?: string
): Promise<boolean> {
  const walletTodos = getWalletTodos(walletAddress);

  if (!walletTodos[listName]) return false;

  const todo = walletTodos[listName].todos.find(t => t.id === todoId);
  if (!todo || !todo.blockchainStored || !todo.objectId) {
    console.error('Todo not found or not stored on blockchain');
    return false;
  }

  if (!signer || !signer.signAndExecuteTransaction) {
    console.warn('No wallet signer available - cannot complete NFT');
    return false;
  }

  try {
    // Load runtime configuration
    const config = await ensureConfigLoaded();

    // Create a transaction to complete the todo
    const tx = new Transaction();

    // Call the complete_todo function from the contract
    tx.moveCall({
      target: `${config.deployment.packageId}::todo_nft::complete_todo`,
      arguments: [tx.object(todo.objectId)],
    });

    console.log('Marking todo as complete:', todo.objectId);

    // Execute the transaction
    const result = await signer.signAndExecuteTransaction(tx);
    console.log('Complete transaction result:', result);

    // Update local state after successful completion
    if (result.digest) {
      todo.completed = true;
      todo.completedAt = new Date().toISOString();
      updateTodo(listName, todo, walletAddress);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Failed to complete todo on blockchain:', error);
    return false;
  }
}

/**
 * Transfer a todo NFT to another address
 * This requires the todo to be stored on blockchain
 */
export async function transferTodoNFT(
  listName: string,
  todoId: string,
  toAddress: string,
  signer?: WalletSigner,
  walletAddress?: string
): Promise<boolean> {
  const walletTodos = getWalletTodos(walletAddress);

  if (!walletTodos[listName]) return false;

  const todo = walletTodos[listName].todos.find(t => t.id === todoId);
  if (!todo || !todo.blockchainStored || !todo.objectId) {
    console.error('Todo not found or not stored on blockchain');
    return false;
  }

  if (!signer || !signer.signAndExecuteTransaction) {
    console.warn('No wallet signer available - cannot transfer NFT');
    return false;
  }

  try {
    // Load runtime configuration
    const config = await ensureConfigLoaded();

    // Create a transfer transaction
    const tx = new Transaction();

    // Use the custom transfer function from the contract which emits events
    tx.moveCall({
      target: `${config.deployment.packageId}::todo_nft::transfer_todo_nft`,
      arguments: [tx.object(todo.objectId), tx.pure.address(toAddress)],
    });

    console.log('Transferring NFT:', todo.objectId, 'to:', toAddress);

    // Execute the transaction
    const result = await signer.signAndExecuteTransaction(tx);
    console.log('Transfer transaction result:', result);

    // Remove the todo from the sender's list after successful transfer
    if (result.digest) {
      deleteTodo(listName, todoId, walletAddress);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Failed to transfer todo NFT:', error);
    return false;
  }
}

/**
 * Create a Todo NFT with image and metadata
 */
export async function createNFT(
  listName: string,
  todo: Omit<Todo, 'id' | 'blockchainStored'>,
  imageFile?: File | Blob,
  signer?: WalletSigner,
  walletAddress?: string
): Promise<{ todoId: string; objectId: string | null }> {
  // First add the todo locally
  const newTodo = addTodo(listName, todo, walletAddress);
  
  if (!signer || !signer.signAndExecuteTransaction) {
    console.warn('No wallet signer available - created local todo only');
    return { todoId: newTodo.id, objectId: null };
  }

  try {
    // Update transaction status
    updateTransactionStatus(newTodo.id, 'pending', 'Creating NFT...');

    // Load runtime configuration
    const config = await ensureConfigLoaded();

    // Process and upload image if provided
    let imageData: TodoNFTMetadata['imageData'] | undefined;
    if (imageFile) {
      console.log('Processing and uploading image...');
      const processedImage = await processImage(imageFile, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.9,
        format: 'jpeg'
      });
      
      const imageBuffer = new Uint8Array(await processedImage.blob.arrayBuffer());
      const imageResult = await walrusClient.upload(imageBuffer, { epochs: 5 });
      imageData = {
        blobId: imageResult.blobId,
        url: walrusClient.getBlobUrl(imageResult.blobId),
        mimeType: processedImage.mimeType,
        size: processedImage.size
      };
      console.log('Image uploaded to Walrus:', imageData.blobId);
    }

    // Prepare metadata
    const metadata: TodoNFTMetadata = {
      priority: todo.priority,
      tags: todo.tags || [],
      dueDate: todo.dueDate,
      category: todo.category,
      imageData,
      attributes: {
        createdBy: walletAddress,
        createdAt: new Date().toISOString()
      }
    };

    // Validate metadata
    if (!validateNFTMetadata(metadata)) {
      throw new Error('Invalid NFT metadata');
    }

    // Upload todo data and metadata to Walrus
    const todoData = {
      title: todo.title,
      description: todo.description || '',
      metadata,
      localId: newTodo.id,
    };

    console.log('Uploading todo data to Walrus...');
    const walrusResult = await walrusClient.uploadJson(todoData, { epochs: 5 });
    console.log('Walrus upload successful:', walrusResult.blobId);

    // Create NFT on blockchain
    const objectId = await createNFTOnBlockchain(
      newTodo,
      walrusResult.blobId,
      imageData?.url || '',
      metadata,
      config,
      signer
    );

    if (objectId) {
      // Mark as blockchain stored
      markTodoAsBlockchainStored(listName, newTodo.id, objectId, walletAddress);
      
      // Update cache
      updateNFTCache(objectId, { ...newTodo, objectId, blockchainStored: true });
      
      // Update transaction status
      updateTransactionStatus(newTodo.id, 'success', 'NFT created successfully');
    } else {
      updateTransactionStatus(newTodo.id, 'failed', 'Failed to create NFT on blockchain');
    }

    return { todoId: newTodo.id, objectId };
  } catch (error) {
    console.error('Failed to create NFT:', error);
    updateTransactionStatus(newTodo.id, 'failed', error instanceof Error ? error.message : 'Unknown error');
    return { todoId: newTodo.id, objectId: null };
  }
}

/**
 * Update NFT metadata on blockchain
 */
export async function updateNFTMetadata(
  listName: string,
  todoId: string,
  updates: Partial<Todo>,
  newImageFile?: File | Blob,
  signer?: WalletSigner,
  walletAddress?: string
): Promise<boolean> {
  const walletTodos = getWalletTodos(walletAddress);

  if (!walletTodos[listName]) return false;

  const todo = walletTodos[listName].todos.find(t => t.id === todoId);
  if (!todo || !todo.blockchainStored || !todo.objectId) {
    console.error('Todo not found or not stored on blockchain');
    return false;
  }

  if (!signer || !signer.signAndExecuteTransaction) {
    console.warn('No wallet signer available - updating local only');
    return updateTodo(listName, { ...todo, ...updates }, walletAddress);
  }

  try {
    updateTransactionStatus(todoId, 'pending', 'Updating NFT metadata...');

    // Load runtime configuration
    const config = await ensureConfigLoaded();

    // Process new image if provided
    let newImageData: TodoNFTMetadata['imageData'] | undefined;
    if (newImageFile) {
      const processedImage = await processImage(newImageFile, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.9,
        format: 'jpeg'
      });
      
      const imageBuffer = new Uint8Array(await processedImage.blob.arrayBuffer());
      const imageResult = await walrusClient.upload(imageBuffer, { epochs: 5 });
      newImageData = {
        blobId: imageResult.blobId,
        url: walrusClient.getBlobUrl(imageResult.blobId),
        mimeType: processedImage.mimeType,
        size: processedImage.size
      };
    }

    // Prepare updated metadata
    const updatedMetadata: TodoNFTMetadata = {
      priority: updates.priority || todo.priority,
      tags: updates.tags || todo.tags || [],
      dueDate: updates.dueDate || todo.dueDate,
      category: updates.category || todo.category,
      imageData: newImageData || undefined,
      attributes: {
        updatedBy: walletAddress,
        updatedAt: new Date().toISOString()
      }
    };

    // Upload updated data to Walrus
    const updatedData = {
      title: updates.title || todo.title,
      description: updates.description || todo.description || '',
      metadata: updatedMetadata,
      localId: todoId,
    };

    const walrusResult = await walrusClient.uploadJson(updatedData, { epochs: 5 });

    // Update on blockchain
    const tx = new Transaction();

    const titleBytes = new TextEncoder().encode(updatedData.title);
    const descriptionBytes = new TextEncoder().encode(updatedData.description);
    const imageUrlBytes = new TextEncoder().encode(newImageData?.url || '');
    const metadataBytes = new TextEncoder().encode(JSON.stringify(updatedMetadata));

    tx.moveCall({
      target: `${config.deployment.packageId}::todo_nft::update_todo_nft`,
      arguments: [
        tx.object(todo.objectId),
        tx.pure.vector('u8', Array.from(titleBytes)),
        tx.pure.vector('u8', Array.from(descriptionBytes)),
        tx.pure.vector('u8', Array.from(imageUrlBytes)),
        tx.pure.vector('u8', Array.from(metadataBytes)),
      ],
    });

    const result = await signer.signAndExecuteTransaction(tx);

    if (result.digest) {
      // Update local state
      const updatedTodo = { ...todo, ...updates, updatedAt: new Date().toISOString() };
      updateTodo(listName, updatedTodo, walletAddress);
      
      // Update cache
      updateNFTCache(todo.objectId, updatedTodo);
      
      updateTransactionStatus(todoId, 'success', 'NFT updated successfully');
      return true;
    }

    updateTransactionStatus(todoId, 'failed', 'Failed to update NFT');
    return false;
  } catch (error) {
    console.error('Failed to update NFT metadata:', error);
    updateTransactionStatus(todoId, 'failed', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

/**
 * Batch NFT operations for efficiency
 */
export async function batchNFTOperations(
  operations: BatchNFTOperation[],
  signer?: WalletSigner,
  walletAddress?: string
): Promise<{ success: boolean; results: any[] }> {
  if (!signer || !signer.signAndExecuteTransaction) {
    console.warn('No wallet signer available - cannot perform batch operations');
    return { success: false, results: [] };
  }

  const results: any[] = [];
  const config = await ensureConfigLoaded();

  try {
    // Group operations by type for efficiency
    const createOps = operations.filter(op => op.type === 'create');
    const transferOps = operations.filter(op => op.type === 'transfer');
    const updateOps = operations.filter(op => op.type === 'update');

    // Process create operations
    if (createOps.length > 0) {
      console.log(`Processing ${createOps.length} create operations...`);
      for (const op of createOps) {
        if (op.todos) {
          for (const todo of op.todos) {
            const result = await createNFT('default', todo, undefined, signer, walletAddress);
            results.push({ type: 'create', ...result });
          }
        }
      }
    }

    // Process transfer operations
    if (transferOps.length > 0) {
      console.log(`Processing ${transferOps.length} transfer operations...`);
      const tx = new Transaction();
      
      for (const op of transferOps) {
        if (op.todoIds && op.toAddress) {
          for (const todoId of op.todoIds) {
            // Find the todo in any list
            let todo: Todo | undefined;
            let listName: string | undefined;
            
            const lists = getTodoLists(walletAddress);
            for (const list of lists) {
              const todos = getTodos(list, walletAddress);
              const found = todos.find(t => t.id === todoId);
              if (found) {
                todo = found;
                listName = list;
                break;
              }
            }
            
            if (todo && todo.objectId && listName) {
              tx.moveCall({
                target: `${config.deployment.packageId}::todo_nft::transfer_todo_nft`,
                arguments: [tx.object(todo.objectId), tx.pure.address(op.toAddress)],
              });
            }
          }
        }
      }
      
      if (tx.blockData.transactions.length > 0) {
        const result = await signer.signAndExecuteTransaction(tx);
        results.push({ type: 'batch_transfer', digest: result.digest });
      }
    }

    return { success: true, results };
  } catch (error) {
    console.error('Batch NFT operations failed:', error);
    return { success: false, results };
  }
}

/**
 * Get NFT from cache or blockchain
 */
export async function getNFT(
  objectId: string,
  forceRefresh = false
): Promise<Todo | null> {
  // Check cache first
  if (!forceRefresh) {
    const cached = getNFTFromCache(objectId);
    if (cached) return cached;
  }

  try {
    const config = await ensureConfigLoaded();
    const client = new SuiClient({ url: config.network.url });

    const object = await client.getObject({
      id: objectId,
      options: {
        showContent: true,
        showType: true,
        showOwner: true,
      },
    });

    if (object.data?.content?.dataType === 'moveObject') {
      const fields = object.data.content.fields as any;
      const todo = await parseNFTObject(object.data, fields);
      
      // Update cache
      updateNFTCache(objectId, todo);
      
      return todo;
    }

    return null;
  } catch (error) {
    console.error('Failed to get NFT:', error);
    return null;
  }
}

/**
 * Estimate gas for NFT operations
 */
export async function estimateNFTGas(
  operation: 'create' | 'transfer' | 'update',
  signer?: WalletSigner
): Promise<{ estimatedGas: number; estimatedCost: string }> {
  if (!signer || !signer.signTransaction) {
    return { estimatedGas: 0, estimatedCost: '0' };
  }

  try {
    const config = await ensureConfigLoaded();
    const client = new SuiClient({ url: config.network.url });
    
    // Create a dummy transaction for gas estimation
    const tx = new Transaction();
    
    switch (operation) {
      case 'create':
        tx.moveCall({
          target: `${config.deployment.packageId}::todo_nft::create_todo_nft`,
          arguments: [
            tx.pure.vector('u8', Array.from(new TextEncoder().encode('Test'))),
            tx.pure.vector('u8', Array.from(new TextEncoder().encode(''))),
            tx.pure.vector('u8', Array.from(new TextEncoder().encode(''))),
            tx.pure.vector('u8', Array.from(new TextEncoder().encode('{}'))),
            tx.pure.bool(false),
          ],
        });
        break;
      case 'transfer':
        // Use a dummy object ID for estimation
        tx.moveCall({
          target: `${config.deployment.packageId}::todo_nft::transfer_todo_nft`,
          arguments: [
            tx.object('0x0000000000000000000000000000000000000000000000000000000000000000'),
            tx.pure.address('0x0000000000000000000000000000000000000000000000000000000000000000'),
          ],
        });
        break;
      case 'update':
        tx.moveCall({
          target: `${config.deployment.packageId}::todo_nft::update_todo_nft`,
          arguments: [
            tx.object('0x0000000000000000000000000000000000000000000000000000000000000000'),
            tx.pure.vector('u8', Array.from(new TextEncoder().encode('Test'))),
            tx.pure.vector('u8', Array.from(new TextEncoder().encode(''))),
            tx.pure.vector('u8', Array.from(new TextEncoder().encode(''))),
            tx.pure.vector('u8', Array.from(new TextEncoder().encode('{}'))),
          ],
        });
        break;
    }

    // Dry run to get gas estimate
    tx.setSender(signer.address || '0x0000000000000000000000000000000000000000000000000000000000000000');
    const dryRunResult = await client.dryRunTransactionBlock({
      transactionBlock: await tx.build({ client }),
    });

    const gasUsed = Number(dryRunResult.effects.gasUsed.computationCost) + 
                    Number(dryRunResult.effects.gasUsed.storageCost) -
                    Number(dryRunResult.effects.gasUsed.storageRebate);

    // Convert to SUI (1 SUI = 10^9 MIST)
    const estimatedCost = (gasUsed / 1_000_000_000).toFixed(6);

    return { estimatedGas: gasUsed, estimatedCost: `${estimatedCost} SUI` };
  } catch (error) {
    console.error('Failed to estimate gas:', error);
    return { estimatedGas: 0, estimatedCost: '0' };
  }
}

/**
 * Get transaction status
 */
export function getTransactionStatus(todoId: string): {
  status: 'pending' | 'success' | 'failed' | 'none';
  message?: string;
} {
  const status = transactionStatusMap.get(todoId);
  if (!status) return { status: 'none' };
  
  // Clean up old statuses (older than 1 hour)
  if (Date.now() - status.timestamp > 3600000) {
    transactionStatusMap.delete(todoId);
    return { status: 'none' };
  }
  
  return { status: status.status, message: status.message };
}

// Helper functions

/**
 * Process image for NFT upload
 */
async function processImage(
  file: File | Blob,
  options: ImageProcessingOptions
): Promise<{ blob: Blob; mimeType: string; size: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Calculate dimensions
        let { width, height } = img;
        const maxWidth = options.maxWidth || 1200;
        const maxHeight = options.maxHeight || 1200;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to process image'));
              return;
            }
            resolve({
              blob,
              mimeType: `image/${options.format || 'jpeg'}`,
              size: blob.size,
            });
          },
          `image/${options.format || 'jpeg'}`,
          options.quality || 0.9
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Validate NFT metadata
 */
function validateNFTMetadata(metadata: TodoNFTMetadata): boolean {
  if (!metadata.priority || !['low', 'medium', 'high'].includes(metadata.priority)) {
    return false;
  }
  
  if (!Array.isArray(metadata.tags)) {
    return false;
  }
  
  if (metadata.imageData) {
    if (!metadata.imageData.blobId || !metadata.imageData.url) {
      return false;
    }
  }
  
  return true;
}

/**
 * Update NFT cache
 */
function updateNFTCache(objectId: string, todo: Todo): void {
  nftCache.set(objectId, {
    todo,
    timestamp: Date.now(),
  });
  
  // Clean up old cache entries
  for (const [key, value] of Array.from(nftCache.entries())) {
    if (Date.now() - value.timestamp > CACHE_DURATION) {
      nftCache.delete(key);
    }
  }
}

/**
 * Get NFT from cache
 */
function getNFTFromCache(objectId: string): Todo | null {
  const cached = nftCache.get(objectId);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp > CACHE_DURATION) {
    nftCache.delete(objectId);
    return null;
  }
  
  return cached.todo;
}

/**
 * Update transaction status
 */
function updateTransactionStatus(
  todoId: string,
  status: 'pending' | 'success' | 'failed',
  message?: string
): void {
  transactionStatusMap.set(todoId, {
    status,
    message,
    timestamp: Date.now(),
  });
}

/**
 * Create NFT on blockchain
 */
async function createNFTOnBlockchain(
  todo: Todo,
  walrusBlobId: string,
  imageUrl: string,
  metadata: TodoNFTMetadata,
  config: AppConfig,
  signer: WalletSigner
): Promise<string | null> {
  const tx = new Transaction();

  const titleBytes = new TextEncoder().encode(todo.title);
  const descriptionBytes = new TextEncoder().encode(todo.description || '');
  const imageUrlBytes = new TextEncoder().encode(imageUrl);
  const metadataBytes = new TextEncoder().encode(JSON.stringify({
    ...metadata,
    walrusBlobId,
  }));

  tx.moveCall({
    target: `${config.deployment.packageId}::todo_nft::create_todo_nft`,
    arguments: [
      tx.pure.vector('u8', Array.from(titleBytes)),
      tx.pure.vector('u8', Array.from(descriptionBytes)),
      tx.pure.vector('u8', Array.from(imageUrlBytes)),
      tx.pure.vector('u8', Array.from(metadataBytes)),
      tx.pure.bool(todo.isPrivate || false),
    ],
  });

  const result = await signer.signAndExecuteTransaction!(tx);
  return result.effects?.created?.[0]?.reference?.objectId || null;
}

/**
 * Parse NFT object from blockchain data
 */
async function parseNFTObject(objectData: any, fields: any): Promise<Todo> {
  let metadata: TodoNFTMetadata = {
    priority: 'medium',
    tags: [],
  };

  try {
    if (fields.metadata) {
      metadata = JSON.parse(fields.metadata);
    }
  } catch (e) {
    console.warn('Failed to parse NFT metadata:', e);
  }

  // Try to fetch additional data from Walrus if available
  if (metadata.walrusBlobId) {
    try {
      const walrusData = await walrusClient.downloadJson(metadata.walrusBlobId);
      console.log('Fetched additional NFT data from Walrus:', walrusData);
    } catch (e) {
      console.warn('Failed to fetch Walrus data for NFT:', e);
    }
  }

  return {
    id: objectData.objectId,
    title: fields.title || '',
    description: fields.description || '',
    completed: fields.completed || false,
    priority: metadata.priority,
    tags: metadata.tags,
    dueDate: metadata.dueDate,
    blockchainStored: true,
    objectId: objectData.objectId,
    imageUrl: fields.image_url || metadata.imageData?.url,
    owner: objectData.owner?.AddressOwner || objectData.owner?.ObjectOwner || '',
    isPrivate: fields.is_private || false,
    category: metadata.category,
    walrusBlobId: metadata.walrusBlobId,
    isNFT: true,
    nftData: {
      owner: objectData.owner?.AddressOwner || objectData.owner?.ObjectOwner || '',
      createdAt: fields.created_at,
      completedAt: fields.completed_at,
      updatedAt: fields.updated_at,
    },
  };
}
