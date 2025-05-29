// Import our enhanced Express types
import './express';
import {
  Request,
  Response,
  NextFunction,
  RequestHandler,
  ErrorRequestHandler,
} from './express';

// Re-export the enhanced Express types
export type {
  Request,
  Response,
  NextFunction,
  RequestHandler,
  ErrorRequestHandler,
};

export interface AuthenticatedRequest extends Request {
  wallet?: string;
  user?: {
    id: string;
    wallet: string;
  };
}

export interface Todo {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  priority?: 'high' | 'medium' | 'low';
  category?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  wallet: string;
  listName?: string;
  blockchain?: {
    objectId?: string;
    transactionHash?: string;
    walrusUrl?: string;
  };
}

export interface CreateTodoRequest {
  description: string;
  priority?: 'high' | 'medium' | 'low';
  category?: string;
  tags?: string[];
  listName?: string;
}

export interface UpdateTodoRequest {
  description?: string;
  completed?: boolean;
  priority?: 'high' | 'medium' | 'low';
  category?: string;
  tags?: string[];
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
  wallet?: string;
}

export interface TodoListResponse {
  data: Todo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
}

export interface WebSocketEvents {
  TODO_CREATED: Todo;
  TODO_UPDATED: Todo;
  TODO_DELETED: { id: string; wallet: string };
  TODO_COMPLETED: Todo;
  SYNC_REQUESTED: { wallet: string };
  ERROR: { message: string; code?: string };
  LIST_CREATED: TodoListInfo;
  LIST_DELETED: { name: string; wallet: string };
}

export interface BatchOperation {
  action: 'create' | 'update' | 'delete' | 'complete';
  id?: string;
  data?: CreateTodoRequest | UpdateTodoRequest;
}

export interface BatchResponse {
  results: Array<{
    success: boolean;
    data?: any;
    error?: string;
    operation?: BatchOperation;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

// AI-related types
export interface AISuggestionRequest {
  wallet: string;
  context?: string;
  limit?: number;
}

export interface AISuggestion {
  id: string;
  title: string;
  description: string;
  priority?: 'high' | 'medium' | 'low';
  category?: string;
  tags?: string[];
  reasoning?: string;
}

export interface AISuggestionsResponse {
  suggestions: AISuggestion[];
  context?: string;
}

export interface AISummarizeRequest {
  wallet: string;
  timeframe?: 'day' | 'week' | 'month' | 'all';
  includeCompleted?: boolean;
}

export interface AISummaryResponse {
  summary: string;
  stats: {
    total: number;
    completed: number;
    pending: number;
    overdue: number;
  };
  insights?: string[];
}

export interface AICategorizeRequest {
  wallet: string;
  todoIds?: string[];
}

export interface AICategoryMapping {
  todoId: string;
  suggestedCategory: string;
  suggestedTags: string[];
  confidence: number;
}

export interface AICategorizeResponse {
  mappings: AICategoryMapping[];
  newCategories?: string[];
  newTags?: string[];
}

export interface AIPrioritizeRequest {
  wallet: string;
  considerDeadlines?: boolean;
  considerDependencies?: boolean;
}

export interface AIPriorityMapping {
  todoId: string;
  currentPriority?: 'high' | 'medium' | 'low';
  suggestedPriority: 'high' | 'medium' | 'low';
  reasoning: string;
  score: number;
}

export interface AIPrioritizeResponse {
  priorities: AIPriorityMapping[];
  topPriorities: string[];
}

export interface AIAnalyzeRequest {
  wallet: string;
  timeframe?: 'day' | 'week' | 'month' | 'all';
}

export interface AIProductivityInsight {
  type: 'pattern' | 'suggestion' | 'achievement';
  title: string;
  description: string;
  impact?: 'positive' | 'negative' | 'neutral';
}

export interface AIAnalyzeResponse {
  productivityScore: number;
  insights: AIProductivityInsight[];
  patterns: {
    mostProductiveTime?: string;
    completionRate: number;
    averageCompletionTime?: number;
    topCategories: string[];
  };
  recommendations: string[];
}

// Sync types
export interface SyncStatus {
  todoId: string;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  walrus?: {
    synced: boolean;
    blobId?: string;
    url?: string;
    syncedAt?: string;
    error?: string;
  };
  blockchain?: {
    synced: boolean;
    objectId?: string;
    transactionHash?: string;
    syncedAt?: string;
    error?: string;
  };
  lastAttempt?: string;
  retryCount?: number;
}

export interface SyncRequest {
  todoId: string;
  targets: Array<'walrus' | 'blockchain'>;
  priority?: 'high' | 'normal' | 'low';
}

export interface BatchSyncRequest {
  operations: SyncRequest[];
  waitForCompletion?: boolean;
}

export interface WalrusData {
  type: 'todo' | 'list';
  data: Todo | Todo[];
  metadata?: {
    wallet: string;
    listName?: string;
    createdAt: string;
    version: string;
  };
}

// List management types
export interface TodoListMetadata {
  name: string;
  description?: string;
  todoCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateListRequest {
  name: string;
  description?: string;
}

export interface TodoListInfo {
  name: string;
  description?: string;
  todoCount: number;
  todos?: Todo[];
  createdAt: string;
  updatedAt: string;
}
