/**
 * Walrus Todo Storage - Specialized client for todo operations
 * Consolidates todo-specific functionality from CLI and frontend implementations
 */

import { WalrusClient } from './WalrusClient';
import type { 
  WalrusUploadResponse,
  WalrusTodo,
  WalrusTodoUploadOptions,
  WalrusTodoCreateResult,
  UniversalSigner,
  Todo,
  TodoList,
  WalrusNetwork,
  StorageCostEstimate
} from '../types';
import { WalrusValidationError, WalrusStorageError } from '../errors';

export class WalrusTodoStorage extends WalrusClient {
  constructor(network: WalrusNetwork = 'testnet', options?: { useMockMode?: boolean }) {
    super({ network, ...options });
  }

  /**
   * Store a todo on Walrus (alias for storeTodo for backwards compatibility)
   */
  async store(
    todo: WalrusTodo | Omit<WalrusTodo, 'id' | 'createdAt' | 'updatedAt' | 'blockchainStored'>,
    signer?: UniversalSigner,
    options: WalrusTodoUploadOptions = {}
  ): Promise<WalrusUploadResponse> {
    return this.storeWalrusTodo(todo, signer, options);
  }

  /**
   * Retrieve a todo from Walrus (alias for retrieveTodo for backwards compatibility)
   */
  async retrieve(walrusBlobId: string): Promise<WalrusTodo> {
    return this.retrieveWalrusTodo(walrusBlobId);
  }

  /**
   * Store a todo on Walrus with comprehensive metadata
   */
  async storeWalrusTodo(
    todo: WalrusTodo | Omit<WalrusTodo, 'id' | 'createdAt' | 'updatedAt' | 'blockchainStored'>,
    signer?: UniversalSigner,
    options: WalrusTodoUploadOptions = {}
  ): Promise<WalrusUploadResponse> {
    // Ensure we have a complete todo object
    const completeTodo = this.ensureCompleteTodo(todo);
    
    // Validate todo data
    this.validateTodo(completeTodo);

    // Prepare upload options with todo-specific attributes
    const uploadOptions = {
      ...options,
      contentType: 'application/json',
      attributes: {
        ...options.attributes,
        type: 'todo',
        title: completeTodo.title,
        priority: completeTodo.priority,
        completed: String(completeTodo.completed),
        private: String(options.isPrivate || false),
        tags: completeTodo.tags?.join(',') || '',
        createdAt: new Date(completeTodo.createdAt).toISOString(),
        updatedAt: new Date(completeTodo.updatedAt).toISOString(),
        // Add signer address if available
        ...(signer && {
          owner: typeof signer.getAddress === 'function' 
            ? await signer.getAddress() 
            : signer.toSuiAddress()
        }),
      },
    };

    return this.uploadJson(completeTodo, uploadOptions);
  }

