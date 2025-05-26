
import { Request as ExpressRequest, Response as ExpressResponse, NextFunction } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    apiKey?: string;
    userId?: string;
    body?: any;
    params?: any;
    query?: any;
    file?: {
      mimetype: string;
      size: number;
      buffer: Buffer;
      originalname: string;
      fieldname: string;
    };
  }
  
  interface Response {
    json(body?: any): this;
    status(code: number): this;
    send(body?: any): this;
  }
}

declare module 'express' {
  interface Request {
    apiKey?: string;
    userId?: string;
    body?: any;
    params?: any;
    query?: any;
    file?: {
      mimetype: string;
      size: number;
      buffer: Buffer;
      originalname: string;
      fieldname: string;
    };
  }
  
  interface Response {
    json(body?: any): this;
    status(code: number): this;
    send(body?: any): this;
  }
}

// Define API types
export interface SummarizeRequestBody {
  todos: string[];
}

export interface SummarizeResponse {
  summary: string;
  insights: string[];
}

export interface CategorizeRequestBody {
  todos: string[];
}

export interface CategorizeResponse {
  categories: Record<string, string[]>;
  uncategorized: string[];
}

export interface PrioritizeRequestBody {
  todos: string[];
}

export interface PrioritizeResponse {
  high: string[];
  medium: string[];
  low: string[];
}

export interface SuggestResponse {
  suggestions: string[];
  context: string;
}

export interface EnhanceRequestParams {
  todoId: string;
}

export interface EnhanceRequestBody {
  enhancement: string;
}

export interface EnhanceResponse {
  enhanced: boolean;
  originalTodo: string;
  enhancedTodo: string;
}

export interface ProvidersResponse {
  providers: string[];
  current: string;
}

export interface VerifyRequestBody {
  operation: string;
  data: any;
}

export interface VerifyResponse {
  verified: boolean;
  confidence: number;
  details: string;
}

export interface PullRequestBody {
  lastSync?: string;
  force?: boolean;
}

export interface PullResponse {
  data: {
    pulled: number;
    conflicts: number;
    lastSync: Date;
  };
  message: string;
}

export interface PushRequestBody {
  todoIds?: string[];
  includeAll?: boolean;
}

export interface PushResponse {
  data: {
    pushed: number;
    lastSync: Date;
  };
  message: string;
}

export interface StatusResponse {
  data: {
    lastSync: Date | null;
    pendingChanges: number;
    conflicts: number;
    status: 'synced' | 'pending' | 'conflict';
  };
}

// Conflict resolution types
export interface ResolveConflictRequestBody {
  conflictId: string;
  resolution: 'local' | 'remote' | 'merge';
  mergedData?: any;
}

export interface ResolveConflictResponse {
  data: {
    resolved: boolean;
    todoId: string;
    resolution: 'local' | 'remote' | 'merge';
    resolvedData: any;
  };
  message: string;
}

// Conflicts types
export interface ConflictsResponse {
  data: Array<{
    id: string;
    todoId: string;
    localVersion: any;
    remoteVersion: any;
    detectedAt: Date;
  }>;
  count: number;
}

// Full sync types
export interface FullSyncRequestBody {
  direction: 'pull' | 'push' | 'bidirectional';
  resolveStrategy?: 'local' | 'remote' | 'newest';
}

export interface FullSyncResponse {
  data: {
    pulled: number;
    pushed: number;
    resolved: number;
    lastSync: Date;
  };
  message: string;
}

// Todo Controller Types
export interface ListQueryParams {
  page?: string;
  limit?: string;
}

export interface ListResponse {
  data: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GetResponse {
  data: any;
}

export interface CreateResponse {
  data: any;
  message: string;
}

export interface UpdateResponse {
  data: any;
  message: string;
}

export interface DeleteResponse {
  data: any;
  message: string;
}

export interface CompleteResponse {
  data: any;
  message: string;
}

export interface StoreResponse {
  message: string;
  transactionHash: string;
  walrusUrl: string;
}

export interface RetrieveResponse {
  message: string;
  data: {
    id: string;
    content: string;
    blockchain: boolean;
  };
}

export interface BatchRequestBody {
  operations: Array<{
    action: 'create' | 'update' | 'delete' | 'complete';
    id?: string;
    data?: {
      content: string;
      priority?: 'high' | 'medium' | 'low';
      category?: string;
      tags?: string[];
    };
  }>;
}

export interface BatchResponse {
  results: Array<{
    success: boolean;
    [key: string]: any;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

// Export Express types with our custom extensions
export { Request, Response, NextFunction } from 'express';
