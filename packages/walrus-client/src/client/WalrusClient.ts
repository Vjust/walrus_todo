/**
 * Universal Walrus Client for Node.js and Browser
 * Consolidates functionality from CLI and frontend implementations
 */

import type { 
  WalrusUploadResponse, 
  WalrusBlob, 
  WalrusUploadOptions,
  WalrusStorageInfo,
  WalrusClientAdapter,
  UniversalSigner,
  Todo,
  TodoList,
  WalrusNetwork
} from '../types';
import { WalrusConfig } from '../config/WalrusConfig';
import { RetryManager } from '../utils/RetryManager';
import { ErrorHandler } from '../utils/ErrorHandler';
import { universalFetch, RUNTIME } from '../utils/environment';
import { 
  WalrusClientError, 
  WalrusNetworkError, 
  WalrusValidationError,
  WalrusStorageError 
} from '../errors';
import { API_ENDPOINTS, DEFAULT_UPLOAD_OPTIONS } from '../constants';

// Node.js specific imports (conditionally loaded)
let fs: any;
let path: any;
let os: any;
let crypto: any;
let exec: any;

if (RUNTIME.isNode) {
  import('fs').then(module => fs = module);
  import('path').then(module => path = module);
  import('os').then(module => os = module);
  import('crypto').then(module => crypto = module);
  import('child_process').then(module => exec = module.exec);
}

export class WalrusClient implements WalrusClientAdapter {
  private config: WalrusConfig;
  private retryManager: RetryManager;
  private isConnected: boolean = false;
  private useMockMode: boolean = false;
  private tempDir?: string;
  private walrusPath?: string;
  private configPath?: string;

  constructor(config?: WalrusConfig | string | { network?: WalrusNetwork; useMockMode?: boolean; [key: string]: any }) {
    if (typeof config === 'string') {
      this.config = WalrusConfig.forNetwork(config as WalrusNetwork);
    } else if (config instanceof WalrusConfig) {
      this.config = config;
    } else {
      const { useMockMode = false, ...configOptions } = config || {};
      this.config = new WalrusConfig(configOptions);
      this.useMockMode = useMockMode || this.shouldUseMock();
    }

    this.retryManager = new RetryManager({
      maxRetries: this.config.getRetries(),
      timeout: this.config.getTimeout(),
      shouldRetry: ErrorHandler.isRetryableError,
    });

    // Initialize Node.js specific paths if in Node environment
    if (RUNTIME.isNode) {
      this.initializeNodePaths();
    }
  }

  private shouldUseMock(): boolean {
    return (
      // Removed WALRUS_USE_MOCK - using real implementations 
      process?.env?.NODE_ENV === 'test'
    );
  }

  private initializeNodePaths(): void {
    if (!RUNTIME.isNode) return;
    
    // These will be set when the dynamic imports complete
    setTimeout(() => {
      if (os && path) {
        this.tempDir = path.join(os.tmpdir(), 'walrus-storage');
        this.walrusPath = path.join(os.homedir(), '.local', 'bin', 'walrus');
        this.configPath = process.env.WALRUS_CONFIG_PATH ||
          path.join(os.homedir(), '.config', 'walrus', 'client_config.yaml');
        
        // Create temp directory if it doesn't exist
        if (fs && !fs.existsSync(this.tempDir)) {
          fs.mkdirSync(this.tempDir, { recursive: true });
        }
      }
    }, 100);
  }

  /**
   * Initialize the connection
   */
  async init(): Promise<void> {
    if (this.useMockMode) {
      // eslint-disable-next-line no-console
      console.log('Using mock Walrus storage');
      this.isConnected = true;
      return;
    }

    if (RUNTIME.isNode && this.walrusPath) {
      // Check if Walrus CLI is available in Node.js
      try {
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        await execAsync(`${this.walrusPath} --version`);
        this.isConnected = true;
      } catch (error) {
        throw new WalrusClientError(
          'Walrus CLI not found. Please install it from https://docs.wal.app'
        );
      }
    } else {
      // For browser, we're always connected
      this.isConnected = true;
    }
  }

