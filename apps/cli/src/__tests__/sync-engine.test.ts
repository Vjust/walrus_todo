import { SyncEngine, SyncEngineConfig } from '../services/syncEngine';
import { FileWatcher } from '../utils/fileWatcher';
import { ApiClient } from '../utils/apiClient';
import { TodoService } from '../services/todoService';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock dependencies
jest.mock('../utils/fileWatcher');
jest.mock('../utils/apiClient');
jest.mock('../services/todoService');
jest.mock('../utils/BackgroundCommandOrchestrator');

describe('SyncEngine', () => {
  let syncEngine: SyncEngine;
  let mockConfig: SyncEngineConfig;
  let mockTodosDir: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    mockTodosDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'waltodo-sync-test-')
    );

    mockConfig = {
      todosDirectory: mockTodosDir,
      apiConfig: {
        baseURL: 'http://localhost:3001',
        timeout: 5000,
        enableWebSocket: true,
      },
      syncInterval: 1000,
      conflictResolution: 'newest',
      enableRealTimeSync: true,
      maxConcurrentSyncs: 2,
      syncDebounceMs: 500,
    };

    syncEngine = new SyncEngine(mockConfig);
  });

  afterEach(async () => {
    if (syncEngine) {
      await syncEngine.shutdown();
    }

    // Clean up temp directory
    try {
      await fs.rmdir(mockTodosDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const initPromise = new Promise<void>(resolve => {
        syncEngine.on('initialized', resolve);
      });

      await syncEngine.initialize('test-wallet');
      await initPromise;

      expect(syncEngine.getSyncStatus().isActive).toBe(false); // Not started yet
    });

    it('should create todos directory if it does not exist', async () => {
      const nonExistentDir = path.join(mockTodosDir, 'nested', 'todos');

      const config = {
        ...mockConfig,
        todosDirectory: nonExistentDir,
      };

      const engine = new SyncEngine(config);
      await engine.initialize('test-wallet');

      const stats = await fs.stat(nonExistentDir);
      expect(stats.isDirectory()).toBe(true);

      await engine.shutdown();
    });
  });

  describe('sync status', () => {
    it('should return correct initial status', () => {
      const status = syncEngine.getSyncStatus();

      expect(status).toEqual({
        isActive: false,
        lastSync: 0,
        pendingChanges: 0,
        conflicts: [],
        errors: [],
      });
    });

    it('should update status when started', async () => {
      await syncEngine.initialize('test-wallet');
      await syncEngine.start();

      const status = syncEngine.getSyncStatus();
      expect(status.isActive).toBe(true);
    });
  });

  describe('configuration', () => {
    it('should apply default configuration values', () => {
      const minimalConfig: SyncEngineConfig = {
        todosDirectory: mockTodosDir,
        apiConfig: {
          baseURL: 'http://localhost:3001',
        },
      };

      const engine = new SyncEngine(minimalConfig);
      const config = engine.getConfig();

      expect(config.syncInterval).toBe(30000); // Default value
      expect(config.conflictResolution).toBe('newest'); // Default value
      expect(config.enableRealTimeSync).toBe(true); // Default value
    });

    it('should override default values with provided config', () => {
      const config = syncEngine.getConfig();

      expect(config.syncInterval).toBe(1000); // From mockConfig
      expect(config.conflictResolution).toBe('newest'); // From mockConfig
      expect(config.maxConcurrentSyncs).toBe(2); // From mockConfig
    });
  });

  describe('file watching', () => {
    it('should setup file watcher correctly', async () => {
      const MockFileWatcher = FileWatcher as jest.MockedClass<
        typeof FileWatcher
      >;

      await syncEngine.initialize('test-wallet');

      expect(MockFileWatcher).toHaveBeenCalledWith({
        recursive: true,
        ignoreInitial: false,
        debounceMs: 1000,
        fileExtensions: ['.json'],
        excludePatterns: expect.arrayContaining([
          expect.any(RegExp), // Should include exclude patterns
        ]),
      });
    });
  });

  describe('API client', () => {
    it('should setup API client with correct config', async () => {
      const MockApiClient = ApiClient as jest.MockedClass<typeof ApiClient>;

      await syncEngine.initialize('test-wallet');

      expect(MockApiClient).toHaveBeenCalledWith({
        baseURL: 'http://localhost:3001',
        timeout: 5000,
        enableWebSocket: true,
      });
    });
  });

  describe('error handling', () => {
    it('should emit error events when file watcher fails', async () => {
      const MockFileWatcher = FileWatcher as jest.MockedClass<
        typeof FileWatcher
      >;
      const mockInstance = MockFileWatcher.mock.instances[0] as any;

      await syncEngine.initialize('test-wallet');

      const errorPromise = new Promise<Error>(resolve => {
        syncEngine.on('error', resolve);
      });

      const testError = new Error('File watcher error');
      mockInstance.emit('error', testError);

      const receivedError = await errorPromise;
      expect(receivedError).toBe(testError);
    });

    it('should emit error events when API client fails', async () => {
      const MockApiClient = ApiClient as jest.MockedClass<typeof ApiClient>;
      const mockInstance = MockApiClient.mock.instances[0] as any;

      await syncEngine.initialize('test-wallet');

      const errorPromise = new Promise<Error>(resolve => {
        syncEngine.on('error', resolve);
      });

      const testError = new Error('API client error');
      mockInstance.emit('error', testError);

      const receivedError = await errorPromise;
      expect(receivedError).toBe(testError);
    });
  });

  describe('lifecycle management', () => {
    it('should start and stop correctly', async () => {
      await syncEngine.initialize('test-wallet');

      const startPromise = new Promise<void>(resolve => {
        syncEngine.on('started', resolve);
      });

      await syncEngine.start();
      await startPromise;

      expect(syncEngine.getSyncStatus().isActive).toBe(true);

      const stopPromise = new Promise<void>(resolve => {
        syncEngine.on('stopped', resolve);
      });

      await syncEngine.stop();
      await stopPromise;

      expect(syncEngine.getSyncStatus().isActive).toBe(false);
    });

    it('should shutdown cleanly', async () => {
      await syncEngine.initialize('test-wallet');
      await syncEngine.start();

      // Should not throw
      await syncEngine.shutdown();

      expect(syncEngine.getSyncStatus().isActive).toBe(false);
    });
  });

  describe('wallet management', () => {
    it('should set wallet correctly', async () => {
      await syncEngine.initialize();

      await syncEngine.setWallet('new-wallet-address');

      // Verify API client was called to connect with new wallet
      const MockApiClient = ApiClient as jest.MockedClass<typeof ApiClient>;
      const mockInstance = MockApiClient.mock.instances[0] as any;
      expect(mockInstance.connect).toHaveBeenCalledWith('new-wallet-address');
    });
  });
});

