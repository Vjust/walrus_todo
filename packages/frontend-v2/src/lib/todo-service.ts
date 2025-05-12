/**
 * Service for managing local todo data
 * In a production app, this would integrate with the backend CLI
 */

import { Todo, TodoList } from './sui-client';

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

// Mock data store - would be replaced with actual local storage or API calls
let todoLists: Record<string, TodoList> = {
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

/**
 * Try to load todo lists from storage
 */
function loadTodoLists(): void {
  if (typeof window !== 'undefined' && isStorageAvailable()) {
    try {
      const storedLists = localStorage.getItem('walrusTodoLists');
      if (storedLists) {
        const parsed = JSON.parse(storedLists);
        if (parsed && typeof parsed === 'object') {
          todoLists = parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load todo lists from storage:', e);
    }
  }
}

/**
 * Save todo lists to storage
 */
function saveTodoLists(): void {
  if (typeof window !== 'undefined' && isStorageAvailable()) {
    try {
      localStorage.setItem('walrusTodoLists', JSON.stringify(todoLists));
    } catch (e) {
      console.warn('Failed to save todo lists to storage:', e);
    }
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