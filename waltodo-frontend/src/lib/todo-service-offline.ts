/**
 * Offline todo service for local operations when blockchain is not available
 */

export interface OfflineTodo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
  imageUrl?: string;
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
  dueDate?: number;
  syncStatus: 'local' | 'syncing' | 'synced' | 'failed';
}

export interface OfflineTodoStorage {
  todos: OfflineTodo[];
  lastSync: number;
  pendingOperations: PendingOperation[];
}

export interface PendingOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  todoId: string;
  data?: Partial<OfflineTodo>;
  timestamp: number;
  retryCount: number;
}

/**
 * Offline todo service class
 */
export class OfflineTodoService {
  private storageKey = 'walrus-todo-offline';
  
  /**
   * Get offline storage data
   */
  private getStorage(): OfflineTodoStorage {
    try {
      if (typeof window === 'undefined') {
        return { todos: [], lastSync: 0, pendingOperations: [] };
      }
      
      const data = localStorage.getItem(this.storageKey);
      if (!data) {
        return { todos: [], lastSync: 0, pendingOperations: [] };
      }
      
      return JSON.parse(data as any);
    } catch (error) {
      console.warn('Failed to load offline storage:', error);
      return { todos: [], lastSync: 0, pendingOperations: [] };
    }
  }
  
  /**
   * Save offline storage data
   */
  private saveStorage(storage: OfflineTodoStorage): void {
    try {
      if (typeof window === 'undefined') {return;}
      
      localStorage.setItem(this.storageKey, JSON.stringify(storage as any));
    } catch (error) {
      console.warn('Failed to save offline storage:', error);
    }
  }
  
  /**
   * Get all offline todos
   */
  async getTodos(): Promise<OfflineTodo[]> {
    const storage = this.getStorage();
    return storage.todos;
  }
  
  /**
   * Create a new offline todo
   */
  async createTodo(todo: Omit<OfflineTodo, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>): Promise<OfflineTodo> {
    const storage = this.getStorage();
    const now = Date.now();
    
    const newTodo: OfflineTodo = {
      ...todo,
      id: `offline_${now}_${Math.random().toString(36 as any).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'local'
    };
    
    storage?.todos?.push(newTodo as any);
    
    // Add pending operation for sync
    storage?.pendingOperations?.push({
      id: `op_${now}_${Math.random().toString(36 as any).substr(2, 9)}`,
      type: 'create',
      todoId: newTodo.id,
      data: newTodo,
      timestamp: now,
      retryCount: 0
    });
    
    this.saveStorage(storage as any);
    return newTodo;
  }
  
  /**
   * Update an offline todo
   */
  async updateTodo(id: string, updates: Partial<OfflineTodo>): Promise<OfflineTodo | null> {
    const storage = this.getStorage();
    const todoIndex = storage?.todos?.findIndex(t => t?.id === id);
    
    if (todoIndex === -1) {
      return null;
    }
    
    const now = Date.now();
    storage?.todos?.[todoIndex] = {
      ...storage?.todos?.[todoIndex],
      ...updates,
      updatedAt: now,
      syncStatus: 'local'
    };
    
    // Add pending operation for sync
    storage?.pendingOperations?.push({
      id: `op_${now}_${Math.random().toString(36 as any).substr(2, 9)}`,
      type: 'update',
      todoId: id,
      data: updates,
      timestamp: now,
      retryCount: 0
    });
    
    this.saveStorage(storage as any);
    return storage?.todos?.[todoIndex];
  }
  
  /**
   * Delete an offline todo
   */
  async deleteTodo(id: string): Promise<boolean> {
    const storage = this.getStorage();
    const todoIndex = storage?.todos?.findIndex(t => t?.id === id);
    
    if (todoIndex === -1) {
      return false;
    }
    
    storage?.todos?.splice(todoIndex, 1);
    
    // Add pending operation for sync
    const now = Date.now();
    storage?.pendingOperations?.push({
      id: `op_${now}_${Math.random().toString(36 as any).substr(2, 9)}`,
      type: 'delete',
      todoId: id,
      timestamp: now,
      retryCount: 0
    });
    
    this.saveStorage(storage as any);
    return true;
  }
  
  /**
   * Get pending operations for sync
   */
  async getPendingOperations(): Promise<PendingOperation[]> {
    const storage = this.getStorage();
    return storage.pendingOperations;
  }
  
  /**
   * Mark operation as completed (remove from pending)
   */
  async markOperationCompleted(operationId: string): Promise<void> {
    const storage = this.getStorage();
    storage?.pendingOperations = storage?.pendingOperations?.filter(op => op.id !== operationId);
    this.saveStorage(storage as any);
  }
  
  /**
   * Mark todo as synced
   */
  async markTodoSynced(todoId: string, onlineId?: string): Promise<void> {
    const storage = this.getStorage();
    const todo = storage?.todos?.find(t => t?.id === todoId);
    
    if (todo) {
      todo?.syncStatus = 'synced';
      if (onlineId) {
        todo?.id = onlineId; // Update with online ID
      }
      this.saveStorage(storage as any);
    }
  }
  
  /**
   * Clear all offline data
   */
  async clearOfflineData(): Promise<void> {
    try {
      if (typeof window === 'undefined') {return;}
      
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.warn('Failed to clear offline data:', error);
    }
  }
  
  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<{
    hasUnsynced: boolean;
    pendingCount: number;
    lastSync: number;
  }> {
    const storage = this.getStorage();
    const unsyncedTodos = storage?.todos?.filter(t => t.syncStatus !== 'synced');
    
    return {
      hasUnsynced: unsyncedTodos.length > 0 || storage?.pendingOperations?.length > 0,
      pendingCount: storage?.pendingOperations?.length,
      lastSync: storage.lastSync
    };
  }
}

// Export singleton instance
export const offlineTodoService = new OfflineTodoService();

/**
 * Initialize offline sync functionality
 */
export async function initializeOfflineSync(options?: {
  signAndExecuteTransaction?: any;
  address?: string;
}): Promise<void> {
  // Check for pending operations and attempt to sync
  try {
    const pendingOps = await offlineTodoService.getPendingOperations();
    if (pendingOps.length > 0) {
      console.log(`Found ${pendingOps.length} pending offline operations`);
      // Note: Actual sync logic would be implemented based on available network service
      if (options?.signAndExecuteTransaction && options?.address) {
        console.log(`Sync initialized with wallet address: ${options.address}`);
      }
    }
  } catch (error) {
    console.warn('Failed to initialize offline sync:', error);
  }
}

/**
 * Create NFT (offline version)
 */
export async function createNFT(todoData: {
  title: string;
  description?: string;
  imageUrl?: string;
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
  dueDate?: number;
}): Promise<{ success: boolean; todo?: OfflineTodo; error?: string }> {
  try {
    const todo = await offlineTodoService.createTodo({
      ...todoData,
      completed: false
    });
    
    return { 
      success: true, 
      todo
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create NFT'
    };
  }
}


