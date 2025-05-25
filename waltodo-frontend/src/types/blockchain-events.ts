/**
 * TypeScript type definitions for blockchain events
 * Comprehensive types for TodoNFT event handling
 */

// Core event data types from smart contract
export interface TodoNFTCreatedEventData {
  todo_id: string;
  title: string;
  owner: string;
  timestamp: string;
}

export interface TodoNFTCompletedEventData {
  todo_id: string;
  timestamp: string;
}

export interface TodoNFTUpdatedEventData {
  todo_id: string;
  title?: string;
  description?: string;
  timestamp: string;
}

export interface TodoNFTDeletedEventData {
  todo_id: string;
  timestamp: string;
}

export interface TodoNFTTransferredEventData {
  todo_id: string;
  from: string;
  to: string;
  timestamp: string;
}

// Union type for all event data
export type TodoNFTEventData =
  | TodoNFTCreatedEventData
  | TodoNFTCompletedEventData
  | TodoNFTUpdatedEventData
  | TodoNFTDeletedEventData
  | TodoNFTTransferredEventData;

// Typed event objects
export interface TodoNFTCreatedEvent {
  type: 'created';
  data: TodoNFTCreatedEventData;
  rawEvent: any; // Original SuiEvent
}

export interface TodoNFTCompletedEvent {
  type: 'completed';
  data: TodoNFTCompletedEventData;
  rawEvent: any;
}

export interface TodoNFTUpdatedEvent {
  type: 'updated';
  data: TodoNFTUpdatedEventData;
  rawEvent: any;
}

export interface TodoNFTDeletedEvent {
  type: 'deleted';
  data: TodoNFTDeletedEventData;
  rawEvent: any;
}

export interface TodoNFTTransferredEvent {
  type: 'transferred';
  data: TodoNFTTransferredEventData;
  rawEvent: any;
}

// Union type for all events
export type TodoNFTEvent =
  | TodoNFTCreatedEvent
  | TodoNFTCompletedEvent
  | TodoNFTUpdatedEvent
  | TodoNFTDeletedEvent
  | TodoNFTTransferredEvent;

// Event listener types
export type TodoNFTEventListener<T = TodoNFTEvent> = (event: T) => void;
export type TodoNFTEventListenerMap = {
  created: TodoNFTEventListener<TodoNFTCreatedEvent>;
  completed: TodoNFTEventListener<TodoNFTCompletedEvent>;
  updated: TodoNFTEventListener<TodoNFTUpdatedEvent>;
  deleted: TodoNFTEventListener<TodoNFTDeletedEvent>;
  transferred: TodoNFTEventListener<TodoNFTTransferredEvent>;
  '*': TodoNFTEventListener<TodoNFTEvent>;
};

// Connection state types
export interface EventConnectionState {
  connected: boolean;
  connecting: boolean;
  error: Error | null;
  lastReconnectAttempt: number;
  reconnectAttempts: number;
  subscriptionCount: number;
}

// Event subscription configuration
export interface EventSubscriptionConfig {
  packageId?: string;
  eventTypes?: TodoNFTEventType[];
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  autoReconnect?: boolean;
  owner?: string;
}

// Event type enumeration
export type TodoNFTEventType =
  | 'TodoNFTCreated'
  | 'TodoNFTCompleted'
  | 'TodoNFTUpdated'
  | 'TodoNFTDeleted'
  | 'TodoNFTTransferred';

// Event filter options
export interface EventFilterOptions {
  eventType?: TodoNFTEventType | TodoNFTEventType[];
  owner?: string;
  todoId?: string;
  fromDate?: Date;
  toDate?: Date;
}

// React hook return types
export interface UseBlockchainEventsReturn {
  connectionState: EventConnectionState;
  startSubscription: () => Promise<void>;
  stopSubscription: () => void;
  restartSubscription: () => Promise<void>;
  addEventListener: (
    eventType: keyof TodoNFTEventListenerMap,
    listener: TodoNFTEventListener
  ) => () => void;
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
}

export interface UseTodoEventsReturn extends UseBlockchainEventsReturn {
  recentEvents: TodoNFTEvent[];
  clearRecentEvents: () => void;
}

export interface UseTodoStateSyncReturn extends UseBlockchainEventsReturn {
  syncedTodos: Todo[];
}

// Notification types
export interface TodoEventNotification {
  id: string;
  message: string;
  type: TodoNFTEvent['type'];
  timestamp: number;
  todoId?: string;
  autoRemove?: boolean;
}

// Component prop types
export interface BlockchainEventStatusProps {
  className?: string;
  showReconnectButton?: boolean;
  showDetails?: boolean;
  compact?: boolean;
}

export interface RealtimeTodoListProps {
  initialTodos: Todo[];
  listName: string;
  onTodoUpdate?: (todos: Todo[]) => void;
  onTodoComplete?: (todo: Todo) => void;
  onTodoDelete?: (todoId: string) => void;
  className?: string;
  showEventIndicator?: boolean;
  owner?: string;
}

// Event manager interface
export interface IBlockchainEventManager {
  initialize(): Promise<void>;
  subscribeToEvents(owner?: string): Promise<void>;
  unsubscribeAll(): void;
  addEventListener(
    eventType: keyof TodoNFTEventListenerMap,
    listener: TodoNFTEventListener
  ): () => void;
  removeEventListener(
    eventType: keyof TodoNFTEventListenerMap,
    listener: TodoNFTEventListener
  ): void;
  getConnectionState(): EventConnectionState;
  destroy(): void;
}

// Utility types for event processing
export interface EventProcessingResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
}

export interface EventTransformOptions {
  includeRawEvent?: boolean;
  transformTimestamp?: boolean;
  validateData?: boolean;
}

// Import Todo type from existing file
import type { Todo } from '@/lib/sui-client';

// Re-export for convenience
export type { Todo };
