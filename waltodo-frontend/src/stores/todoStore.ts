'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Todo, TodoList } from '../types/todo';
import { apiClient } from '../lib/api-client';

// UI State interface
interface UIState {
  activeList: string;
  filter: 'all' | 'active' | 'completed';
  sortBy: 'created' | 'priority' | 'title' | 'dueDate';
  sortOrder: 'asc' | 'desc';
  showCompleted: boolean;
  sidebarOpen: boolean;
  syncInProgress: Set<string>;
}

// Settings interface
interface Settings {
  autoSync: boolean;
  syncToWalrus: boolean;
  syncToBlockchain: boolean;
  notifications: boolean;
  theme: 'light' | 'dark' | 'ocean';
  defaultPriority: 'low' | 'medium' | 'high';
}

// Main store interface
interface TodoStore {
  // Data
  todos: Record<string, Todo[]>; // keyed by list name
  lists: string[];
  settings: Settings;
  uiState: UIState;
  
  // Sync state
  lastSync: Date | null;
  syncErrors: Record<string, string>;
  
  // Actions - Todos
  addTodo: (todo: Partial<Todo>, listName?: string) => void;
  updateTodo: (id: string, updates: Partial<Todo>, listName?: string) => void;
  deleteTodo: (id: string, listName?: string) => void;
  completeTodo: (id: string, listName?: string) => void;
  
  // Actions - Lists
  createList: (name: string) => void;
  deleteList: (name: string) => void;
  setActiveList: (name: string) => void;
  
  // Actions - UI
  setFilter: (filter: UIState['filter']) => void;
  setSortBy: (sortBy: UIState['sortBy']) => void;
  setSortOrder: (order: UIState['sortOrder']) => void;
  toggleShowCompleted: () => void;
  toggleSidebar: () => void;
  setSyncInProgress: (todoId: string, inProgress: boolean) => void;
  
  // Actions - Settings
  updateSettings: (settings: Partial<Settings>) => void;
  
  // Actions - Sync
  markSyncError: (todoId: string, error: string) => void;
  clearSyncError: (todoId: string) => void;
  updateLastSync: () => void;
  
  // Computed
  getCurrentTodos: () => Todo[];
  getFilteredTodos: () => Todo[];
  getTodoById: (id: string) => Todo | undefined;
  
  // Migration helpers (for moving away from localStorage)
  migrateFromLocalStorage: () => void;
  clearLegacyData: () => void;
}

// Default values
const defaultSettings: Settings = {
  autoSync: true,
  syncToWalrus: true,
  syncToBlockchain: false,
  notifications: true,
  theme: 'ocean',
  defaultPriority: 'medium',
};

const defaultUIState: UIState = {
  activeList: 'default',
  filter: 'all',
  sortBy: 'created',
  sortOrder: 'desc',
  showCompleted: true,
  sidebarOpen: false,
  syncInProgress: new Set(),
};

