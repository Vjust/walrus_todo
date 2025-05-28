'use client';

import { useState, useEffect, useCallback } from 'react';
import { Todo } from '@/lib/sui-client';
// import { useTodoStateSync } from '@/hooks/useBlockchainEvents'
// import { BlockchainEventIndicator } from './BlockchainEventStatus'
import { useWalletContext } from '@/contexts/WalletContext';
import { getTodos, updateTodo } from '@/lib/todo-service';
import {
  getTodosFromBlockchain,
  completeTodoOnBlockchain,
  deleteTodoOnBlockchain,
  initializeSuiClient,
} from '@/lib/sui-client';

type TodoListProps = {
  listName: string;
};

export default function TodoList({ listName }: TodoListProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [blockchainTodos, setBlockchainTodos] = useState<Todo[]>([]);
  const [loadingBlockchain, setLoadingBlockchain] = useState(false);
  const { address, connected, signAndExecuteTransaction } = useWalletContext();

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

  // Load blockchain todos when wallet is connected
  const loadBlockchainTodos = useCallback(async () => {
    if (!connected || !address) {
      setBlockchainTodos([]);
      return;
    }

    setLoadingBlockchain(true);
    try {
      // Initialize Sui client
      try {
        initializeSuiClient('testnet');
      } catch (e) {
        console.warn('Sui client already initialized');
      }

      // Fetch todos from blockchain
      const fetchedTodos = await getTodosFromBlockchain(address);
      setBlockchainTodos(fetchedTodos);
    } catch (error) {
      console.error('Failed to load blockchain todos:', error);
      setBlockchainTodos([]);
    } finally {
      setLoadingBlockchain(false);
    }
  }, [connected, address]); // useCallback dependencies

  // Load initial todos from local storage for the connected wallet
  useEffect(() => {
    const loadTodos = async () => {
      setIsLoading(true);
      try {
        // Load wallet-specific todos from local storage
        const localTodos = getTodos(listName, address || undefined);
        setTodos(localTodos);

        // Also load blockchain todos if wallet is connected
        if (connected && address) {
          await loadBlockchainTodos();
        }
      } catch (error) {
        console.error('Failed to load todos:', error);
        // Fallback to empty array
        setTodos([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadTodos();
  }, [listName, address, connected, loadBlockchainTodos]); // Re-load when wallet address changes

  // Merge local and blockchain todos, prioritizing blockchain todos
  const mergedTodos = [...todos, ...blockchainTodos].reduce(
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

  // Use merged todos since blockchain events are disabled
  const displayTodos = mergedTodos;

  const toggleTodoCompletion = async (id: string) => {
    const todo = displayTodos.find(t => t.id === id);
    if (!todo) return;

    // Update local state immediately for optimistic UI
    const updatedTodos = displayTodos.map(todoItem =>
      todoItem.id === id
        ? {
            ...todoItem,
            completed: !todoItem.completed,
            completedAt: !todoItem.completed ? Date.now() : undefined,
          }
        : todoItem
    );
    setTodos(updatedTodos);

    try {
      if (todo.blockchainStored && todo.objectId && signAndExecuteTransaction) {
        // Complete todo on blockchain
        console.log('Completing todo on blockchain:', todo.objectId);
        const result = await completeTodoOnBlockchain(
          todo.objectId,
          signAndExecuteTransaction,
          address || ''
        );

        if (result.success) {
          console.log('✅ Todo completed on blockchain:', result.digest);
          // Refresh blockchain todos to get updated state
          await loadBlockchainTodos();
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
          completedAt: !todo.completed ? Date.now() : undefined,
        };
        const success = updateTodo(listName, updatedTodo, address || undefined);

        if (!success) {
          console.error('Failed to update todo in storage');
          // Revert optimistic update by reloading from storage
          const localTodos = getTodos(listName, address || undefined);
          setTodos(localTodos);
        }
      }
    } catch (error) {
      console.error('Failed to toggle todo completion:', error);
      // Revert optimistic update by reloading from storage and blockchain
      const localTodos = getTodos(listName, address || undefined);
      setTodos(localTodos);
      if (connected && address) {
        await loadBlockchainTodos();
      }
    }
  };

  if (isLoading) {
    return (
      <div className='flex justify-center py-12'>
        <div className='w-12 h-12 rounded-full border-4 border-ocean-light border-t-ocean-deep animate-spin'></div>
      </div>
    );
  }

  if (displayTodos.length === 0) {
    return (
      <div className='text-center py-12'>
        <p className='text-ocean-medium dark:text-ocean-light mb-4'>
          No todos in this list yet.
        </p>
        <p className='text-sm text-ocean-medium/70 dark:text-ocean-light/70'>
          Create your first todo using the form above!
        </p>
        {connected && (
          <div className='mt-4'>
            <div className='flex items-center space-x-2'>
              <div className='w-2 h-2 bg-blue-500 rounded-full' />
              <span className='text-xs text-ocean-medium/70'>
                Blockchain Connected
              </span>
            </div>
            <p className='text-xs text-ocean-medium/50 dark:text-ocean-light/50 mt-2'>
              Blockchain integration active
            </p>
            {loadingBlockchain && (
              <p className='text-xs text-blue-600 dark:text-blue-400 mt-1 animate-pulse'>
                Loading blockchain todos...
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Handle storing local todo on blockchain
  const handleStoreOnBlockchain = async (todo: Todo) => {
    if (!connected || !address || !signAndExecuteTransaction) return;

    try {
      console.log('Storing todo on blockchain:', todo.title);
      // This would create an NFT version of the local todo
      // Implementation would involve calling storeTodoOnBlockchain
      // For now, just show a placeholder
      alert(
        'Feature coming soon: Store existing todo as NFT on Sui blockchain'
      );
    } catch (error) {
      console.error('Failed to store todo on blockchain:', error);
    }
  };

  // Handle deleting todo (local or blockchain)
  const handleDeleteTodo = async (todo: Todo) => {
    if (!confirm(`Are you sure you want to delete "${todo.title}"?`)) return;

    try {
      if (todo.blockchainStored && todo.objectId && signAndExecuteTransaction) {
        // Delete from blockchain
        console.log('Deleting todo from blockchain:', todo.objectId);
        const result = await deleteTodoOnBlockchain(
          todo.objectId,
          signAndExecuteTransaction,
          address || ''
        );

        if (result.success) {
          console.log('✅ Todo deleted from blockchain:', result.digest);
          // Refresh blockchain todos
          await loadBlockchainTodos();
        } else {
          throw new Error(
            result.error || 'Failed to delete todo from blockchain'
          );
        }
      } else {
        // Delete from local storage
        const updatedTodos = todos.filter(t => t.id !== todo.id);
        setTodos(updatedTodos);
        // Update storage would happen here
      }
    } catch (error) {
      console.error('Failed to delete todo:', error);
      alert('Failed to delete todo. Please try again.');
    }
  };

  return (
    <div className='space-y-4'>
      {/* Event connection indicator - temporarily disabled */}
      {connected && (
        <div className='flex items-center justify-between mb-4 p-3 bg-white/30 dark:bg-ocean-deep/30 rounded-lg border border-ocean-light/20'>
          <div className='flex items-center space-x-2'>
            <div className='w-2 h-2 bg-blue-500 rounded-full' />
            <span className='text-sm text-ocean-medium dark:text-ocean-light'>
              Blockchain integration active
            </span>
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
                      <span className='w-1.5 h-1.5 bg-dream-purple rounded-full mr-1'></span>
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
