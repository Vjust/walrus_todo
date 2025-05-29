import { Todo, CreateTodoInput, UpdateTodoInput, TodoFilters, TodoSortOptions } from './todo';

/**
 * Base API response structure
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: ApiMetadata;
}

/**
 * API error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp?: string;
}

/**
 * API metadata
 */
export interface ApiMetadata {
  timestamp: string;
  requestId?: string;
  version?: string;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

// Todo API types
export interface GetTodosRequest {
  filters?: TodoFilters;
  sort?: TodoSortOptions;
  page?: number;
  pageSize?: number;
}

export interface GetTodosResponse extends PaginatedResponse<Todo> {}

export interface GetTodoRequest {
  id: string;
}

export interface GetTodoResponse extends ApiResponse<Todo> {}

export interface CreateTodoRequest {
  todo: CreateTodoInput;
}

export interface CreateTodoResponse extends ApiResponse<Todo> {}

export interface UpdateTodoRequest {
  id: string;
  updates: UpdateTodoInput;
}

export interface UpdateTodoResponse extends ApiResponse<Todo> {}

export interface DeleteTodoRequest {
  id: string;
}

export interface DeleteTodoResponse extends ApiResponse<{ id: string }> {}

// Sync API types
export interface SyncRequest {
  lastSyncTimestamp?: string;
  localTodos?: Todo[];
}

export interface SyncResponse extends ApiResponse<{
  todos: Todo[];
  conflicts?: SyncConflict[];
  lastSyncTimestamp: string;
}> {}

export interface SyncConflict {
  todoId: string;
  localVersion: Todo;
  remoteVersion: Todo;
  resolution?: 'local' | 'remote' | 'merge';
}

// Storage API types
export interface StoreToWalrusRequest {
  todoId: string;
  epochs?: number;
}

export interface StoreToWalrusResponse extends ApiResponse<{
  blobId: string;
  walrusUrls: string[];
  transactionId: string;
}> {}

export interface RetrieveFromWalrusRequest {
  blobId: string;
}

export interface RetrieveFromWalrusResponse extends ApiResponse<Todo> {}

// AI API types
export interface AIEnhanceRequest {
  todoId: string;
  prompt?: string;
}

export interface AIEnhanceResponse extends ApiResponse<{
  enhancedTodo: Todo;
  suggestions: string[];
}> {}

export interface AISuggestRequest {
  context?: string;
  existingTodos?: string[];
}

export interface AISuggestResponse extends ApiResponse<{
  suggestions: Array<{
    title: string;
    description: string;
    priority?: 'low' | 'medium' | 'high';
    tags?: string[];
  }>;
}> {}

// WebSocket event types
export interface WebSocketEvent {
  type: 'todo_created' | 'todo_updated' | 'todo_deleted' | 'sync_required';
  data: any;
  timestamp: string;
}

export interface TodoCreatedEvent extends WebSocketEvent {
  type: 'todo_created';
  data: Todo;
}

export interface TodoUpdatedEvent extends WebSocketEvent {
  type: 'todo_updated';
  data: Todo;
}

export interface TodoDeletedEvent extends WebSocketEvent {
  type: 'todo_deleted';
  data: { id: string };
}

export interface SyncRequiredEvent extends WebSocketEvent {
  type: 'sync_required';
  data: { reason: string };
}