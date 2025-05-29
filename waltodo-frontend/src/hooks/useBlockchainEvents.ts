/**
 * React hooks for blockchain event subscriptions
 * Provides real-time updates for TodoNFT events with automatic state management
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BlockchainEventManager,
  TodoNFTEvent,
  EventConnectionState,
  EventListener,
  getEventManager,
  transformEventToTodoUpdate,
} from '@/lib/blockchain-events';
import { Todo } from '@/lib/sui-client';
import { useWalletContext } from '@/contexts/WalletContext';

/**
 * Hook for managing blockchain event subscriptions
 */
export function useBlockchainEvents(
  options: {
    autoStart?: boolean;
    owner?: string;
    enableReconnect?: boolean;
  } = {}
) {
  const { autoStart = true, owner, enableReconnect = true } = options;
  const [connectionState, setConnectionState] = useState<EventConnectionState>({
    connected: false,
    connecting: false,
    error: null,
    lastReconnectAttempt: 0,
    reconnectAttempts: 0,
  });

  const eventManagerRef = useRef<BlockchainEventManager | null>(null);
  const { address } = useWalletContext();

  // Use wallet address if no owner specified
  const targetOwner = owner || address;

  /**
   * Initialize event manager
   */
  const initialize = useCallback(async () => {
    try {
      if (!eventManagerRef.current) {
        eventManagerRef.current = getEventManager({
          autoReconnect: enableReconnect,
        });
      }

      await eventManagerRef.current.initialize();
      setConnectionState(eventManagerRef.current.getConnectionState());
    } catch (error) {
      console.error('Failed to initialize blockchain events:', error);
      setConnectionState(prev => ({
        ...prev,
        error: error as Error,
        connecting: false,
      }));
    }
  }, [enableReconnect]);

  /**
   * Start event subscriptions
   */
  const startSubscription = useCallback(async () => {
    if (!eventManagerRef.current) {
      await initialize();
    }

    if (!eventManagerRef.current) return;

    try {
      setConnectionState(prev => ({ ...prev, connecting: true }));
      await eventManagerRef.current.subscribeToEvents(targetOwner || undefined);
      setConnectionState(eventManagerRef.current.getConnectionState());
    } catch (error) {
      console.error('Failed to start event subscription:', error);
      setConnectionState(prev => ({
        ...prev,
        error: error as Error,
        connecting: false,
      }));
    }
  }, [initialize, targetOwner]);

  /**
   * Stop event subscriptions
   */
  const stopSubscription = useCallback(() => {
    if (eventManagerRef.current) {
      eventManagerRef.current.unsubscribeAll();
      setConnectionState(eventManagerRef.current.getConnectionState());
    }
  }, []);

  /**
   * Restart event subscriptions
   */
  const restartSubscription = useCallback(async () => {
    stopSubscription();
    await startSubscription();
  }, [stopSubscription, startSubscription]);

  /**
   * Add event listener
   */
  const addEventListener = useCallback(
    (eventType: string | '*', listener: EventListener): (() => void) => {
      if (!eventManagerRef.current) {
        // Don't spam console with warnings, just return noop
        return () => {};
      }

      return eventManagerRef.current.addEventListener(eventType, listener);
    },
    []
  );

  // Auto-start subscription when wallet connects
  useEffect(() => {
    let isMounted = true;
    
    if (autoStart && targetOwner && isMounted) {
      startSubscription();
    }

    return () => {
      isMounted = false;
      if (eventManagerRef.current) {
        eventManagerRef.current.destroy();
        eventManagerRef.current = null;
      }
    };
  }, [autoStart, targetOwner]);

  // Update connection state periodically
  useEffect(() => {
    if (!eventManagerRef.current) return;

    const interval = setInterval(() => {
      if (eventManagerRef.current) {
        setConnectionState(eventManagerRef.current.getConnectionState());
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return {
    connectionState,
    startSubscription,
    stopSubscription,
    restartSubscription,
    addEventListener,
    isConnected: connectionState.connected,
    isConnecting: connectionState.connecting,
    error: connectionState.error,
  };
}

/**
 * Hook for real-time todo updates from blockchain events
 */
export function useTodoEvents(
  options: {
    onTodoCreated?: (todo: Partial<Todo>) => void;
    onTodoUpdated?: (todo: Partial<Todo>) => void;
    onTodoCompleted?: (todo: Partial<Todo>) => void;
    onTodoDeleted?: (todoId: string) => void;
    owner?: string;
    autoStart?: boolean;
  } = {}
) {
  const {
    onTodoCreated,
    onTodoUpdated,
    onTodoCompleted,
    onTodoDeleted,
    owner,
    autoStart = true,
  } = options;

  const [recentEvents, setRecentEvents] = useState<TodoNFTEvent[]>([]);
  const { addEventListener, ...eventHookResult } = useBlockchainEvents({
    autoStart,
    owner,
  });

  // Handle todo events
  useEffect(() => {
    const unsubscribe = addEventListener('*', (event: TodoNFTEvent) => {
      // Add to recent events list
      setRecentEvents(prev => [event, ...prev.slice(0, 49)]); // Keep last 50 events

      // Transform event to todo update
      const todoUpdate = transformEventToTodoUpdate(event);

      // Call appropriate callback
      switch (event.type) {
        case 'created':
          if (todoUpdate && onTodoCreated) {
            onTodoCreated(todoUpdate);
          }
          break;
        case 'updated':
          if (todoUpdate && onTodoUpdated) {
            onTodoUpdated(todoUpdate);
          }
          break;
        case 'completed':
          if (todoUpdate && onTodoCompleted) {
            onTodoCompleted(todoUpdate);
          }
          break;
        case 'deleted':
          if (onTodoDeleted) {
            onTodoDeleted(event.data.todo_id);
          }
          break;
      }
    });

    return unsubscribe;
  }, [
    addEventListener,
    onTodoCreated,
    onTodoUpdated,
    onTodoCompleted,
    onTodoDeleted,
  ]);

  return {
    ...eventHookResult,
    recentEvents,
    clearRecentEvents: () => setRecentEvents([]),
  };
}

/**
 * Hook for real-time todo state synchronization
 * Automatically updates local state when blockchain events occur
 */
export function useTodoStateSync(
  options: {
    todos: Todo[];
    onTodoChange: (todos: Todo[]) => void;
    owner?: string;
    autoStart?: boolean;
  } = {} as any
) {
  const { todos, onTodoChange, owner, autoStart = true } = options;
  const [syncedTodos, setSyncedTodos] = useState<Todo[]>(todos || []);

  const { ...eventHookResult } = useTodoEvents({
    owner,
    autoStart,
    onTodoCreated: todoUpdate => {
      setSyncedTodos(prev => {
        // Check if todo already exists
        const existingIndex = prev.findIndex(
          t => t.id === todoUpdate.id || t.objectId === todoUpdate.id
        );
        if (existingIndex >= 0) {
          // Update existing todo
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], ...todoUpdate };
          return updated;
        } else {
          // Add new todo
          const newTodo: Todo = {
            id: todoUpdate.id || '',
            title: todoUpdate.title || 'Untitled',
            completed: false,
            priority: 'medium',
            blockchainStored: true,
            ...todoUpdate,
          };
          return [...prev, newTodo];
        }
      });
    },
    onTodoUpdated: todoUpdate => {
      setSyncedTodos(prev => {
        const index = prev.findIndex(
          t => t.id === todoUpdate.id || t.objectId === todoUpdate.id
        );
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = { ...updated[index], ...todoUpdate };
          return updated;
        }
        return prev;
      });
    },
    onTodoCompleted: todoUpdate => {
      setSyncedTodos(prev => {
        const index = prev.findIndex(
          t => t.id === todoUpdate.id || t.objectId === todoUpdate.id
        );
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = { ...updated[index], ...todoUpdate };
          return updated;
        }
        return prev;
      });
    },
    onTodoDeleted: todoId => {
      setSyncedTodos(prev =>
        prev.filter(t => t.id !== todoId && t.objectId !== todoId)
      );
    },
  });

  // Update parent component when todos change
  useEffect(() => {
    if (onTodoChange) {
      onTodoChange(syncedTodos);
    }
  }, [syncedTodos, onTodoChange]);

  // Update local state when external todos change
  useEffect(() => {
    if (todos) {
      setSyncedTodos(todos);
    }
  }, [todos]);

  return {
    ...eventHookResult,
    syncedTodos,
  };
}

/**
 * Hook for connection status with visual indicators
 */
export function useEventConnectionStatus() {
  const { connectionState, restartSubscription } = useBlockchainEvents({
    autoStart: false,
  });

  const getStatusColor = useCallback(() => {
    if (connectionState.connecting) return 'yellow';
    if (connectionState.connected) return 'green';
    if (connectionState.error) return 'red';
    return 'gray';
  }, [connectionState]);

  const getStatusText = useCallback(() => {
    if (connectionState.connecting) return 'Connecting...';
    if (connectionState.connected) return 'Connected';
    if (connectionState.error) return `Error: ${connectionState.error.message}`;
    return 'Disconnected';
  }, [connectionState]);

  const canReconnect = useCallback(() => {
    return !connectionState.connecting && !connectionState.connected;
  }, [connectionState]);

  return {
    connectionState,
    statusColor: getStatusColor(),
    statusText: getStatusText(),
    canReconnect: canReconnect(),
    reconnect: restartSubscription,
  };
}