// Integration test with mocked file system
describe('SyncEngine Integration', () => {
  let syncEngine: SyncEngine;
  let mockTodosDir: string;

  beforeEach(async () => {
    mockTodosDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'waltodo-integration-')
    );
  });

  afterEach(async () => {
    if (syncEngine) {
      await syncEngine.shutdown();
    }

    try {
      await fs.rmdir(mockTodosDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should detect file changes and trigger sync', async () => {
    const config: SyncEngineConfig = {
      todosDirectory: mockTodosDir,
      apiConfig: {
        baseURL: 'http://localhost:3001',
        enableWebSocket: false, // Disable for testing
      },
      enableRealTimeSync: true,
      syncDebounceMs: 100, // Fast for testing
    };

    syncEngine = new SyncEngine(config);

    await syncEngine.initialize('test-wallet');
    await syncEngine.start();

    // Create a test todo file
    const testTodoFile = path.join(mockTodosDir, 'test-list.json');
    const testTodo = {
      name: 'test-list',
      todos: [
        {
          id: 'test-todo-1',
          title: 'Test Todo',
          completed: false,
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Write the file and wait for sync
    await fs.writeFile(testTodoFile, JSON.stringify(testTodo, null, 2));

    // Wait a bit for the file watcher to detect the change
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify that sync was triggered (through mocked API calls)
    const MockApiClient = ApiClient as jest.MockedClass<typeof ApiClient>;
    const mockInstance = MockApiClient.mock.instances[0] as any;

    // Should have attempted to push the todo
    expect(mockInstance.pushTodo).toHaveBeenCalled();
  });
});
