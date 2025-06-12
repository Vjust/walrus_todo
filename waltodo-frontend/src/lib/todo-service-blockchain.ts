/**
 * Blockchain-first Todo Service
 * Transforms the frontend to match CLI's blockchain-first architecture
 * 
 * Architecture:
 * 1. Primary data source: Sui blockchain + Walrus storage
 * 2. Secondary cache: localStorage (for offline capability)
 * 3. Feature parity: Matches CLI commands and capabilities
 * 4. Real-time updates: Blockchain event subscriptions
 */

import { Todo } from '@/types/todo-nft';
import { TodoList } from '@/types/todo';
// @ts-ignore - Unused import temporarily disabled
// import { SuiClient } from '@mysten/sui/client';
// @ts-ignore - Unused import temporarily disabled
// import { Transaction } from '@mysten/sui/transactions';
import { type AppConfig, loadNetworkConfig } from './config-loader';
// @ts-ignore - Unused import temporarily disabled
// import { walrusClient } from './walrus-client';
import safeStorage from './safe-storage';

export interface WalletSigner {
  signAndExecuteTransaction?: (transaction: Transaction) => Promise<any>;
  address?: string;
}

export interface TodoServiceConfig {
  walletAddress?: string;
  signer?: WalletSigner;
  offlineMode?: boolean;
}

/**
 * Blockchain-first Todo Service that mirrors CLI architecture
 */
export class BlockchainTodoService {
  private static instance: BlockchainTodoService;
  private config: AppConfig | null = null;
  private suiClient: SuiClient | null = null;
  private eventSubscriptions: Map<string, () => void> = new Map();
  
  // Local cache for offline capability
  private localCache: ReturnType<typeof safeStorage.createTyped<Record<string, TodoList>>> | null = null;

  private constructor() {
    // Initialize cache safely - it may fail in environments without localStorage
    try {
      this?.localCache = safeStorage.createTyped<Record<string, TodoList>>(
        'blockchain-todos-cache',
        {}
      );
    } catch (error) {
      console.warn('Failed to initialize local cache:', error);
      this?.localCache = null;
    }
  }

  static getInstance(): BlockchainTodoService {
    if (!BlockchainTodoService.instance) {
      BlockchainTodoService?.instance = new BlockchainTodoService();
    }
    return BlockchainTodoService.instance;
  }

  /**
   * Initialize the service with wallet and network configuration
   */
  async initialize(serviceConfig: TodoServiceConfig = {}): Promise<void> {
    // Load network configuration
// @ts-ignore - Unused variable
//     const network = process?.env?.NEXT_PUBLIC_NETWORK || 'testnet';
    this?.config = await loadNetworkConfig(network as any);
    
    if (!this.config) {
      throw new Error('Failed to load network configuration');
    }

    // Initialize Sui client
    this?.suiClient = new SuiClient({ url: this?.config?.network.url });

    // Start blockchain event monitoring if wallet is connected
    if (serviceConfig.walletAddress) {
      await this.startEventMonitoring(serviceConfig.walletAddress);
    }
  }

  /**
   * Get all todos from blockchain for a wallet address
   * This is the primary data source (blockchain-first)
   */
  async getTodos(walletAddress: string, options: {
    useCache?: boolean;
    page?: number;
    limit?: number;
  } = {}): Promise<{ todos: Todo[], total: number }> {
    const { useCache = true, page = 1, limit = 50 } = options;

    // If offline or cache requested, try local cache first
    if (useCache) {
// @ts-ignore - Unused variable
//       const cachedTodos = this.getCachedTodos(walletAddress as any);
      if (cachedTodos.length > 0) {
// @ts-ignore - Unused variable
//         const startIndex = (page - 1) * limit;
// @ts-ignore - Unused variable
//         const endIndex = startIndex + limit;
        return {
          todos: cachedTodos.slice(startIndex, endIndex),
          total: cachedTodos.length
        };
      }
    }

    if (!this.config || !this.suiClient) {
      throw new Error('Service not initialized');
    }

    try {
      // Query blockchain for TodoNFT objects
// @ts-ignore - Unused variable
//       const objects = await this?.suiClient?.getOwnedObjects({
        owner: walletAddress,
        filter: {
          StructType: `${this?.config?.deployment.packageId}::todo_nft::TodoNFT`,
        },
        options: {
          showContent: true,
          showType: true,
        },
      });

