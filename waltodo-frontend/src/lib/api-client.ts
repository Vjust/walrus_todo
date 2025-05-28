import { Todo, TodoList } from '../types/todo';

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

export class TodoAPIClient {
  private baseURL: string;
  private apiKey?: string;

  constructor() {
    this.baseURL =
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    this.apiKey = process.env.NEXT_PUBLIC_API_KEY;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  // Todo operations
  async getTodos(listName: string = 'default'): Promise<Todo[]> {
    return this.request<Todo[]>(`/v1/todos?list=${listName}`);
  }

  async getTodo(id: string): Promise<Todo> {
    return this.request<Todo>(`/v1/todos/${id}`);
  }

  async createTodo(
    todo: Partial<Todo>,
    listName: string = 'default'
  ): Promise<Todo> {
    return this.request<Todo>('/v1/todos', {
      method: 'POST',
      body: JSON.stringify({ ...todo, listName }),
    });
  }

  async updateTodo(id: string, updates: Partial<Todo>): Promise<Todo> {
    return this.request<Todo>(`/v1/todos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteTodo(id: string): Promise<void> {
    await this.request<void>(`/v1/todos/${id}`, {
      method: 'DELETE',
    });
  }

  async completeTodo(id: string): Promise<Todo> {
    return this.request<Todo>(`/v1/todos/${id}/complete`, {
      method: 'POST',
    });
  }

  // List operations
  async getLists(): Promise<string[]> {
    return this.request<string[]>('/lists');
  }

  async createList(name: string): Promise<TodoList> {
    return this.request<TodoList>('/lists', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async deleteList(name: string): Promise<void> {
    await this.request<void>(`/lists/${name}`, {
      method: 'DELETE',
    });
  }

  // AI operations
  async suggestTasks(context: {
    existingTodos: Todo[];
    preferences?: any;
  }): Promise<AIResponse> {
    return this.request<AIResponse>('/ai/suggest', {
      method: 'POST',
      body: JSON.stringify(context),
    });
  }

  async summarizeTodos(todos: Todo[]): Promise<AIResponse> {
    return this.request<AIResponse>('/ai/summarize', {
      method: 'POST',
      body: JSON.stringify({ todos }),
    });
  }

  async categorizeTodos(todos: Todo[]): Promise<AIResponse> {
    return this.request<AIResponse>('/ai/categorize', {
      method: 'POST',
      body: JSON.stringify({ todos }),
    });
  }

  async prioritizeTodos(todos: Todo[]): Promise<AIResponse> {
    return this.request<AIResponse>('/ai/prioritize', {
      method: 'POST',
      body: JSON.stringify({ todos }),
    });
  }

  // Sync operations
  async syncTodoToWalrus(todoId: string): Promise<{ blobId: string }> {
    return this.request<{ blobId: string }>(`/sync/todos/${todoId}/walrus`, {
      method: 'POST',
    });
  }

  async syncTodoToBlockchain(todoId: string): Promise<{ nftObjectId: string }> {
    return this.request<{ nftObjectId: string }>(
      `/sync/todos/${todoId}/blockchain`,
      {
        method: 'POST',
      }
    );
  }

  async syncListToWalrus(listName: string): Promise<{ blobId: string }> {
    return this.request<{ blobId: string }>(`/sync/lists/${listName}/walrus`, {
      method: 'POST',
    });
  }

  async retrieveFromWalrus(blobId: string): Promise<Todo> {
    return this.request<Todo>(`/sync/walrus/${blobId}`);
  }

  async getSyncStatus(todoId: string): Promise<SyncStatus> {
    return this.request<SyncStatus>(`/sync/status/${todoId}`);
  }

  async batchSync(todoIds: string[]): Promise<Record<string, string>> {
    return this.request<Record<string, string>>('/sync/batch', {
      method: 'POST',
      body: JSON.stringify({ todoIds }),
    });
  }

  // Health check
  async healthCheck(): Promise<{ status: string; version: string }> {
    return this.request<{ status: string; version: string }>('/healthz');
  }
}

// Export singleton instance
export const apiClient = new TodoAPIClient();
