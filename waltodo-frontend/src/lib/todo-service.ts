/**
 * Service for managing local todo data
 * In a production app, this would integrate with the backend CLI
 */

import { Todo, TodoList } from './sui-client';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { PublicKey } from '@solana/web3.js';
import safeStorage, { isUsingFallbackStorage } from './safe-storage';
import testnetConfig from '@/config/testnet.json';
import { walrusClient } from './walrus-client';

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

  walletTodos[listName].todos[index] = updatedTodo;

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
      target: `${testnetConfig.deployment.packageId}::todo_nft::create_todo_nft`,
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
    // Create a Sui client to query the blockchain
    const client = new SuiClient({ url: testnetConfig.rpcUrl });

    // Query for TodoNFT objects owned by the address
    const objects = await client.getOwnedObjects({
      owner: address,
      filter: {
        StructType: `${testnetConfig.deployment.packageId}::todo_nft::TodoNFT`,
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
    // Create a transaction to complete the todo
    const tx = new Transaction();

    // Call the complete_todo function from the contract
    tx.moveCall({
      target: `${testnetConfig.deployment.packageId}::todo_nft::complete_todo`,
      arguments: [tx.object(todo.objectId)],
    });

    console.log('Marking todo as complete:', todo.objectId);

    // Execute the transaction
    const result = await signer.signAndExecuteTransaction(tx);
    console.log('Complete transaction result:', result);

    // Update local state after successful completion
    if (result.digest) {
      todo.completed = true;
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
    // Create a transfer transaction
    const tx = new Transaction();

    // Use the custom transfer function from the contract which emits events
    tx.moveCall({
      target: `${testnetConfig.deployment.packageId}::todo_nft::transfer_todo_nft`,
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
