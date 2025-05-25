/**
 * @fileoverview Backward Compatibility Adapter - Provides compatibility with legacy storage code
 *
 * This adapter allows old code to seamlessly work with the new consolidated storage
 * implementations. It wraps the new storage classes with the old interfaces to
 * ensure a smooth transition without breaking existing code.
 */

import { Todo, TodoList } from '../../../types/todo';
import { TodoStorage } from '../implementations/TodoStorage';
import { ImageStorage } from '../implementations/ImageStorage';
import { NFTStorage } from '../implementations/NFTStorage';
import { TransactionSigner } from '../../../types/signer';
import { CLIError } from '../../../types/error';

/**
 * Adapter that provides the legacy WalrusStorage interface
 * but uses the new consolidated TodoStorage implementation.
 */
export class LegacyWalrusStorageAdapter {
  private todoStorage: TodoStorage;

  /**
   * Creates a new LegacyWalrusStorageAdapter.
   *
   * @param address - User's wallet address
   * @param useMockMode - Whether to use mock mode
   */
  constructor(address: string, useMockMode = false) {
    this.todoStorage = new TodoStorage(address, { useMockMode });
  }

  /**
   * Initializes the storage.
   */
  async init(): Promise<void> {
    await this.todoStorage.connect();
  }

  /**
   * Connects to the storage.
   */
  async connect(): Promise<void> {
    await this.todoStorage.connect();
  }

  /**
   * Disconnects from the storage.
   */
  async disconnect(): Promise<void> {
    await this.todoStorage.disconnect();
  }

  /**
   * Checks if the storage is connected.
   */
  async isConnected(): Promise<boolean> {
    return this.todoStorage.isConnected();
  }

  /**
   * Sets the signer for transactions.
   */
  setSigner(signer: TransactionSigner): void {
    this.todoStorage.setSigner(signer);
  }

  /**
   * Gets the active wallet address.
   */
  getActiveAddress(): string {
    // This is equivalent to calling client.getAddress() in our new implementation
    // but we simulate the old behavior
    const config = this.todoStorage.getConfig();
    if (!config || !(config as any).address) {
      throw new CLIError('No active address set: WALRUS_NO_ADDRESS');
    }
    return (config as any).address;
  }

  /**
   * Stores a todo in storage.
   */
  async storeTodo(todo: Todo): Promise<string> {
    return this.todoStorage.storeTodo(todo);
  }

  /**
   * Retrieves a todo from storage.
   */
  async retrieveTodo(blobId: string): Promise<Todo> {
    return this.todoStorage.retrieveTodo(blobId);
  }

  /**
   * Updates a todo in storage.
   */
  async updateTodo(todo: Todo, blobId: string): Promise<string> {
    return this.todoStorage.updateTodo(todo, blobId);
  }

  /**
   * Stores a todo list in storage.
   */
  async storeTodoList(todoList: TodoList): Promise<string> {
    return this.todoStorage.storeTodoList(todoList);
  }

  /**
   * Retrieves a todo list from storage.
   */
  async retrieveTodoList(blobId: string): Promise<TodoList> {
    return this.todoStorage.retrieveTodoList(blobId);
  }

  /**
   * Ensures storage is allocated.
   */
  async ensureStorageAllocated(sizeBytes = 1073741824): Promise<any> {
    const result = await this.todoStorage.ensureStorageAllocated(sizeBytes);

    // Convert to format expected by old code
    return {
      id: { id: result.id },
      storage_size: result.totalSize.toString(),
      used_size: result.usedSize.toString(),
      end_epoch: result.endEpoch.toString(),
      start_epoch: result.startEpoch.toString(),
      content: null,
      data: undefined,
    };
  }

  /**
   * Checks existing storage.
   */
  async checkExistingStorage(): Promise<any> {
    const usage = await this.todoStorage.getStorageUsage();
    if (usage.storageObjects.length === 0) {
      return null;
    }

    // Find best storage object (one with most space available)
    const bestObject = usage.storageObjects.sort(
      (a, b) => b.remainingBytes - a.remainingBytes
    )[0];

    // Convert to format expected by old code
    return {
      id: { id: bestObject.id },
      storage_size: bestObject.totalSize.toString(),
      used_size: bestObject.usedSize.toString(),
      end_epoch: bestObject.endEpoch.toString(),
      start_epoch: bestObject.startEpoch.toString(),
      content: null,
      data: undefined,
    };
  }
}

/**
 * Adapter that provides the legacy WalrusImageStorage interface
 * but uses the new consolidated ImageStorage implementation.
 */
export class LegacyWalrusImageStorageAdapter {
  private imageStorage: ImageStorage;

