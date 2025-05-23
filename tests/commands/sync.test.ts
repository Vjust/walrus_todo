import { SyncCommand } from '../../src/commands/sync';
import { ConfigService } from '../../src/services/config-service';
import { WalrusStorage } from '../../src/utils/walrus-storage';
import type { WalrusStorage as WalrusStorageType } from '../../src/utils/walrus-storage';
import * as readline from 'readline';
import chalk from 'chalk';
import { Todo } from '../../src/types/todo';

jest.mock('../../src/services/config-service');
jest.mock('../../src/utils/walrus-storage');
jest.mock('readline');

describe('SyncCommand', () => {
  let sync: SyncCommand;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockWalrusStorage: jest.Mocked<WalrusStorageType>;

  const mockBlobId = '0x123456789';
  const mockRemoteTodos: Todo[] = [
    {
      id: 'remote-1',
      title: 'Remote Todo 1',
      completed: false,
      createdAt: new Date().toISOString(),
      priority: 'high',
      category: 'work',
      updatedAt: new Date().toISOString(),
      private: true,
      tags: []
    },
    {
      id: 'remote-2',
      title: 'Remote Todo 2',
      completed: true,
      createdAt: new Date().toISOString(),
      priority: 'medium',
      category: 'personal',
      updatedAt: new Date().toISOString(),
      private: true,
      tags: []
    }
  ];

  const mockLocalTodos: Todo[] = [
    {
      id: 'local-1',
      title: 'Local Todo 1',
      completed: false,
      createdAt: new Date().toISOString(),
      priority: 'low',
      category: '',
      updatedAt: new Date().toISOString(),
      private: true,
      tags: []
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfigService = new ConfigService() as jest.Mocked<ConfigService>;
    mockWalrusStorage = new WalrusStorage('testnet', true) as jest.Mocked<WalrusStorageType>;

    sync = new SyncCommand([], {} as any);
    
    // Mock the services
    jest.spyOn(sync as any, 'getConfigService').mockReturnValue(mockConfigService);
    jest.spyOn(sync as any, 'getWalrusStorage').mockReturnValue(mockWalrusStorage);
  });

  describe('run', () => {
    it('should sync todos with merge option', async () => {
      // Setup mocks
      mockWalrusStorage.retrieve.mockResolvedValue({
        id: mockBlobId,
        todos: mockRemoteTodos
      });
      mockConfigService.getTodoList.mockResolvedValue(mockLocalTodos);
      mockConfigService.saveAllTodos.mockResolvedValue(true);

      // Mock interactive prompt
      const mockReadline = {
        question: jest.fn((_, callback) => callback('merge')),
        close: jest.fn()
      };
      jest.spyOn(readline, 'createInterface').mockReturnValue(mockReadline as any);

      // Run the command
      await sync.run({ args: { blobIdOrUrl: mockBlobId } });

      // Verify the flow
      expect(mockWalrusStorage.retrieve).toHaveBeenCalledWith(mockBlobId);
      expect(mockConfigService.getTodoList).toHaveBeenCalled();
      expect(mockConfigService.saveAllTodos).toHaveBeenCalledWith([
        ...mockLocalTodos,
        ...mockRemoteTodos
      ]);
      expect(mockReadline.close).toHaveBeenCalled();
    });

    it('should sync todos with replace option', async () => {
      mockWalrusStorage.retrieve.mockResolvedValue({
        id: mockBlobId,
        todos: mockRemoteTodos
      });
      mockConfigService.getTodoList.mockResolvedValue(mockLocalTodos);
      mockConfigService.saveAllTodos.mockResolvedValue(true);

      const mockReadline = {
        question: jest.fn((_, callback) => callback('replace')),
        close: jest.fn()
      };
      jest.spyOn(readline, 'createInterface').mockReturnValue(mockReadline as any);

      await sync.run({ args: { blobIdOrUrl: mockBlobId } });

      expect(mockConfigService.saveAllTodos).toHaveBeenCalledWith(mockRemoteTodos);
    });

    it('should cancel sync operation', async () => {
      mockWalrusStorage.retrieve.mockResolvedValue({
        id: mockBlobId,
        todos: mockRemoteTodos
      });
      mockConfigService.getTodoList.mockResolvedValue(mockLocalTodos);

      const mockReadline = {
        question: jest.fn((_, callback) => callback('cancel')),
        close: jest.fn()
      };
      jest.spyOn(readline, 'createInterface').mockReturnValue(mockReadline as any);

      await sync.run({ args: { blobIdOrUrl: mockBlobId } });

      expect(mockConfigService.saveAllTodos).not.toHaveBeenCalled();
    });

    it('should handle shared link URLs', async () => {
      const sharedLink = `https://wal.gg/${mockBlobId}`;
      
      mockWalrusStorage.retrieve.mockResolvedValue({
        id: mockBlobId,
        todos: mockRemoteTodos
      });
      mockConfigService.getTodoList.mockResolvedValue(mockLocalTodos);
      mockConfigService.saveAllTodos.mockResolvedValue(true);

      const mockReadline = {
        question: jest.fn((_, callback) => callback('merge')),
        close: jest.fn()
      };
      jest.spyOn(readline, 'createInterface').mockReturnValue(mockReadline as any);

      await sync.run({ args: { blobIdOrUrl: sharedLink } });

      expect(mockWalrusStorage.retrieve).toHaveBeenCalledWith(mockBlobId);
    });

    it('should handle network errors gracefully', async () => {
      const mockError = new Error('Network error');
      mockWalrusStorage.retrieve.mockRejectedValue(mockError);

      // Mock console.error to prevent output during tests
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(sync.run({ args: { blobIdOrUrl: mockBlobId } }))
        .rejects.toThrow('Network error');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red('Failed to sync:'),
        mockError.message
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle empty blob data', async () => {
      mockWalrusStorage.retrieve.mockResolvedValue({
        id: mockBlobId,
        todos: []
      });
      mockConfigService.getTodoList.mockResolvedValue(mockLocalTodos);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await sync.run({ args: { blobIdOrUrl: mockBlobId } });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        chalk.yellow('The blob contains no todos.')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith('Nothing to sync.');

      consoleWarnSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should display todo counts during sync', async () => {
      mockWalrusStorage.retrieve.mockResolvedValue({
        id: mockBlobId,
        todos: mockRemoteTodos
      });
      mockConfigService.getTodoList.mockResolvedValue(mockLocalTodos);
      mockConfigService.saveAllTodos.mockResolvedValue(true);

      const mockReadline = {
        question: jest.fn((_, callback) => callback('merge')),
        close: jest.fn()
      };
      jest.spyOn(readline, 'createInterface').mockReturnValue(mockReadline as any);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await sync.run({ args: { blobIdOrUrl: mockBlobId } });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        `Found ${chalk.cyan(mockRemoteTodos.length)} todos in the blob.`
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        `You currently have ${chalk.cyan(mockLocalTodos.length)} todo.`
      );

      consoleLogSpy.mockRestore();
    });

    it('should handle invalid blob ID', async () => {
      const invalidBlobId = 'invalid-id';
      const mockError = new Error('Invalid blob ID');
      mockWalrusStorage.retrieve.mockRejectedValue(mockError);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(sync.run({ args: { blobIdOrUrl: invalidBlobId } }))
        .rejects.toThrow('Invalid blob ID');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red('Failed to sync:'),
        mockError.message
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle corrupted blob data', async () => {
      // Mock retrieve to return corrupted data
      mockWalrusStorage.retrieve.mockResolvedValue({
        id: mockBlobId,
        todos: null as any // This would cause an error when trying to access length
      });
      mockConfigService.getTodoList.mockResolvedValue(mockLocalTodos);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(sync.run({ args: { blobIdOrUrl: mockBlobId } }))
        .rejects.toThrow();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('extractBlobId', () => {
    it('should extract blob ID from various URL formats', () => {
      const testCases = [
        { input: 'https://wal.gg/blob123', expected: 'blob123' },
        { input: 'http://wal.gg/blob456', expected: 'blob456' },
        { input: 'https://example.wal.app/blob/789', expected: '789' },
        { input: '0x12345', expected: '0x12345' },
        { input: 'plain-blob-id', expected: 'plain-blob-id' }
      ];

      testCases.forEach(({ input, expected }) => {
        expect((sync as any).extractBlobId(input)).toBe(expected);
      });
    });
  });
});