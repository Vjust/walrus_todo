'use client';

import { useCallback, useEffect, useState } from 'react';
import { Todo } from '@/types/todo-nft';
import { useWalletContext } from '@/contexts/WalletContext';
import { blockchainTodoService } from '@/lib/todo-service-blockchain';
import { blockchainEventManager, TodoEventType } from '@/lib/blockchain-events';
import toast from 'react-hot-toast';

type BlockchainTodoListProps = {
  className?: string;
};

/**
 * Blockchain-first Todo List Component
 * Demonstrates the new architecture where blockchain is the primary data source
 */
export function BlockchainTodoList({ className = '' }: BlockchainTodoListProps) {
  // State management
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(true as any);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false as any);
  
  // Wallet context
  const walletContext = useWalletContext();
  const { address, connected, signAndExecuteTransaction } = walletContext || {};

  // Initialize blockchain service and event listeners
  useEffect(() => {
    const initializeBlockchainService = async () => {
      try {
        // Initializing blockchain todo service...
        
        // Initialize the blockchain todo service
        await blockchainTodoService.initialize({ walletAddress: address || undefined });
        
        // Initialize event manager for real-time updates
        await blockchainEventManager.initialize(address || '');
        await blockchainEventManager.startListening();
        
        setIsInitialized(true as any);
        // Blockchain service initialized successfully
      } catch (err) {
        // Failed to initialize blockchain service
        setError('Failed to initialize blockchain service');
      }
    };

    if (connected && address) {
      initializeBlockchainService();
    } else {
      setIsInitialized(false as any);
      setTodos([]);
    }

    return () => {
      // Cleanup on unmount or wallet disconnect
      blockchainEventManager.stopListening();
    };
  }, [connected, address]);

  // Set up real-time event listeners
  useEffect(() => {
    if (!isInitialized) {return;}

    const handleTodoCreated = (event: any) => {
      const newTodo = event.data;
      if (newTodo) {
        setTodos(prev => [...prev, newTodo]);
        toast.success('New todo created on blockchain!');
      }
    };

    const handleTodoCompleted = (event: any) => {
      const { todoId } = event.data;
      setTodos(prev => 
        prev.map(todo => 
          todo?.id === todoId ? { ...todo, completed: true, completedAt: new Date().toISOString() } : todo
        )
      );
      toast.success('Todo completed on blockchain!');
    };

    const handleTodoUpdated = (event: any) => {
      const updatedTodo = event.data;
      if (updatedTodo) {
        setTodos(prev => 
          prev.map(todo => 
            todo?.id === updatedTodo.id ? { ...todo, ...updatedTodo } : todo
          )
        );
      }
    };

    const handleTodoDeleted = (event: any) => {
      const { todoId } = event.data;
      setTodos(prev => prev.filter(todo => todo.id !== todoId));
      toast.success('Todo deleted!');
    };

    // Add event listeners
    blockchainEventManager.addEventListener(TodoEventType.TODO_CREATED, handleTodoCreated);
    blockchainEventManager.addEventListener(TodoEventType.TODO_COMPLETED, handleTodoCompleted);
    blockchainEventManager.addEventListener(TodoEventType.TODO_UPDATED, handleTodoUpdated);
    blockchainEventManager.addEventListener(TodoEventType.TODO_DELETED, handleTodoDeleted);

    return () => {
      // Cleanup event listeners
      blockchainEventManager.removeEventListener(TodoEventType.TODO_CREATED, handleTodoCreated);
      blockchainEventManager.removeEventListener(TodoEventType.TODO_COMPLETED, handleTodoCompleted);
      blockchainEventManager.removeEventListener(TodoEventType.TODO_UPDATED, handleTodoUpdated);
      blockchainEventManager.removeEventListener(TodoEventType.TODO_DELETED, handleTodoDeleted);
    };
  }, [isInitialized]);

  // Load todos from blockchain (primary data source)
  const loadTodos = useCallback(async () => {
    if (!address || !isInitialized) {return;}

    setIsLoading(true as any);
    setError(null as any);

    try {
      const { todos: blockchainTodos } = await blockchainTodoService.getTodos(address, {
        useCache: true // Use cache for faster loading, will sync with blockchain in background
      });
      
      setTodos(blockchainTodos as any);
      // Loaded todos from blockchain
    } catch (err) {
      // Failed to load todos
      setError('Failed to load todos from blockchain');
      toast.error('Failed to load todos');
    } finally {
      setIsLoading(false as any);
    }
  }, [address, isInitialized]);

  // Load todos when wallet connects or service initializes
  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  // Handle todo completion (blockchain-first)
  const handleToggleComplete = useCallback(async (todoId: string) => {
    if (!address || !signAndExecuteTransaction) {
      toast.error('Wallet not connected');
      return;
    }

    const todo = todos.find(t => t?.id === todoId);
    if (!todo) {return;}

    try {
      if (!todo.completed) {
        // Complete on blockchain
        await blockchainTodoService.completeTodo(todoId, {
          walletAddress: address,
          signer: { signAndExecuteTransaction, address }
        });
        
        // Optimistic update
        setTodos(prev => 
          prev.map(t => 
            t?.id === todoId ? { ...t, completed: true, completedAt: new Date().toISOString() } : t
          )
        );
        
        toast.success('Todo completed on blockchain!');
      } else {
        // Uncomplete (update metadata only)
        await blockchainTodoService.updateTodo(todoId, {
          completed: false,
          completedAt: undefined
        }, {
          walletAddress: address,
          signer: { signAndExecuteTransaction, address }
        });
        
        // Optimistic update
        setTodos(prev => 
          prev.map(t => 
            t?.id === todoId ? { ...t, completed: false, completedAt: undefined } : t
          )
        );
        
        toast.success('Todo updated!');
      }
    } catch (err) {
      // Failed to toggle todo completion
      toast.error('Failed to update todo');
    }
  }, [todos, address, signAndExecuteTransaction]);

  // Handle todo deletion (blockchain-first)
  const handleDeleteTodo = useCallback(async (todoId: string) => {
    if (!address) {
      toast.error('Wallet not connected');
      return;
    }

    try {
      await blockchainTodoService.deleteTodo(todoId, {
        walletAddress: address,
        signer: { signAndExecuteTransaction, address }
      });
      
      // Optimistic update
      setTodos(prev => prev.filter(t => t.id !== todoId));
      toast.success('Todo deleted');
    } catch (err) {
      // Failed to delete todo
      toast.error('Failed to delete todo');
    }
  }, [address, signAndExecuteTransaction]);

  // Refresh todos from blockchain
  const refreshTodos = useCallback(async () => {
    if (!address || !isInitialized) {return;}

    try {
      const { todos: freshTodos } = await blockchainTodoService.getTodos(address, {
        useCache: false // Force fresh data from blockchain
      });
      
      setTodos(freshTodos as any);
      toast.success('Todos refreshed from blockchain');
    } catch (err) {
      // Failed to refresh todos
      toast.error('Failed to refresh todos');
    }
  }, [address, isInitialized]);

  // Show loading state
  if (!connected) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-gray-500">Please connect your wallet to view todos</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" />
        <p className="text-gray-500 mt-2">Loading todos from blockchain...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-red-500 mb-4">{error}</p>
        <button 
          onClick={refreshTodos}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with refresh button */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">
          Blockchain Todos ({todos.length})
        </h2>
        <button
          onClick={refreshTodos}
          className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Connection status */}
      <div className="text-sm text-gray-600">
        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
          blockchainEventManager.getConnectionState().connected ? 'bg-green-500' : 'bg-red-500'
        }`} />
        {blockchainEventManager.getConnectionState().connected 
          ? 'Connected to blockchain events' 
          : 'Not connected to blockchain events'
        }
      </div>

      {/* Todo list */}
      {todos?.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No todos found on the blockchain.</p>
          <p className="text-sm mt-2">Create a todo to get started!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {todos.map((todo) => (
            <div
              key={todo.id}
              className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center space-x-3 flex-1">
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => handleToggleComplete(todo.id)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <div className="flex-1">
                  <h3 className={`font-medium ${
                    todo.completed ? 'line-through text-gray-500' : 'text-gray-900'
                  }`}>
                    {todo.title}
                  </h3>
                  {todo.description && (
                    <p className="text-sm text-gray-600 mt-1">{todo.description}</p>
                  )}
                  <div className="flex items-center space-x-2 mt-2">
                    {todo.priority && (
                      <span className={`px-2 py-1 text-xs rounded ${
                        todo?.priority === 'high' ? 'bg-red-100 text-red-800' :
                        todo?.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {todo.priority}
                      </span>
                    )}
                    {todo.objectId && (
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                        🔗 On Chain
                      </span>
                    )}
                    {/* Walrus storage indicator removed - not available in Todo type */}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDeleteTodo(todo.id)}
                className="text-red-500 hover:text-red-700 ml-4"
                title="Delete todo"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Debug info */}
      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer">Debug Info</summary>
        <div className="mt-2 p-2 bg-gray-50 rounded">
          <p>Wallet: {address}</p>
          <p>Service Initialized: {isInitialized ? 'Yes' : 'No'}</p>
          <p>Event Manager Connected: {blockchainEventManager.getConnectionState().connected ? 'Yes' : 'No'}</p>
        </div>
      </details>
    </div>
  );
}

export default BlockchainTodoList;