import crypto from 'crypto';
import { Todo, TodoList, WalrusBlob, WalrusClientInterface, WalrusError } from '../types';

/**
 * Test implementation of Walrus storage service
 * Provides mock functionality for development and testing
 */
export class WalrusTestService implements WalrusClientInterface {
  private isActive: boolean = false;
  public network: string = 'testnet';
  private storage: Map<string, Uint8Array> = new Map();
  private metadata = new Map<string, { todoIds: string[], name?: string, version?: number }>();
  private todos = new Map<string, Todo>();
  private lists = new Map<string, TodoList>();

  constructor() {
    this.isActive = true;
  }

  /**
   * Check if client is connected
   * @returns boolean Connection status
   */
  public isConnected(): boolean {
    return this.isActive;
  }

  /**
   * Connect to the Walrus service
   */
  public async connect(): Promise<void> {
    this.isActive = true;
    return Promise.resolve();
  }

  /**
   * Disconnect from the Walrus service
   */
  public async disconnect(): Promise<void> {
    this.isActive = false;
    return Promise.resolve();
  }

  /**
   * Write blob data to storage
   * @param data Blob content as Uint8Array
   * @param size Optional size parameter
   * @param isPublic Optional public flag
   * @returns Promise<string> Blob ID
   */
  public async writeBlob(data: Uint8Array, size?: number, isPublic?: boolean): Promise<string> {
    if (!this.isActive) {
      throw new WalrusError('Client not connected', 'CONNECTION_ERROR');
    }
    
    // Generate mock blob ID
    const blobId = `test-blob-${Date.now()}-${Math.round(Math.random() * 1000)}`;
    
    // Store data in memory
    this.storage.set(blobId, data);
    
    return blobId;
  }

  /**
   * Read blob data from storage
   * @param blobId ID of the blob to read
   * @returns Promise<Uint8Array> Blob content
   */
  public async readBlob(blobId: string): Promise<Uint8Array> {
    if (!this.isActive) {
      throw new WalrusError('Client not connected', 'CONNECTION_ERROR');
    }
    
    const data = this.storage.get(blobId);
    if (!data) {
      throw new WalrusError(`Blob not found: ${blobId}`, 'NOT_FOUND');
    }
    
    return data;
  }

  /**
   * Simulates storing a todo item
   * @param listId Name of the todo list
   * @param todo Todo item to store
   * @param skipMetadata Optional flag to skip metadata updates
   * @returns Promise<string> Blob ID of stored todo
   */
  public async storeTodo(
    listId: string,
    todo: Todo,
    skipMetadata?: boolean // new optional flag
  ): Promise<string> {
    // Generate a deterministic but unique blob ID
    const blobId = `blob-${todo.id}-${Date.now()}`;
    
    // Store the todo in our in-memory map
    this.todos.set(todo.id, { ...todo });
    
    // Simulate encryption and storage
    const jsonString = JSON.stringify(todo);
    const encryptedData = new TextEncoder().encode(jsonString);
    this.storage.set(blobId, encryptedData);
    
    // Update metadata for the list if not skipped
    if (!skipMetadata) {
      if (!this.metadata.has(listId)) {
        this.metadata.set(listId, { todoIds: [] });
      }
      this.metadata.get(listId)?.todoIds.push(blobId);
    }
    
    return blobId;
  }

  /**
   * Simulates retrieving a todo item
   * @param blobId ID of the blob to retrieve
   * @returns Promise<Todo | null>
   */
  public async getTodo(blobId: string): Promise<Todo | null> {
    // Handle test for local todos
    if (blobId.startsWith('local-')) {
      const todoId = blobId.replace('local-', '');
      const todo = this.todos.get(todoId);
      return todo || null;
    }
    
    // Get encrypted data from storage
    const encryptedData = this.storage.get(blobId);
    if (!encryptedData) return null;
    
    // Simulate decryption
    const jsonString = new TextDecoder().decode(encryptedData);
    const todo = JSON.parse(jsonString) as Todo;
    return todo;
  }