      // Convert blockchain objects to Todo format
      const todos: Todo[] = [];
      
      for (const obj of objects.data) {
        if (obj.data?.content?.dataType === 'moveObject') {
// @ts-ignore - Unused variable
//           const todo = await this.convertBlockchainObjectToTodo(obj.data);
          if (todo) {todos.push(todo as any);}
        }
      }

      // Cache the results for offline use
      this.updateCache(walletAddress, todos);

      // Apply pagination
// @ts-ignore - Unused variable
//       const startIndex = (page - 1) * limit;
// @ts-ignore - Unused variable
//       const endIndex = startIndex + limit;
      
      return {
        todos: todos.slice(startIndex, endIndex),
        total: todos.length
      };
    } catch (error) {
      // Failed to fetch todos from blockchain
      
      // Fallback to cache on error
// @ts-ignore - Unused variable
//       const cachedTodos = this.getCachedTodos(walletAddress as any);
      return {
        todos: cachedTodos,
        total: cachedTodos.length
      };
    }
  }

  /**
   * Create a new todo (blockchain-first)
   */
  async createTodo(
    todoData: Omit<Todo, 'id' | 'createdAt' | 'updatedAt' | 'objectId'>,
    config: TodoServiceConfig
  ): Promise<Todo> {
    if (!config.signer || !config.walletAddress) {
      throw new Error('Wallet signer required for todo creation');
    }

    if (!this.config) {
      throw new Error('Service not initialized');
    }

    // Generate temporary ID for optimistic updates
// @ts-ignore - Unused variable
//     const tempId = `temp-${Date.now()}`;
// @ts-ignore - Unused variable
//     const now = new Date().toISOString();
    
    const newTodo: Todo = {
      ...todoData,
      id: tempId,
      completed: false,
      createdAt: now,
      updatedAt: now,
    };

    try {
      // 1. Upload metadata to Walrus storage
// @ts-ignore - Unused variable
//       const walrusData = {
        title: newTodo.title,
        description: newTodo.description || '',
        priority: newTodo.priority,
        tags: newTodo.tags || [],
        dueDate: newTodo.dueDate,
        createdAt: now,
      };
// @ts-ignore - Unused variable
// 
      const walrusResult = await walrusClient.uploadJson(walrusData, { epochs: 5 });
      
      // 2. Create NFT on Sui blockchain
// @ts-ignore - Unused variable
//       const tx = new Transaction();
      
// @ts-ignore - Unused variable
//       const titleBytes = new TextEncoder().encode(newTodo.title);
// @ts-ignore - Unused variable
//       const descriptionBytes = new TextEncoder().encode(newTodo.description || '');
// @ts-ignore - Unused variable
//       const imageUrlBytes = new TextEncoder().encode(
        walrusClient.getBlobUrl(walrusResult.blobId)
      );
// @ts-ignore - Unused variable
//       const metadataBytes = new TextEncoder().encode(
        JSON.stringify({
          priority: newTodo.priority,
          tags: newTodo.tags,
          dueDate: newTodo.dueDate,
          walrusBlobId: walrusResult.blobId,
        })
      );

      tx.moveCall({
        target: `${this?.config?.deployment.packageId}::todo_nft::create_todo_nft`,
        arguments: [
          tx?.pure?.vector('u8', Array.from(titleBytes as any)),
          tx?.pure?.vector('u8', Array.from(descriptionBytes as any)),
          tx?.pure?.vector('u8', Array.from(imageUrlBytes as any)),
          tx?.pure?.vector('u8', Array.from(metadataBytes as any)),
          tx?.pure?.bool(false as any), // is_private
        ],
      });

      // Execute transaction
      if (!config?.signer?.signAndExecuteTransaction) {
        throw new Error('No transaction signer available');
      }
