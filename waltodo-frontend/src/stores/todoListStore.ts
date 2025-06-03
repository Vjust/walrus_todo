import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Todo } from '@/types/todo-nft';

export interface TodoListState {
  // Todo data
  todos: Todo[];
  blockchainTodos: Todo[];
  
  // Loading states
  isLoading: boolean;
  loadingBlockchain: boolean;
  
  // Component state
  componentMounted: boolean;
  initializationComplete: boolean;
  
  // Actions
  setTodos: (todos: Todo[]) => void;
  setBlockchainTodos: (todos: Todo[]) => void;
  setIsLoading: (loading: boolean) => void;
  setLoadingBlockchain: (loading: boolean) => void;
  setComponentMounted: (mounted: boolean) => void;
  setInitializationComplete: (complete: boolean) => void;
  
  // Todo operations
  addTodo: (todo: Todo) => void;
  updateTodo: (todoId: string, updates: Partial<Todo>) => void;
  removeTodo: (todoId: string) => void;
  
  // Utility actions
  getMergedTodos: () => Todo[];
  clearBlockchainTodos: () => void;
  reset: () => void;
}

const initialState = {
  todos: [],
  blockchainTodos: [],
  isLoading: true,
  loadingBlockchain: false,
  componentMounted: false,
  initializationComplete: false,
};

export const useTodoListStore = create<TodoListState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,
    
    // Basic setters
    setTodos: (todos: Todo[]) => set({ todos }),
    setBlockchainTodos: (blockchainTodos: Todo[]) => set({ blockchainTodos }),
    setIsLoading: (isLoading: boolean) => set({ isLoading }),
    setLoadingBlockchain: (loadingBlockchain: boolean) => set({ loadingBlockchain }),
    setComponentMounted: (componentMounted: boolean) => set({ componentMounted }),
    setInitializationComplete: (initializationComplete: boolean) => set({ initializationComplete }),
    
    // Todo operations
    addTodo: (todo: Todo) => {
      const { todos } = get();
      set({ todos: [...todos, todo] });
    },
    
    updateTodo: (todoId: string, updates: Partial<Todo>) => {
      const { todos } = get();
      const updatedTodos = todos.map(todo =>
        todo.id === todoId ? { ...todo, ...updates } : todo
      );
      set({ todos: updatedTodos });
    },
    
    removeTodo: (todoId: string) => {
      const { todos } = get();
      const filteredTodos = todos.filter(todo => todo.id !== todoId);
      set({ todos: filteredTodos });
    },
    
    // Utility actions
    getMergedTodos: () => {
      const { todos, blockchainTodos } = get();
      return [...todos, ...blockchainTodos].reduce(
        (acc: Todo[], todo) => {
          // Remove duplicates based on objectId (blockchain todos take precedence)
          const existing = acc.find(
            t => t.objectId && t.objectId === todo.objectId
          );
          if (!existing) {
            acc.push(todo);
          } else if (todo.blockchainStored && !existing.blockchainStored) {
            // Replace local todo with blockchain version
            const index = acc.indexOf(existing);
            acc[index] = todo;
          }
          return acc;
        },
        []
      );
    },
    
    clearBlockchainTodos: () => set({ blockchainTodos: [] }),
    
    reset: () => set(initialState),
  }))
);

// Selectors for performance optimization
export const useTodoListData = () => {
  return useTodoListStore((state) => ({
    todos: state.todos,
    blockchainTodos: state.blockchainTodos,
    mergedTodos: state.getMergedTodos(),
  }));
};

export const useTodoListLoadingState = () => {
  return useTodoListStore((state) => ({
    isLoading: state.isLoading,
    loadingBlockchain: state.loadingBlockchain,
  }));
};

export const useTodoListComponentState = () => {
  return useTodoListStore((state) => ({
    componentMounted: state.componentMounted,
    initializationComplete: state.initializationComplete,
  }));
};

// Selector for individual todo
export const useTodoById = (todoId: string) => {
  return useTodoListStore((state) => {
    const mergedTodos = state.getMergedTodos();
    return mergedTodos.find(todo => todo.id === todoId);
  });
};