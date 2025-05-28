import { SyncCommand } from '../../apps/cli/src/commands/sync';
import { ConfigService } from '../../apps/cli/src/services/config-service';
import { WalrusStorage } from '../../apps/cli/src/utils/walrus-storage';
import type { WalrusStorage as WalrusStorageType } from '../../apps/cli/src/utils/walrus-storage';
import * as readline from 'readline';
import chalk from 'chalk';
import { Todo } from '../../apps/cli/src/types/todo';
import { CliConfig } from '../../apps/cli/src/types/config';

jest.mock('../../apps/cli/src/services/config-service');
jest.mock('../../apps/cli/src/utils/walrus-storage');
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
      priority: 'high' as const,
      category: 'work',
      updatedAt: new Date().toISOString(),
      private: true,
      tags: [],
    },
    {
      id: 'remote-2',
      title: 'Remote Todo 2',
      completed: true,
      createdAt: new Date().toISOString(),
      priority: 'medium' as const,
      category: 'personal',
      updatedAt: new Date().toISOString(),
      private: true,
      tags: [],
    },
  ];

  const mockLocalTodos: Todo[] = [
    {
      id: 'local-1',
      title: 'Local Todo 1',
      completed: false,
      createdAt: new Date().toISOString(),
      priority: 'low' as const,
      category: '',
      updatedAt: new Date().toISOString(),
      private: true,
      tags: [],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console methods to prevent output during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    mockConfigService = new ConfigService() as jest.Mocked<ConfigService>;
    mockWalrusStorage = new WalrusStorage(
      'testnet',
      true
    ) as jest.Mocked<WalrusStorageType>;

    sync = new SyncCommand([], {} as CliConfig);

    // Mock the services
    jest
      .spyOn(sync as unknown as { getConfigService: () => ConfigService }, 'getConfigService')
      .mockReturnValue(mockConfigService);
    jest
      .spyOn(sync as unknown as { getWalrusStorage: () => WalrusStorageType }, 'getWalrusStorage')
      .mockReturnValue(mockWalrusStorage);
  });

  describe('run', () => {
    it('should sync todos with merge option', async () => {
      // Setup mocks
      mockWalrusStorage.retrieve.mockResolvedValue({
        id: mockBlobId,
        todos: mockRemoteTodos,
      });
      mockConfigService.getTodoList.mockResolvedValue(mockLocalTodos);
      mockConfigService.saveAllTodos.mockResolvedValue(true);

      // Mock interactive prompt
      const mockReadline: Partial<readline.Interface> = {
        question: jest.fn((_, callback) => callback('merge')),
        close: jest.fn(),
      };
      jest
        .spyOn(readline, 'createInterface')
        .mockReturnValue(mockReadline as readline.Interface);

      // Run the command
      await sync.run({ args: { blobIdOrUrl: mockBlobId } });

      // Verify the flow
      expect(mockWalrusStorage.retrieve).toHaveBeenCalledWith(mockBlobId);
      expect(mockConfigService.getTodoList).toHaveBeenCalled();
      expect(mockConfigService.saveAllTodos).toHaveBeenCalledWith([
        ...mockLocalTodos,
        ...mockRemoteTodos,
      ]);
      expect(mockReadline.close).toHaveBeenCalled();
    });

    it('should sync todos with replace option', async () => {
      mockWalrusStorage.retrieve.mockResolvedValue({
        id: mockBlobId,
        todos: mockRemoteTodos,
      });
      mockConfigService.getTodoList.mockResolvedValue(mockLocalTodos);
      mockConfigService.saveAllTodos.mockResolvedValue(true);

      const mockReadline: Partial<readline.Interface> = {
        question: jest.fn((_, callback) => callback('replace')),
        close: jest.fn(),
      };
      jest
        .spyOn(readline, 'createInterface')
        .mockReturnValue(mockReadline as readline.Interface);

      await sync.run({ args: { blobIdOrUrl: mockBlobId } });

      expect(mockConfigService.saveAllTodos).toHaveBeenCalledWith(
        mockRemoteTodos
      );
    });

    it('should cancel sync operation', async () => {
      mockWalrusStorage.retrieve.mockResolvedValue({
        id: mockBlobId,
        todos: mockRemoteTodos,
      });
      mockConfigService.getTodoList.mockResolvedValue(mockLocalTodos);

      const mockReadline: Partial<readline.Interface> = {
        question: jest.fn((_, callback) => callback('cancel')),
        close: jest.fn(),
      };
      jest
        .spyOn(readline, 'createInterface')
        .mockReturnValue(mockReadline as readline.Interface);

      await sync.run({ args: { blobIdOrUrl: mockBlobId } });

      expect(mockConfigService.saveAllTodos).not.toHaveBeenCalled();
    });

    it('should handle shared link URLs', async () => {
      const sharedLink = `https://wal.gg/${mockBlobId}`;

      mockWalrusStorage.retrieve.mockResolvedValue({
        id: mockBlobId,
        todos: mockRemoteTodos,
      });
      mockConfigService.getTodoList.mockResolvedValue(mockLocalTodos);
      mockConfigService.saveAllTodos.mockResolvedValue(true);

      const mockReadline: Partial<readline.Interface> = {
        question: jest.fn((_, callback) => callback('merge')),
        close: jest.fn(),
      };
      jest
        .spyOn(readline, 'createInterface')
        .mockReturnValue(mockReadline as readline.Interface);

      await sync.run({ args: { blobIdOrUrl: sharedLink } });

      expect(mockWalrusStorage.retrieve).toHaveBeenCalledWith(mockBlobId);
    });

    it('should handle network errors gracefully', async () => {
      const mockError = new Error('Network error');
      mockWalrusStorage.retrieve.mockRejectedValue(mockError);

      await expect(
        sync.run({ args: { blobIdOrUrl: mockBlobId } })
      ).rejects.toThrow('Network error');

      expect(console.error).toHaveBeenCalledWith(
        chalk.red('Failed to sync:'),
        mockError.message
      );
    });

    it('should handle empty blob data', async () => {
      mockWalrusStorage.retrieve.mockResolvedValue({
        id: mockBlobId,
        todos: [],
      });
      mockConfigService.getTodoList.mockResolvedValue(mockLocalTodos);

      await sync.run({ args: { blobIdOrUrl: mockBlobId } });

      expect(console.warn).toHaveBeenCalledWith(
        chalk.yellow('The blob contains no todos.')
      );
      expect(console.log).toHaveBeenCalledWith('Nothing to sync.');
    });

    it('should display todo counts during sync', async () => {
      mockWalrusStorage.retrieve.mockResolvedValue({
        id: mockBlobId,
        todos: mockRemoteTodos,
      });
      mockConfigService.getTodoList.mockResolvedValue(mockLocalTodos);
      mockConfigService.saveAllTodos.mockResolvedValue(true);

      const mockReadline: Partial<readline.Interface> = {
        question: jest.fn((_, callback) => callback('merge')),
        close: jest.fn(),
      };
      jest
        .spyOn(readline, 'createInterface')
        .mockReturnValue(mockReadline as readline.Interface);

      await sync.run({ args: { blobIdOrUrl: mockBlobId } });

      expect(console.log).toHaveBeenCalledWith(
        `Found ${chalk.cyan(mockRemoteTodos.length)} todos in the blob.`
      );
      expect(console.log).toHaveBeenCalledWith(
        `You currently have ${chalk.cyan(mockLocalTodos.length)} todo.`
      );
    });

    it('should handle invalid blob ID', async () => {
      const invalidBlobId = 'invalid-id';
      const mockError = new Error('Invalid blob ID');
      mockWalrusStorage.retrieve.mockRejectedValue(mockError);

      await expect(
        sync.run({ args: { blobIdOrUrl: invalidBlobId } })
      ).rejects.toThrow('Invalid blob ID');

      expect(console.error).toHaveBeenCalledWith(
        chalk.red('Failed to sync:'),
        mockError.message
      );
    });

    it('should handle corrupted blob data', async () => {
      // Mock retrieve to return corrupted data
      mockWalrusStorage.retrieve.mockResolvedValue({
        id: mockBlobId,
        todos: null as unknown as Todo[], // This would cause an error when trying to access length
      });
      mockConfigService.getTodoList.mockResolvedValue(mockLocalTodos);

      await expect(
        sync.run({ args: { blobIdOrUrl: mockBlobId } })
      ).rejects.toThrow();
    });
  });

  describe('extractBlobId', () => {
    it('should extract blob ID from various URL formats', () => {
      const testCases = [
        { input: 'https://wal.gg/blob123', expected: 'blob123' },
        { input: 'http://wal.gg/blob456', expected: 'blob456' },
        { input: 'https://example.wal.app/blob/789', expected: '789' },
        { input: '0x12345', expected: '0x12345' },
        { input: 'plain-blob-id', expected: 'plain-blob-id' },
      ];

      testCases.forEach(({ input, expected }) => {
        expect((sync as unknown as { extractBlobId: (input: string) => string }).extractBlobId(input)).toBe(expected);
      });
    });
  });
});