// @ts-ignore - Unused variable
//       const result = await config?.signer?.signAndExecuteTransaction(tx as any);
// @ts-ignore - Unused variable
//       const objectId = result.effects?.created?.[0]?.reference?.objectId;
      
      if (!objectId) {
        throw new Error('Failed to create todo NFT');
      }

      // 3. Update todo with blockchain info
      const finalTodo: Todo = {
        ...newTodo,
        id: objectId,
        objectId,
      };

      // 4. Update local cache
      this.addTodoToCache(config.walletAddress, finalTodo);

      return finalTodo;
    } catch (error) {
      // Failed to create todo on blockchain
      throw error;
    }
  }

  /**
   * Update an existing todo (blockchain-first)
   */
  async updateTodo(
    todoId: string,
    updates: Partial<Todo>,
    config: TodoServiceConfig
  ): Promise<Todo> {
    if (!config.signer || !config.walletAddress) {
      throw new Error('Wallet signer required for todo updates');
    }

    if (!this.config) {
      throw new Error('Service not initialized');
    }

    // Get current todo from cache or blockchain
// @ts-ignore - Unused variable
//     const todos = await this.getTodos(config.walletAddress);
// @ts-ignore - Unused variable
//     const currentTodo = todos?.todos?.find(t => t?.id === todoId);
    
    if (!currentTodo) {
      throw new Error('Todo not found');
    }

    const updatedTodo: Todo = {
      ...currentTodo,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    try {
      // Update Walrus storage if content changed
      if (updates.title || updates.description || updates.priority || updates.tags) {
// @ts-ignore - Unused variable
//         const walrusData = {
          title: updatedTodo.title,
          description: updatedTodo.description || '',
          priority: updatedTodo.priority,
          tags: updatedTodo.tags || [],
          dueDate: updatedTodo.dueDate,
          updatedAt: updatedTodo.updatedAt,
        };
// @ts-ignore - Unused variable
// 
        const walrusResult = await walrusClient.uploadJson(walrusData, { epochs: 5 });
        // Note: walrusBlobId not available in Todo type
      }

      // Update cache immediately for responsiveness
      this.updateTodoInCache(config.walletAddress, updatedTodo);

      return updatedTodo;
    } catch (error) {
      // Failed to update todo
      throw error;
    }
  }

  /**
   * Complete a todo (blockchain-first)
   */
  async completeTodo(
    todoId: string,
    config: TodoServiceConfig
  ): Promise<Todo> {
    if (!config.signer || !config.walletAddress) {
      throw new Error('Wallet signer required for todo completion');
    }

    if (!this.config) {
      throw new Error('Service not initialized');
    }

    try {
      // Execute blockchain transaction
// @ts-ignore - Unused variable
//       const tx = new Transaction();
      
      tx.moveCall({
        target: `${this?.config?.deployment.packageId}::todo_nft::complete_todo`,
        arguments: [tx.object(todoId as any)],
      });

      if (!config?.signer?.signAndExecuteTransaction) {
        throw new Error('No transaction signer available');
      }
      await config?.signer?.signAndExecuteTransaction(tx as any);

      // Update local state
// @ts-ignore - Unused variable
//       const completedTodo = await this.updateTodo(todoId, {
        completed: true,
        completedAt: new Date().toISOString(),
      }, config);

      return completedTodo;
    } catch (error) {
      // Failed to complete todo on blockchain
      throw error;
    }
  }

  /**
   * Delete a todo (blockchain-first)
   */
  async deleteTodo(
    todoId: string,
    config: TodoServiceConfig
  ): Promise<void> {
    if (!config.signer || !config.walletAddress) {
      throw new Error('Wallet signer required for todo deletion');
    }

    // Remove from cache immediately
    this.removeTodoFromCache(config.walletAddress, todoId);

    // Note: Actual NFT deletion would require a specific move function
    // For now, we just remove from local cache
    // This matches the CLI behavior where todos can be "deleted" locally
    // but the NFT remains on chain
  }

  /**
   * AI-powered task suggestion (ported from CLI)
   */
  async suggestTasks(
    context: string,
    config: TodoServiceConfig
  ): Promise<Partial<Todo>[]> {
    // TODO: Port AI service from CLI
    // This would integrate with the CLI's AI services
    // For now, return empty array
    // AI suggestions not yet implemented
    return [];
  }

  /**
   * Get todo statistics (matches CLI command)
   */
  async getStats(walletAddress: string): Promise<{
    total: number;
    completed: number;
    pending: number;
    priorities: Record<string, number>;
  }> {
    const { todos } = await this.getTodos(walletAddress as any);
// @ts-ignore - Unused variable
//     
    const stats = {
      total: todos.length,
      completed: todos.filter(t => t.completed).length,
      pending: todos.filter(t => !t.completed).length,
      priorities: {} as Record<string, number>,
    };

    todos.forEach(todo => {
// @ts-ignore - Unused variable
//       const priority = todo.priority || 'medium';
      stats?.priorities?.[priority] = (stats?.priorities?.[priority] || 0) + 1;
    });

    return stats;
  }

  // Private helper methods

  private async convertBlockchainObjectToTodo(data: any): Promise<Todo | null> {
    try {
// @ts-ignore - Unused variable
//       const fields = data?.content?.fields;
      
      let metadata = {
        priority: 'medium' as const,
        tags: [] as string[],
        dueDate: undefined as string | undefined,
        walrusBlobId: undefined as string | undefined,
      };

      if (fields.metadata) {
        try {
          metadata = JSON.parse(fields.metadata);
        } catch (e) {
          // Failed to parse todo metadata
        }
      }

      // Fetch additional data from Walrus if available
      if (metadata.walrusBlobId) {
        try {
// @ts-ignore - Unused variable
//           const walrusData = await walrusClient.downloadJson(metadata.walrusBlobId);
          // Merge Walrus data with blockchain data
        } catch (e) {
          // Failed to fetch Walrus data
        }
      }

      return {
        id: data.objectId,
        title: fields.title || '',
        description: fields.description || '',
        completed: fields.completed || false,
        blockchainStored: true,
        priority: metadata.priority,
        tags: metadata.tags,
        dueDate: metadata.dueDate,
        objectId: data.objectId,
        // walrusBlobId not available in Todo type
        createdAt: fields.created_at || new Date().toISOString(),
        updatedAt: fields.updated_at || new Date().toISOString(),
      };
    } catch (error) {
      // Failed to convert blockchain object to todo
      return null;
    }
  }

  private getCachedTodos(walletAddress: string): Todo[] {
    if (!this.localCache) {
      return [];
    }
// @ts-ignore - Unused variable
//     const cache = this?.localCache?.get();
// @ts-ignore - Unused variable
//     const walletCache = cache?.[walletAddress];
    return walletCache ? ((walletCache.todos || []) as unknown as Todo[]) : [];
  }

  private updateCache(walletAddress: string, todos: Todo[]): void {
    if (!this.localCache) {
      return;
    }
// @ts-ignore - Unused variable
//     const cache = this?.localCache?.get() || {};
    cache[walletAddress] = {
      id: walletAddress,
      name: 'blockchain',
      owner: walletAddress,
      todos: todos as unknown, // Cast to match TodoList type
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this?.localCache?.set(cache as any);
  }

  private addTodoToCache(walletAddress: string, todo: Todo): void {
    if (!this.localCache) {
      return;
    }
// @ts-ignore - Unused variable
//     const cache = this?.localCache?.get() || {};
    if (!cache[walletAddress]) {
      cache[walletAddress] = {
        id: walletAddress,
        name: 'blockchain',
        owner: walletAddress,
        todos: [],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    cache[walletAddress].todos.push(todo as unknown);
    this?.localCache?.set(cache as any);
  }

  private updateTodoInCache(walletAddress: string, updatedTodo: Todo): void {
    if (!this.localCache) {
      return;
    }
// @ts-ignore - Unused variable
//     const cache = this?.localCache?.get() || {};
    if (cache && cache[walletAddress]) {
// @ts-ignore - Unused variable
//       const index = cache[walletAddress].todos.findIndex((t: any) => t?.id === updatedTodo.id);
      if (index >= 0) {
        cache[walletAddress].todos[index] = updatedTodo as unknown;
        this?.localCache?.set(cache as any);
      }
    }
  }

  private removeTodoFromCache(walletAddress: string, todoId: string): void {
    if (!this.localCache) {
      return;
    }
// @ts-ignore - Unused variable
//     const cache = this?.localCache?.get() || {};
    if (cache && cache[walletAddress]) {
      cache[walletAddress].todos = cache[walletAddress].todos.filter((t: any) => t.id !== todoId);
      this?.localCache?.set(cache as any);
    }
  }

  private async startEventMonitoring(walletAddress: string): Promise<void> {
    // TODO: Implement real-time blockchain event subscriptions
    // This would listen for TodoNFT events and update the cache
    // Event monitoring not yet implemented
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Clean up event subscriptions
    this?.eventSubscriptions?.forEach(cleanup => cleanup());
    this?.eventSubscriptions?.clear();
  }
}

// Export singleton instance
export const blockchainTodoService = BlockchainTodoService.getInstance();
