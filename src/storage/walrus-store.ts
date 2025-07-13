/**
 * Walrus-based implementation of TodoStore
 * Stores TODOs in the Walrus decentralized storage network
 */

import { Todo, TodoStore, generateId } from '../todos/todo';
import { WalrusClient, WalrusConfig } from './walrus';
import { logger } from '../utils/logger';
import { NotFoundError, StorageError } from '../utils/errors';
import { compress, decompress } from '../utils/compression';

/**
 * Data structure stored in Walrus
 */
interface TodoData {
  version: string;
  todos: Todo[];
  lastUpdated: string;
}

/**
 * Walrus-based TODO store
 */
export class WalrusStore implements TodoStore {
  private client: WalrusClient;
  private currentBlobId: string | null = null;
  private cache: TodoData | null = null;
  private compressionEnabled: boolean = true;

  constructor(config: WalrusConfig, options?: { compressionEnabled?: boolean }) {
    this.client = new WalrusClient(config);
    this.compressionEnabled = options?.compressionEnabled ?? true;
  }

  /**
   * Load data from Walrus or create new if not exists
   */
  private async loadData(): Promise<TodoData> {
    if (this.cache) {
      return this.cache;
    }

    try {
      // Try to load from a stored blob ID (could be from config/cache)
      if (this.currentBlobId) {
        logger.debug('Loading TODO data from Walrus', { blobId: this.currentBlobId });
        
        const rawData = await this.client.retrieve(this.currentBlobId);
        const jsonData = this.compressionEnabled ? 
          await decompress(Buffer.from(rawData, 'base64')) : 
          rawData;
        const data = JSON.parse(jsonData) as TodoData;
        
        this.cache = data;
        return data;
      }
    } catch (error) {
      logger.warn('Failed to load existing data, creating new', error);
    }

    // Create new data structure
    const newData: TodoData = {
      version: '1.0.0',
      todos: [],
      lastUpdated: new Date().toISOString(),
    };

    this.cache = newData;
    return newData;
  }

  /**
   * Save data to Walrus
   */
  private async saveData(data: TodoData): Promise<void> {
    try {
      data.lastUpdated = new Date().toISOString();
      
      const jsonData = JSON.stringify(data);
      const dataToStore = this.compressionEnabled ? 
        (await compress(jsonData)).toString('base64') : 
        jsonData;
      
      logger.debug('Saving TODO data to Walrus', { 
        todoCount: data.todos.length,
        compressed: this.compressionEnabled 
      });

      const response = await this.client.store(dataToStore);
      
      // Delete old blob if exists
      if (this.currentBlobId && this.currentBlobId !== response.blobId) {
        try {
          await this.client.delete(this.currentBlobId);
        } catch (error) {
          logger.warn('Failed to delete old blob', error);
        }
      }

      this.currentBlobId = response.blobId;
      this.cache = data;
      
      logger.info('TODO data saved to Walrus', { 
        blobId: response.blobId,
        size: response.size 
      });
    } catch (error) {
      logger.error('Failed to save data to Walrus', error);
      throw new StorageError('Failed to save TODO data');
    }
  }

  /**
   * Get all TODOs
   */
  async getAll(): Promise<Todo[]> {
    const data = await this.loadData();
    return [...data.todos];
  }

  /**
   * Get a specific TODO by ID
   */
  async getById(id: string): Promise<Todo | null> {
    const data = await this.loadData();
    return data.todos.find(todo => todo.id === id) || null;
  }

  /**
   * Add a new TODO
   */
  async add(todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>): Promise<Todo> {
    const data = await this.loadData();
    
    const newTodo: Todo = {
      ...todo,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    data.todos.push(newTodo);
    await this.saveData(data);

    return newTodo;
  }

  /**
   * Update an existing TODO
   */
  async update(id: string, updates: Partial<Omit<Todo, 'id' | 'createdAt'>>): Promise<Todo> {
    const data = await this.loadData();
    
    const index = data.todos.findIndex(todo => todo.id === id);
    if (index === -1) {
      throw new NotFoundError(`TODO with id ${id} not found`);
    }

    const updatedTodo: Todo = {
      ...data.todos[index],
      ...updates,
      id, // Ensure ID doesn't change
      createdAt: data.todos[index].createdAt, // Preserve creation date
      updatedAt: new Date().toISOString(),
    };

    data.todos[index] = updatedTodo;
    await this.saveData(data);

    return updatedTodo;
  }

  /**
   * Delete a TODO
   */
  async delete(id: string): Promise<void> {
    const data = await this.loadData();
    
    const index = data.todos.findIndex(todo => todo.id === id);
    if (index === -1) {
      throw new NotFoundError(`TODO with id ${id} not found`);
    }

    data.todos.splice(index, 1);
    await this.saveData(data);
  }

  /**
   * Delete all TODOs
   */
  async clear(): Promise<void> {
    const data = await this.loadData();
    data.todos = [];
    await this.saveData(data);
  }

  /**
   * Get current blob ID (for backup/restore)
   */
  getBlobId(): string | null {
    return this.currentBlobId;
  }

  /**
   * Set blob ID (for restore from backup)
   */
  setBlobId(blobId: string): void {
    this.currentBlobId = blobId;
    this.cache = null; // Clear cache to force reload
  }
}