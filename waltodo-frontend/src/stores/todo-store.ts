import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { TodoActions, TodoState } from './types';
import type { Todo, TodoList } from '@/types/todo';
import { defaultStorageConfig, persistSelectors, storageKeys } from './middleware/persist';
import { logger } from './middleware/logger';

/**
 * Initial state for todo store
 */
const initialTodoState: TodoState = {
  // Local state
  todos: {},
  lists: [],
  currentList: 'default',
  
  // Blockchain state
  blockchainTodos: {},
  nftMetadata: {},
  
  // Sync state
  lastSync: {},
  syncInProgress: false,
  
  // Cache state
  cache: {
    size: 0,
    maxSize: 50 * 1024 * 1024, // 50MB
    lastCleanup: Date.now(),
  },
};

/**
 * Todo Store with comprehensive todo and list management
 */
export const useTodoStore = create<TodoState & TodoActions>()(
  devtools(
    persist(
      subscribeWithSelector(
        logger(
          'Todo Store',
          immer((set, get) => ({
            ...initialTodoState,

            // Local todo management
            addTodo: (listName, todo) => {
              set((state) => {
                if (!state.todos[listName]) {
                  state.todos[listName] = [];
                }
                
                const newTodo: Todo = {
                  ...todo,
                  id: generateTodoId(),
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                
                state.todos[listName].unshift(newTodo);
                
                // Update cache size estimation
                state.cache.size += estimateTodoSize(newTodo);
              });
            },

            updateTodo: (listName, todoId, updates) => {
              set((state) => {
                const todos = state.todos[listName];
                if (!todos) {return;}
                
                const todoIndex = todos.findIndex(t => t.id === todoId);
                if (todoIndex === -1) {return;}
                
                const oldTodo = todos[todoIndex];
                const updatedTodo = {
                  ...oldTodo,
                  ...updates,
                  updatedAt: new Date().toISOString(),
                };
                
                todos[todoIndex] = updatedTodo;
                
                // Update cache size
                state.cache.size = state.cache.size - estimateTodoSize(oldTodo) + estimateTodoSize(updatedTodo);
              });
            },

            deleteTodo: (listName, todoId) => {
              set((state) => {
                const todos = state.todos[listName];
                if (!todos) {return;}
                
                const todoIndex = todos.findIndex(t => t.id === todoId);
                if (todoIndex === -1) {return;}
                
                const deletedTodo = todos[todoIndex];
                todos.splice(todoIndex, 1);
                
                // Update cache size
                state.cache.size -= estimateTodoSize(deletedTodo);
              });
            },

            completeTodo: (listName, todoId) => {
              set((state) => {
                const todos = state.todos[listName];
                if (!todos) {return;}
                
                const todo = todos.find(t => t.id === todoId);
                if (!todo) {return;}
                
                todo.completed = !todo.completed;
                todo.updatedAt = new Date().toISOString();
                
                if (todo.completed) {
                  todo.completedAt = new Date().toISOString();
                } else {
                  delete todo.completedAt;
                }
              });
            },

            // List management
            createList: (list) => {
              set((state) => {
                const newList: TodoList = {
                  ...list,
                  id: generateListId(),
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  version: 1,
                };
                
                state.lists.push(newList);
                
                // Initialize empty todo array for the list
                if (!state.todos[newList.name]) {
                  state.todos[newList.name] = [];
                }
              });
            },

            updateList: (listId, updates) => {
              set((state) => {
                const list = state.lists.find(l => l.id === listId);
                if (!list) {return;}
                
                Object.assign(list, updates, {
                  updatedAt: new Date().toISOString(),
                  version: list.version + 1,
                });
              });
            },

            deleteList: (listId) => {
              set((state) => {
                const listIndex = state.lists.findIndex(l => l.id === listId);
                if (listIndex === -1) {return;}
                
                const list = state.lists[listIndex];
                
                // Remove the list
                state.lists.splice(listIndex, 1);
                
                // Remove associated todos
                const todos = state.todos[list.name] || [];
                delete state.todos[list.name];
                
                // Update cache size
                state.cache.size -= todos.reduce((size, todo) => size + estimateTodoSize(todo), 0);
                
                // Change current list if deleted
                if (state.currentList === list.name) {
                  state.currentList = state.lists.length > 0 ? state.lists[0].name : 'default';
                }
              });
            },

            setCurrentList: (listName) => {
              set((state) => {
                state.currentList = listName;
              });
            },

            // Blockchain integration
            setBlockchainTodos: (address, todos) => {
              set((state) => {
                state.blockchainTodos[address] = todos;
                state.lastSync[address] = Date.now();
              });
            },

            updateBlockchainTodo: (address, todoId, updates) => {
              set((state) => {
                const todos = state.blockchainTodos[address];
                if (!todos) {return;}
                
                const todo = todos.find(t => t.id === todoId);
                if (!todo) {return;}
                
                Object.assign(todo, updates, {
                  updatedAt: new Date().toISOString(),
                });
              });
            },

            setNFTMetadata: (objectId, metadata) => {
              set((state) => {
                state.nftMetadata[objectId] = metadata;
              });
            },

            // Sync management
            setSyncStatus: (inProgress) => {
              set((state) => {
                state.syncInProgress = inProgress;
              });
            },

            updateLastSync: (key, timestamp) => {
              set((state) => {
                state.lastSync[key] = timestamp;
              });
            },

            // Cache management
            clearCache: () => {
              set((state) => {
                state.cache.size = 0;
                state.cache.lastCleanup = Date.now();
                
                // Clear blockchain cache but keep local todos
                state.blockchainTodos = {};
                state.nftMetadata = {};
              });
            },

            updateCacheSize: (size) => {
              set((state) => {
                state.cache.size = size;
              });
            },

            // Bulk operations
            bulkUpdateTodos: (listName, updates) => {
              set((state) => {
                const todos = state.todos[listName];
                if (!todos) {return;}
                
                updates.forEach(({ id, updates: todoUpdates }) => {
                  const todo = todos.find(t => t.id === id);
                  if (todo) {
                    Object.assign(todo, todoUpdates, {
                      updatedAt: new Date().toISOString(),
                    });
                  }
                });
              });
            },

            replaceTodos: (listName, todos) => {
              set((state) => {
                // Calculate old size for cache management
                const oldTodos = state.todos[listName] || [];
                const oldSize = oldTodos.reduce((size, todo) => size + estimateTodoSize(todo), 0);
                
                // Replace todos
                state.todos[listName] = todos;
                
                // Calculate new size
                const newSize = todos.reduce((size, todo) => size + estimateTodoSize(todo), 0);
                
                // Update cache size
                state.cache.size = state.cache.size - oldSize + newSize;
              });
            },
          }))
        )
      ),
      {
        name: storageKeys.todos,
        ...defaultStorageConfig,
        partialize: persistSelectors.todos,
        version: 0,
      }
    ),
    {
      name: 'WalTodo Todo Store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// Local todos selectors
export const useTodos = (listName?: string) => 
  useTodoStore((state) => state.todos[listName || state.currentList] || []);

export const useTodoById = (listName: string, todoId: string) =>
  useTodoStore((state) => state.todos[listName]?.find(t => t.id === todoId));

export const useCurrentListTodos = () => 
  useTodoStore((state) => state.todos[state.currentList] || []);

// List selectors
export const useTodoLists = () => useTodoStore((state) => state.lists);
export const useCurrentList = () => useTodoStore((state) => state.currentList);
export const useListByName = (name: string) => 
  useTodoStore((state) => state.lists.find(l => l.name === name));

// Blockchain selectors
export const useBlockchainTodos = (address?: string) =>
  useTodoStore((state) => address ? state.blockchainTodos[address] || [] : state.blockchainTodos);

export const useNFTMetadata = (objectId: string) =>
  useTodoStore((state) => state.nftMetadata[objectId]);

// Sync selectors
export const useSyncStatus = () => useTodoStore((state) => state.syncInProgress);
export const useLastSync = (key: string) => useTodoStore((state) => state.lastSync[key]);

// Cache selectors
export const useCacheInfo = () => useTodoStore((state) => state.cache);
export const useCacheSize = () => useTodoStore((state) => state.cache.size);

// Computed selectors
export const useTodoStats = (listName?: string) => useTodoStore((state) => {
  const todos = state.todos[listName || state.currentList] || [];
  
  return {
    total: todos.length,
    completed: todos.filter(t => t.completed).length,
    pending: todos.filter(t => !t.completed).length,
    overdue: todos.filter(t => !t.completed && t.dueDate && new Date(t.dueDate) < new Date()).length,
    highPriority: todos.filter(t => !t.completed && t.priority === 'high').length,
  };
});

export const useFilteredTodos = (listName?: string, filters?: {
  status?: 'all' | 'pending' | 'completed';
  priority?: 'all' | 'high' | 'medium' | 'low';
  search?: string;
}) => useTodoStore((state) => {
  let todos = state.todos[listName || state.currentList] || [];
  
  if (!filters) {return todos;}
  
  if (filters.status && filters.status !== 'all') {
    todos = todos.filter(t => filters.status === 'completed' ? t.completed : !t.completed);
  }
  
  if (filters.priority && filters.priority !== 'all') {
    todos = todos.filter(t => t.priority === filters.priority);
  }
  
  if (filters.search) {
    const query = filters.search.toLowerCase();
    todos = todos.filter(t => 
      t.title.toLowerCase().includes(query) ||
      t.description?.toLowerCase().includes(query) ||
      t.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  }
  
  return todos;
});

// Action selectors
export const useTodoActions = () => useTodoStore((state) => ({
  addTodo: state.addTodo,
  updateTodo: state.updateTodo,
  deleteTodo: state.deleteTodo,
  completeTodo: state.completeTodo,
  createList: state.createList,
  updateList: state.updateList,
  deleteList: state.deleteList,
  setCurrentList: state.setCurrentList,
  setBlockchainTodos: state.setBlockchainTodos,
  updateBlockchainTodo: state.updateBlockchainTodo,
  setNFTMetadata: state.setNFTMetadata,
  setSyncStatus: state.setSyncStatus,
  updateLastSync: state.updateLastSync,
  clearCache: state.clearCache,
  updateCacheSize: state.updateCacheSize,
  bulkUpdateTodos: state.bulkUpdateTodos,
  replaceTodos: state.replaceTodos,
}));

// Utility functions
function generateTodoId(): string {
  return `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateListId(): string {
  return `list_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function estimateTodoSize(todo: Todo): number {
  // Rough estimation of todo object size in bytes
  return JSON.stringify(todo).length * 2; // UTF-16 encoding approximation
}

/**
 * Cache management utility
 */
export const manageTodoCache = () => {
  const { cache, clearCache } = useTodoStore.getState();
  
  // Clean up if cache is too large or hasn't been cleaned in 24 hours
  const shouldCleanup = 
    cache.size > cache.maxSize || 
    Date.now() - cache.lastCleanup > 24 * 60 * 60 * 1000;
  
  if (shouldCleanup) {
    clearCache();
    console.log('🗑️ Todo cache cleaned up');
  }
};

/**
 * Store hydration helper
 */
export const hydrateTodoStore = () => {
  if (typeof window !== 'undefined') {
    useTodoStore.persist.rehydrate();
    
    // Start cache management
    manageTodoCache();
    setInterval(manageTodoCache, 60 * 60 * 1000); // Check every hour
  }
};