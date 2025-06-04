'use client';

import { memo, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import type { Todo } from '@/types/todo-nft';
// import { useTodoStateSync } from '@/hooks/useBlockchainEvents'
// import { BlockchainEventIndicator } from './BlockchainEventStatus'
import { useWalletContext } from '@/contexts/WalletContext';
// WebSocket status removed - using blockchain events for real-time updates
import { getTodos, updateTodo } from '@/lib/todo-service';
import {
  completeTodoOnBlockchain,
  deleteTodoOnBlockchain,
  getTodosFromBlockchain,
} from '@/lib/sui-client';
import { useSuiClient } from '@/hooks/useSuiClient';
import toast from 'react-hot-toast';
import { TodoImageDisplay } from './TodoImageDisplay';

type TodoListProps = {
  listName: string;
};

function TodoList({ listName }: TodoListProps) {
  // ALL HOOKS MUST BE DECLARED AT THE TOP - NO CONDITIONAL HOOKS
  // Fixed React hooks order violation by removing componentMounted and initializationComplete
  // from useCallback dependency arrays and moved safety checks inside the callbacks
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [blockchainTodos, setBlockchainTodos] = useState<Todo[]>([]);
  const [loadingBlockchain, setLoadingBlockchain] = useState(false);
  const [componentMounted, setComponentMounted] = useState(false);
  const initializationComplete = useRef(false);
  const lastInitCheck = useRef(0);
  
  // Wallet context with safety checks
  const walletContext = useWalletContext();
  const { address, connected, signAndExecuteTransaction } = walletContext || {};

  // Sui client hook with initialization state - moved before early returns
  const { 
    isInitialized: suiClientInitialized, 
    isInitializing: suiClientInitializing, 
    error: suiClientError 
  } = useSuiClient('testnet');

  // TODO: WebSocket/real-time updates temporarily disabled

  // Disable blockchain events to prevent console spam
  // const { syncedTodos, isConnected: eventsConnected } = useTodoStateSync({
  //   todos,
  //   onTodoChange: (updatedTodos) => {
  //     setTodos(updatedTodos)
  //   },
  //   owner: address || undefined,
  //   autoStart: connected,
  // })
  const eventsConnected = false;

  // Merge local and blockchain todos, prioritizing blockchain todos
  const mergedTodos = useMemo(() => {
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
  }, [todos, blockchainTodos]);

  // Use merged todos since blockchain events are disabled
  const displayTodos = useMemo(() => mergedTodos, [mergedTodos]);

  // SSR/Hydration safety - don't render wallet features until client-side mounted
  useEffect(() => {
    setComponentMounted(true);
  }, []);

  // Check initialization state without triggering re-renders
  const checkInitialization = useCallback(() => {
    const now = Date.now();
    if (now - lastInitCheck.current < 50) return initializationComplete.current; // Debounce
    
    lastInitCheck.current = now;
    const isComplete = componentMounted && (suiClientInitialized || !connected);
    initializationComplete.current = isComplete;
    return isComplete;
  }, [componentMounted, suiClientInitialized, connected]);

  // Load blockchain todos when wallet is connected and Sui client is ready
  useEffect(() => {
    let isMounted = true;

    const loadBlockchainTodos = async () => {
      // Safety checks - prevent premature execution
      if (!checkInitialization()) {
        return;
      }

      if (!connected || !address) {
        if (isMounted) {
          setBlockchainTodos([]);
        }
        return;
      }

      // Only proceed if Sui client is initialized
      if (!suiClientInitialized) {
        // Sui client not initialized, skipping blockchain fetch
        return;
      }

      if (isMounted) {
        setLoadingBlockchain(true);
      }

      try {
        // Fetching todos from blockchain...
        const fetchedTodos = await getTodosFromBlockchain(address);
        if (isMounted) {
          setBlockchainTodos(fetchedTodos);
          // Loaded todos from blockchain
        }
      } catch (error) {
        // Failed to load blockchain todos
        if (isMounted) {
          setBlockchainTodos([]);
          // Show error toast for blockchain loading failures
          toast.error('Failed to load blockchain todos. Using local storage only.', {
            duration: 4000,
            icon: '⚠️',
          });
        }
      } finally {
        if (isMounted) {
          setLoadingBlockchain(false);
        }
      }
    };

    loadBlockchainTodos();

    return () => {
      isMounted = false;
    };
  }, [connected, address, checkInitialization]);

  // Load initial todos from local storage for the connected wallet
  useEffect(() => {
    let isMounted = true;

    const loadTodos = async () => {
      if (isMounted) {
        setIsLoading(true);
      }

      try {
        // Load wallet-specific todos from local storage
        const localTodos = getTodos(listName, address || undefined);
        if (isMounted) {
          setTodos(localTodos);
        }
      } catch (error) {
        // Failed to load todos
        // Fallback to empty array
        if (isMounted) {
          setTodos([]);
          toast.error('Failed to load todos from local storage', {
            duration: 4000,
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadTodos();

    return () => {
      isMounted = false;
    };
  }, [listName, address]);

  // Move all useCallback hooks before early returns
  const refreshBlockchainTodos = useCallback(async () => {
    // Safety guards - moved inside the callback to ensure stable hook count
    if (!checkInitialization()) {return;}
    if (!connected || !address || !suiClientInitialized) {return;}

    try {
      // Refreshing blockchain todos...
      const fetchedTodos = await getTodosFromBlockchain(address);
      setBlockchainTodos(fetchedTodos);
      // Refreshed todos from blockchain
    } catch (error) {
      // Failed to refresh blockchain todos
      toast.error('Failed to refresh blockchain todos', {
        duration: 3000,
      });
    }
  }, [connected, address, suiClientInitialized, checkInitialization]);

  const toggleTodoCompletion = useCallback(async (id: string) => {
    // Safety guards - componentMounted and initializationComplete checked inside to ensure stable hook count
    if (!checkInitialization()) {return;}
    
    // Find todo using current state directly, not as dependency
    const allCurrentTodos = displayTodos;
    const todo = allCurrentTodos.find(t => t.id === id);
    if (!todo) {return;}

    // Update local state immediately for optimistic UI
    setTodos(prevTodos => prevTodos.map(todoItem =>
      todoItem.id === id
        ? {
            ...todoItem,
            completed: !todoItem.completed,
            completedAt: !todoItem.completed ? new Date().toISOString() : undefined,
          }
        : todoItem
    ));

    try {
      if (todo.blockchainStored && todo.objectId && signAndExecuteTransaction && suiClientInitialized) {
        // Completing todo on blockchain
        const result = await completeTodoOnBlockchain(
          todo.objectId,
          signAndExecuteTransaction,
          address || ''
        );

        if (result.success) {
          // Todo completed on blockchain
          toast.success('Todo updated on blockchain!', {
            duration: 3000,
            icon: '🎉',
          });
          // Refresh blockchain todos to get updated state
          if (connected && address && suiClientInitialized) {
            try {
              const fetchedTodos = await getTodosFromBlockchain(address);
              setBlockchainTodos(fetchedTodos);
            } catch (error) {
              // Failed to refresh blockchain todos after update
            }
          }
        } else {
          throw new Error(
            result.error || 'Failed to complete todo on blockchain'
          );
        }
      } else {
        // Update in wallet-specific local storage
        const updatedTodo = {
          ...todo,
          completed: !todo.completed,
          completedAt: !todo.completed ? new Date().toISOString() : undefined,
        };
        const success = updateTodo(listName, updatedTodo, address || undefined);

        if (!success) {
          // Failed to update todo in storage
          toast.error('Failed to update todo', {
            duration: 3000,
          });
          // Revert optimistic update by reloading from storage
          const localTodos = getTodos(listName, address || undefined);
          setTodos(localTodos);
        } else {
          toast.success('Todo updated!', {
            duration: 2000,
          });
        }
      }
    } catch (error) {
      // Failed to toggle todo completion
      const errorMessage = error instanceof Error ? error.message : 'Failed to update todo';
      toast.error(errorMessage, {
        duration: 5000,
      });
      // Revert optimistic update by reloading from storage and blockchain
      const localTodos = getTodos(listName, address || undefined);
      setTodos(localTodos);
      if (connected && address && suiClientInitialized) {
        try {
          const fetchedTodos = await getTodosFromBlockchain(address);
          setBlockchainTodos(fetchedTodos);
        } catch (error) {
          // Failed to refresh blockchain todos after error
        }
      }
    }
  }, [signAndExecuteTransaction, address, listName, connected, suiClientInitialized, checkInitialization]);

  // Handle storing local todo on blockchain
  const handleStoreOnBlockchain = useCallback(async (todo: Todo) => {
    // Safety guards - moved inside the callback to ensure stable hook count
    if (!checkInitialization()) {return;}
    if (!connected || !address || !signAndExecuteTransaction || !suiClientInitialized) {return;}

    try {
      // Storing todo on blockchain
      // This would create an NFT version of the local todo
      // Implementation would involve calling storeTodoOnBlockchain
      // For now, just show a placeholder
      toast('Feature coming soon: Store existing todo as NFT on Sui blockchain', {
        duration: 4000,
        icon: '🚧',
      });
    } catch (error) {
      // Failed to store todo on blockchain
      toast.error('Failed to store todo on blockchain', {
        duration: 4000,
      });
    }
  }, [connected, address, signAndExecuteTransaction, suiClientInitialized, checkInitialization]);

  // Handle deleting todo (local or blockchain)
  const handleDeleteTodo = useCallback(async (todo: Todo) => {
    // Safety guards - moved inside the callback to ensure stable hook count
    if (!checkInitialization()) {return;}
    if (!confirm(`Are you sure you want to delete "${todo.title}"?`)) {return;}

    try {
      if (todo.blockchainStored && todo.objectId && signAndExecuteTransaction && suiClientInitialized) {
        // Deleting todo from blockchain
        const result = await deleteTodoOnBlockchain(
          todo.objectId,
          signAndExecuteTransaction,
          address || ''
        );

        if (result.success) {
          // Todo deleted from blockchain
          toast.success('Todo deleted from blockchain!', {
            duration: 3000,
            icon: '🗑️',
          });
          // Refresh blockchain todos
          if (connected && address && suiClientInitialized) {
            try {
              const fetchedTodos = await getTodosFromBlockchain(address);
              setBlockchainTodos(fetchedTodos);
            } catch (error) {
              // Failed to refresh blockchain todos after delete
            }
          }
        } else {
          throw new Error(
            result.error || 'Failed to delete todo from blockchain'
          );
        }
      } else {
        // Delete from local storage
        setTodos(prevTodos => prevTodos.filter(t => t.id !== todo.id));
        toast.success('Todo deleted!', {
          duration: 2000,
        });
        // Update storage would happen here
      }
    } catch (error) {
      // Failed to delete todo
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete todo';
      toast.error(errorMessage, {
        duration: 5000,
      });
    }
  }, [signAndExecuteTransaction, address, listName, suiClientInitialized, checkInitialization]);

  // Early returns after all hooks are called
  if (!componentMounted) {
    return <TodoListSkeleton />;
  }

  // Loading states with proper initialization guards
  if (isLoading || (connected && suiClientInitializing)) {
    return (
      <div className='flex flex-col items-center justify-center py-12'>
        <div className='w-12 h-12 rounded-full border-4 border-ocean-light border-t-ocean-deep animate-spin' />
        <div className='mt-4 text-center'>
          {!componentMounted && (
            <p className='text-sm text-ocean-medium animate-pulse'>
              Loading component...
            </p>
          )}
          {componentMounted && isLoading && (
            <p className='text-sm text-ocean-medium animate-pulse'>
              Loading todos...
            </p>
          )}
          {componentMounted && connected && suiClientInitializing && (
            <p className='text-sm text-ocean-medium animate-pulse'>
              Initializing blockchain connection...
            </p>
          )}
        </div>
      </div>
    );
  }

  // Show Sui client error if there is one (only after component is mounted)
  if (componentMounted && connected && suiClientError) {
    return (
      <div className='text-center py-12'>
        <div className='text-red-500 mb-4'>
          <p className='font-medium'>Blockchain Connection Error</p>
          <p className='text-sm'>{suiClientError}</p>
        </div>
        <p className='text-sm text-ocean-medium/70 dark:text-ocean-light/70'>
          Local todos will still work. Try refreshing to reconnect to the blockchain.
        </p>
      </div>
    );
  }

  if (displayTodos.length === 0) {
    return (
      <div className='text-center py-12'>
        <div className='mx-auto w-24 h-24 mb-4 text-gray-400'>
          <svg className='w-full h-full' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} 
              d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' />
          </svg>
        </div>
        <h3 className='text-lg font-medium text-gray-900 dark:text-gray-100 mb-2'>
          No todos yet
        </h3>
        <p className='text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto'>
          Get started by creating your first todo. You can create local todos or mint them as NFTs on the Sui blockchain.
        </p>
        
        {/* Quick action buttons */}
        <div className='flex flex-col sm:flex-row gap-3 justify-center items-center'>
          <button
            onClick={() => {
              // Trigger create form if available
              const createButton = document.querySelector('[data-testid="create-todo-button"]') as HTMLButtonElement;
              if (createButton) {createButton.click();}
            }}
            className='inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
          >
            <svg className='w-4 h-4 mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 6v6m0 0v6m0-6h6m-6 0H6' />
            </svg>
            Create Todo
          </button>
          
          {connected && (
            <button className='inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors'>
              <svg className='w-4 h-4 mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} 
                  d='M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' />
              </svg>
              Create NFT Todo
            </button>
          )}
        </div>
        
        {/* Connection status */}
        <div className='mt-6 pt-6 border-t border-gray-200 dark:border-gray-700'>
          {connected ? (
            <div className='flex items-center justify-center space-x-2 text-green-600 dark:text-green-400'>
              <div className='w-2 h-2 bg-green-500 rounded-full animate-pulse' />
              <span className='text-sm'>Wallet Connected - Ready for blockchain todos</span>
            </div>
          ) : (
            <div className='flex items-center justify-center space-x-2 text-gray-500 dark:text-gray-400'>
              <div className='w-2 h-2 bg-gray-400 rounded-full' />
              <span className='text-sm'>Connect wallet to create blockchain todos</span>
            </div>
          )}
          
          {loadingBlockchain && (
            <p className='text-xs text-blue-600 dark:text-blue-400 mt-2 animate-pulse'>
              Loading blockchain todos...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {/* Connection status indicators */}
      {connected && (
        <div className='flex items-center justify-between mb-4 p-3 bg-white/30 dark:bg-ocean-deep/30 rounded-lg border border-ocean-light/20'>
          <div className='flex items-center space-x-4'>
            <div className='flex items-center space-x-2'>
              <div className='w-2 h-2 bg-blue-500 rounded-full' />
              <span className='text-sm text-ocean-medium dark:text-ocean-light'>
                Blockchain active
              </span>
            </div>
            <div className='flex items-center space-x-2'>
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-sm text-blue-600">
                Blockchain-first mode
              </span>
            </div>
          </div>
          <div className='text-xs text-ocean-medium/70 dark:text-ocean-light/70'>
            {displayTodos.length} todos
          </div>
        </div>
      )}

      {displayTodos.map(todo => (
        <div
          key={todo.objectId ?? todo.id}
          data-testid='todo-item'
          className={`p-4 rounded-lg transition-all ${
            todo.completed
              ? 'bg-green-50/50 dark:bg-green-900/30 border border-green-200 dark:border-green-800/50'
              : 'bg-white/50 dark:bg-ocean-deep/30 border border-ocean-light/20'
          }`}
        >
          <div className='flex items-start gap-3'>
            <button
              onClick={() => toggleTodoCompletion(todo.id)}
              data-testid='todo-checkbox'
              className={`mt-1 w-5 h-5 rounded-full flex-shrink-0 ${
                todo.completed
                  ? 'bg-green-500 text-white flex items-center justify-center'
                  : 'border-2 border-ocean-medium'
              }`}
            >
              {todo.completed && (
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 20 20'
                  fill='currentColor'
                  className='w-3 h-3'
                >
                  <path
                    fillRule='evenodd'
                    d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                    clipRule='evenodd'
                  />
                </svg>
              )}
            </button>

            <div className='flex-grow'>
              <div className='flex items-start justify-between'>
                <h3
                  data-testid='todo-title'
                  className={`font-medium ${todo.completed ? 'line-through text-ocean-medium/70 dark:text-ocean-light/70 completed' : 'text-ocean-deep dark:text-ocean-foam'}`}
                >
                  {todo.title}
                </h3>

                <div className='flex items-center gap-2'>
                  {todo.blockchainStored && (
                    <span className='flex items-center text-xs bg-dream-purple/20 text-dream-purple px-2 py-0.5 rounded-full'>
                      <span className='w-1.5 h-1.5 bg-dream-purple rounded-full mr-1' />
                      NFT
                    </span>
                  )}

                  {todo.objectId && (
                    <a
                      href={`https://suiexplorer.com/object/${todo.objectId}?network=testnet`}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-xs text-ocean-medium hover:text-ocean-deep dark:text-ocean-light dark:hover:text-ocean-foam transition-colors'
                      title='View on Sui Explorer'
                    >
                      🔍
                    </a>
                  )}

                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      todo.priority === 'high'
                        ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300'
                        : todo.priority === 'medium'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                          : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}
                  >
                    {todo.priority}
                  </span>
                </div>
              </div>

              {todo.description && (
                <p className='mt-1 text-sm text-ocean-medium dark:text-ocean-light/80'>
                  {todo.description}
                </p>
              )}

              {/* Display optimized image if available */}
              {todo.imageUrl && (
                <div className='mt-3'>
                  <TodoImageDisplay
                    todoId={todo.id}
                    imageUrl={todo.imageUrl}
                    showPerformanceMetrics={false}
                  />
                </div>
              )}

              <div className='mt-2 flex flex-wrap items-center gap-2'>
                {todo.tags &&
                  todo.tags.map(tag => (
                    <span
                      key={tag}
                      className='text-xs bg-ocean-light/30 dark:bg-ocean-medium/30 text-ocean-deep dark:text-ocean-foam px-2 py-0.5 rounded-full'
                    >
                      #{tag}
                    </span>
                  ))}

                {todo.dueDate && (
                  <span className='text-xs text-ocean-medium dark:text-ocean-light flex items-center'>
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      className='h-3 w-3 mr-1'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
                      />
                    </svg>
                    Due: {todo.dueDate}
                  </span>
                )}

                {todo.blockchainStored && (
                  <span className='text-xs text-purple-600 dark:text-purple-400 flex items-center'>
                    ⛓️ On-chain todo
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className='mt-3 pt-3 border-t border-ocean-light/20 dark:border-ocean-medium/20 flex justify-end gap-2'>
            <button className='text-xs text-ocean-medium hover:text-ocean-deep dark:text-ocean-light dark:hover:text-ocean-foam transition-colors'>
              Edit
            </button>
            {!todo.blockchainStored && connected && (
              <button
                onClick={() => handleStoreOnBlockchain(todo)}
                className='text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 transition-colors'
              >
                Store as NFT
              </button>
            )}
            <button
              onClick={() => handleDeleteTodo(todo)}
              className='text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors'
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Skeleton component for loading state during hydration
function TodoListSkeleton() {
  return (
    <div className='flex flex-col items-center justify-center py-12'>
      <div className='w-12 h-12 rounded-full border-4 border-gray-200 border-t-blue-600 animate-spin' />
      <div className='mt-4 text-center'>
        <p className='text-sm text-gray-500 animate-pulse'>
          Initializing todo list...
        </p>
      </div>
    </div>
  );
}

export default memo(TodoList);