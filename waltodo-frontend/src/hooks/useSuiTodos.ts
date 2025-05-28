/**
 * React hook for TodoNFT operations with wallet integration
 * Provides easy-to-use interface for blockchain todo operations
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

// Use unified types
import type { 
  Todo, 
  CreateTodoParams, 
  UpdateTodoParams,
  TransactionResult as TodoTransactionResult,
  NetworkType
} from '@/types/todo-nft';

interface UseSuiTodosState {
  todos: Todo[];
  loading: boolean;
  error: string | null;
  networkHealth: boolean;
  refreshing: boolean;
}

interface UseSuiTodosActions {
  createTodo: (params: CreateTodoParams) => Promise<TodoTransactionResult>;
  updateTodo: (params: UpdateTodoParams) => Promise<TodoTransactionResult>;
  completeTodo: (objectId: string) => Promise<TodoTransactionResult>;
  deleteTodo: (objectId: string) => Promise<TodoTransactionResult>;
  refreshTodos: () => Promise<void>;
  switchToNetwork: (network: NetworkType) => Promise<void>;
  checkHealth: () => Promise<void>;
  clearError: () => void;
}

interface UseSuiTodosReturn {
  state: UseSuiTodosState;
  actions: UseSuiTodosActions;
  network: NetworkType;
  isWalletReady: boolean;
}

import { useWalletContext } from '@/contexts/WalletContext';
import {
  storeTodoOnBlockchain,
  retrieveTodosFromBlockchain,
  completeTodoOnBlockchain,
  transferTodoNFT,
  addTodo,
  getTodos,
  getTodoList,
  updateTodo as updateLocalTodo,
  deleteTodo as deleteLocalTodo,
  type WalletSigner,
} from '@/lib/todo-service';
import { getTodosFromBlockchain } from '@/lib/sui-client';
import type { TodoList } from '@/types/todo-nft';

/**
 * Hook for managing TodoNFTs on Sui blockchain
 */
