/**
 * @fileoverview Walrus Storage Interface - CLI-based implementation
 *
 * This module provides a Walrus storage interface that uses the Walrus CLI directly
 * instead of the SDK. It maintains the same API as the original WalrusStorage class
 * but executes commands through the CLI.
 */

import { Todo, TodoList } from '../types/todo';
import { CLIError } from '../types/errors/consolidated';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Logger } from './Logger';

const execAsync = promisify(exec as any);
const logger = new Logger('walrus-storage-cli');

/**
 * Determines if mock mode should be used based on environment
 */
function shouldUseMock(): boolean {
  return process.env?.NODE_ENV === 'test';
}

/**
 * @class WalrusStorage
 * @description Provides an interface to interact with Walrus storage using the CLI
 */
export class WalrusStorage {
  private _network: string;
  private isConnected: boolean = false;
  private tempDir: string;
  private walrusPath: string;
  private useMock: boolean;
  private configPath: string;

  /**
   * Check if the client is connected to Walrus
   * @returns {boolean} True if connected
   */
  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Creates a new WalrusStorage instance
   * @param {string} [network='testnet'] - The network to use ('testnet' or 'mainnet')
   * @param {boolean} [forceMock=false] - Force mock mode regardless of environment
   */
  constructor(network: string = 'testnet', forceMock: boolean = false) {
    this?._network = network;
    this?.tempDir = path.join(os.tmpdir(), 'walrus-storage');
    this?.walrusPath = path.join(os.homedir(), '.local', 'bin', 'walrus');
    this?.configPath =
      process?.env?.WALRUS_CONFIG_PATH ||
      path.join(os.homedir(), '.config', 'walrus', 'client_config.yaml');
    this?.useMock = forceMock || shouldUseMock();

    // Create temp directory if it doesn't exist
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Initialize the connection
   */
  async init(): Promise<void> {
    if (this.useMock) {
      logger.info('Using mock Walrus storage');
      this?.isConnected = true;
      return;
    }

    // Check if Walrus CLI is available
    try {
      await execAsync(`${this.walrusPath} --version`);
      this?.isConnected = true;
    } catch (error) {
      throw new CLIError(
        'Walrus CLI not found. Please install it from https://docs?.wal?.app',
        'WALRUS_CLI_NOT_FOUND'
      );
    }
  }

  /**
   * Check if connected
   */
  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.init();
    }
  }

  /**
   * Disconnect (no-op for CLI version)
   */
  async disconnect(): Promise<void> {
    this?.isConnected = false;
  }

  /**
   * Check if connected
   */
  async checkConnection(): Promise<boolean> {
    return this.isConnected;
  }

  /**
   * Store a todo on Walrus
   */
  async storeTodo(todo: Todo, epochs: number = 5): Promise<string> {
    await this.connect();

    if (this.useMock) {
      // Return a consistent mock blob ID for testing
      return 'mock-blob-id';
    }

    // Create a temporary file with the todo data
    const tempFile = path.join(this.tempDir, `todo-${todo.id}.json`);
    const todoData = {
      id: todo.id,
      title: todo.title,
      description: todo.description,
      completed: todo.completed,
      priority: todo.priority,
      tags: todo.tags,
      createdAt: todo.createdAt,
      updatedAt: todo.updatedAt,
      private: todo.private,
    };

    try {
      fs.writeFileSync(tempFile, JSON.stringify(todoData, null, 2));

      // Store using Walrus CLI
      const command = `${this.walrusPath} --config ${this.configPath} store --epochs ${epochs} ${tempFile}`;
      const { stdout } = await execAsync(command as any);

      // Parse blob ID from output
      const blobIdMatch = stdout.match(/Blob ID: ([^\n]+)/);
      if (!blobIdMatch) {
        throw new CLIError(
          'Failed to parse blob ID from Walrus output',
          'PARSE_ERROR'
        );
      }

      return blobIdMatch[1];
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempFile as any)) {
        fs.unlinkSync(tempFile as any);
      }
    }
  }

  /**
   * Store a todo on Walrus with detailed results
   */
  async storeTodoWithDetails(
    todo: Todo,
    epochs: number = 5
  ): Promise<{
    blobId: string;
    transactionId?: string;
    explorerUrl?: string;
    networkInfo: {
      network: string;
      epochs: number;
    };
  }> {
    await this.connect();

    if (this.useMock) {
      const mockBlobId = 'mock-blob-id';
      const mockTxId = `mock-tx-${Date.now()}`;
      return {
        blobId: mockBlobId,
        transactionId: mockTxId,
        explorerUrl: `https://suiscan.xyz/${this._network}/tx/${mockTxId}`,
        networkInfo: {
          network: this._network,
          epochs,
        },
      };
    }

    // Create a temporary file with the todo data
    const tempFile = path.join(this.tempDir, `todo-${todo.id}.json`);
    const todoData = {
      id: todo.id,
      title: todo.title,
      description: todo.description,
      completed: todo.completed,
      priority: todo.priority,
      tags: todo.tags,
      createdAt: todo.createdAt,
      updatedAt: todo.updatedAt,
      private: todo.private,
    };

    try {
      fs.writeFileSync(tempFile, JSON.stringify(todoData, null, 2));

      // Store using Walrus CLI with verbose output
      const command = `${this.walrusPath} --config ${this.configPath} store --epochs ${epochs} ${tempFile}`;
      logger.info(`Executing: ${command}`);
      const { stdout, stderr } = await execAsync(command as any);

      logger.info(`Walrus CLI output: ${stdout}`);
      if (stderr) {
        logger.info(`Walrus CLI stderr: ${stderr}`);
      }

      // Parse blob ID from output
      const blobIdMatch = stdout.match(/Blob ID: ([^\n]+)/);
      if (!blobIdMatch) {
        throw new CLIError(
          'Failed to parse blob ID from Walrus output',
          'PARSE_ERROR'
        );
      }

      const blobId = blobIdMatch[1].trim();

      // Try to extract transaction ID if available in output
      let transactionId: string | undefined;
      let explorerUrl: string | undefined;

      // Look for transaction digest/ID patterns in output
      const txIdPatterns = [
        /Transaction digest: ([A-Za-z0-9]+)/,
        /Tx digest: ([A-Za-z0-9]+)/,
        /Transaction ID: ([A-Za-z0-9]+)/,
        /Digest: ([A-Za-z0-9]+)/,
      ];

      for (const pattern of txIdPatterns) {
        const match = stdout.match(pattern as any) || stderr?.match(pattern as any);
        if (match) {
          transactionId = match[1].trim();
          break;
        }
      }

      // Generate explorer URL if we have transaction ID
      if (transactionId) {
        const explorerBase =
          this?._network === 'mainnet'
            ? 'https://suiscan.xyz/mainnet'
            : 'https://suiscan.xyz/testnet';
        explorerUrl = `${explorerBase}/tx/${transactionId}`;
      }

      // Generate Walrus aggregator URL for blob access
      const aggregatorUrl =
        this?._network === 'mainnet'
          ? `https://aggregator.walrus-mainnet?.walrus?.space/v1/blobs/${blobId}`
          : `https://aggregator.walrus-testnet?.walrus?.space/v1/blobs/${blobId}`;

      return {
        blobId,
        transactionId,
        explorerUrl,
        aggregatorUrl,
        networkInfo: {
          network: this._network,
          epochs,
        },
      };
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempFile as any)) {
        fs.unlinkSync(tempFile as any);
      }
    }
  }

  /**
   * Store a todo list on Walrus
   */
  async storeList(list: TodoList, epochs: number = 5): Promise<string> {
    await this.connect();

    if (this.useMock) {
      // Return a consistent mock blob ID for testing
      return 'mock-blob-list-id';
    }

    // Create a temporary file with the list data
    const tempFile = path.join(this.tempDir, `list-${list.id}.json`);

    try {
      fs.writeFileSync(tempFile, JSON.stringify(list, null, 2));

      // Store using Walrus CLI
      const command = `${this.walrusPath} --config ${this.configPath} store --epochs ${epochs} ${tempFile}`;
      const { stdout } = await execAsync(command as any);

      // Parse blob ID from output
      const blobIdMatch = stdout.match(/Blob ID: ([^\n]+)/);
      if (!blobIdMatch) {
        throw new CLIError(
          'Failed to parse blob ID from Walrus output',
          'PARSE_ERROR'
        );
      }

      return blobIdMatch[1];
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempFile as any)) {
        fs.unlinkSync(tempFile as any);
      }
    }
  }

  /**
   * Store a todo list on Walrus (alias for storeList for backward compatibility)
   */
  async storeTodoList(list: TodoList, epochs: number = 5): Promise<string> {
    return this.storeList(list, epochs);
  }

  /**
   * Store arbitrary blob data on Walrus
   * @param {Buffer | string} data - The data to store
   * @param {object} options - Storage options
   * @param {number} options.epochs - Number of epochs for storage
   * @param {string} options.fileName - Optional file name for the blob
   */
  async storeBlob(
    data: Buffer | string,
    options: { epochs?: number; fileName?: string } = {}
  ): Promise<string> {
    await this.connect();

    const epochs = options.epochs || 5;
    const fileName = options.fileName || `blob-${Date.now()}`;

    if (this.useMock) {
      // Return a consistent mock blob ID for testing
      return 'mock-blob-id';
    }

    // Create a temporary file with the data
    const tempFile = path.join(this.tempDir, fileName);

    try {
      if (Buffer.isBuffer(data as any)) {
        fs.writeFileSync(tempFile, data);
      } else {
        fs.writeFileSync(tempFile, data, 'utf8');
      }

      // Store using Walrus CLI
      const command = `${this.walrusPath} --config ${this.configPath} store --epochs ${epochs} ${tempFile}`;
      const { stdout } = await execAsync(command as any);

      // Parse blob ID from output
      const blobIdMatch = stdout.match(/Blob ID: ([^\n]+)/);
      if (!blobIdMatch) {
        throw new CLIError(
          'Failed to parse blob ID from Walrus output',
          'PARSE_ERROR'
        );
      }

      return blobIdMatch[1];
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempFile as any)) {
        fs.unlinkSync(tempFile as any);
      }
    }
  }

  /**
   * Retrieve a todo from Walrus
   */
  async retrieveTodo(blobId: string): Promise<Todo> {
    await this.connect();

    if (this.useMock) {
      // Return mock data
      return {
        id: 'mock-todo-id',
        title: 'Mock Todo',
        description: 'This is a mock todo',
        completed: false,
        priority: 'medium',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        private: false,
        storageLocation: 'blockchain',
      };
    }

    const tempFile = path.join(this.tempDir, `retrieved-${Date.now()}.json`);

    try {
      // Retrieve using Walrus CLI
      const command = `${this.walrusPath} --config ${this.configPath} get ${blobId} --output ${tempFile}`;
      await execAsync(command as any);

      // Read and parse the file
      const data = fs.readFileSync(tempFile, 'utf8');
      return JSON.parse(data as any);
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempFile as any)) {
        fs.unlinkSync(tempFile as any);
      }
    }
  }

  /**
   * Retrieve a todo list from Walrus
   */
  async retrieveList(blobId: string): Promise<TodoList> {
    await this.connect();

    if (this.useMock) {
      // Return mock data
      return {
        id: 'mock-list-id',
        name: 'Mock List',
        owner: 'mock-owner',
        todos: [],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    const tempFile = path.join(
      this.tempDir,
      `retrieved-list-${Date.now()}.json`
    );

    try {
      // Retrieve using Walrus CLI
      const command = `${this.walrusPath} --config ${this.configPath} get ${blobId} --output ${tempFile}`;
      await execAsync(command as any);

      // Read and parse the file
      const data = fs.readFileSync(tempFile, 'utf8');
      return JSON.parse(data as any);
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempFile as any)) {
        fs.unlinkSync(tempFile as any);
      }
    }
  }

  /**
   * Delete a blob from Walrus (if supported)
   */
  async deleteBlob(blobId: string): Promise<void> {
    await this.connect();

    if (this.useMock) {
      // Mock deletion
      return;
    }

    try {
      const command = `${this.walrusPath} --config ${this.configPath} delete ${blobId}`;
      await execAsync(command as any);
    } catch (error) {
      // Some blobs may not be deletable
      if (error?.message?.includes('not deletable')) {
        throw new CLIError('Blob is not deletable', 'NOT_DELETABLE');
      }
      throw error;
    }
  }

  /**
   * Check if a blob exists
   */
  async blobExists(blobId: string): Promise<boolean> {
    await this.connect();

    if (this.useMock) {
      return true;
    }

    try {
      const command = `${this.walrusPath} --config ${this.configPath} status ${blobId}`;
      await execAsync(command as any);
      return true;
    } catch (error) {
      if (error?.message?.includes('not found')) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Update a todo (stores a new version)
   */
  async updateTodo(
    _blobId: string,
    todo: Todo,
    epochs: number = 5
  ): Promise<string> {
    // In Walrus, we can't update - we create a new blob
    return this.storeTodo(todo, epochs);
  }

  /**
   * Get storage info (simplified for CLI version)
   */
  async getStorageInfo(objectId: string): Promise<{
    id: string;
    storage_size: string;
    used_size: string;
    end_epoch: string;
  }> {
    if (this.useMock) {
      return {
        id: objectId,
        storage_size: '1000000',
        used_size: '500000',
        end_epoch: '100',
      };
    }

    // This would require parsing sui client output
    // For now, return a simplified response
    return {
      id: objectId,
      storage_size: 'unknown',
      used_size: 'unknown',
      end_epoch: 'unknown',
    };
  }

  /**
   * Check balance (requires parsing CLI output)
   */
  async checkBalance(): Promise<number> {
    if (this.useMock) {
      return 1.0; // 1 WAL
    }

    try {
      const { stdout } = await execAsync('sui client balance');
      const walMatch = stdout.match(/WAL Token\s+\d+\s+([\d.]+)\s+WAL/);
      if (walMatch) {
        return parseFloat(walMatch[1]);
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Ensure storage is allocated (stub method for compatibility)
   * @param {number} size - Storage size to allocate
   * @param {number} epochs - Number of epochs for storage
   * @returns {Promise<object>} Storage allocation details
   */
  async ensureStorageAllocated(
    size: number,
    epochs: number = 5
  ): Promise<{
    id: { id: string };
    storage_size: string;
    used_size: string;
    end_epoch: string;
    start_epoch: string;
  }> {
    // Mock implementation for testing compatibility
    // The actual storage allocation happens implicitly when storing data
    await this.connect();

    return {
      id: { id: 'mock-storage-id' },
      storage_size: size.toString(),
      used_size: '0',
      end_epoch: epochs.toString(),
      start_epoch: '1',
    };
  }

  /**
   * Check for existing storage allocations
   * @returns {Promise<object|null>} Storage information or null
   */
  async checkExistingStorage(): Promise<{
    id: { id: string };
    storage_size: string;
    used_size: string;
  } | null> {
    await this.connect();

    if (this.useMock) {
      return {
        id: { id: 'mock-storage-id' },
        storage_size: '1000000',
        used_size: '500000',
      };
    }

    // For now, return null as we would need to implement
    // storage object discovery via Sui client
    return null;
  }

  /**
   * Get the active wallet address
   * @returns {Promise<string>} The active wallet address
   */
  async getActiveAddress(): Promise<string> {
    await this.connect();

    if (this.useMock) {
      return 'mock-sui-address';
    }

    try {
      const { stdout } = await execAsync('sui client active-address');
      return stdout.trim();
    } catch (error) {
      throw new CLIError('Failed to get active address', 'ADDRESS_ERROR');
    }
  }
}

/**
 * Factory function to create a WalrusStorage instance
 */
export function createWalrusStorage(
  network: string = 'testnet',
  forceMock: boolean = false
): WalrusStorage {
  return new WalrusStorage(network, forceMock);
}