  /**
   * Simulates retrieving a todo list
   * @param listId ID of the todo list to retrieve
   * @returns Promise<TodoList | null>
   */
  public async getTodoList(listId: string): Promise<TodoList | null> {
    // Check if we have this list in our memory
    if (this.lists.has(listId)) {
      return this.lists.get(listId) || null;
    }
    
    // Try to build the list from metadata and todos
    const listMetadata = this.metadata.get(listId);
    if (!listMetadata) return null;
    
    const todos: Todo[] = [];
    
    // Collect all todos from the blob IDs in metadata
    for (const blobId of listMetadata.todoIds) {
      const todo = await this.getTodo(blobId);
      if (todo) todos.push(todo);
    }
    
    // Create a new TodoList
    const todoList: TodoList = {
      id: listId,
      name: listMetadata.name || `List ${listId}`,
      owner: "testOwner", // added owner to satisfy the required property
      todos,
      version: listMetadata.version || 1
    };
    
    // Cache for future use
    this.lists.set(listId, todoList);
    
    return todoList;
  }

  /**
   * Simulates updating a todo item
   * @param listId ID of the todo list
   * @param todo Updated todo item
   * @returns Promise<void>
   */
  public async updateTodo(listId: string, todo: Todo): Promise<void> {
    // Remove old references to this todo first
    const listMetadata = this.metadata.get(listId);
    if (listMetadata) {
      const newBlobIds: string[] = [];
      for (const id of listMetadata.todoIds) {
        const existingTodo = await this.getTodo(id);
        if (!existingTodo || existingTodo.id !== todo.id) {
          newBlobIds.push(id);
        }
      }
      listMetadata.todoIds = newBlobIds;
    }

    // Store updated todo, skipping metadata insertion here
    const blobId = await this.storeTodo(listId, todo, true);

    // Append the new blob reference once
    if (listMetadata) {
      listMetadata.todoIds.push(blobId);
    }

    // Update cache
    if (this.lists.has(listId)) {
      const list = this.lists.get(listId)!;
      const index = list.todos.findIndex(t => t.id === todo.id);
      if (index >= 0) {
        list.todos[index] = { ...todo };
      } else {
        list.todos.push({ ...todo });
      }
      // remove or comment out list.updatedAt if it exists
    }
  }

  /**
   * Simulates deleting a todo item
   * @param listId ID of the todo list
   * @param todoId ID of the todo to delete
   * @returns Promise<void>
   */
  public async deleteTodo(listId: string, todoId: string): Promise<void> {
    // Remove todo from in-memory store
    this.todos.delete(todoId);
    
    // Update metadata to remove references to this todo
    const listMetadata = this.metadata.get(listId);
    if (listMetadata) {
      // Filter out blob IDs for this todo
      listMetadata.todoIds = listMetadata.todoIds.filter(async (blobId) => {
        const todo = await this.getTodo(blobId);
        return todo && todo.id !== todoId;
      });
    }
    
    // Update cache
    if (this.lists.has(listId)) {
      const list = this.lists.get(listId)!;
      list.todos = list.todos.filter(t => t.id !== todoId);
    }
  }

  /**
   * Simulates syncing with blockchain
   * @param listId ID of the todo list to sync
   * @param onChainList Todo list data from the blockchain
   * @returns Promise<void>
   */
  public async syncWithBlockchain(listId: string, onChainList: TodoList): Promise<void> {
    // Store the full list
    this.lists.set(listId, { ...onChainList });
    
    // Update metadata
    if (!this.metadata.has(listId)) {
      this.metadata.set(listId, { 
        todoIds: [],
        name: onChainList.name,
        version: onChainList.version
      });
    } else {
      const metadata = this.metadata.get(listId)!;
      metadata.name = onChainList.name;
      metadata.version = onChainList.version;
    }
    
    // Store all todos individually
    for (const todo of onChainList.todos) {
      if (!todo.private) {
        await this.storeTodo(listId, todo);
      }
    }
  }
  
  /**
   * Reset all storage (for test cleanup)
   */
  public reset(): void {
    this.storage.clear();
    this.metadata.clear();
    this.todos.clear();
    this.lists.clear();
  }
}
