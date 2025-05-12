// This file will handle connections to the todo backend service

export type Todo = {
  id: string
  title: string
  description?: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  tags?: string[]
  dueDate?: string
  blockchainStored?: boolean
  storageUri?: string
  objectId?: string
  transactionDigest?: string
}

export type TodoList = {
  name: string
  todos: Todo[]
}

// API endpoints - to be replaced with actual API
const API_BASE_URL = '/api';
const ENDPOINTS = {
  LISTS: `${API_BASE_URL}/lists`,
  TODOS: `${API_BASE_URL}/todos`,
  TODO: (id: string) => `${API_BASE_URL}/todos/${id}`,
  LIST_TODOS: (listName: string) => `${API_BASE_URL}/lists/${listName}/todos`,
}

// Mock data for development
const MOCK_LISTS = ['default', 'work', 'personal', 'shopping'];
const MOCK_TODOS: Record<string, Todo[]> = {
  default: [
    {
      id: '1',
      title: 'Setup Sui wallet',
      description: 'Install and configure Sui wallet extension',
      completed: false,
      priority: 'high',
      tags: ['setup', 'blockchain'],
      blockchainStored: true,
      objectId: '0x123456789abcdef',
    },
    {
      id: '2',
      title: 'Learn Move language',
      completed: false,
      priority: 'medium',
      tags: ['learning', 'blockchain'],
    },
    {
      id: '3',
      title: 'Setup development environment',
      completed: true,
      priority: 'high',
      tags: ['setup', 'dev'],
    },
  ],
  work: [
    {
      id: '4',
      title: 'Complete oceanic UI design',
      completed: false,
      priority: 'high',
      dueDate: '2023-12-01',
      tags: ['design', 'frontend'],
    },
    {
      id: '5',
      title: 'Implement storage reuse algorithm',
      description: 'Optimize IPFS storage usage for todos',
      completed: false,
      priority: 'medium',
      tags: ['backend', 'optimization'],
    },
  ],
  personal: [
    {
      id: '6',
      title: 'Buy groceries',
      completed: true,
      priority: 'low',
      tags: ['shopping'],
    },
  ],
  shopping: [
    {
      id: '7',
      title: 'Buy new keyboard',
      completed: false,
      priority: 'low',
      tags: ['hardware'],
    },
  ],
};

// Delay helper for mock API
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Get all todo lists
export async function getAllLists(): Promise<string[]> {
  // Mock API call
  await delay(800);
  return MOCK_LISTS;
}

// Get todos for a specific list
export async function getTodosByList(listName: string): Promise<Todo[]> {
  // Mock API call
  await delay(1000);
  return MOCK_TODOS[listName] || [];
}

// Create a new todo
export async function createTodo(listName: string, todoData: Omit<Todo, 'id'>): Promise<Todo> {
  // Mock API call
  await delay(1200);
  
  const newTodo: Todo = {
    ...todoData,
    id: Math.random().toString(36).substring(2, 9), // Generate random ID
  };
  
  // Update mock data (in a real implementation, this would be handled by the API)
  if (!MOCK_TODOS[listName]) {
    MOCK_TODOS[listName] = [];
  }
  MOCK_TODOS[listName].push(newTodo);
  
  return newTodo;
}

// Update an existing todo
export async function updateTodo(todoId: string, todoData: Partial<Todo>): Promise<Todo> {
  // Mock API call
  await delay(1000);
  
  // Find todo in mock data
  let updatedTodo: Todo | undefined;
  
  for (const listName in MOCK_TODOS) {
    const todoIndex = MOCK_TODOS[listName].findIndex(todo => todo.id === todoId);
    if (todoIndex !== -1) {
      // Update todo in the mock data
      MOCK_TODOS[listName][todoIndex] = {
        ...MOCK_TODOS[listName][todoIndex],
        ...todoData,
      };
      updatedTodo = MOCK_TODOS[listName][todoIndex];
      break;
    }
  }
  
  if (!updatedTodo) {
    throw new Error(`Todo with ID ${todoId} not found`);
  }
  
  return updatedTodo;
}

// Delete a todo
export async function deleteTodo(todoId: string): Promise<boolean> {
  // Mock API call
  await delay(800);
  
  // Find and remove todo from mock data
  for (const listName in MOCK_TODOS) {
    const todoIndex = MOCK_TODOS[listName].findIndex(todo => todo.id === todoId);
    if (todoIndex !== -1) {
      MOCK_TODOS[listName].splice(todoIndex, 1);
      return true;
    }
  }
  
  return false;
}

// Create a new list
export async function createList(listName: string): Promise<boolean> {
  // Mock API call
  await delay(600);
  
  if (MOCK_LISTS.includes(listName)) {
    return false; // List already exists
  }
  
  MOCK_LISTS.push(listName);
  MOCK_TODOS[listName] = [];
  
  return true;
}

// Store todo on blockchain
export async function storeOnBlockchain(todoId: string): Promise<Todo> {
  // Mock API call
  await delay(2000);
  
  // Find todo in mock data
  let updatedTodo: Todo | undefined;
  
  for (const listName in MOCK_TODOS) {
    const todoIndex = MOCK_TODOS[listName].findIndex(todo => todo.id === todoId);
    if (todoIndex !== -1) {
      // Update todo in the mock data with blockchain info
      MOCK_TODOS[listName][todoIndex] = {
        ...MOCK_TODOS[listName][todoIndex],
        blockchainStored: true,
        objectId: '0x' + Math.random().toString(16).slice(2, 34),
        storageUri: 'https://testnet.wal.app/blob/' + Math.random().toString(16).slice(2, 34),
        transactionDigest: '0x' + Math.random().toString(16).slice(2, 66),
      };
      updatedTodo = MOCK_TODOS[listName][todoIndex];
      break;
    }
  }
  
  if (!updatedTodo) {
    throw new Error(`Todo with ID ${todoId} not found`);
  }
  
  return updatedTodo;
}