  /**
   * Retrieve a todo from Walrus storage
   */
  async retrieveWalrusTodo(walrusBlobId: string): Promise<WalrusTodo> {
    try {
      const todoData = await this.downloadJson<WalrusTodo>(walrusBlobId);
      
      // Validate retrieved data
      if (!this.isValidTodoData(todoData)) {
        throw new WalrusValidationError('Retrieved data is not a valid todo object');
      }

      return {
        ...todoData,
        walrusBlobId,
        blockchainStored: true,
      };
    } catch (error) {
      if (error instanceof WalrusValidationError) throw error;
      throw new WalrusStorageError(
        `Failed to retrieve todo: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'retrieveTodo',
        walrusBlobId,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Update a todo (creates new blob, as Walrus is immutable)
   */
  async updateWalrusTodo(
    todo: WalrusTodo,
    signer?: UniversalSigner,
    options: Partial<WalrusTodoUploadOptions> = {}
  ): Promise<WalrusUploadResponse> {
    const updatedTodo: WalrusTodo = {
      ...todo,
      updatedAt: Date.now(),
    };

    return this.storeWalrusTodo(updatedTodo, signer, {
      ...options,
      attributes: {
        ...options.attributes,
        type: 'todo-update',
        originalBlobId: todo.walrusBlobId || '',
        updateTimestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Create a comprehensive todo with Walrus storage and optional blockchain integration
   */
  async createTodo(
    todoInput: Omit<WalrusTodo, 'id' | 'createdAt' | 'updatedAt' | 'blockchainStored'>,
    signer?: UniversalSigner,
    signAndExecuteTransaction?: (txb: any) => Promise<any>,
    options: WalrusTodoUploadOptions = {}
  ): Promise<WalrusTodoCreateResult> {
    const todo = this.ensureCompleteTodo(todoInput);
    
    options.onProgress?.('Uploading to Walrus storage...', 25);

    // Store todo on Walrus
    const walrusResult = await this.storeWalrusTodo(todo, signer, {
      ...options,
      onProgress: (message, progress) => options.onProgress?.('Uploading...', 25 + progress * 0.5),
    });

    // Update todo with Walrus information
    todo.walrusBlobId = walrusResult.blobId;
    todo.storageSize = walrusResult.size;
    todo.blockchainStored = true;

    options.onProgress?.('Walrus upload complete', 75);

    // Optional: Create NFT on blockchain
    let suiResult;
    if (options.createNFT && signAndExecuteTransaction) {
      options.onProgress?.('Creating NFT on blockchain...', 85);
      
      try {
        // This would integrate with Sui blockchain
        // Implementation depends on the specific NFT contract
        suiResult = await this.createNFTForTodo(todo, signer, signAndExecuteTransaction);
        
        if (suiResult?.success) {
          todo.suiObjectId = suiResult.objectId;
          options.onProgress?.('NFT creation complete', 100);
        } else {
          options.onProgress?.('NFT creation failed, but Walrus storage successful', 90);
        }
      } catch (error) {
        console.warn('NFT creation failed:', error);
        options.onProgress?.('NFT creation failed, but Walrus storage successful', 90);
      }
    } else {
      options.onProgress?.('Todo creation complete', 100);
    }

    // Calculate storage metadata
    const storageCost = await this.calculateStorageCost(
      walrusResult.size,
      options.epochs || 5
    );

    const metadata = {
      walrusBlobId: walrusResult.blobId,
      suiObjectId: todo.suiObjectId,
      storageSize: walrusResult.size,
      storageEpochs: options.epochs || 5,
      storageCost: {
        total: storageCost.totalCost,
        storage: storageCost.storageCost,
        write: storageCost.writeCost,
      },
      uploadTimestamp: Date.now(),
      expiresAt: walrusResult.transactionId ? Date.now() + (options.epochs || 5) * 7 * 24 * 60 * 60 * 1000 : undefined,
    };

    return {
      todo,
      walrusResult,
      suiResult,
      metadata,
    };
  }

  /**
   * Create multiple todos in batch
   */
  async createMultipleTodos(
    todos: Array<Omit<WalrusTodo, 'id' | 'createdAt' | 'updatedAt' | 'blockchainStored'>>,
    signer?: UniversalSigner,
    signAndExecuteTransaction?: (txb: any) => Promise<any>,
    options: WalrusTodoUploadOptions = {}
  ): Promise<WalrusTodoCreateResult[]> {
    const results: WalrusTodoCreateResult[] = [];
    
    for (let i = 0; i < todos.length; i++) {
      const todo = todos[i];
      if (!todo) continue; // Skip undefined entries
      
      options.onProgress?.(
        `Creating todo ${i + 1} of ${todos.length}: ${todo.title}`,
        (i / todos.length) * 100
      );

      try {
        const result = await this.createTodo(todo, signer, signAndExecuteTransaction, {
          ...options,
          onProgress: undefined, // Avoid nested progress callbacks
        });
        results.push(result);
      } catch (error) {
        console.error(`Failed to create todo ${i + 1} (${todo.title}):`, error);
        // Continue with other todos even if one fails
      }
    }

    options.onProgress?.('Batch creation complete', 100);
    return results;
  }

  /**
   * Estimate storage costs for todos
   */
  async estimateTodoStorageCost(
    todo: WalrusTodo | Omit<WalrusTodo, 'id' | 'createdAt' | 'updatedAt' | 'blockchainStored'>,
    epochs: number = 5
  ): Promise<{
    totalCost: bigint;
    sizeBytes: number;
    storageCost: bigint;
    writeCost: bigint;
  }> {
    const completeTodo = this.ensureCompleteTodo(todo);
    const sizeBytes = JSON.stringify(completeTodo).length;
    const costs = await this.calculateStorageCost(sizeBytes, epochs);
    
    return {
      totalCost: costs.totalCost,
      sizeBytes,
      storageCost: costs.storageCost,
      writeCost: costs.writeCost,
    };
  }

  /**
   * Search todos by metadata (would require indexing service)
   */
  async searchTodos(query: {
    title?: string;
    priority?: string;
    completed?: boolean;
    tags?: string[];
    owner?: string;
  }): Promise<string[]> {
    // This would require an external indexing service
    // For now, return empty array
    console.warn('Todo search requires external indexing service');
    return [];
  }

  /**
   * List all todos for a specific owner (would require indexing service)
   */
  async listTodosByOwner(owner: string): Promise<string[]> {
    // This would require an external indexing service
    // For now, return empty array
    console.warn('Todo listing requires external indexing service');
    return [];
  }

  /**
   * Ensure todo object has all required fields
   */
  private ensureCompleteTodo(
    todo: WalrusTodo | Omit<WalrusTodo, 'id' | 'createdAt' | 'updatedAt' | 'blockchainStored'>
  ): WalrusTodo {
    const now = Date.now();
    
    return {
      id: 'id' in todo ? todo.id : `todo_${now}_${Math.random().toString(36).substr(2, 9)}`,
      title: todo.title,
      description: todo.description,
      completed: todo.completed,
      priority: todo.priority,
      tags: todo.tags,
      dueDate: todo.dueDate,
      walrusBlobId: 'walrusBlobId' in todo ? todo.walrusBlobId : undefined,
      suiObjectId: 'suiObjectId' in todo ? todo.suiObjectId : undefined,
      blockchainStored: 'blockchainStored' in todo ? todo.blockchainStored : false,
      createdAt: 'createdAt' in todo ? todo.createdAt : now,
      updatedAt: 'updatedAt' in todo ? todo.updatedAt : now,
      owner: todo.owner,
      storageEpochs: todo.storageEpochs,
      storageSize: todo.storageSize,
      isPrivate: todo.isPrivate,
    };
  }

  /**
   * Validate todo data structure
   */
  private validateTodo(todo: WalrusTodo): void {
    if (!todo.title || typeof todo.title !== 'string' || todo.title.trim().length === 0) {
      throw new WalrusValidationError('Todo title is required and must be non-empty', 'title', todo.title);
    }

    if (todo.title.length > 500) {
      throw new WalrusValidationError('Todo title is too long (max 500 characters)', 'title', todo.title);
    }

    if (typeof todo.completed !== 'boolean') {
      throw new WalrusValidationError('Todo completed status must be boolean', 'completed', todo.completed);
    }

    if (!['low', 'medium', 'high'].includes(todo.priority)) {
      throw new WalrusValidationError(
        'Todo priority must be "low", "medium", or "high"',
        'priority',
        todo.priority
      );
    }

    if (todo.description && typeof todo.description !== 'string') {
      throw new WalrusValidationError('Todo description must be string', 'description', todo.description);
    }

    if (todo.description && todo.description.length > 2000) {
      throw new WalrusValidationError('Todo description is too long (max 2000 characters)', 'description');
    }

    if (todo.tags && (!Array.isArray(todo.tags) || !todo.tags.every(tag => typeof tag === 'string'))) {
      throw new WalrusValidationError('Todo tags must be array of strings', 'tags', todo.tags);
    }

    if (todo.dueDate && typeof todo.dueDate !== 'string') {
      throw new WalrusValidationError('Todo due date must be ISO string', 'dueDate', todo.dueDate);
    }
  }

  /**
   * Check if data is valid todo object
   */
  private isValidTodoData(data: unknown): data is WalrusTodo {
    if (!data || typeof data !== 'object') return false;
    
    const todo = data as any;
    return (
      typeof todo.id === 'string' &&
      typeof todo.title === 'string' &&
      typeof todo.completed === 'boolean' &&
      ['low', 'medium', 'high'].includes(todo.priority) &&
      typeof todo.createdAt === 'number' &&
      typeof todo.updatedAt === 'number'
    );
  }

  /**
   * Store todo using the legacy Todo interface (consolidated from CLI)
   */
  async storeTodoLegacy(todo: Todo, epochs: number = 5): Promise<string> {
    const walrusTodo = this.convertToWalrusTodo(todo);
    const result = await this.storeWalrusTodo(walrusTodo, undefined, { epochs });
    return result.blobId;
  }

  /**
   * Store todo list using the legacy TodoList interface
   */
  async storeTodoListLegacy(list: TodoList, epochs: number = 5): Promise<string> {
    const result = await this.uploadJson(list, { epochs });
    return result.blobId;
  }

  /**
   * Retrieve todo using the legacy Todo interface
   */
  async retrieveTodoLegacy(blobId: string): Promise<Todo> {
    const walrusTodo = await this.retrieveWalrusTodo(blobId);
    return this.convertToTodo(walrusTodo);
  }

  /**
   * Retrieve todo list using the legacy TodoList interface
   */
  async retrieveListLegacy(blobId: string): Promise<TodoList> {
    return await this.downloadJson<TodoList>(blobId);
  }

  /**
   * Convert between Todo and WalrusTodo formats
   */
  convertToWalrusTodo(todo: Todo): WalrusTodo {
    return {
      id: todo.id,
      title: todo.title,
      description: todo.description,
      completed: todo.completed,
      priority: todo.priority,
      tags: todo.tags,
      dueDate: todo.dueDate,
      walrusBlobId: todo.walrusBlobId,
      suiObjectId: todo.suiObjectId,
      blockchainStored: !!todo.suiObjectId,
      createdAt: new Date(todo.createdAt).getTime(),
      updatedAt: new Date(todo.updatedAt).getTime(),
      isPrivate: todo.private,
    };
  }

  /**
   * Convert WalrusTodo back to Todo format
   */
  convertToTodo(walrusTodo: WalrusTodo): Todo {
    return {
      id: walrusTodo.id,
      title: walrusTodo.title,
      description: walrusTodo.description,
      completed: walrusTodo.completed,
      priority: walrusTodo.priority,
      tags: walrusTodo.tags,
      createdAt: new Date(walrusTodo.createdAt).toISOString(),
      updatedAt: new Date(walrusTodo.updatedAt).toISOString(),
      private: walrusTodo.isPrivate,
      dueDate: walrusTodo.dueDate,
      walrusBlobId: walrusTodo.walrusBlobId,
      suiObjectId: walrusTodo.suiObjectId,
      storageLocation: walrusTodo.blockchainStored ? 'blockchain' : 'walrus',
    };
  }

  /**
   * Get storage information for todos
   */
  async getTodoStorageInfo(walrusBlobId: string): Promise<{
    exists: boolean;
    blobInfo?: any;
    storageCost?: StorageCostEstimate;
  }> {
    const exists = await this.exists(walrusBlobId);
    
    if (!exists) {
      return { exists: false };
    }

    try {
      const blobInfo = await this.getBlobInfo(walrusBlobId);
      let storageCost: StorageCostEstimate | undefined;
      
      if (blobInfo.size) {
        const costResult = await this.calculateStorageCost(blobInfo.size, 5);
        storageCost = {
          ...costResult,
          sizeBytes: blobInfo.size,
          epochs: 5,
        };
      }

      return {
        exists: true,
        blobInfo,
        storageCost,
      };
    } catch (error) {
      return { exists: true };
    }
  }

  /**
   * Estimate storage costs for multiple todos
   */
  async estimateStorageCosts(
    todos: Array<Omit<WalrusTodo, 'id' | 'createdAt' | 'updatedAt' | 'blockchainStored'>>,
    epochs: number = 5
  ): Promise<{
    totalCost: bigint;
    totalSize: number;
    perTodoCost: Array<{ totalCost: bigint; size: number }>;
  }> {
    let totalCost = BigInt(0);
    let totalSize = 0;
    const perTodoCost: Array<{ totalCost: bigint; size: number }> = [];

    for (const todo of todos) {
      const sizeBytes = JSON.stringify(todo).length;
      const cost = await this.calculateStorageCost(sizeBytes, epochs);
      
      totalCost += cost.totalCost;
      totalSize += sizeBytes;
      perTodoCost.push({ totalCost: cost.totalCost, size: sizeBytes });
    }

    return {
      totalCost,
      totalSize,
      perTodoCost,
    };
  }

  /**
   * Delete a todo (for legacy Todo interface)
   */
  async deleteTodoLegacy(walrusBlobId: string, signer?: UniversalSigner): Promise<void> {
    if (!walrusBlobId) {
      throw new WalrusValidationError('Walrus blob ID is required for deletion');
    }

    try {
      await this.delete(walrusBlobId, signer);
    } catch (error) {
      console.warn('Walrus blob deletion failed (may not be deletable):', error);
    }
  }


  /**
   * Create NFT for todo (placeholder - would need actual Sui integration)
   */
  private async createNFTForTodo(
    todo: WalrusTodo,
    signer?: UniversalSigner,
    signAndExecuteTransaction?: (txb: any) => Promise<any>
  ): Promise<any> {
    // This would integrate with the actual Sui NFT creation logic
    // For now, return a mock result
    return {
      success: false,
      error: 'NFT creation not yet implemented in unified client',
    };
  }
}