  /**
   * Creates a new LegacyWalrusImageStorageAdapter.
   *
   * @param address - User's wallet address
   * @param useMockMode - Whether to use mock mode
   */
  constructor(address: string, useMockMode = false) {
    this.imageStorage = new ImageStorage(address, { useMockMode });
  }

  /**
   * Initializes the storage.
   */
  async init(): Promise<void> {
    await this.imageStorage.connect();
  }

  /**
   * Connects to the storage.
   */
  async connect(): Promise<void> {
    await this.imageStorage.connect();
  }

  /**
   * Disconnects from the storage.
   */
  async disconnect(): Promise<void> {
    await this.imageStorage.disconnect();
  }

  /**
   * Sets the signer for transactions.
   */
  setSigner(signer: TransactionSigner): void {
    this.imageStorage.setSigner(signer);
  }

  /**
   * Stores an image in storage.
   */
  async storeImage(
    imageData: Uint8Array,
    filename: string,
    contentType: string,
    options?: any
  ): Promise<string> {
    return this.imageStorage.storeImage(
      imageData,
      filename,
      contentType,
      options?.metadata
    );
  }

  /**
   * Retrieves an image from storage.
   */
  async retrieveImage(
    blobId: string
  ): Promise<{ imageData: Uint8Array; metadata: Record<string, string> }> {
    const result = await this.imageStorage.retrieveImage(blobId);
    return {
      imageData: result.imageData,
      metadata: result.metadata,
    };
  }

  /**
   * Ensures storage is allocated.
   */
  async ensureStorageAllocated(sizeBytes = 20971520): Promise<any> {
    const result = await this.imageStorage.ensureStorageAllocated(sizeBytes);

    // Convert to format expected by old code
    return {
      id: { id: result.id },
      storage_size: result.totalSize.toString(),
      used_size: result.usedSize.toString(),
      end_epoch: result.endEpoch.toString(),
      start_epoch: result.startEpoch.toString(),
      content: null,
      data: undefined,
    };
  }
}

/**
 * Adapter that provides the legacy SuiNftStorage interface
 * but uses the new consolidated NFTStorage implementation.
 */
export class LegacySuiNftStorageAdapter {
  private nftStorage: NFTStorage;

  /**
   * Creates a new LegacySuiNftStorageAdapter.
   *
   * @param suiClient - Sui client instance (for compatibility but ignored)
   * @param signer - Transaction signer
   * @param config - NFT configuration
   */
  constructor(suiClient: any, signer: TransactionSigner, config: any) {
    this.nftStorage = new NFTStorage(config.address, config.packageId, {
      collectionId: config.collectionId,
    });

    // Set the signer
    this.nftStorage.setSigner(signer);
  }

  /**
   * Creates a Todo NFT.
   */
  async createTodoNft(todo: Todo, walrusBlobId: string): Promise<string> {
    const result = await this.nftStorage.createTodoNFT(todo, walrusBlobId);
    return result.objectId;
  }

  /**
   * Gets a Todo NFT.
   */
  async getTodoNft(nftId: string): Promise<any> {
    const result = await this.nftStorage.getTodoNFT(nftId);

    // Convert to format expected by old code
    return {
      objectId: result.objectId,
      title: result.title,
      description: result.description,
      completed: result.completed,
      walrusBlobId: result.walrusBlobId,
    };
  }

  /**
   * Updates a Todo NFT's completion status.
   */
  async updateTodoNftCompletionStatus(nftId: string): Promise<string> {
    return this.nftStorage.updateTodoNFTCompletionStatus(nftId, true);
  }
}

/**
 * Factory function to create a legacy WalrusStorage adapter.
 */
export function createLegacyWalrusStorage(
  useMockMode = false
): LegacyWalrusStorageAdapter {
  // Get address from environment or config
  const address = process.env.SUI_ADDRESS || '0x0000000000000';
  return new LegacyWalrusStorageAdapter(address, useMockMode);
}

/**
 * Factory function to create a legacy WalrusImageStorage adapter.
 */
export function createLegacyWalrusImageStorage(
  useMockMode = false
): LegacyWalrusImageStorageAdapter {
  // Get address from environment or config
  const address = process.env.SUI_ADDRESS || '0x0000000000000';
  return new LegacyWalrusImageStorageAdapter(address, useMockMode);
}

/**
 * Factory function to create a legacy SuiNftStorage adapter.
 */
export function createLegacySuiNftStorage(
  suiClient: any,
  signer: TransactionSigner,
  config: any
): LegacySuiNftStorageAdapter {
  return new LegacySuiNftStorageAdapter(suiClient, signer, config);
}
