/**
 * Enhanced TodoList component with real-time blockchain event updates
 * Automatically syncs with blockchain events and displays live updates
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Todo } from '@/lib/sui-client';
import { useTodoStateSync, useTodoEvents } from '@/hooks/useBlockchainEvents';
import { useWalletContext } from '@/contexts/WalletContext';
import { BlockchainEventIndicator } from './BlockchainEventStatus';

interface RealtimeTodoListProps {
  initialTodos: Todo[];
  listName: string;
  onTodoUpdate?: (todos: Todo[]) => void;
  onTodoComplete?: (todo: Todo) => void;
  onTodoDelete?: (todoId: string) => void;
  className?: string;
  showEventIndicator?: boolean;
}

export function RealtimeTodoList({
  initialTodos,
  listName,
  onTodoUpdate,
  onTodoComplete,
  onTodoDelete,
  className = '',
  showEventIndicator = true
}: RealtimeTodoListProps) {
  const { address, connected } = useWalletContext();
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    message: string;
    type: 'created' | 'updated' | 'completed' | 'deleted';
    timestamp: number;
  }>>([]);

  // Enable blockchain events for real-time updates
  const { syncedTodos, isConnected, connectionState } = useTodoStateSync({
    todos,
    onTodoChange: (updatedTodos) => {
      setTodos(updatedTodos);
      if (onTodoUpdate) {
        onTodoUpdate(updatedTodos);
      }
    },
    owner: address || undefined,
    autoStart: connected,
  });

  // Enable individual todo events for real-time notifications
  const { recentEvents } = useTodoEvents({
    owner: address || undefined,
    autoStart: connected,
    onTodoCreated: (todo) => {
      addNotification({
        id: `created-${todo.id}-${Date.now()}`,
        message: `New todo created: ${todo.title}`,
        type: 'created',
        timestamp: Date.now(),
      });
    },
    onTodoUpdated: (todo) => {
      addNotification({
        id: `updated-${todo.id}-${Date.now()}`,
        message: `Todo updated: ${todo.title || 'Unknown'}`,
        type: 'updated',
        timestamp: Date.now(),
      });
    },
    onTodoCompleted: (todo) => {
      addNotification({
        id: `completed-${todo.id}-${Date.now()}`,
        message: `Todo completed: ${todo.title || 'Unknown'}`,
        type: 'completed',
        timestamp: Date.now(),
      });
    },
    onTodoDeleted: (todoId) => {
      addNotification({
        id: `deleted-${todoId}-${Date.now()}`,
        message: `Todo deleted`,
        type: 'deleted',
        timestamp: Date.now(),
      });
    },
  });

  const addNotification = useCallback((notification: typeof notifications[0]) => {
    setNotifications(prev => [notification, ...prev.slice(0, 4)]); // Keep last 5 notifications
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  }, []);

  const handleTodoComplete = useCallback(async (todo: Todo) => {
    if (onTodoComplete) {
      await onTodoComplete(todo);
    }
  }, [onTodoComplete]);

  const handleTodoDelete = useCallback(async (todoId: string) => {
    if (onTodoDelete) {
      await onTodoDelete(todoId);
    }
  }, [onTodoDelete]);

  // Update todos when initial todos change
  useEffect(() => {
    setTodos(initialTodos);
  }, [initialTodos]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'created':
        return '➕';
      case 'updated':
        return '📝';
      case 'completed':
        return '✅';
      case 'deleted':
        return '🗑️';
      default:
        return '📋';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'created':
        return 'bg-green-100 border-green-300 text-green-800';
      case 'updated':
        return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'completed':
        return 'bg-purple-100 border-purple-300 text-purple-800';
      case 'deleted':
        return 'bg-red-100 border-red-300 text-red-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (!connected) {
    return (
      <div className={`text-center p-8 ${className}`}>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800">
            Connect your wallet to see real-time todo updates from the blockchain.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Event connection status */}
      {showEventIndicator && (
        <div className="mb-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {listName} Todos
          </h3>
          <div className="w-2 h-2 bg-blue-500 rounded-full" />
        </div>
      )}

      {/* Live notifications */}
      {notifications.length > 0 && (
        <div className="mb-4 space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`flex items-center p-3 rounded-lg border ${getNotificationColor(notification.type)} transition-all duration-300`}
            >
              <span className="mr-2 text-lg">
                {getNotificationIcon(notification.type)}
              </span>
              <span className="flex-1">{notification.message}</span>
              <button
                onClick={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))}
                className="ml-2 text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Todo list */}
      <div className="space-y-3">
        {todos.length === 0 ? (
          <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-600 dark:text-gray-400">
              No todos found. Create your first todo to get started!
            </p>
          </div>
        ) : (
          todos.map((todo) => (
            <div
              key={todo.id}
              className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 transition-all duration-200 ${
                todo.completed ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => handleTodoComplete(todo)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <h4 className={`font-medium ${
                      todo.completed 
                        ? 'line-through text-gray-500 dark:text-gray-400' 
                        : 'text-gray-900 dark:text-gray-100'
                    }`}>
                      {todo.title}
                    </h4>
                    {todo.blockchainStored && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        🔗 On-chain
                      </span>
                    )}
                  </div>
                  
                  {todo.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {todo.description}
                    </p>
                  )}
                  
                  <div className="flex items-center space-x-2 text-xs">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full border ${getPriorityColor(todo.priority)}`}>
                      {todo.priority}
                    </span>
                    
                    {todo.tags && todo.tags.length > 0 && (
                      <div className="flex space-x-1">
                        {todo.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {todo.dueDate && (
                      <span className="text-gray-500">
                        Due: {new Date(todo.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  {todo.objectId && (
                    <a
                      href={`https://suiexplorer.com/object/${todo.objectId}?network=${connectionState.connected ? 'testnet' : 'mainnet'}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm"
                      title="View on Sui Explorer"
                    >
                      🔍
                    </a>
                  )}
                  
                  <button
                    onClick={() => handleTodoDelete(todo.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                    title="Delete todo"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Recent events debug info (dev mode) */}
      {process.env.NODE_ENV === 'development' && recentEvents.length > 0 && (
        <div className="mt-6 p-4 bg-gray-100 rounded-lg">
          <h4 className="font-medium mb-2">Recent Events (Dev Mode)</h4>
          <div className="space-y-1 text-xs">
            {recentEvents.slice(0, 5).map((event, index) => (
              <div key={index} className="font-mono text-gray-600">
                {event.type}: {JSON.stringify(event.data)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}