export function useSuiTodos(): UseSuiTodosReturn {
  const walletContext = useWalletContext();
  const {
    connected,
    address,
    trackTransaction,
    error: walletError,
    clearError: clearWalletError,
  } = walletContext;

  const [state, setState] = useState<UseSuiTodosState>({
    todos: [],
    loading: false,
    error: null,
    networkHealth: true,
    refreshing: false,
  });

  const [currentNetwork, setCurrentNetwork] = useState<NetworkType>('testnet');

  // Check if wallet is ready for operations
  const isWalletReady = useMemo(() => {
    return Boolean(connected && address && !walletError);
  }, [connected, address, walletError]);

  // Set error helper
  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  // Set loading helper
  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading }));
  }, []);

  // Set refreshing helper
  const setRefreshing = useCallback((refreshing: boolean) => {
    setState(prev => ({ ...prev, refreshing }));
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
    clearWalletError();
  }, [setError, clearWalletError]);

  // Check network health
  const checkHealth = useCallback(async () => {
    try {
      // Mock health check - always returns healthy
      setState(prev => ({ ...prev, networkHealth: true }));
    } catch (error) {
      setState(prev => ({ ...prev, networkHealth: false }));
      setError(
        `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }, [setError]);

  // Fetch todos from blockchain and local storage
  const refreshTodos = useCallback(async () => {
    if (!address) {
      // Load anonymous todos when no wallet connected
      const localTodos = getTodos('default');
      setState(prev => ({ ...prev, todos: localTodos }));
      return;
    }

    setRefreshing(true);
    setError(null);

    try {
      // Fetch todos from blockchain
      const blockchainTodos = await retrieveTodosFromBlockchain(address);

      // Also get local todos for this wallet
      const localTodos = getTodos('default', address);

      // Merge blockchain and local todos (blockchain takes precedence for duplicates)
      const todoMap = new Map<string, Todo>();

      // Add local todos first
      localTodos.forEach(todo => {
        todoMap.set(todo.id, todo);
      });

      // Add/override with blockchain todos
      blockchainTodos.forEach(todo => {
        todoMap.set(todo.id, todo);
      });

      const mergedTodos = Array.from(todoMap.values());

      setState(prev => ({ ...prev, todos: mergedTodos }));
    } catch (error) {
      setError('Failed to fetch todos');
      console.error('Error fetching todos:', error);

      // Fallback to local todos only
      const localTodos = getTodos('default', address);
      setState(prev => ({ ...prev, todos: localTodos }));
    } finally {
      setRefreshing(false);
    }
  }, [address, setError, setRefreshing]);

  // Switch to different network
  const switchToNetwork = useCallback(
    async (network: NetworkType) => {
      setLoading(true);
      setError(null);

      try {
        // Update network state
        setCurrentNetwork(network);

        // Refresh todos after network switch
        if (isWalletReady) {
          await refreshTodos();
        }
      } catch (error) {
        setError(`Failed to switch to ${network} network`);
        console.error('Network switch error:', error);
      } finally {
        setLoading(false);
      }
    },
    [isWalletReady, refreshTodos, setError, setLoading]
  );

  // Create todo (locally first, then optionally on blockchain)
  const createTodo = useCallback(
    async (params: CreateTodoParams): Promise<TodoTransactionResult> => {
      setLoading(true);
      setError(null);

      try {
        // First, create the todo locally
        const newTodo = addTodo(
          'default',
          {
            title: params.title,
            description: params.description,
            completed: false,
            priority: params.priority || 'medium',
            tags: params.tags,
            dueDate: params.dueDate,
          },
          address || undefined
        );

        // If wallet is connected, also store on blockchain
        if (
          isWalletReady &&
          address &&
          walletContext.signAndExecuteTransaction
        ) {
          const walletSigner: WalletSigner = {
            signAndExecuteTransaction: walletContext.signAndExecuteTransaction,
            address,
          };

          const todoPromise = storeTodoOnBlockchain(
            'default',
            newTodo.id,
            walletSigner,
            address
          ).then(objectId => ({ digest: objectId || undefined }));

          const result = trackTransaction 
            ? await trackTransaction(todoPromise, 'Create Todo NFT')
            : await todoPromise;
          const objectId = result.digest;

          if (objectId) {
            // Refresh to get updated blockchain state
            await refreshTodos();
            return { success: true, digest: objectId };
          }
        }

        // For local-only todos, still refresh to update UI
        await refreshTodos();
        return { success: true, digest: newTodo.id };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to create todo';
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [
      isWalletReady,
      address,
      trackTransaction,
      refreshTodos,
      setError,
      setLoading,
      walletContext.signAndExecuteTransaction,
    ]
  );

  // Update todo on blockchain
  const updateTodo = useCallback(
    async (params: UpdateTodoParams): Promise<TodoTransactionResult> => {
      if (!isWalletReady || !address) {
        throw new Error('Wallet not connected');
      }

      setLoading(true);
      setError(null);

      try {
        // Mock transaction
        const result: TodoTransactionResult = {
          success: true,
          digest: 'mock_digest_' + Date.now(),
        };

        // Simulate transaction delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Update mock todo in state
        setState(prev => ({
          ...prev,
          todos: prev.todos.map(todo =>
            todo.objectId === params.objectId
              ? {
                  ...todo,
                  title: params.title || todo.title,
                  description: params.description || todo.description,
                  priority: params.priority || todo.priority,
                  dueDate: params.dueDate || todo.dueDate,
                  updatedAt: new Date().toISOString(),
                }
              : todo
          ),
        }));

        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to update todo';
        setError(message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [isWalletReady, address, setError, setLoading]
  );

  // Complete todo
  const completeTodo = useCallback(
    async (todoId: string): Promise<TodoTransactionResult> => {
      setLoading(true);
      setError(null);

      try {
        // Find the todo
        const todo = state.todos.find(
          t => t.id === todoId || t.objectId === todoId
        );
        if (!todo) {
          throw new Error('Todo not found');
        }

        // Update locally first
        todo.completed = true;
        updateLocalTodo('default', todo, address || undefined);

        // If it's a blockchain todo and wallet is connected, complete on blockchain
        if (
          todo.blockchainStored &&
          todo.objectId &&
          isWalletReady &&
          address &&
          walletContext.signAndExecuteTransaction
        ) {
          const walletSigner: WalletSigner = {
            signAndExecuteTransaction: walletContext.signAndExecuteTransaction,
            address,
          };

          const completePromise = completeTodoOnBlockchain(
            'default',
            todo.id,
            walletSigner,
            address
          ).then(success => ({ digest: success ? 'completed' : undefined }));

          const result = trackTransaction 
            ? await trackTransaction(completePromise, 'Complete Todo NFT')
            : await completePromise;
          const success = !!result.digest;

          if (!success) {
            throw new Error('Failed to complete todo on blockchain');
          }
        }

        // Refresh todos
        await refreshTodos();
        return { success: true, digest: todo.objectId || todo.id };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to complete todo';
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [
      state.todos,
      isWalletReady,
      address,
      trackTransaction,
      refreshTodos,
      setError,
      setLoading,
      walletContext.signAndExecuteTransaction,
    ]
  );

  // Transfer todo NFT (delete locally after transfer)
  const deleteTodo = useCallback(
    async (todoId: string): Promise<TodoTransactionResult> => {
      setLoading(true);
      setError(null);

      try {
        // Find the todo
        const todo = state.todos.find(
          t => t.id === todoId || t.objectId === todoId
        );
        if (!todo) {
          throw new Error('Todo not found');
        }

        // For blockchain todos, we can't delete - only transfer
        // For local todos, we can delete directly
        if (!todo.blockchainStored) {
          // Delete local todo
          const deleted = deleteLocalTodo(
            'default',
            todo.id,
            address || undefined
          );
          if (deleted) {
            await refreshTodos();
            return { success: true, digest: todo.id };
          }
        } else {
          // For blockchain todos, inform user they need to transfer it
          throw new Error(
            'Blockchain todos cannot be deleted, only transferred to another address'
          );
        }

        return { success: false, error: 'Failed to delete todo' };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to delete todo';
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [state.todos, address, refreshTodos, setError, setLoading]
  );

  // Auto-refresh todos when wallet connects
  useEffect(() => {
    if (!isWalletReady) return;
    
    let isMounted = true;
    
    const loadInitialTodos = async () => {
      if (!isMounted) return;
      
      setRefreshing(true);
      try {
        const chainTodos = await getTodosFromBlockchain(address!);
        if (isMounted) {
          setState(s => ({ ...s, todos: chainTodos, error: null }));
          await checkHealth();
        }
      } catch (err) {
        if (isMounted) {
          setError(`Failed to load blockchain todos: ${err instanceof Error ? err.message : String(err)}`);
        }
      } finally {
        if (isMounted) {
          setRefreshing(false);
        }
      }
    };

    loadInitialTodos();
    
    return () => {
      isMounted = false;
    };
  }, [isWalletReady, address]);

  // Auto-check health periodically
  useEffect(() => {
    if (!isWalletReady) return;

    const interval = setInterval(() => {
      checkHealth();
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [isWalletReady]);

  return {
    state,
    actions: {
      createTodo,
      updateTodo,
      completeTodo,
      deleteTodo,
      refreshTodos,
      switchToNetwork,
      checkHealth,
      clearError,
    },
    network: currentNetwork,
    isWalletReady,
  };
}

// Helper hook for individual todo operations
export function useTodoOperation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TodoTransactionResult | null>(null);

  const executeOperation = useCallback(
    async (operation: () => Promise<TodoTransactionResult>) => {
      setLoading(true);
      setError(null);
      setResult(null);

      try {
        const operationResult = await operation();
        setResult(operationResult);
        return operationResult;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Operation failed';
        setError(message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const clearState = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  return {
    loading,
    error,
    result,
    executeOperation,
    clearState,
  };
}

export type {
  Todo,
  CreateTodoParams,
  UpdateTodoParams,
  TodoTransactionResult as TransactionResult,
  NetworkType,
  UseSuiTodosState,
  UseSuiTodosActions,
  UseSuiTodosReturn,
};
