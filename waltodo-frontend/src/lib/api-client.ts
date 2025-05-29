import { Todo, TodoList, adaptSharedTodo } from '../types/todo';
import { 
  ApiResponse,
  ApiError,
  CreateTodoInput,
  UpdateTodoInput,
  Todo as SharedTodo,
  AISuggestResponse,
  AIEnhanceResponse
} from '@waltodo/shared-types';

export interface SyncStatus {
  todoId: string;
  walrusBlobId?: string;
  nftObjectId?: string;
  lastSynced?: Date;
  syncStatus: 'pending' | 'synced' | 'failed';
  error?: string;
}

export interface AIResponse {
  result: any;
  verified?: boolean;
  proof?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  wallet: string;
  expiresIn: number;
}

export interface AuthVerifyResponse {
  valid: boolean;
  wallet: string;
  expiresAt: string | null;
}

export class TodoAPIClient {
  private baseURL: string;
  private apiKey?: string;
  private accessToken?: string;
  private walletAddress?: string;

  constructor() {
    this.baseURL =
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    this.apiKey = process.env.NEXT_PUBLIC_API_KEY;
    
    // Try to load access token from localStorage
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('walrus_access_token') || undefined;
    }
  }

  setAccessToken(token: string | null): void {
    if (token) {
      this.accessToken = token;
      if (typeof window !== 'undefined') {
        localStorage.setItem('walrus_access_token', token);
      }
    } else {
      this.accessToken = undefined;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('walrus_access_token');
      }
    }
  }

  setWalletAddress(address: string | null): void {
    this.walletAddress = address || undefined;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    // Add authentication headers
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    } else if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    // Always include wallet address if available
    if (this.walletAddress) {
      headers['X-Wallet-Address'] = this.walletAddress;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: response.statusText }));
      
      // Handle 401 Unauthorized specially
      if (response.status === 401) {
        // Clear tokens on auth failure
        this.setAccessToken(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('walrus_refresh_token');
          // Dispatch custom event for global handling
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        }
      }
      
      throw new Error(error.message || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  // Todo operations
  async getTodos(listName: string = 'default'): Promise<Todo[]> {
    const response = await this.request<SharedTodo[]>(`/api/v1/todos?list=${listName}`);
    // Convert shared todos to frontend todos
    return response.map(sharedTodo => adaptSharedTodo(sharedTodo));
  }

  async getTodo(id: string): Promise<Todo> {
    const response = await this.request<SharedTodo>(`/api/v1/todos/${id}`);
    // Convert shared todo to frontend todo
    return adaptSharedTodo(response);
  }

  async createTodo(
    todo: Partial<Todo>,
    listName: string = 'default'
  ): Promise<Todo> {
    // Convert frontend todo to shared format
    const createInput: CreateTodoInput = {
      title: todo.title || '',
      description: todo.description || '',
      priority: todo.priority,
      tags: todo.tags,
      dueDate: todo.dueDate,
    };
    
    const response = await this.request<SharedTodo>('/api/v1/todos', {
      method: 'POST',
      body: JSON.stringify({ ...createInput, listName }),
    });
    
    // Convert response back to frontend format
    return adaptSharedTodo(response);
  }

  async updateTodo(id: string, updates: Partial<Todo>): Promise<Todo> {
    // Convert frontend updates to shared format
    const updateInput: UpdateTodoInput = {
      title: updates.title,
      description: updates.description,
      completed: updates.completed,
      priority: updates.priority,
      tags: updates.tags,
      dueDate: updates.dueDate,
    };
    
    const response = await this.request<SharedTodo>(`/api/v1/todos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateInput),
    });
    
    // Convert response back to frontend format
    return adaptSharedTodo(response);
  }

  async deleteTodo(id: string): Promise<void> {
    await this.request<void>(`/api/v1/todos/${id}`, {
      method: 'DELETE',
    });
  }

  async completeTodo(id: string): Promise<Todo> {
    const response = await this.request<SharedTodo>(`/api/v1/todos/${id}/complete`, {
      method: 'POST',
    });
    // Convert shared todo to frontend todo
    return adaptSharedTodo(response);
  }

  // List operations
  async getAllLists(): Promise<string[]> {
    return this.request<string[]>('/api/lists');
  }

  async createList(name: string): Promise<TodoList> {
    return this.request<TodoList>('/api/lists', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async deleteList(name: string): Promise<void> {
    await this.request<void>(`/api/lists/${name}`, {
      method: 'DELETE',
    });
  }

  // AI operations
  async suggestTasks(context: {
    existingTodos: Todo[];
    preferences?: any;
  }): Promise<AIResponse> {
    return this.request<AIResponse>('/api/ai/suggest', {
      method: 'POST',
      body: JSON.stringify(context),
    });
  }

  async summarizeTodos(todos: Todo[]): Promise<AIResponse> {
    return this.request<AIResponse>('/api/ai/summarize', {
      method: 'POST',
      body: JSON.stringify({ todos }),
    });
  }

  async categorizeTodos(todos: Todo[]): Promise<AIResponse> {
    return this.request<AIResponse>('/api/ai/categorize', {
      method: 'POST',
      body: JSON.stringify({ todos }),
    });
  }

  async prioritizeTodos(todos: Todo[]): Promise<AIResponse> {
    return this.request<AIResponse>('/api/ai/prioritize', {
      method: 'POST',
      body: JSON.stringify({ todos }),
    });
  }

  // Sync operations
  async syncTodoToWalrus(todoId: string): Promise<{ blobId: string }> {
    return this.request<{ blobId: string }>(`/api/sync/todos/${todoId}/walrus`, {
      method: 'POST',
    });
  }

  async syncTodoToBlockchain(todoId: string): Promise<{ nftObjectId: string }> {
    return this.request<{ nftObjectId: string }>(
      `/api/sync/todos/${todoId}/blockchain`,
      {
        method: 'POST',
      }
    );
  }

  async syncListToWalrus(listName: string): Promise<{ blobId: string }> {
    return this.request<{ blobId: string }>(`/api/sync/lists/${listName}/walrus`, {
      method: 'POST',
    });
  }

  async retrieveFromWalrus(blobId: string): Promise<Todo> {
    const response = await this.request<SharedTodo>(`/api/sync/walrus/${blobId}`);
    // Convert shared todo to frontend todo
    return adaptSharedTodo(response);
  }

  async getSyncStatus(todoId: string): Promise<SyncStatus> {
    return this.request<SyncStatus>(`/api/sync/status/${todoId}`);
  }

  async batchSync(todoIds: string[]): Promise<Record<string, string>> {
    return this.request<Record<string, string>>('/api/sync/batch', {
      method: 'POST',
      body: JSON.stringify({ todoIds }),
    });
  }

  // Health check
  async healthCheck(): Promise<{ status: string; version: string }> {
    return this.request<{ status: string; version: string }>('/api/healthz');
  }

  // Authentication operations
  async login(wallet: string, signature: string, message: string): Promise<AuthResponse> {
    const response = await this.request<{ success: boolean; data: AuthResponse }>(
      '/api/v1/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ wallet, signature, message }),
      }
    );
    
    if (response.success && response.data) {
      // Automatically set the access token
      this.setAccessToken(response.data.accessToken);
      
      // Store refresh token separately
      if (typeof window !== 'undefined') {
        localStorage.setItem('walrus_refresh_token', response.data.refreshToken);
      }
      
      return response.data;
    }
    
    throw new Error('Login failed');
  }

  async verify(): Promise<AuthVerifyResponse> {
    const response = await this.request<{ success: boolean; data: AuthVerifyResponse }>(
      '/api/v1/auth/verify',
      {
        method: 'POST',
      }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error('Token verification failed');
  }

  async refresh(): Promise<AuthResponse> {
    const refreshToken = typeof window !== 'undefined' 
      ? localStorage.getItem('walrus_refresh_token') 
      : null;
      
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.request<{ success: boolean; data: AuthResponse }>(
      '/api/v1/auth/refresh',
      {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }
    );
    
    if (response.success && response.data) {
      // Update tokens
      this.setAccessToken(response.data.accessToken);
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('walrus_refresh_token', response.data.refreshToken);
      }
      
      return response.data;
    }
    
    throw new Error('Token refresh failed');
  }

  async logout(): Promise<void> {
    try {
      await this.request<{ success: boolean }>('/api/v1/auth/logout', {
        method: 'POST',
      });
    } finally {
      // Clear tokens and wallet address regardless of API response
      this.setAccessToken(null);
      this.setWalletAddress(null);
      
      if (typeof window !== 'undefined') {
        localStorage.removeItem('walrus_refresh_token');
      }
    }
  }
}

// Export singleton instance
export const apiClient = new TodoAPIClient();
