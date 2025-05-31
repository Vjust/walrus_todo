/**
 * Usage examples for blockchain event system
 * Demonstrates various ways to integrate real-time events
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { Todo } from '@/types/todo-nft';
import {
  useBlockchainEvents,
  useTodoEvents,
  useTodoStateSync,
  useEventConnectionStatus,
} from '@/hooks/useBlockchainEvents';
import {
  BlockchainEventStatus,
  BlockchainEventIndicator,
} from '@/components/BlockchainEventStatus';
import { RealtimeTodoList } from '@/components/RealtimeTodoList';
import { useWalletContext } from '@/contexts/WalletContext';

/**
 * Example 1: Basic Event Subscription
 */
export function BasicEventSubscription() {
  const walletContext = useWalletContext();
  const address = walletContext?.address || null;
  const {
    isConnected,
    isConnecting,
    error,
    startSubscription,
    stopSubscription,
  } = useBlockchainEvents({
    autoStart: true,
    owner: address || undefined,
    enableReconnect: true,
  });

  return (
    <div className='p-4 border rounded-lg'>
      <h3 className='text-lg font-semibold mb-4'>Basic Event Subscription</h3>

      <div className='space-y-2'>
        <p>
          Status:{' '}
          {isConnecting
            ? 'Connecting...'
            : isConnected
              ? 'Connected'
              : 'Disconnected'}
        </p>
        {error && <p className='text-red-600'>Error: {error.message}</p>}

        <div className='space-x-2'>
          <button
            onClick={startSubscription}
            disabled={isConnected || isConnecting}
            className='px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50'
          >
            Start Subscription
          </button>
          <button
            onClick={stopSubscription}
            disabled={!isConnected}
            className='px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50'
          >
            Stop Subscription
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Example 2: Todo Event Handlers
 */
export function TodoEventHandlers() {
  const walletContext = useWalletContext();
  const address = walletContext?.address || null;
  const [notifications, setNotifications] = useState<string[]>([]);

  const addNotification = useCallback((message: string) => {
    setNotifications(prev => [message, ...prev.slice(0, 9)]); // Keep last 10
  }, []);

  const { recentEvents, isConnected } = useTodoEvents({
    autoStart: true,
    owner: address || undefined,
    onTodoCreated: todo => {
      addNotification(`✅ New todo created: "${todo.title}"`);
    },
    onTodoCompleted: todo => {
      addNotification(`🎉 Todo completed: "${todo.title || 'Unknown'}"`);
    },
    onTodoUpdated: todo => {
      addNotification(`📝 Todo updated: "${todo.title || 'Unknown'}"`);
    },
    onTodoDeleted: todoId => {
      addNotification(`🗑️ Todo deleted: ${todoId}`);
    },
  });

  return (
    <div className='p-4 border rounded-lg'>
      <h3 className='text-lg font-semibold mb-4'>Todo Event Handlers</h3>

      <div className='grid grid-cols-2 gap-4'>
        <div>
          <h4 className='font-medium mb-2'>Live Notifications</h4>
          <div className='space-y-1 max-h-40 overflow-y-auto'>
            {notifications.length === 0 ? (
              <p className='text-gray-500 text-sm'>No notifications yet</p>
            ) : (
              notifications.map((notification, index) => (
                <div key={index} className='text-sm p-2 bg-gray-100 rounded'>
                  {notification}
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h4 className='font-medium mb-2'>
            Recent Events ({recentEvents.length})
          </h4>
          <div className='space-y-1 max-h-40 overflow-y-auto'>
            {recentEvents.slice(0, 5).map((event, index) => (
              <div key={index} className='text-xs p-2 bg-blue-50 rounded'>
                <span className='font-mono'>{event.type}</span>:{' '}
                {JSON.stringify(event.data, null, 2).substring(0, 50)}...
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className='mt-4'>
        <BlockchainEventIndicator />
        <span className='ml-2 text-sm text-gray-600'>
          {isConnected
            ? 'Receiving live updates'
            : 'Connect wallet for live updates'}
        </span>
      </div>
    </div>
  );
}

/**
 * Example 3: Real-time Todo State Sync
 */
export function TodoStateSync() {
  const walletContext = useWalletContext();
  const address = walletContext?.address || null;
  const [localTodos, setLocalTodos] = useState<Todo[]>([
    {
      id: '1',
      title: 'Example Local Todo',
      completed: false,
      priority: 'medium',
      blockchainStored: false,
    },
  ]);

  const { syncedTodos, isConnected } = useTodoStateSync({
    todos: localTodos,
    onTodoChange: updatedTodos => {
      console.log('Todos synchronized from blockchain:', updatedTodos);
      setLocalTodos(updatedTodos);
    },
    owner: address || undefined,
    autoStart: true,
  });

  const handleAddTodo = () => {
    const newTodo: Todo = {
      id: Date.now().toString(),
      title: `New Todo ${Date.now()}`,
      completed: false,
      priority: 'medium',
      blockchainStored: false,
    };
    setLocalTodos(prev => [...prev, newTodo]);
  };

  return (
    <div className='p-4 border rounded-lg'>
      <h3 className='text-lg font-semibold mb-4'>Real-time Todo State Sync</h3>

      <div className='mb-4'>
        <button
          onClick={handleAddTodo}
          className='px-4 py-2 bg-green-600 text-white rounded'
        >
          Add Local Todo
        </button>
        <span className='ml-4 text-sm text-gray-600'>
          Total todos: {syncedTodos.length} | Connected:{' '}
          {isConnected ? '✅' : '❌'}
        </span>
      </div>

      <div className='space-y-2'>
        {syncedTodos.map(todo => (
          <div
            key={todo.id}
            className='flex items-center justify-between p-2 bg-gray-50 rounded'
          >
            <div>
              <span
                className={todo.completed ? 'line-through text-gray-500' : ''}
              >
                {todo.title}
              </span>
              {todo.blockchainStored && (
                <span className='ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded'>
                  On-chain
                </span>
              )}
            </div>
            <div className='text-xs text-gray-500'>
              {todo.priority} priority
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Example 4: Connection Status Management
 */
export function ConnectionStatusManagement() {
  const { connectionState, statusColor, statusText, canReconnect, reconnect } =
    useEventConnectionStatus();

  return (
    <div className='p-4 border rounded-lg'>
      <h3 className='text-lg font-semibold mb-4'>
        Connection Status Management
      </h3>

      <div className='grid grid-cols-2 gap-4'>
        <div>
          <h4 className='font-medium mb-2'>Current Status</h4>
          <div className='space-y-2'>
            <div className='flex items-center'>
              <div
                className={`w-3 h-3 rounded-full mr-2 bg-${statusColor}-500`}
              ></div>
              <span>{statusText}</span>
            </div>
            <div className='text-sm text-gray-600'>
              Reconnect attempts: {connectionState.reconnectAttempts}
            </div>
          </div>
        </div>

        <div>
          <h4 className='font-medium mb-2'>Actions</h4>
          <div className='space-y-2'>
            <button
              onClick={reconnect}
              disabled={!canReconnect}
              className='w-full px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50'
            >
              Reconnect
            </button>
          </div>
        </div>
      </div>

      <div className='mt-4'>
        <BlockchainEventStatus showReconnectButton={true} showDetails={true} />
      </div>
    </div>
  );
}

/**
 * Example 5: Complete Real-time Todo Application
 */
export function CompleteRealtimeTodoApp() {
  const walletContext = useWalletContext();
  const address = walletContext?.address || null;
  const connected = walletContext?.connected || false;
  const [todos, setTodos] = useState<Todo[]>([]);

  const handleTodoComplete = async (todo: Todo) => {
    // Simulate blockchain completion
    console.log('Completing todo on blockchain:', todo);

    // Update local state immediately for optimistic UI
    setTodos(prev =>
      prev.map(t =>
        t.id === todo.id
          ? { ...t, completed: true, completedAt: new Date().toISOString() }
          : t
      )
    );
  };

  const handleTodoDelete = async (todoId: string) => {
    // Simulate blockchain deletion
    console.log('Deleting todo from blockchain:', todoId);

    // Update local state immediately for optimistic UI
    setTodos(prev => prev.filter(t => t.id !== todoId));
  };

  const handleTodoUpdate = (updatedTodos: Todo[]) => {
    setTodos(updatedTodos);
    // Optionally save to local storage
    localStorage.setItem('realtimeTodos', JSON.stringify(updatedTodos));
  };

  // Load todos from local storage on mount
  useEffect(() => {
    const savedTodos = localStorage.getItem('realtimeTodos');
    if (savedTodos) {
      setTodos(JSON.parse(savedTodos));
    }
  }, []);

  if (!connected) {
    return (
      <div className='p-4 border rounded-lg text-center'>
        <h3 className='text-lg font-semibold mb-4'>
          Complete Real-time Todo App
        </h3>
        <p className='text-gray-600 mb-4'>
          Please connect your wallet to use the real-time todo application.
        </p>
      </div>
    );
  }

  return (
    <div className='p-4 border rounded-lg'>
      <h3 className='text-lg font-semibold mb-4'>
        Complete Real-time Todo App
      </h3>

      <RealtimeTodoList
        initialTodos={todos}
        listName='My Real-time Todos'
        onTodoUpdate={handleTodoUpdate}
        onTodoComplete={handleTodoComplete}
        onTodoDelete={handleTodoDelete}
        showEventIndicator={true}
      />

      <div className='mt-4 p-3 bg-blue-50 rounded text-sm'>
        <p>
          <strong>Tips:</strong>
        </p>
        <ul className='list-disc list-inside mt-1 space-y-1'>
          <li>Real-time updates when todos are modified on the blockchain</li>
          <li>Visual notifications for new events</li>
          <li>Connection status indicator shows event subscription health</li>
          <li>Automatic reconnection on network issues</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Demo page showing all examples
 */
export default function BlockchainEventsDemo() {
  const [selectedExample, setSelectedExample] = useState('basic');

  const examples = {
    basic: {
      component: BasicEventSubscription,
      title: 'Basic Event Subscription',
    },
    handlers: { component: TodoEventHandlers, title: 'Todo Event Handlers' },
    sync: { component: TodoStateSync, title: 'Todo State Sync' },
    status: {
      component: ConnectionStatusManagement,
      title: 'Connection Status',
    },
    complete: {
      component: CompleteRealtimeTodoApp,
      title: 'Complete Todo App',
    },
  };

  const SelectedComponent =
    examples[selectedExample as keyof typeof examples].component;

  return (
    <div className='container mx-auto px-4 py-8'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold mb-4'>
          Blockchain Events Usage Examples
        </h1>
        <p className='text-gray-600 mb-6'>
          Interactive examples demonstrating real-time blockchain event
          integration for TodoNFT smart contracts.
        </p>

        <div className='flex space-x-2 mb-6'>
          {Object.entries(examples).map(([key, { title }]) => (
            <button
              key={key}
              onClick={() => setSelectedExample(key)}
              className={`px-4 py-2 rounded ${
                selectedExample === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {title}
            </button>
          ))}
        </div>
      </div>

      <div className='mb-8'>
        <SelectedComponent />
      </div>

      <div className='mt-8 p-4 bg-yellow-50 border-l-4 border-yellow-400'>
        <h4 className='font-semibold text-yellow-800'>Development Notes</h4>
        <ul className='mt-2 text-sm text-yellow-700 space-y-1'>
          <li>• Make sure you have the Sui wallet extension installed</li>
          <li>• Connect to testnet for testing TodoNFT events</li>
          <li>• Check browser console for detailed event logs</li>
          <li>
            • Some features require actual blockchain transactions to trigger
            events
          </li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Individual usage examples for integration
 */

// Simple event listener setup
export function SimpleEventSetup() {
  const { addEventListener } = useBlockchainEvents({ autoStart: true });

  useEffect(() => {
    const unsubscribe = addEventListener('*', event => {
      console.log('Received event:', event);
    });

    return unsubscribe;
  }, [addEventListener]);

  return <div>Event listener active</div>;
}

// Todo creation with real-time feedback
export function TodoCreationWithFeedback() {
  const [isCreating, setIsCreating] = useState(false);
  const { addEventListener } = useBlockchainEvents({ autoStart: true });

  useEffect(() => {
    const unsubscribe = addEventListener('created', event => {
      if (isCreating) {
        setIsCreating(false);
        alert(`Todo created successfully`);
      }
    });

    return unsubscribe;
  }, [addEventListener, isCreating]);

  const createTodo = async () => {
    setIsCreating(true);
    // Trigger blockchain transaction to create todo
    // Event listener will handle success notification
  };

  return (
    <button onClick={createTodo} disabled={isCreating}>
      {isCreating ? 'Creating...' : 'Create Todo'}
    </button>
  );
}
