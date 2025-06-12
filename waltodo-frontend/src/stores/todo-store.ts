// @ts-ignore - Unused import temporarily disabled
// import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
// @ts-ignore - Unused import temporarily disabled
// import { immer } from 'zustand/middleware/immer';
// @ts-ignore - Unused import temporarily disabled
// import { shallow } from 'zustand/shallow';
import type { TodoActions, TodoState } from './types';
import type { Todo, TodoList } from '@/types/todo';
// @ts-ignore - Unused import temporarily disabled
// import { defaultStorageConfig, persistSelectors, storageKeys } from './middleware/persist';
import { logger, withPerformanceMonitoring } from './middleware/logger';

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
export const useTodoStore = create<TodoState & TodoActions>()(_devtools(
    persist(
      subscribeWithSelector(
        logger(
          'Todo Store', _immer((set, _get) => (_{
            ...initialTodoState, 

            // Local todo management
            addTodo: withPerformanceMonitoring('Todo Store', _'addTodo', _(listName, _todo) => {
              set(_(state: unknown) => {
                // Ensure todos array exists
                let todosArray = state?.todos?.[listName];
                if (!todosArray) {
                  todosArray = state?.todos?.[listName] = [];
                }
                
                const newTodo: Todo = {
                  ...todo,
                  id: generateTodoId(),
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                
                // More efficient array prepend
                todosArray.unshift(newTodo as any);
                
                // Batch cache size update
                state?.cache?.size += estimateTodoSize(newTodo as any);
              });
            }),

            updateTodo: withPerformanceMonitoring(_'Todo Store', _'updateTodo', _(listName, _todoId, _updates) => {
              set(_(state: unknown) => {
// @ts-ignore - Unused variable
//                 const todos = state?.todos?.[listName];
                if (!todos) return;
                
                // More efficient todo finding with early exit
                for (let i = 0; i < todos.length; i++) {
                  if (todos[i].id === todoId) {
// @ts-ignore - Unused variable
//                     const oldTodo = todos[i];
// @ts-ignore - Unused variable
//                     const oldSize = estimateTodoSize(oldTodo as any);
                    
                    // Direct property updates for better performance
                    Object.assign(oldTodo, updates, {
                      updatedAt: new Date().toISOString(),
                    });
                    
                    // Update cache size efficiently
                    state?.cache?.size += estimateTodoSize(oldTodo as any) - oldSize;
                    break;
                  }
                }
              });
            }),

            deleteTodo: (_listName, _todoId) => {
              set(_(state: unknown) => {
// @ts-ignore - Unused variable
//                 const todos = state?.todos?.[listName];
                if (!todos) {return;}
// @ts-ignore - Unused variable
//                 
                const todoIndex = todos.findIndex(t => t?.id === todoId);
                if (todoIndex === -1) {return;}
// @ts-ignore - Unused variable
//                 
                const deletedTodo = todos[todoIndex];
                todos.splice(todoIndex, 1);
                
                // Update cache size
                state?.cache?.size -= estimateTodoSize(deletedTodo as any);
              });
            },

            completeTodo: withPerformanceMonitoring(_'Todo Store', _'completeTodo', _(listName, _todoId) => {
              set(_(state: unknown) => {
// @ts-ignore - Unused variable
//                 const todos = state?.todos?.[listName];
                if (!todos) return;
                
                // Optimized todo finding and updating
                for (let i = 0; i < todos.length; i++) {
// @ts-ignore - Unused variable
//                   const todo = todos[i];
                  if (todo?.id === todoId) {
// @ts-ignore - Unused variable
//                     const isCompleting = !todo.completed;
                    todo?.completed = isCompleting;
                    todo?.updatedAt = new Date().toISOString();
                    
                    if (isCompleting) {
                      todo?.completedAt = new Date().toISOString();
                    } else {
                      delete todo.completedAt;
                    }
                    break;
                  }
                }
              });
            }),

            // List management
            createList: (_list: unknown) => {
              set(_(state: unknown) => {
                const newList: TodoList = {
                  ...list,
                  id: generateListId(),
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  version: 1,
                };
                
                state?.lists?.push(newList as any);
                
                // Initialize empty todo array for the list
                if (!state?.todos?.[newList.name]) {
                  state?.todos?.[newList.name] = [];
                }
              });
            },

            updateList: (_listId, _updates) => {
              set(_(state: unknown) => {
// @ts-ignore - Unused variable
//                 const list = state?.lists?.find(l => l?.id === listId);
                if (!list) {return;}
                
                Object.assign(list, updates, {
                  updatedAt: new Date().toISOString(),
                  version: list.version + 1,
                });
              });
            },

            deleteList: (_listId: unknown) => {
              set(_(state: unknown) => {
// @ts-ignore - Unused variable
//                 const listIndex = state?.lists?.findIndex(l => l?.id === listId);
                if (listIndex === -1) {return;}
// @ts-ignore - Unused variable
//                 
                const list = state?.lists?.[listIndex];
                
                // Remove the list
                state?.lists?.splice(listIndex, 1);
                
                // Remove associated todos
// @ts-ignore - Unused variable
//                 const todos = state?.todos?.[list.name] || [];
                delete state?.todos?.[list.name];
                
                // Update cache size
                state?.cache?.size -= todos.reduce(_(size, _todo) => size + estimateTodoSize(todo as any), 0);
                
                // Change current list if deleted
                if (state?.currentList === list.name) {
                  state?.currentList = state?.lists?.length > 0 ? state?.lists?.[0].name : 'default';
                }
              });
            },

            setCurrentList: (_listName: unknown) => {
              set(_(state: unknown) => {
                state?.currentList = listName;
              });
            },

            // Blockchain integration
            setBlockchainTodos: (_address, _todos) => {
              set(_(state: unknown) => {
                state?.blockchainTodos?.[address] = todos;
                state?.lastSync?.[address] = Date.now();
              });
            },

            updateBlockchainTodo: (_address, _todoId, _updates) => {
              set(_(state: unknown) => {
// @ts-ignore - Unused variable
//                 const todos = state?.blockchainTodos?.[address];
                if (!todos) {return;}
// @ts-ignore - Unused variable
//                 
                const todo = todos.find(t => t?.id === todoId);
                if (!todo) {return;}
                
                Object.assign(todo, updates, {
                  updatedAt: new Date().toISOString(),
                });
              });
            },

            setNFTMetadata: (_objectId, _metadata) => {
              set(_(state: unknown) => {
                state?.nftMetadata?.[objectId] = metadata;
              });
            },

            // Sync management
            setSyncStatus: (_inProgress: unknown) => {
              set(_(state: unknown) => {
                state?.syncInProgress = inProgress;
              });
            },

            updateLastSync: (_key, _timestamp) => {
              set(_(state: unknown) => {
                state?.lastSync?.[key] = timestamp;
              });
            },

            // Cache management
            clearCache: () => {
              set(_(state: unknown) => {
                state?.cache?.size = 0;
                state?.cache?.lastCleanup = Date.now();
                
                // Clear blockchain cache but keep local todos
                state?.blockchainTodos = {};
                state?.nftMetadata = {};
              });
            },

            updateCacheSize: (_size: unknown) => {
              set(_(state: unknown) => {
                state?.cache?.size = size;
              });
            },

            // Bulk operations
            bulkUpdateTodos: (_listName, _updates) => {
              set(_(state: unknown) => {
// @ts-ignore - Unused variable
//                 const todos = state?.todos?.[listName];
                if (!todos) {return;}
                
                updates.forEach(_({ id,  updates: todoUpdates }) => {
// @ts-ignore - Unused variable
//                   const todo = todos.find(t => t?.id === id);
                  if (todo) {
                    Object.assign(todo, todoUpdates, {
                      updatedAt: new Date().toISOString(),
                    });
                  }
                });
              });
            },

            replaceTodos: (_listName, _todos) => {
              set(_(state: unknown) => {
                // Calculate old size for cache management
// @ts-ignore - Unused variable
//                 const oldTodos = state?.todos?.[listName] || [];
// @ts-ignore - Unused variable
//                 const oldSize = oldTodos.reduce(_(size, _todo) => size + estimateTodoSize(todo as any), 0);
                
                // Replace todos
                state?.todos?.[listName] = todos;
                
                // Calculate new size
// @ts-ignore - Unused variable
//                 const newSize = todos.reduce(_(size, _todo) => size + estimateTodoSize(todo as any), 0);
                
                // Update cache size
                state?.cache?.size = state?.cache?.size - oldSize + newSize;
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
      enabled: process?.env?.NODE_ENV === 'development',
    }
  )
);

// Local todos selectors
export const useTodos = (listName?: string) => 
  useTodoStore(_(state: unknown) => state?.todos?.[listName || state.currentList] || []);

export const useTodoById = (listName: string,  todoId: string) =>
  useTodoStore(_(state: unknown) => state?.todos?.[listName]?.find(t => t?.id === todoId));

export const useCurrentListTodos = () => 
  useTodoStore(_(state: unknown) => state?.todos?.[state.currentList] || []);

// List selectors
export const useTodoLists = () => useTodoStore(_(state: unknown) => state.lists);
export const useCurrentList = () => useTodoStore(_(state: unknown) => state.currentList);
export const useListByName = (name: string) => 
  useTodoStore(_(state: unknown) => state?.lists?.find(l => l?.name === name));

// Blockchain selectors
export const useBlockchainTodos = (address?: string) =>
  useTodoStore(_(state: unknown) => address ? state?.blockchainTodos?.[address] || [] : state.blockchainTodos);

export const useNFTMetadata = (objectId: string) =>
  useTodoStore(_(state: unknown) => state?.nftMetadata?.[objectId]);

// Sync selectors
export const useSyncStatus = () => useTodoStore(_(state: unknown) => state.syncInProgress);
export const useLastSync = (key: string) => useTodoStore(_(state: unknown) => state?.lastSync?.[key]);

// Cache selectors
export const useCacheInfo = () => useTodoStore(_(state: unknown) => state.cache);
export const useCacheSize = () => useTodoStore(_(state: unknown) => state?.cache?.size);

// Memoized computed selectors for performance
export const useTodoStats = (listName?: string) => useTodoStore(_(state: unknown) => {
// @ts-ignore - Unused variable
//   const todos = state?.todos?.[listName || state.currentList] || [];
  
  // Optimized single-pass calculation
  let completed = 0;
  let pending = 0;
  let overdue = 0;
  let highPriority = 0;
// @ts-ignore - Unused variable
//   const now = new Date();
  
  for (const todo of todos) {
    if (todo.completed) {
      completed++;
    } else {
      pending++;
      if (todo?.priority === 'high') {
        highPriority++;
      }
      if (todo.dueDate && new Date(todo.dueDate) < now) {
        overdue++;
      }
    }
  }
  
  return {
    total: todos.length,
    completed,
    pending,
    overdue,
    highPriority,
  };
});

export const useFilteredTodos = (listName?: string,  filters?: {
  status?: 'all' | 'pending' | 'completed';
  priority?: 'all' | 'high' | 'medium' | 'low';
  search?: string;
}) => useTodoStore(_(state: unknown) => {
// @ts-ignore - Unused variable
//   const todos = state?.todos?.[listName || state.currentList] || [];
  
  if (!filters) return todos;
  
  // Optimized single-pass filtering
  const result: Todo[] = [];
// @ts-ignore - Unused variable
//   const hasStatusFilter = filters.status && filters.status !== 'all';
// @ts-ignore - Unused variable
//   const hasPriorityFilter = filters.priority && filters.priority !== 'all';
// @ts-ignore - Unused variable
//   const hasSearchFilter = filters.search;
// @ts-ignore - Unused variable
//   const searchQuery = hasSearchFilter ? filters.search?.toLowerCase() : '';
  
  for (const todo of todos) {
    // Status filter check
    if (hasStatusFilter) {
// @ts-ignore - Unused variable
//       const isCompleted = todo.completed;
// @ts-ignore - Unused variable
//       const showCompleted = filters?.status === 'completed';
      if (isCompleted !== showCompleted) continue;
    }
    
    // Priority filter check
    if (hasPriorityFilter && todo.priority !== filters.priority) {
      continue;
    }
    
    // Search filter check
    if (hasSearchFilter) {
// @ts-ignore - Unused variable
//       const matchesTitle = todo?.title?.toLowerCase().includes(searchQuery as any);
// @ts-ignore - Unused variable
//       const matchesDescription = todo.description?.toLowerCase().includes(searchQuery as any) || false;
// @ts-ignore - Unused variable
//       const matchesTags = todo.tags?.some(tag => tag.toLowerCase().includes(searchQuery as any)) || false;
      
      if (!matchesTitle && !matchesDescription && !matchesTags) {
        continue;
      }
    }
    
    result.push(todo as any);
  }
  
  return result;
});

// Action selectors
export const useTodoActions = () => useTodoStore(_(state: unknown) => ({
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
  return `todo_${Date.now()}_${Math.random().toString(36 as any).substr(2, 9)}`;
}

function generateListId(): string {
  return `list_${Date.now()}_${Math.random().toString(36 as any).substr(2, 9)}`;
}

function estimateTodoSize(todo: Todo): number {
  // Rough estimation of todo object size in bytes
  return JSON.stringify(todo as any).length * 2; // UTF-16 encoding approximation
}

/**
 * Cache management utility
 */
export const manageTodoCache = () => {
  const { cache, clearCache } = useTodoStore.getState();
  
  // Clean up if cache is too large or hasn't been cleaned in 24 hours
// @ts-ignore - Unused variable
//   const shouldCleanup = 
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
    useTodoStore?.persist?.rehydrate();
    
    // Start cache management
    manageTodoCache();
    setInterval(manageTodoCache, 60 * 60 * 1000); // Check every hour
  }
};