// Create the store
export const useTodoStore = create<TodoStore>()(
  persist(
    (set, get) => ({
      // Initial state
      todos: { default: [] },
      lists: ['default'],
      settings: defaultSettings,
      uiState: defaultUIState,
      lastSync: null,
      syncErrors: {},

      // Todo actions
      addTodo: (todo, listName = 'default') => {
        const newTodo: Todo = {
          id: `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: todo.title || '',
          description: todo.description || '',
          completed: false,
          priority: todo.priority || get().settings.defaultPriority,
          tags: todo.tags || [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          private: false,
          ...todo,
        };

        set(state => ({
          todos: {
            ...state.todos,
            [listName]: [...(state.todos[listName] || []), newTodo],
          },
        }));
      },

      updateTodo: (id, updates, listName) => {
        set(state => {
          const targetList = listName || state.uiState.activeList;
          const todos = state.todos[targetList] || [];
          
          return {
            todos: {
              ...state.todos,
              [targetList]: todos.map(todo =>
                todo.id === id 
                  ? { ...todo, ...updates, updatedAt: new Date().toISOString() }
                  : todo
              ),
            },
          };
        });
      },

      deleteTodo: (id, listName) => {
        set(state => {
          const targetList = listName || state.uiState.activeList;
          
          return {
            todos: {
              ...state.todos,
              [targetList]: (state.todos[targetList] || []).filter(todo => todo.id !== id),
            },
            syncErrors: Object.fromEntries(
              Object.entries(state.syncErrors).filter(([key]) => key !== id)
            ),
          };
        });
      },

      completeTodo: (id, listName) => {
        const { updateTodo } = get();
        updateTodo(id, { completed: true, completedAt: new Date().toISOString() }, listName);
      },

      // List actions
      createList: (name) => {
        set(state => ({
          lists: [...state.lists, name],
          todos: { ...state.todos, [name]: [] },
        }));
      },

      deleteList: (name) => {
        if (name === 'default') return; // Can't delete default list
        
        set(state => {
          const { [name]: deleted, ...remainingTodos } = state.todos;
          return {
            lists: state.lists.filter(list => list !== name),
            todos: remainingTodos,
            uiState: {
              ...state.uiState,
              activeList: state.uiState.activeList === name ? 'default' : state.uiState.activeList,
            },
          };
        });
      },

      setActiveList: (name) => {
        set(state => ({
          uiState: { ...state.uiState, activeList: name },
        }));
      },

      // UI actions
      setFilter: (filter) => {
        set(state => ({
          uiState: { ...state.uiState, filter },
        }));
      },

      setSortBy: (sortBy) => {
        set(state => ({
          uiState: { ...state.uiState, sortBy },
        }));
      },

      setSortOrder: (sortOrder) => {
        set(state => ({
          uiState: { ...state.uiState, sortOrder },
        }));
      },

      toggleShowCompleted: () => {
        set(state => ({
          uiState: { ...state.uiState, showCompleted: !state.uiState.showCompleted },
        }));
      },

      toggleSidebar: () => {
        set(state => ({
          uiState: { ...state.uiState, sidebarOpen: !state.uiState.sidebarOpen },
        }));
      },

      setSyncInProgress: (todoId, inProgress) => {
        set(state => {
          const newSyncInProgress = new Set(state.uiState.syncInProgress);
          if (inProgress) {
            newSyncInProgress.add(todoId);
          } else {
            newSyncInProgress.delete(todoId);
          }
          
          return {
            uiState: { ...state.uiState, syncInProgress: newSyncInProgress },
          };
        });
      },

      // Settings actions
      updateSettings: (newSettings) => {
        set(state => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },

      // Sync actions
      markSyncError: (todoId, error) => {
        set(state => ({
          syncErrors: { ...state.syncErrors, [todoId]: error },
        }));
      },

      clearSyncError: (todoId) => {
        set(state => ({
          syncErrors: Object.fromEntries(
            Object.entries(state.syncErrors).filter(([key]) => key !== todoId)
          ),
        }));
      },

      updateLastSync: () => {
        set({ lastSync: new Date() });
      },

      // Computed values
      getCurrentTodos: () => {
        const state = get();
        return state.todos[state.uiState.activeList] || [];
      },

      getFilteredTodos: () => {
        const state = get();
        const todos = state.getCurrentTodos();
        const { filter, sortBy, sortOrder, showCompleted } = state.uiState;

        let filtered = todos;

        // Apply filter
        if (filter === 'active') {
          filtered = todos.filter(todo => !todo.completed);
        } else if (filter === 'completed') {
          filtered = todos.filter(todo => todo.completed);
        }

        // Apply completed visibility
        if (!showCompleted) {
          filtered = filtered.filter(todo => !todo.completed);
        }

        // Apply sorting
        filtered.sort((a, b) => {
          let comparison = 0;
          
          switch (sortBy) {
            case 'title':
              comparison = a.title.localeCompare(b.title);
              break;
            case 'priority':
              const priorityOrder = { low: 1, medium: 2, high: 3 };
              comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
              break;
            case 'dueDate':
              if (a.dueDate && b.dueDate) {
                comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
              } else if (a.dueDate) {
                comparison = -1;
              } else if (b.dueDate) {
                comparison = 1;
              }
              break;
            case 'created':
            default:
              comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
              break;
          }

          return sortOrder === 'asc' ? comparison : -comparison;
        });

        return filtered;
      },

      getTodoById: (id) => {
        const state = get();
        for (const listTodos of Object.values(state.todos)) {
          const todo = listTodos.find(t => t.id === id);
          if (todo) return todo;
        }
        return undefined;
      },

      // Migration helpers
      migrateFromLocalStorage: () => {
        try {
          // Migration logic for existing localStorage data
          const oldTodos = localStorage.getItem('walrus-todos');
          if (oldTodos) {
            const parsed = JSON.parse(oldTodos);
            set(state => ({
              todos: { ...state.todos, default: [...state.todos.default, ...parsed] },
            }));
          }
        } catch (error) {
          console.error('Migration from localStorage failed:', error);
        }
      },

      clearLegacyData: () => {
        // Clear old localStorage keys
        const legacyKeys = ['walrus-todos', 'walrus-todo-lists', 'walrus-settings'];
        legacyKeys.forEach(key => localStorage.removeItem(key));
      },
    }),
    {
      name: 'walrus-todo-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        todos: state.todos,
        lists: state.lists,
        settings: state.settings,
        uiState: {
          ...state.uiState,
          syncInProgress: new Set(), // Don't persist sync state
        },
      }),
      onRehydrateStorage: () => (state) => {
        // Initialize non-serializable state
        if (state) {
          state.uiState.syncInProgress = new Set();
        }
      },
    }
  )
);

// Selector hooks for better performance
export const useActiveList = () => useTodoStore(state => state.uiState.activeList);
export const useCurrentTodos = () => useTodoStore(state => state.getCurrentTodos());
export const useFilteredTodos = () => useTodoStore(state => state.getFilteredTodos());
export const useSettings = () => useTodoStore(state => state.settings);
export const useSyncState = () => useTodoStore(state => ({
  lastSync: state.lastSync,
  syncErrors: state.syncErrors,
  syncInProgress: state.uiState.syncInProgress,
}));