  /**
   * Connect to Walrus
   */
  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.init();
    }
  }

  /**
   * Disconnect from Walrus
   */
  async disconnect(): Promise<void> {
    this.isConnected = false;
  }

  /**
   * Check connection status
   */
  async checkConnection(): Promise<boolean> {
    return this.isConnected;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  async getConfig() {
    return this.config.get();
  }

  /**
   * Upload data to Walrus storage
   */
  async upload(
    data: Uint8Array | string,
    options: WalrusUploadOptions = {}
  ): Promise<WalrusUploadResponse> {
    const mergedOptions = { ...DEFAULT_UPLOAD_OPTIONS, ...options };
    
    return this.retryManager.execute(async () => {
      const blobData = typeof data === 'string' ? new TextEncoder().encode(data) : data;
      
      if (blobData.length === 0) {
        throw new WalrusValidationError('Cannot upload empty data');
      }

      const url = new URL(`${this.config.getPublisherUrl()}${API_ENDPOINTS.STORE}`);
      
      if (mergedOptions.epochs) {
        url.searchParams.append('epochs', mergedOptions.epochs.toString());
      }

      mergedOptions.onProgress?.('Uploading to Walrus...', 0);

      const response = await universalFetch(url.toString(), {
        method: 'PUT',
        body: blobData,
        headers: {
          'Content-Type': mergedOptions.contentType || 'application/octet-stream',
        },
      });

      if (!response.ok) {
        const errorMessage = await ErrorHandler.extractErrorMessage(response);
        throw ErrorHandler.createErrorFromResponse(response);
      }

      mergedOptions.onProgress?.('Processing response...', 90);

      const result = await response.json();
      
      // Handle different response formats from Walrus
      const blobInfo = result.newlyCreated || result.alreadyCertified;
      if (!blobInfo?.blobId) {
        throw new WalrusStorageError('Invalid response format from Walrus', 'upload');
      }

      mergedOptions.onProgress?.('Upload complete', 100);

      return {
        blobId: blobInfo.blobId,
        size: blobInfo.size || blobData.length,
        encodedSize: blobInfo.encodedSize || blobData.length,
        cost: blobInfo.cost || 0,
        transactionId: blobInfo.transactionId,
        explorerUrl: blobInfo.explorerUrl,
      };
    }, 'upload');
  }

  /**
   * Download data from Walrus storage
   */
  async download(blobId: string): Promise<WalrusBlob> {
    this.validateBlobId(blobId);

    return this.retryManager.execute(async () => {
      const url = `${this.config.getAggregatorUrl()}${API_ENDPOINTS.BLOB.replace('{blobId}', blobId)}`;
      
      const response = await universalFetch(url, {
        method: 'GET',
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new WalrusStorageError(`Blob not found: ${blobId}`, 'download', blobId);
        }
        throw ErrorHandler.createErrorFromResponse(response);
      }

      const data = await response.arrayBuffer();
      const contentType = response.headers.get('content-type');

      return {
        id: blobId,
        data: new Uint8Array(data),
        ...(contentType && { contentType }),
        size: data.byteLength,
      };
    }, 'download');
  }

  /**
   * Check if a blob exists
   */
  async exists(blobId: string): Promise<boolean> {
    this.validateBlobId(blobId);

    try {
      const url = `${this.config.getAggregatorUrl()}${API_ENDPOINTS.BLOB.replace('{blobId}', blobId)}`;
      
      const response = await universalFetch(url, {
        method: 'HEAD',
      });

      return response.ok;
    } catch (error) {
      // If it's a network error, we can't determine existence
      if (ErrorHandler.isRetryableError(error as Error)) {
        throw ErrorHandler.wrapError(error, `Failed to check existence of blob ${blobId}`);
      }
      return false;
    }
  }

  /**
   * Delete a blob (if deletable)
   */
  async delete(blobId: string, signer?: UniversalSigner): Promise<string> {
    this.validateBlobId(blobId);

    return this.retryManager.execute(async () => {
      const url = `${this.config.getPublisherUrl()}${API_ENDPOINTS.DELETE.replace('{blobId}', blobId)}`;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add authentication if signer is provided
      if (signer) {
        // This would need to be implemented based on Walrus auth requirements
        // For now, we'll just include the address
        const address = typeof signer.getAddress === 'function' 
          ? await signer.getAddress() 
          : signer.toSuiAddress();
        headers['X-Wallet-Address'] = address;
      }

      const response = await universalFetch(url, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new WalrusStorageError(`Blob not found: ${blobId}`, 'delete', blobId);
        }
        if (response.status === 403) {
          throw new WalrusStorageError(`Blob is not deletable: ${blobId}`, 'delete', blobId);
        }
        throw ErrorHandler.createErrorFromResponse(response);
      }

      return blobId;
    }, 'delete');
  }

  /**
   * Get blob information
   */
  async getBlobInfo(blobId: string): Promise<{ size?: number }> {
    this.validateBlobId(blobId);

    try {
      const url = `${this.config.getAggregatorUrl()}${API_ENDPOINTS.BLOB.replace('{blobId}', blobId)}`;
      
      const response = await universalFetch(url, {
        method: 'HEAD',
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new WalrusStorageError(`Blob not found: ${blobId}`, 'getBlobInfo', blobId);
        }
        throw ErrorHandler.createErrorFromResponse(response);
      }

      const contentLength = response.headers.get('content-length');
      const size = contentLength ? parseInt(contentLength) : undefined;

      return size !== undefined ? { size } : {};
    } catch (error) {
      throw ErrorHandler.wrapError(error, `Failed to get blob info for ${blobId}`);
    }
  }

  /**
   * Calculate storage costs
   */
  async calculateStorageCost(
    size: number,
    epochs: number
  ): Promise<{ totalCost: bigint; storageCost: bigint; writeCost: bigint }> {
    if (size <= 0) {
      throw new WalrusValidationError('Size must be positive', 'size', size);
    }
    if (epochs <= 0) {
      throw new WalrusValidationError('Epochs must be positive', 'epochs', epochs);
    }

    // Simple cost calculation - would need to be updated based on actual Walrus pricing
    const writeCost = BigInt(Math.ceil(size / 1024)); // Cost per KB
    const storageCost = BigInt(epochs) * writeCost;
    const totalCost = writeCost + storageCost;

    return {
      totalCost,
      storageCost,
      writeCost,
    };
  }

  /**
   * Get WAL balance (stub - would need actual implementation)
   */
  async getWalBalance(): Promise<string> {
    // This would require integration with Sui wallet
    return '0';
  }

  /**
   * Get storage usage (stub - would need actual implementation)
   */
  async getStorageUsage(): Promise<{ used: string; total: string }> {
    // This would require querying storage objects
    return { used: '0', total: '0' };
  }

  /**
   * Upload JSON data
   */
  async uploadJson(
    data: unknown,
    options?: WalrusUploadOptions
  ): Promise<WalrusUploadResponse> {
    const jsonString = JSON.stringify(data);
    return this.upload(jsonString, {
      ...options,
      contentType: 'application/json',
    });
  }

  /**
   * Download and parse JSON data
   */
  async downloadJson<T = unknown>(blobId: string): Promise<T> {
    const blob = await this.download(blobId);
    const text = new TextDecoder().decode(blob.data);
    
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new WalrusValidationError(
        `Invalid JSON in blob ${blobId}`,
        'json',
        text.substring(0, 100)
      );
    }
  }

  /**
   * Upload image file (for browser use with File objects)
   */
  async uploadImage(
    file: File,
    options?: WalrusUploadOptions
  ): Promise<WalrusUploadResponse> {
    if (!RUNTIME.isBrowser) {
      throw new WalrusClientError('uploadImage with File objects is only available in browsers');
    }

    const data = await file.arrayBuffer();
    return this.upload(new Uint8Array(data), {
      ...options,
      contentType: file.type,
    });
  }

  /**
   * Get public URL for a blob
   */
  getBlobUrl(blobId: string): string {
    this.validateBlobId(blobId);
    return `${this.config.getAggregatorUrl()}${API_ENDPOINTS.BLOB.replace('{blobId}', blobId)}`;
  }

  /**
   * Get storage information for a blob
   */
  async getStorageInfo(blobId: string): Promise<WalrusStorageInfo> {
    const exists = await this.exists(blobId);
    
    if (!exists) {
      return { exists: false };
    }

    try {
      const blobInfo = await this.getBlobInfo(blobId);
      let storageCost;
      
      if (blobInfo.size) {
        const costs = await this.calculateStorageCost(blobInfo.size, 5);
        storageCost = {
          total: costs.totalCost,
          storage: costs.storageCost,
          write: costs.writeCost,
        };
      }

      return {
        exists: true,
        ...(blobInfo.size !== undefined && { size: blobInfo.size }),
        ...(storageCost && { storageCost }),
      };
    } catch (error) {
      return { exists: true }; // We know it exists, but couldn't get details
    }
  }

  /**
   * Store a todo on Walrus (consolidated from CLI implementation)
   */
  async storeTodo(todo: Todo, epochs: number = 5): Promise<string> {
    await this.connect();

    if (this.useMockMode) {
      return `mock-blob-${todo.id}`;
    }

    if (RUNTIME.isNode && this.tempDir && fs && path && exec) {
      // Use CLI implementation in Node.js
      return this.storeTodoViaCLI(todo, epochs);
    } else {
      // Use HTTP API in browser or fallback
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

      const result = await this.uploadJson(todoData, { epochs });
      return result.blobId;
    }
  }

  /**
   * Store a todo list on Walrus
   */
  async storeList(list: TodoList, epochs: number = 5): Promise<string> {
    await this.connect();

    if (this.useMockMode) {
      return `mock-blob-list-${list.id}`;
    }

    if (RUNTIME.isNode && this.tempDir && fs && path && exec) {
      return this.storeListViaCLI(list, epochs);
    } else {
      const result = await this.uploadJson(list, { epochs });
      return result.blobId;
    }
  }

  /**
   * Store todo list (alias for backward compatibility)
   */
  async storeTodoList(list: TodoList, epochs: number = 5): Promise<string> {
    return this.storeList(list, epochs);
  }

  /**
   * Retrieve a todo from Walrus
   */
  async retrieveTodo(blobId: string): Promise<Todo> {
    await this.connect();

    if (this.useMockMode) {
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

    if (RUNTIME.isNode && this.tempDir && fs && path && exec) {
      return this.retrieveTodoViaCLI(blobId);
    } else {
      return this.downloadJson<Todo>(blobId);
    }
  }

  /**
   * Retrieve a todo list from Walrus
   */
  async retrieveList(blobId: string): Promise<TodoList> {
    await this.connect();

    if (this.useMockMode) {
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

    if (RUNTIME.isNode && this.tempDir && fs && path && exec) {
      return this.retrieveListViaCLI(blobId);
    } else {
      return this.downloadJson<TodoList>(blobId);
    }
  }

  /**
   * Store todo via CLI (Node.js specific)
   */
  private async storeTodoViaCLI(todo: Todo, epochs: number): Promise<string> {
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

      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      const command = `${this.walrusPath} --config ${this.configPath} store --epochs ${epochs} ${tempFile}`;
      const { stdout } = await execAsync(command);

      const blobIdMatch = stdout.match(/Blob ID: ([^\n]+)/);
      if (!blobIdMatch) {
        throw new WalrusStorageError('Failed to parse blob ID from Walrus output', 'storeTodo');
      }

      return blobIdMatch[1];
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }

  /**
   * Store list via CLI (Node.js specific)
   */
  private async storeListViaCLI(list: TodoList, epochs: number): Promise<string> {
    const tempFile = path.join(this.tempDir, `list-${list.id}.json`);

    try {
      fs.writeFileSync(tempFile, JSON.stringify(list, null, 2));

      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      const command = `${this.walrusPath} --config ${this.configPath} store --epochs ${epochs} ${tempFile}`;
      const { stdout } = await execAsync(command);

      const blobIdMatch = stdout.match(/Blob ID: ([^\n]+)/);
      if (!blobIdMatch) {
        throw new WalrusStorageError('Failed to parse blob ID from Walrus output', 'storeList');
      }

      return blobIdMatch[1];
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }

  /**
   * Retrieve todo via CLI (Node.js specific)
   */
  private async retrieveTodoViaCLI(blobId: string): Promise<Todo> {
    const tempFile = path.join(this.tempDir, `retrieved-${Date.now()}.json`);

    try {
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      const command = `${this.walrusPath} --config ${this.configPath} get ${blobId} --output ${tempFile}`;
      await execAsync(command);

      const data = fs.readFileSync(tempFile, 'utf8');
      return JSON.parse(data);
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }

  /**
   * Retrieve list via CLI (Node.js specific)
   */
  private async retrieveListViaCLI(blobId: string): Promise<TodoList> {
    const tempFile = path.join(this.tempDir, `retrieved-list-${Date.now()}.json`);

    try {
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      const command = `${this.walrusPath} --config ${this.configPath} get ${blobId} --output ${tempFile}`;
      await execAsync(command);

      const data = fs.readFileSync(tempFile, 'utf8');
      return JSON.parse(data);
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }

  /**
   * Store blob data with detailed results
   */
  async storeTodoWithDetails(todo: Todo, epochs: number = 5): Promise<{
    blobId: string;
    transactionId?: string;
    explorerUrl?: string;
    aggregatorUrl?: string;
    networkInfo: {
      network: string;
      epochs: number;
    };
  }> {
    await this.connect();

    if (this.useMockMode) {
      const mockBlobId = `mock-blob-${todo.id}`;
      const mockTxId = `mock-tx-${Date.now()}`;
      return {
        blobId: mockBlobId,
        transactionId: mockTxId,
        explorerUrl: `https://suiscan.xyz/testnet/tx/${mockTxId}`,
        aggregatorUrl: `https://aggregator-testnet.walrus.space/v1/${mockBlobId}`,
        networkInfo: {
          network: this.config.getNetwork(),
          epochs
        }
      };
    }

    const blobId = await this.storeTodo(todo, epochs);
    const network = this.config.getNetwork();
    
    return {
      blobId,
      aggregatorUrl: this.getBlobUrl(blobId),
      networkInfo: {
        network,
        epochs
      }
    };
  }

  /**
   * Update a todo (creates new version)
   */
  async updateTodo(blobId: string, todo: Todo, epochs: number = 5): Promise<string> {
    return this.storeTodo(todo, epochs);
  }

  /**
   * Check for existing storage allocations
   */
  async checkExistingStorage(): Promise<{
    id: { id: string };
    storage_size: string;
    used_size: string;
  } | null> {
    await this.connect();

    if (this.useMockMode) {
      return {
        id: { id: 'mock-storage-id' },
        storage_size: '1000000',
        used_size: '500000',
      };
    }

    return null;
  }

  /**
   * Get the active wallet address
   */
  async getActiveAddress(): Promise<string> {
    await this.connect();

    if (this.useMockMode) {
      return 'mock-sui-address';
    }

    if (RUNTIME.isNode && exec) {
      try {
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        const { stdout } = await execAsync('sui client active-address');
        return stdout.trim();
      } catch (error) {
        throw new WalrusClientError('Failed to get active address');
      }
    }

    return 'unknown-address';
  }

  /**
   * Check balance
   */
  async checkBalance(): Promise<number> {
    if (this.useMockMode) {
      return 1.0;
    }

    if (RUNTIME.isNode && exec) {
      try {
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        const { stdout } = await execAsync('sui client balance');
        const walMatch = stdout.match(/WAL Token\s+\d+\s+([\d.]+)\s+WAL/);
        if (walMatch) {
          return parseFloat(walMatch[1]);
        }
      } catch (error) {
        // Ignore errors
      }
    }
    
    return 0;
  }

  private validateBlobId(blobId: string): void {
    if (!blobId || typeof blobId !== 'string') {
      throw new WalrusValidationError('Blob ID must be a non-empty string', 'blobId', blobId);
    }
    
    // Basic validation - actual format may vary
    if (blobId.length < 10) {
      throw new WalrusValidationError('Blob ID appears to be too short', 'blobId', blobId);
    }
  }
}