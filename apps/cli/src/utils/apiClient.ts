import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { EventEmitter } from 'events';
import { io, Socket } from 'socket.io-client';
import { Logger } from './Logger';
import { Todo, TodoList } from '../types/todo';
import { RetryManager } from './retry-manager';

export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  enableWebSocket?: boolean;
  websocketURL?: string;
  headers?: Record<string, string>;
}

export interface SyncResponse {
  success: boolean;
  message?: string;
  data?: any;
  timestamp: number;
}

export interface ApiSyncEvent {
  type:
    | 'todo-created'
    | 'todo-updated'
    | 'todo-deleted'
    | 'todo-completed'
    | 'sync-requested';
  data: any;
  timestamp: number;
  wallet?: string;
}

/**
 * API client for communication with the sync server
 * Handles REST API calls and WebSocket connections for real-time sync
 */
export class ApiClient extends EventEmitter {
  private logger: Logger;
  private httpClient: AxiosInstance;
  private websocket: Socket | null = null;
  private retryManager: RetryManager;
  private config: Required<ApiClientConfig>;
  private isConnected = false;
  private wallet: string | null = null;

  constructor(config: ApiClientConfig) {
    super();
    this?.logger = new Logger('ApiClient');

    this?.config = {
      baseURL: config.baseURL || 'http://localhost:3001',
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      enableWebSocket: config.enableWebSocket ?? true,
      websocketURL:
        config.websocketURL || config.baseURL || 'http://localhost:3001',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WalTodo-CLI/1?.0?.0',
        ...config.headers,
      },
    };

    this?.retryManager = new RetryManager({
      maxAttempts: this?.config?.retryAttempts,
      baseDelay: this?.config?.retryDelay,
      maxDelay: 30000,
      backoffFactor: 2,
    });

    this.setupHttpClient();

