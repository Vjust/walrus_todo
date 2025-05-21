/**
 * Service for managing local todo data
 * In a production app, this would integrate with the backend CLI
 */

import { Todo, TodoList } from './sui-client';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { PublicKey } from '@solana/web3.js';
import safeStorage, { isUsingFallbackStorage } from './safe-storage';

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
        objectId: '0xabc123'
      },
      {
        id: '2',
        title: 'Design oceanic UI components',
        description: 'Create reusable Tailwind components with ocean theme',
        completed: true,
        priority: 'medium',
        tags: ['design', 'frontend'],
        blockchainStored: false
      },
      {
        id: '3',
        title: 'Implement Sui blockchain connectivity',
        completed: false,
        priority: 'high',
        dueDate: '2023-12-01',
        blockchainStored: false
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
        blockchainStored: false
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

// Create a typed storage helper for todo lists
const todoListStorage = safeStorage.createTyped<Record<string, TodoList>>(
  'walrusTodoLists', 
  defaultTodoLists
);

// Current in-memory reference to todo lists
let todoLists: Record<string, TodoList> = { ...defaultTodoLists };

/**
 * Try to load todo lists from storage
 */
function loadTodoLists(): void {
  try {
    const storedLists = todoListStorage.get();
    if (storedLists && typeof storedLists === 'object') {
      todoLists = storedLists;
    }
    
    if (isUsingFallbackStorage()) {
      console.info(`Using memory storage. Data will not persist between sessions.`);
    }
  } catch (e) {
    console.warn('Failed to load todo lists from storage:', e);
  }
}

/**
 * Save todo lists to storage
 */
function saveTodoLists(): void {
  try {
    todoListStorage.set(todoLists);
  } catch (e) {
    console.warn('Failed to save todo lists to storage:', e);
  }
}

/**
 * Get all todo lists
 */
export function getTodoLists(): string[] {
  // Try to load from storage first if needed
  loadTodoLists();
  return Object.keys(todoLists);
}

/**
 * Get a specific todo list
 */
export function getTodoList(listName: string): TodoList | null {
  // Try to load from storage first if needed
  loadTodoLists();
  return todoLists[listName] || null;
}

/**
 * Get todos for a specific list
 */
export function getTodos(listName: string): Todo[] {
  // Try to load from storage first if needed
  loadTodoLists();
  return todoLists[listName]?.todos || [];
}

/**
 * Add a new todo to a list
 */
export function addTodo(listName: string, todo: Omit<Todo, 'id' | 'blockchainStored'>): Todo {
  // Load latest data
  loadTodoLists();

  if (!todoLists[listName]) {
    todoLists[listName] = {
      name: listName,
      todos: [],
    };
  }

  const newTodo: Todo = {
    ...todo,
    id: Date.now().toString(),
    blockchainStored: false,
  };

  todoLists[listName].todos.push(newTodo);

  // Save changes
  saveTodoLists();

  return newTodo;
}

/**
 * Update an existing todo
 */
export function updateTodo(listName: string, updatedTodo: Todo): boolean {
  // Load latest data
  loadTodoLists();

  if (!todoLists[listName]) return false;

  const index = todoLists[listName].todos.findIndex(todo => todo.id === updatedTodo.id);
  if (index === -1) return false;

  todoLists[listName].todos[index] = updatedTodo;

  // Save changes
  saveTodoLists();

  return true;
}

/**
 * Delete a todo
 */
export function deleteTodo(listName: string, todoId: string): boolean {
  // Load latest data
  loadTodoLists();

  if (!todoLists[listName]) return false;

  const initialLength = todoLists[listName].todos.length;
  todoLists[listName].todos = todoLists[listName].todos.filter(todo => todo.id !== todoId);

  // Save changes
  saveTodoLists();

  return todoLists[listName].todos.length !== initialLength;
}

/**
 * Create a new todo list
 */
export function createTodoList(listName: string): boolean {
  // Load latest data
  loadTodoLists();

  if (todoLists[listName]) return false;

  todoLists[listName] = {
    name: listName,
    todos: [],
  };

  // Save changes
  saveTodoLists();

  return true;
}

/**
 * Delete a todo list
 */
export function deleteTodoList(listName: string): boolean {
  // Load latest data
  loadTodoLists();

  if (!todoLists[listName] || listName === 'default') return false;

  delete todoLists[listName];

  // Save changes
  saveTodoLists();

  return true;
}

/**
 * Mark a todo as stored on blockchain
 */
export function markTodoAsBlockchainStored(listName: string, todoId: string, objectId: string): boolean {
  // Load latest data
  loadTodoLists();

  if (!todoLists[listName]) return false;

  const todoIndex = todoLists[listName].todos.findIndex(todo => todo.id === todoId);
  if (todoIndex === -1) return false;

  todoLists[listName].todos[todoIndex].blockchainStored = true;
  todoLists[listName].todos[todoIndex].objectId = objectId;

  // Save changes
  saveTodoLists();

  return true;
}

/**
 * Store a todo on the blockchain using wallet signer
 * This is a placeholder that would integrate with the actual CLI backend
 */
export async function storeTodoOnBlockchain(
  listName: string, 
  todoId: string, 
  signer?: WalletSigner
): Promise<string | null> {
  // Load latest data
  loadTodoLists();

  if (!todoLists[listName]) return null;
  
  const todo = todoLists[listName].todos.find(t => t.id === todoId);
  if (!todo) return null;

  // If no signer provided, operate in read-only mode
  if (!signer || !signer.signAndExecuteTransaction) {
    console.warn('No wallet signer available - running in read-only mode');
    return null;
  }

  try {
    // Create a transaction for storing the todo
    // In production, this would call the actual smart contract
    const tx = new Transaction();
    
    // Example: Add a move call to the todo contract
    // tx.moveCall({
    //   target: '0x123::todo::create_todo',
    //   arguments: [
    //     tx.pure.string(todo.title),
    //     tx.pure.bool(todo.completed),
    //     tx.pure.string(todo.priority || 'medium')
    //   ],
    // });

    // For now, just simulate the transaction
    console.log('Would execute transaction for todo:', todo);
    
    // In production, execute the transaction
    // const result = await signer.signAndExecuteTransaction(tx);
    // const objectId = result.effects?.created?.[0]?.reference?.objectId || null;
    
    // Simulate getting an object ID
    const objectId = `0x${Math.random().toString(16).slice(2, 10)}`;
    
    // Mark the todo as stored
    markTodoAsBlockchainStored(listName, todoId, objectId);
    
    return objectId;
  } catch (error) {
    console.error('Failed to store todo on blockchain:', error);
    return null;
  }
}

/**
 * Retrieve todos from blockchain storage
 * This is a placeholder for future blockchain integration
 */
export async function retrieveTodosFromBlockchain(
  address?: string
): Promise<Todo[]> {
  if (!address) {
    console.warn('No address provided - cannot retrieve blockchain todos');
    return [];
  }

  try {
    // In production, this would query the blockchain for todos owned by the address
    console.log('Would retrieve todos for address:', address);
    
    // Return empty array for now
    return [];
  } catch (error) {
    console.error('Failed to retrieve todos from blockchain:', error);
    return [];
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
  signer?: WalletSigner
): Promise<boolean> {
  // Load latest data
  loadTodoLists();

  if (!todoLists[listName]) return false;
  
  const todo = todoLists[listName].todos.find(t => t.id === todoId);
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
    
    // Example: Transfer the NFT
    // tx.transferObject({
    //   objectId: todo.objectId,
    //   recipient: toAddress,
    // });

    console.log('Would transfer NFT:', todo.objectId, 'to:', toAddress);
    
    // In production, execute the transaction
    // await signer.signAndExecuteTransaction(tx);
    
    // For now, just return success
    return true;
  } catch (error) {
    console.error('Failed to transfer todo NFT:', error);
    return false;
  }
}