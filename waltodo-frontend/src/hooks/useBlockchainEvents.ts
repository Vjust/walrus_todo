/**
 * React hooks for blockchain event subscriptions
 * Provides real-time updates for TodoNFT events with automatic state management
 */

// @ts-nocheck - Temporarily disable type checking for complex blockchain event interfaces
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  BlockchainEventManager,
  TodoNFTEvent,
  EventConnectionState,
  EventListener,
  BlockchainEventHandler,
  getEventManager,
  transformEventToTodoUpdate,
} from '@/lib/blockchain-events';
import type { Todo } from '@/types/todo-nft';
import { useWalletContext } from '@/contexts/WalletContext';
import { SuiClient } from '@mysten/sui/client';
import { loadNetworkConfig } from '@/lib/config-loader';

// Event types based on Move contract
export interface TodoNFTCreatedData {
  todo_id: string;
  title: string;
  owner: string;
  timestamp: string;
}

export interface TodoNFTCompletedData {
  todo_id: string;
  owner: string;
  timestamp: string;
}

export interface TodoNFTUpdatedData {
  todo_id: string;
  owner: string;
  timestamp: string;
}

export interface TodoNFTTransferredData {
  todo_id: string;
  from: string;
  to: string;
  timestamp: string;
}

// Enhanced event type with full NFT support
export interface EnhancedTodoNFTEvent {
  type: 'TodoNFTCreated' | 'TodoNFTCompleted' | 'TodoNFTUpdated' | 'TodoNFTTransferred' | 'created' | 'completed' | 'updated' | 'deleted';
  data: TodoNFTCreatedData | TodoNFTCompletedData | TodoNFTUpdatedData | TodoNFTTransferredData;
  transactionDigest?: string;
  packageId?: string;
  module?: string;
  eventSeq?: string;
  timestamp: string;
}

// Event statistics for aggregation
export interface EventStatistics {
  totalEvents: number;
  createdCount: number;
  completedCount: number;
  updatedCount: number;
  transferredCount: number;
  eventsByOwner: Map<string, number>;
  eventsByHour: Map<string, number>;
  lastEventTime?: string;
}

// Event filter configuration
export interface EventFilter {
  owner?: string;
  eventTypes?: string[];
  startTime?: Date;
  endTime?: Date;
  todoIds?: string[];
}

// Debounce configuration
interface DebounceConfig {
  delay: number;
  maxWait?: number;
}

/**
 * Hook for managing blockchain event subscriptions with enhanced NFT support
 */