    this?.logger?.info('ApiClient initialized', {
      baseURL: this?.config?.baseURL,
      websocketEnabled: this?.config?.enableWebSocket,
    });
  }

  /**
   * Setup HTTP client with interceptors
   */
  private setupHttpClient(): void {
    this?.httpClient = axios.create({
      baseURL: this?.config?.baseURL,
      timeout: this?.config?.timeout,
      headers: this?.config?.headers,
    });

    // Request interceptor
    this?.httpClient?.interceptors.request.use(
      config => {
        const requestId = Date.now().toString();
        config?.headers?.['X-Request-ID'] = requestId;

        if (this.wallet) {
          config?.headers?.['X-Wallet-Address'] = this.wallet;
        }

        this?.logger?.debug('HTTP Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          requestId,
        });

        return config;
      },
      error => {
        this?.logger?.error('HTTP Request Error', error);
        return Promise.reject(error as any);
      }
    );

    // Response interceptor
    this?.httpClient?.interceptors.response.use(
      (response: AxiosResponse) => {
        const requestId = response.config?.headers?.['X-Request-ID'];

        this?.logger?.debug('HTTP Response', {
          status: response.status,
          requestId,
          responseTime: response?.headers?.['x-response-time'],
        });

        return response;
      },
      (error: AxiosError) => {
        const requestId = error.config?.headers?.['X-Request-ID'];

        this?.logger?.error('HTTP Response Error', {
          status: error.response?.status,
          message: error.message,
          requestId,
          url: error.config?.url,
        });

        return Promise.reject(this.normalizeError(error as any));
      }
    );
  }

  /**
   * Connect to the API server
   */
  async connect(wallet?: string): Promise<void> {
    if (wallet) {
      this?.wallet = wallet;
    }

    try {
      // Test HTTP connection
      await this.healthCheck();
      this?.isConnected = true;

      // Setup WebSocket if enabled
      if (this?.config?.enableWebSocket) {
        await this.connectWebSocket();
      }

      this.emit('connected');
      this?.logger?.info('Connected to API server', { wallet: this.wallet });
    } catch (error) {
      this?.logger?.error('Failed to connect to API server:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the API server
   */
  async disconnect(): Promise<void> {
    this?.isConnected = false;

    if (this.websocket) {
      this?.websocket?.disconnect();
      this?.websocket = null;
    }

    this.emit('disconnected');
    this?.logger?.info('Disconnected from API server');
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this?.httpClient?.get('/healthz');
      return response.data?.status === 'ok' || response?.status === 200;
    } catch (error) {
      this?.logger?.error('Health check failed:', error);
      return false;
    }
  }

  /**
   * Setup WebSocket connection for real-time events
   */
  private async connectWebSocket(): Promise<void> {
    if (this.websocket?.connected) {
      return;
    }

    return new Promise((resolve, reject) => {
      this?.websocket = io(this?.config?.websocketURL, {
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        forceNew: true,
      });

      this?.websocket?.on('connect', () => {
        this?.logger?.info('WebSocket connected');

        // Authenticate with wallet if available
        if (this.wallet) {
          this.websocket!.emit('authenticate', { wallet: this.wallet });
          this.websocket!.emit('join-wallet', { wallet: this.wallet });
        }

        resolve();
      });

      this?.websocket?.on('connect_error', error => {
        this?.logger?.error('WebSocket connection error:', error);
        reject(error as any);
      });

      this?.websocket?.on('disconnect', reason => {
        this?.logger?.warn('WebSocket disconnected:', reason);
        this.emit('websocket-disconnected', { reason });
      });

      this?.websocket?.on('reconnect', attemptNumber => {
        this?.logger?.info('WebSocket reconnected', { attempt: attemptNumber });
        this.emit('websocket-reconnected');
      });

      // API event handlers
      this.setupWebSocketEventHandlers();
    });
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocketEventHandlers(): void {
    if (!this.websocket) return;

    // Authentication events
    this?.websocket?.on('auth-success', data => {
      this?.logger?.info('WebSocket authenticated', { wallet: data.wallet });
    });

    this?.websocket?.on('auth-error', data => {
      this?.logger?.error('WebSocket authentication failed:', data.message);
    });

    // Todo events
    this?.websocket?.on('todo-created', (todo: Todo) => {
      this?.logger?.debug('Todo created event received', { id: todo.id });
      this.emit('remote-change', {
        type: 'todo-created',
        data: todo,
        timestamp: Date.now(),
      } as ApiSyncEvent);
    });

    this?.websocket?.on('todo-updated', (todo: Todo) => {
      this?.logger?.debug('Todo updated event received', { id: todo.id });
      this.emit('remote-change', {
        type: 'todo-updated',
        data: todo,
        timestamp: Date.now(),
      } as ApiSyncEvent);
    });

    this?.websocket?.on(
      'todo-deleted',
      (data: { id: string; wallet: string }) => {
        this?.logger?.debug('Todo deleted event received', { id: data.id });
        this.emit('remote-change', {
          type: 'todo-deleted',
          data,
          timestamp: Date.now(),
        } as ApiSyncEvent);
      }
    );

    this?.websocket?.on('todo-completed', (todo: Todo) => {
      this?.logger?.debug('Todo completed event received', { id: todo.id });
      this.emit('remote-change', {
        type: 'todo-completed',
        data: todo,
        timestamp: Date.now(),
      } as ApiSyncEvent);
    });

    this?.websocket?.on('sync-requested', (data: { wallet: string }) => {
      this?.logger?.debug('Sync requested event received', {
        wallet: data.wallet,
      });
      this.emit('sync-requested', data);
    });

    // Error handling
    this?.websocket?.on('error', error => {
      this?.logger?.error('WebSocket error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Send a todo to the server
   */
  async pushTodo(todo: Todo, listName: string): Promise<SyncResponse> {
    return this?.retryManager?.executeWithRetry(async () => {
      const response = await this?.httpClient?.post('/api/v1/todos', {
        ...todo,
        listName,
        wallet: this.wallet,
      });

      this?.logger?.debug('Todo pushed to server', { id: todo.id, listName });

      return {
        success: true,
        data: response.data,
        timestamp: Date.now(),
      };
    });
  }

  /**
   * Pull todos from the server
   */
  async pullTodos(wallet: string, listName?: string): Promise<SyncResponse> {
    return this?.retryManager?.executeWithRetry(async () => {
      const params: any = { wallet };
      if (listName) {
        params?.listName = listName;
      }

      const response = await this?.httpClient?.get('/api/v1/todos', { params });

      this?.logger?.debug('Todos pulled from server', {
        wallet,
        listName,
        count: response.data?.length || 0,
      });

      return {
        success: true,
        data: response.data,
        timestamp: Date.now(),
      };
    });
  }

  /**
   * Delete a todo on the server
   */
  async deleteTodo(todoId: string, listName: string): Promise<SyncResponse> {
    return this?.retryManager?.executeWithRetry(async () => {
      await this?.httpClient?.delete(`/api/v1/todos/${todoId}`, {
        data: { listName, wallet: this.wallet },
      });

      this?.logger?.debug('Todo deleted on server', { id: todoId, listName });

      return {
        success: true,
        timestamp: Date.now(),
      };
    });
  }

  /**
   * Update a todo on the server
   */
  async updateTodo(todo: Todo, listName: string): Promise<SyncResponse> {
    return this?.retryManager?.executeWithRetry(async () => {
      const response = await this?.httpClient?.put(`/api/v1/todos/${todo.id}`, {
        ...todo,
        listName,
        wallet: this.wallet,
      });

      this?.logger?.debug('Todo updated on server', { id: todo.id, listName });

      return {
        success: true,
        data: response.data,
        timestamp: Date.now(),
      };
    });
  }

  /**
   * Request sync for specific wallet
   */
  async requestSync(wallet: string): Promise<void> {
    if (this.websocket?.connected) {
      this?.websocket?.emit('sync-request', { wallet });
      this?.logger?.debug('Sync requested via WebSocket', { wallet });
    } else {
      this?.logger?.warn('Cannot request sync: WebSocket not connected');
    }
  }

  /**
   * Get sync status from server
   */
  async getSyncStatus(wallet: string): Promise<SyncResponse> {
    try {
      const response = await this?.httpClient?.get(`/api/v1/todos/stats`, {
        params: { wallet },
      });

      return {
        success: true,
        data: response.data,
        timestamp: Date.now(),
      };
    } catch (error) {
      this?.logger?.error('Failed to get sync status:', error);
      throw error;
    }
  }

  /**
   * Normalize axios errors
   */
  private normalizeError(error: AxiosError): Error {
    if (error.response) {
      // Server responded with error status
      const message = error?.response?.data?.message || error.message;
      const enhancedError = new Error(`API Error: ${message}`);
      (enhancedError as any).status = error?.response?.status;
      (enhancedError as any).code = error?.response?.data?.code;
      return enhancedError;
    } else if (error.request) {
      // Network error
      return new Error(`Network Error: ${error.message}`);
    } else {
      // Request setup error
      return new Error(`Request Error: ${error.message}`);
    }
  }

  /**
   * Check if client is connected
   */
  isClientConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get WebSocket connection status
   */
  isWebSocketConnected(): boolean {
    return this.websocket?.connected || false;
  }

  /**
   * Get client status
   */
  getStatus(): {
    connected: boolean;
    websocketConnected: boolean;
    wallet: string | null;
    baseURL: string;
  } {
    return {
      connected: this.isConnected,
      websocketConnected: this.isWebSocketConnected(),
      wallet: this.wallet,
      baseURL: this?.config?.baseURL,
    };
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    await this.disconnect();
    this.removeAllListeners();
    this?.logger?.info('ApiClient destroyed');
  }
}
