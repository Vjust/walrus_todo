'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Todo } from '@/types/todo-nft';

interface TodoState {
  // Core todo state
  todos: Todo[];
  isLoading: boolean;
  error: string | null;
  
  // Blockchain state
  blockchainTodos: Todo[];
  loadingBlockchain: boolean;
  
  // UI state
  selectedTodo: Todo | null;
  filter: 'all' | 'completed' | 'pending';
  searchQuery: string;
  
  // Actions
  setTodos: (todos: Todo[]) => void;
  addTodo: (todo: Todo) => void;
  updateTodo: (id: string, updates: Partial<Todo>) => void;
  deleteTodo: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Blockchain actions
  setBlockchainTodos: (todos: Todo[]) => void;
  setLoadingBlockchain: (loading: boolean) => void;
  
  // UI actions
  setSelectedTodo: (todo: Todo | null) => void;
  setFilter: (filter: 'all' | 'completed' | 'pending') => void;
  setSearchQuery: (query: string) => void;
  
  // Computed getters
  filteredTodos: () => Todo[];
  completedCount: () => number;
  pendingCount: () => number;
}

export const useTodoStore = create<TodoState>()(
  persist(
    (set, get) => ({
      // Initial state
      todos: [],
      isLoading: false,
      error: null,
      blockchainTodos: [],
      loadingBlockchain: false,
      selectedTodo: null,
      filter: 'all',
      searchQuery: '',
      
      // Actions
      setTodos: (todos) => set({ todos }),
      
      addTodo: (todo) => set((state) => ({ 
        todos: [...state.todos, todo]
      })),
      
      updateTodo: (id, updates) => set((state) => ({
        todos: state.todos.map(todo => 
          todo.id === id ? { ...todo, ...updates } : todo
        )
      })),
      
      deleteTodo: (id) => set((state) => ({
        todos: state.todos.filter(todo => todo.id !== id)
      })),
      
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      
      // Blockchain actions
      setBlockchainTodos: (blockchainTodos) => set({ blockchainTodos }),
      setLoadingBlockchain: (loadingBlockchain) => set({ loadingBlockchain }),
      
      // UI actions
      setSelectedTodo: (selectedTodo) => set({ selectedTodo }),
      setFilter: (filter) => set({ filter }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      
      // Computed getters
      filteredTodos: () => {
        const { todos, filter, searchQuery } = get();
        let filtered = todos;
        
        // Apply filter
        if (filter === 'completed') {
          filtered = filtered.filter(todo => todo.completed);
        } else if (filter === 'pending') {
          filtered = filtered.filter(todo => !todo.completed);
        }
        
        // Apply search
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filtered = filtered.filter(todo => 
            todo.title.toLowerCase().includes(query) ||
            (todo.description && todo.description.toLowerCase().includes(query))
          );
        }
        
        return filtered;
      },
      
      completedCount: () => get().todos.filter(todo => todo.completed).length,
      pendingCount: () => get().todos.filter(todo => !todo.completed).length,
    }),
    {
      name: 'waltodo-storage',
      partialize: (state) => ({
        todos: state.todos,
        filter: state.filter,
        searchQuery: state.searchQuery,
      }),
    }
  )
);