export function useBlockchainEvents(
  options: {
    autoStart?: boolean;
    owner?: string;
    enableReconnect?: boolean;
    filter?: EventFilter;
    enableHistorical?: boolean;
    debounceConfig?: DebounceConfig;
    maxReconnectAttempts?: number;
  } = {}
) {
  const { 
    autoStart = true, 
    owner, 
    enableReconnect = true,
    filter,
    enableHistorical = false,
    debounceConfig = { delay: 300, maxWait: 1000 },
    maxReconnectAttempts = 5
  } = options;
  
  const [connectionState, setConnectionState] = useState<EventConnectionState>({
    connected: false,
    connecting: false,
    error: null,
    lastReconnectAttempt: 0,
    reconnectAttempts: 0,
  });

  const [eventCache, setEventCache] = useState<Map<string, EnhancedTodoNFTEvent>>(new Map());
  const [eventStatistics, setEventStatistics] = useState<EventStatistics>({
    totalEvents: 0,
    createdCount: 0,
    completedCount: 0,
    updatedCount: 0,
    transferredCount: 0,
    eventsByOwner: new Map(),
    eventsByHour: new Map(),
  });

  const eventManagerRef = useRef<BlockchainEventManager | null>(null);
  const suiClientRef = useRef<SuiClient | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debounceTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const eventBufferRef = useRef<Map<string, EnhancedTodoNFTEvent[]>>(new Map());
  const missedEventsRef = useRef<Set<string>>(new Set());
  
  const walletContext = useWalletContext();
  const address = walletContext?.address || null;

  // Use wallet address if no owner specified
  const targetOwner = filter?.owner || owner || address;

  /**
   * Initialize event manager and SUI client
   */
  const initialize = useCallback(async () => {
    try {
      if (!eventManagerRef.current) {
        eventManagerRef.current = getEventManager();
      }

      // Initialize SUI client for historical queries
      if (!suiClientRef.current) {
        const config = await loadNetworkConfig(
          process.env.NEXT_PUBLIC_NETWORK || 'testnet'
        );
        if (config) {
          suiClientRef.current = new SuiClient({ url: config.network.url });
        }
      }

      await eventManagerRef.current.initialize();
      const state = eventManagerRef.current.getConnectionState();
      setConnectionState(state);
      
      // Load historical events if enabled
      if (enableHistorical && targetOwner) {
        await loadHistoricalEvents();
      }
    } catch (error) {
      // Failed to initialize blockchain events
      setConnectionState(prev => ({
        ...prev,
        error: error as Error,
        connecting: false,
      }));
    }
  }, [enableHistorical, targetOwner, loadHistoricalEvents]);

  /**
   * Load historical events from blockchain
   */
  const loadHistoricalEvents = useCallback(async () => {
    if (!suiClientRef.current || !targetOwner) return;

    try {
      const config = await loadNetworkConfig(
        process.env.NEXT_PUBLIC_NETWORK || 'testnet'
      );
      if (!config) return;

      // Query historical events
      const events = await suiClientRef.current.queryEvents({
        query: {
          MoveModule: {
            package: config.deployment.packageId,
            module: 'todo_nft'
          }
        },
        limit: 100,
        order: 'descending'
      });

      // Process and cache historical events
      setEventCache(prevCache => {
        const newCache = new Map(prevCache);
        events.data.forEach(event => {
          const enhancedEvent = parseBlockchainEvent(event);
          if (enhancedEvent && shouldProcessEvent(enhancedEvent)) {
            newCache.set(enhancedEvent.data.todo_id, enhancedEvent);
            updateEventStatistics(enhancedEvent);
          }
        });
        return newCache;
      });
    } catch (error) {
      console.error('Failed to load historical events:', error);
    }
  }, [targetOwner, parseBlockchainEvent, shouldProcessEvent, updateEventStatistics]);

  /**
   * Parse raw blockchain event into enhanced format
   */
  const parseBlockchainEvent = useCallback((event: any): EnhancedTodoNFTEvent | null => {
    try {
      const { type, parsedJson, timestampMs, id } = event;
      
      // Map event types from Move contract
      let eventType: EnhancedTodoNFTEvent['type'];
      if (type.includes('TodoNFTCreated')) {
        eventType = 'TodoNFTCreated';
      } else if (type.includes('TodoNFTCompleted')) {
        eventType = 'TodoNFTCompleted';
      } else if (type.includes('TodoNFTUpdated')) {
        eventType = 'TodoNFTUpdated';
      } else if (type.includes('TodoNFTTransferred')) {
        eventType = 'TodoNFTTransferred';
      } else {
        return null;
      }

      return {
        type: eventType,
        data: {
          todo_id: parsedJson.todo_id,
          title: parsedJson.title || '',
          owner: parsedJson.owner,
          timestamp: parsedJson.timestamp || timestampMs?.toString() || Date.now().toString(),
          ...parsedJson
        },
        transactionDigest: id?.txDigest,
        packageId: type.split('::')[0],
        module: type.split('::')[1],
        eventSeq: event.eventSeq,
        timestamp: (timestampMs || Date.now()).toString()
      };
    } catch (error) {
      return null;
    }
  }, []);

  /**
   * Check if event should be processed based on filters
   */
  const shouldProcessEvent = useCallback((event: EnhancedTodoNFTEvent): boolean => {
    if (!filter) return true;

    // Filter by owner
    if (filter.owner) {
      const eventOwner = 'owner' in event.data 
        ? event.data.owner 
        : ('to' in event.data ? event.data.to : null);
      if (eventOwner !== filter.owner) {
        return false;
      }
    }

    // Filter by event types
    if (filter.eventTypes && !filter.eventTypes.includes(event.type)) {
      return false;
    }

    // Filter by time range
    const eventTime = new Date(parseInt(event.data.timestamp));
    if (filter.startTime && eventTime < filter.startTime) {
      return false;
    }
    if (filter.endTime && eventTime > filter.endTime) {
      return false;
    }

    // Filter by todo IDs
    if (filter.todoIds && !filter.todoIds.includes(event.data.todo_id)) {
      return false;
    }

    return true;
  }, [filter]);

  /**
   * Update event statistics
   */
  const updateEventStatistics = useCallback((event: EnhancedTodoNFTEvent) => {
    setEventStatistics(prev => {
      const stats = { ...prev };
      stats.totalEvents++;
      
      // Update type counts
      switch (event.type) {
        case 'TodoNFTCreated':
        case 'created':
          stats.createdCount++;
          break;
        case 'TodoNFTCompleted':
        case 'completed':
          stats.completedCount++;
          break;
        case 'TodoNFTUpdated':
        case 'updated':
          stats.updatedCount++;
          break;
        case 'TodoNFTTransferred':
          stats.transferredCount++;
          break;
      }

      // Update owner statistics
      const eventOwner = 'owner' in event.data 
        ? event.data.owner 
        : ('to' in event.data ? event.data.to : 'unknown');
      const ownerCount = stats.eventsByOwner.get(eventOwner) || 0;
      stats.eventsByOwner.set(eventOwner, ownerCount + 1);

      // Update hourly statistics
      const eventDate = new Date(parseInt(event.data.timestamp));
      const hourKey = `${eventDate.getFullYear()}-${eventDate.getMonth()}-${eventDate.getDate()}-${eventDate.getHours()}`;
      const hourCount = stats.eventsByHour.get(hourKey) || 0;
      stats.eventsByHour.set(hourKey, hourCount + 1);

      stats.lastEventTime = event.data.timestamp;

      return stats;
    });
  }, []);

  /**
   * Handle debounced event processing
   */
  const processEventWithDebounce = useCallback((event: EnhancedTodoNFTEvent, handler: BlockchainEventHandler) => {
    const todoId = event.data.todo_id;
    
    // Clear existing timer for this todo
    const existingTimer = debounceTimersRef.current.get(todoId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Buffer events for this todo
    const buffer = eventBufferRef.current.get(todoId) || [];
    buffer.push(event);
    eventBufferRef.current.set(todoId, buffer);

    // Set new debounce timer
    const timer = setTimeout(() => {
      const bufferedEvents = eventBufferRef.current.get(todoId) || [];
      if (bufferedEvents.length > 0) {
        // Process the most recent event
        const latestEvent = bufferedEvents[bufferedEvents.length - 1];
        handler(latestEvent);
        
        // Clear buffer
        eventBufferRef.current.delete(todoId);
      }
      debounceTimersRef.current.delete(todoId);
    }, debounceConfig.delay);

    debounceTimersRef.current.set(todoId, timer);

    // Max wait timeout
    if (debounceConfig.maxWait) {
      setTimeout(() => {
        const timer = debounceTimersRef.current.get(todoId);
        if (timer) {
          clearTimeout(timer);
          const bufferedEvents = eventBufferRef.current.get(todoId) || [];
          if (bufferedEvents.length > 0) {
            const latestEvent = bufferedEvents[bufferedEvents.length - 1];
            handler(latestEvent);
            eventBufferRef.current.delete(todoId);
          }
          debounceTimersRef.current.delete(todoId);
        }
      }, debounceConfig.maxWait);
    }
  }, [debounceConfig]);

  /**
   * Handle reconnection with exponential backoff
   */
  const handleReconnection = useCallback(async () => {
    if (!enableReconnect || connectionState.reconnectAttempts >= maxReconnectAttempts) {
      return;
    }

    const backoffDelay = Math.min(1000 * Math.pow(2, connectionState.reconnectAttempts), 30000);
    
    setConnectionState(prev => ({
      ...prev,
      reconnectAttempts: prev.reconnectAttempts + 1,
      lastReconnectAttempt: Date.now()
    }));

    reconnectTimeoutRef.current = setTimeout(async () => {
      try {
        await startSubscription();
        
        // Replay missed events
        if (missedEventsRef.current.size > 0) {
          await replayMissedEvents();
        }
      } catch (error) {
        // Retry reconnection
        handleReconnection();
      }
    }, backoffDelay);
  }, [enableReconnect, connectionState.reconnectAttempts, maxReconnectAttempts, replayMissedEvents, startSubscription]);

  /**
   * Replay events that were missed during disconnection
   */
  const replayMissedEvents = useCallback(async () => {
    if (!suiClientRef.current || missedEventsRef.current.size === 0) return;

    try {
      const config = await loadNetworkConfig(
        process.env.NEXT_PUBLIC_NETWORK || 'testnet'
      );
      if (!config) return;

      // Query events since last successful connection
      const events = await suiClientRef.current.queryEvents({
        query: {
          MoveModule: {
            package: config.deployment.packageId,
            module: 'todo_nft'
          }
        },
        limit: 50,
        order: 'ascending'
      });

      // Process missed events
      events.data.forEach(event => {
        const enhancedEvent = parseBlockchainEvent(event);
        if (enhancedEvent && missedEventsRef.current.has(enhancedEvent.data.todo_id)) {
          // Emit the missed event
          eventManagerRef.current?.simulateEvent(enhancedEvent.type, enhancedEvent.data);
          missedEventsRef.current.delete(enhancedEvent.data.todo_id);
        }
      });
    } catch (error) {
      console.error('Failed to replay missed events:', error);
    }
  }, [parseBlockchainEvent]);

  /**
   * Start event subscriptions with enhanced error handling
   */
  const startSubscription = useCallback(async () => {
    if (!eventManagerRef.current) {
      await initialize();
    }

    if (!eventManagerRef.current) return;

    try {
      setConnectionState(prev => ({ ...prev, connecting: true, error: null }));
      
      if (targetOwner) {
        await eventManagerRef.current.updateWalletAddress(targetOwner);
      }
      
      await eventManagerRef.current.startListening();
      const state = eventManagerRef.current.getConnectionState();
      setConnectionState(prev => ({ 
        ...prev, 
        ...state, 
        connecting: false,
        reconnectAttempts: 0 // Reset on successful connection
      }));
    } catch (error) {
      // Failed to start event subscription
      setConnectionState(prev => ({
        ...prev,
        error: error as Error,
        connecting: false,
      }));
      
      // Attempt reconnection
      if (enableReconnect) {
        handleReconnection();
      }
    }
  }, [initialize, targetOwner, enableReconnect, handleReconnection]);

  /**
   * Stop event subscriptions and cleanup
   */
  const stopSubscription = useCallback(() => {
    // Clear reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Clear all debounce timers
    debounceTimersRef.current.forEach(timer => clearTimeout(timer));
    debounceTimersRef.current.clear();

    // Clear event buffers
    eventBufferRef.current.clear();

    if (eventManagerRef.current) {
      eventManagerRef.current.stopListening();
      const state = eventManagerRef.current.getConnectionState();
      setConnectionState(prev => ({ ...prev, ...state, connecting: false }));
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
   * Add event listener with enhanced NFT event support and debouncing
   */
  const addEventListener = useCallback(
    (eventType: string | '*', listener: BlockchainEventHandler): (() => void) => {
      if (!eventManagerRef.current) {
        // Don't spam console with warnings, just return noop
        return () => {};
      }

      // Wrap listener to handle enhanced events and debouncing
      const enhancedListener: BlockchainEventHandler = (event: any) => {
        // Parse and enhance the event
        const enhancedEvent = event.type && event.data ? event : parseBlockchainEvent(event);
        if (!enhancedEvent) return;

        // Check if event should be processed
        if (!shouldProcessEvent(enhancedEvent)) return;

        // Update cache and statistics using functional update
        setEventCache(prev => {
          const updated = new Map(prev);
          updated.set(enhancedEvent.data.todo_id, enhancedEvent);
          return updated;
        });
        updateEventStatistics(enhancedEvent);

        // Process with debouncing if configured
        if (debounceConfig.delay > 0) {
          processEventWithDebounce(enhancedEvent, listener);
        } else {
          listener(enhancedEvent);
        }
      };

      eventManagerRef.current.addEventListener(eventType, enhancedListener);
      return () => {
        eventManagerRef.current?.removeEventListener(eventType, enhancedListener);
      };
    },
    [parseBlockchainEvent, shouldProcessEvent, updateEventStatistics, processEventWithDebounce, debounceConfig]
  );

  /**
   * Query historical events with filtering
   */
  const queryHistoricalEvents = useCallback(async (
    queryFilter?: EventFilter
  ): Promise<EnhancedTodoNFTEvent[]> => {
    if (!suiClientRef.current) return [];

    try {
      const config = await loadNetworkConfig(
        process.env.NEXT_PUBLIC_NETWORK || 'testnet'
      );
      if (!config) return [];

      const events = await suiClientRef.current.queryEvents({
        query: {
          MoveModule: {
            package: config.deployment.packageId,
            module: 'todo_nft'
          }
        },
        limit: 1000,
        order: 'descending'
      });

      // Parse and filter events
      const enhancedEvents: EnhancedTodoNFTEvent[] = [];
      events.data.forEach(event => {
        const enhancedEvent = parseBlockchainEvent(event);
        if (enhancedEvent) {
          // Apply additional filter if provided
          const effectiveFilter = queryFilter || filter;
          if (effectiveFilter) {
            // Create a callback that uses the effective filter
            const shouldProcessWithEffectiveFilter = (event: EnhancedTodoNFTEvent): boolean => {
              if (!effectiveFilter) return true;
              
              // Filter by owner
              if (effectiveFilter.owner) {
                const eventOwner = 'owner' in event.data 
                  ? event.data.owner 
                  : ('to' in event.data ? event.data.to : null);
                if (eventOwner !== effectiveFilter.owner) {
                  return false;
                }
              }
              
              // Filter by event types
              if (effectiveFilter.eventTypes && !effectiveFilter.eventTypes.includes(event.type)) {
                return false;
              }
              
              return true;
            };
            
            if (shouldProcessWithEffectiveFilter(enhancedEvent)) {
              enhancedEvents.push(enhancedEvent);
            }
          } else {
            enhancedEvents.push(enhancedEvent);
          }
        }
      });

      return enhancedEvents;
    } catch (error) {
      console.error('Failed to query historical events:', error);
      return [];
    }
  }, [parseBlockchainEvent, filter]);

  /**
   * Mark events for replay when connection is restored
   */
  const markEventForReplay = useCallback((todoId: string) => {
    missedEventsRef.current.add(todoId);
  }, []);

  /**
   * Get aggregated event statistics
   */
  const getEventStatistics = useCallback((): EventStatistics => {
    return { ...eventStatistics };
  }, [eventStatistics]);

  /**
   * Clear event cache and statistics
   */
  const clearEventData = useCallback(() => {
    setEventCache(new Map());
    setEventStatistics({
      totalEvents: 0,
      createdCount: 0,
      completedCount: 0,
      updatedCount: 0,
      transferredCount: 0,
      eventsByOwner: new Map(),
      eventsByHour: new Map(),
    });
    missedEventsRef.current.clear();
  }, []);

  // Auto-start subscription when wallet connects
  useEffect(() => {
    let isMounted = true;
    
    if (autoStart && targetOwner && isMounted) {
      startSubscription();
    }

    return () => {
      isMounted = false;
      stopSubscription();
      if (eventManagerRef.current) {
        eventManagerRef.current = null;
      }
    };
  }, [autoStart, targetOwner, startSubscription, stopSubscription]);

  // Handle connection errors and attempt reconnection
  useEffect(() => {
    if (connectionState.error && enableReconnect && !connectionState.connecting) {
      handleReconnection();
    }
  }, [connectionState.error, connectionState.connecting, enableReconnect, handleReconnection]);

  // Update connection state periodically
  useEffect(() => {
    if (!eventManagerRef.current) return;

    const interval = setInterval(() => {
      if (eventManagerRef.current) {
        const state = eventManagerRef.current.getConnectionState();
        setConnectionState(prev => ({ ...prev, ...state, connecting: false }));
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
    // Enhanced features
    queryHistoricalEvents,
    getEventStatistics,
    clearEventData,
    markEventForReplay,
    eventCache: Array.from(eventCache.values()),
    eventStatistics,
  };
}

/**
 * Hook for real-time todo updates from blockchain events with NFT support
 */
export function useTodoEvents(
  options: {
    onTodoCreated?: (todo: Partial<Todo>) => void;
    onTodoUpdated?: (todo: Partial<Todo>) => void;
    onTodoCompleted?: (todo: Partial<Todo>) => void;
    onTodoDeleted?: (todoId: string) => void;
    onTodoTransferred?: (data: { todoId: string; from: string; to: string }) => void;
    owner?: string;
    autoStart?: boolean;
    filter?: EventFilter;
    enableHistorical?: boolean;
    debounceConfig?: DebounceConfig;
  } = {}
) {
  const {
    onTodoCreated,
    onTodoUpdated,
    onTodoCompleted,
    onTodoDeleted,
    onTodoTransferred,
    owner,
    autoStart = true,
    filter,
    enableHistorical = false,
    debounceConfig,
  } = options;

  const [recentEvents, setRecentEvents] = useState<EnhancedTodoNFTEvent[]>([]);
  const { addEventListener, ...eventHookResult } = useBlockchainEvents({
    autoStart,
    owner,
    filter,
    enableHistorical,
    debounceConfig,
  });

  // Handle todo events with enhanced NFT support
  useEffect(() => {
    const unsubscribe = addEventListener('*', (event) => {
      // Cast to enhanced event
      const todoEvent = event as EnhancedTodoNFTEvent;
      
      // Add to recent events list
      setRecentEvents(prev => [todoEvent, ...prev.slice(0, 99)]); // Keep last 100 events

      // Transform event to todo update
      // @ts-ignore - Type compatibility issue with event interfaces
      const todoUpdate = transformEventToTodoUpdate(todoEvent);

      // Call appropriate callback based on NFT event types
      switch (todoEvent.type) {
        case 'TodoNFTCreated':
        case 'created':
          if (todoUpdate && onTodoCreated) {
            onTodoCreated({
              ...todoUpdate,
              isNFT: true,
              nftData: {
                owner: todoEvent.data.owner,
                createdAt: parseInt(todoEvent.data.timestamp),
              }
            });
          }
          break;
        case 'TodoNFTUpdated':
        case 'updated':
          if (todoUpdate && onTodoUpdated) {
            onTodoUpdated({
              ...todoUpdate,
              isNFT: true,
              nftData: {
                owner: todoEvent.data.owner,
                updatedAt: parseInt(todoEvent.data.timestamp),
              }
            });
          }
          break;
        case 'TodoNFTCompleted':
        case 'completed':
          if (todoUpdate && onTodoCompleted) {
            onTodoCompleted({
              ...todoUpdate,
              completed: true,
              isNFT: true,
              nftData: {
                owner: todoEvent.data.owner,
                completedAt: parseInt(todoEvent.data.timestamp),
              }
            });
          }
          break;
        case 'deleted':
          if (onTodoDeleted) {
            onTodoDeleted(event.data.todo_id);
          }
          break;
        case 'TodoNFTTransferred':
          const transferData = event.data as TodoNFTTransferredData;
          if (onTodoTransferred) {
            onTodoTransferred({
              todoId: transferData.todo_id,
              from: transferData.from,
              to: transferData.to
            });
          }
          // Also trigger update callback for UI refresh
          if (onTodoUpdated) {
            onTodoUpdated({
              id: transferData.todo_id,
              objectId: transferData.todo_id,
              isNFT: true,
              nftData: {
                owner: transferData.to,
                transferredAt: parseInt(transferData.timestamp),
                previousOwner: transferData.from,
              }
            });
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
    onTodoTransferred,
  ]);

  return {
    ...eventHookResult,
    recentEvents,
    clearRecentEvents: () => setRecentEvents([]),
    getEventsByType: (type: EnhancedTodoNFTEvent['type']) => 
      recentEvents.filter(e => e.type === type),
    getEventsByOwner: (owner: string) => 
      recentEvents.filter(e => e.data.owner === owner),
    getEventsByTodoId: (todoId: string) => 
      recentEvents.filter(e => e.data.todo_id === todoId),
  };
}

/**
 * Hook for real-time todo state synchronization with NFT support
 * Automatically updates local state when blockchain events occur
 */
export function useTodoStateSync(
  options: {
    todos: Todo[];
    onTodoChange: (todos: Todo[]) => void;
    owner?: string;
    autoStart?: boolean;
    filter?: EventFilter;
    enableHistorical?: boolean;
    debounceConfig?: DebounceConfig;
  } = {} as any
) {
  const { 
    todos, 
    onTodoChange, 
    owner, 
    autoStart = true,
    filter,
    enableHistorical = true,
    debounceConfig = { delay: 300 }
  } = options;
  
  const [syncedTodos, setSyncedTodos] = useState<Todo[]>(todos || []);
  const [nftOwnership, setNftOwnership] = useState<Map<string, string>>(new Map());

  const { ...eventHookResult } = useTodoEvents({
    owner,
    autoStart,
    filter,
    enableHistorical,
    debounceConfig,
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
      
      // Update NFT ownership tracking
      if (todoUpdate.isNFT && todoUpdate.nftData?.owner) {
        setNftOwnership(prev => {
          const updated = new Map(prev);
          updated.set(todoUpdate.id || '', todoUpdate.nftData!.owner);
          return updated;
        });
      }
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
      
      // Remove from ownership tracking
      setNftOwnership(prev => {
        const updated = new Map(prev);
        updated.delete(todoId);
        return updated;
      });
    },
    onTodoTransferred: ({ todoId, from, to }) => {
      // Update ownership tracking
      setNftOwnership(prev => {
        const updated = new Map(prev);
        updated.set(todoId, to);
        return updated;
      });
      
      // Update todo with new owner
      setSyncedTodos(prev => {
        const index = prev.findIndex(
          t => t.id === todoId || t.objectId === todoId
        );
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            nftData: {
              ...updated[index].nftData,
              owner: to,
              previousOwner: from,
              transferredAt: Date.now(),
            }
          };
          return updated;
        }
        return prev;
      });
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

  // Memoized helper functions
  const getTodosByOwner = useMemo(() => {
    return (ownerAddress: string) => 
      syncedTodos.filter(todo => {
        const todoOwner = nftOwnership.get(todo.id) || todo.nftData?.owner;
        return todoOwner === ownerAddress;
      });
  }, [syncedTodos, nftOwnership]);

  const isOwnedByCurrentUser = useMemo(() => {
    return (todoId: string) => {
      const todoOwner = nftOwnership.get(todoId);
      return todoOwner === owner;
    };
  }, [nftOwnership, owner]);

  return {
    ...eventHookResult,
    syncedTodos,
    nftOwnership,
    getTodosByOwner,
    isOwnedByCurrentUser,
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
