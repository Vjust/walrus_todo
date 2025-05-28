import { Request, Response } from 'express';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      wallet?: string;
      user?: {
        id: string;
        wallet: string;
      };
    }
  }
}

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
  content: string;
  completed: boolean;
  priority?: 'high' | 'medium' | 'low';
  category?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  wallet: string;
  blockchain?: {
    objectId?: string;
    transactionHash?: string;
    walrusUrl?: string;
  };
}

export interface CreateTodoRequest {
  content: string;
  priority?: 'high' | 'medium' | 'low';
  category?: string;
  tags?: string[];
}

export interface UpdateTodoRequest {
  content?: string;
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