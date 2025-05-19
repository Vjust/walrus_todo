import { expect, jest, test, describe, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { ConfigService } from '../../../src/services/config-service';
import { CLIError } from '../../../src/types/error';
import { envConfig, getEnv } from '../../../src/utils/environment-config';
import { loadConfigFile, saveConfigToFile } from '../../../src/utils/config-loader';
import type { Config, Todo, TodoList } from '../../../src/types';
import type { Mock } from 'jest';

// Mock dependencies
jest.mock('fs');
jest.mock('../../../src/utils/environment-config');
jest.mock('../../../src/utils/config-loader');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockFsPromises = mockFs.promises as jest.Mocked<typeof fs.promises>;
const mockEnvConfig = envConfig as jest.Mocked<typeof envConfig>;
const mockGetEnv = getEnv as Mock;
const mockLoadConfigFile = loadConfigFile as Mock;
const mockSaveConfigToFile = saveConfigToFile as Mock;

describe('ConfigService', () => {
  let configService: ConfigService;
  const mockConfigPath = '/home/user/.waltodo.json';
  const mockTodosPath = path.resolve(process.cwd(), 'Todos');
  const mockConfig: Config = {
    network: 'testnet',
    walletAddress: '0x123',
    encryptedStorage: false,
    packageId: '0xpackage',
    registryId: '0xregistry'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockFs.existsSync.mockReturnValue(false);
    mockGetEnv.mockReturnValue('');
    mockEnvConfig.updateConfig.mockReturnValue(undefined);
    mockLoadConfigFile.mockReturnValue({});
    
    // Mock HOME environment
    process.env.HOME = '/home/user';
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('constructor', () => {
    test('should use current directory config if it exists', () => {
      const currentDirConfig = path.join(process.cwd(), '.waltodo.json');
      mockFs.existsSync.mockImplementation((path) => {
        return path === currentDirConfig;
      });
      mockLoadConfigFile.mockReturnValue(mockConfig);

      configService = new ConfigService();

      expect(mockFs.existsSync).toHaveBeenCalledWith(currentDirConfig);
      expect(mockLoadConfigFile).toHaveBeenCalledWith(currentDirConfig);
    });

    test('should use home directory config if current directory config does not exist', () => {
      mockFs.existsSync.mockImplementation((path) => {
        return path === mockConfigPath;
      });
      mockLoadConfigFile.mockReturnValue(mockConfig);

      configService = new ConfigService();

      expect(mockLoadConfigFile).toHaveBeenCalledWith(mockConfigPath);
    });

    test('should use environment storage path if set', () => {
      mockGetEnv.mockImplementation((key) => {
        if (key === 'STORAGE_PATH') return '/custom/path';
        return '';
      });

      configService = new ConfigService();

      expect(mockGetEnv).toHaveBeenCalledWith('STORAGE_PATH');
    });

    test('should create todos directory if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockReturnValue(undefined);

      configService = new ConfigService();

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('Todos'),
        { recursive: true }
      );
    });

    test('should throw error if todos directory creation fails', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => new ConfigService()).toThrow(CLIError);
    });
  });

  describe('loadConfig', () => {
    test('should load config from file if it exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockLoadConfigFile.mockReturnValue({
        network: 'mainnet',
        walletAddress: '0x456',
        encryptedStorage: true
      });

      configService = new ConfigService();
      const config = configService.getConfig();

      expect(config.network).toBe('mainnet');
      expect(config.walletAddress).toBe('0x456');
      expect(config.encryptedStorage).toBe(true);
    });

    test('should fall back to environment variables', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockGetEnv.mockImplementation((key) => {
        if (key === 'NETWORK') return 'devnet';
        if (key === 'WALLET_ADDRESS') return '0x789';
        if (key === 'ENCRYPTED_STORAGE') return 'true';
        return '';
      });

      configService = new ConfigService();
      const config = configService.getConfig();

      expect(config.network).toBe('devnet');
      expect(config.walletAddress).toBe('0x789');
    });

    test('should use defaults if no config or env vars', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockGetEnv.mockReturnValue('');

      configService = new ConfigService();
      const config = configService.getConfig();

      expect(config.network).toBe('testnet');
      expect(config.walletAddress).toBe('');
      expect(config.encryptedStorage).toBe(false);
    });

    test('should throw error if config file is corrupted', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockLoadConfigFile.mockImplementation(() => {
        throw new Error('Invalid JSON');
      });

      expect(() => new ConfigService()).toThrow(CLIError);
    });
  });

  describe('updateEnvironmentConfig', () => {
    test('should update environment with config values', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockLoadConfigFile.mockReturnValue(mockConfig);

      configService = new ConfigService();

      expect(mockEnvConfig.updateConfig).toHaveBeenCalledWith('NETWORK', 'testnet', 'config');
      expect(mockEnvConfig.updateConfig).toHaveBeenCalledWith('WALLET_ADDRESS', '0x123', 'config');
      expect(mockEnvConfig.updateConfig).toHaveBeenCalledWith('ENCRYPTED_STORAGE', false, 'config');
    });

    test('should update package ID from config', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockLoadConfigFile.mockReturnValue({
        ...mockConfig,
        packageId: '0xnewpackage'
      });

      configService = new ConfigService();

      expect(mockEnvConfig.updateConfig).toHaveBeenCalledWith('TODO_PACKAGE_ID', '0xnewpackage', 'config');
    });

    test('should update package ID from lastDeployment', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockLoadConfigFile.mockReturnValue({
        ...mockConfig,
        packageId: undefined,
        lastDeployment: { packageId: '0xdeployedpackage' }
      });

      configService = new ConfigService();

      expect(mockEnvConfig.updateConfig).toHaveBeenCalledWith('TODO_PACKAGE_ID', '0xdeployedpackage', 'config');
    });

    test('should update registry ID if present', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockLoadConfigFile.mockReturnValue({
        ...mockConfig,
        registryId: '0xnewregistry'
      });

      configService = new ConfigService();

      expect(mockEnvConfig.updateConfig).toHaveBeenCalledWith('REGISTRY_ID', '0xnewregistry', 'config');
    });
  });

  describe('saveConfig', () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
      mockLoadConfigFile.mockReturnValue(mockConfig);
      configService = new ConfigService();
    });

    test('should merge and save partial config', async () => {
      await configService.saveConfig({ network: 'mainnet' });

      expect(mockSaveConfigToFile).toHaveBeenCalledWith(
        expect.objectContaining({
          network: 'mainnet',
          walletAddress: '0x123'
        }),
        mockConfigPath
      );
    });

    test('should update environment config after saving', async () => {
      jest.clearAllMocks();
      
      await configService.saveConfig({ walletAddress: '0xnew' });

      expect(mockEnvConfig.updateConfig).toHaveBeenCalledWith('WALLET_ADDRESS', '0xnew', 'config');
    });

    test('should throw error if save fails', async () => {
      mockSaveConfigToFile.mockImplementation(() => {
        throw new Error('Write permission denied');
      });

      await expect(configService.saveConfig({ network: 'mainnet' }))
        .rejects.toThrow(CLIError);
    });
  });

  describe('Todo list operations', () => {
    const mockListName = 'test-list';
    const mockListPath = path.join(mockTodosPath, `${mockListName}.json`);
    const mockTodoList: TodoList = {
      id: mockListName,
      name: mockListName,
      owner: 'local',
      todos: [],
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const mockTodo: Todo = {
      id: 'todo-1',
      title: 'Test Todo',
      description: 'Description',
      completed: false,
      createdAt: new Date().toISOString()
    };

    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
      mockLoadConfigFile.mockReturnValue(mockConfig);
      configService = new ConfigService();
    });

    describe('saveListData', () => {
      test('should save list data to file', async () => {
        mockFsPromises.writeFile = jest.fn().mockResolvedValue(undefined);

        await configService.saveListData(mockListName, mockTodoList);

        expect(mockFsPromises.writeFile).toHaveBeenCalledWith(
          mockListPath,
          JSON.stringify(mockTodoList, null, 2)
        );
      });

      test('should throw error if save fails', async () => {
        mockFsPromises.writeFile = jest.fn().mockRejectedValue(new Error('Write failed'));

        await expect(configService.saveListData(mockListName, mockTodoList))
          .rejects.toThrow(CLIError);
      });
    });

    describe('loadListData', () => {
      test('should load list data from file', async () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFsPromises.readFile = jest.fn().mockResolvedValue(JSON.stringify(mockTodoList));

        const result = await configService.getLocalTodos(mockListName);

        expect(result).toEqual(mockTodoList);
        expect(mockFsPromises.readFile).toHaveBeenCalledWith(mockListPath, 'utf-8');
      });

      test('should return null if list does not exist', async () => {
        mockFs.existsSync.mockReturnValue(false);

        const result = await configService.getLocalTodos(mockListName);

        expect(result).toBeNull();
      });

      test('should throw error if read fails', async () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFsPromises.readFile = jest.fn().mockRejectedValue(new Error('Read failed'));

        await expect(configService.getLocalTodos(mockListName))
          .rejects.toThrow(CLIError);
      });
    });

    describe('getAllLists', () => {
      test('should return all list names', async () => {
        mockFsPromises.readdir = jest.fn().mockResolvedValue([
          'list1.json',
          'list2.json',
          'other.txt'
        ]);

        const result = await configService.getAllLists();

        expect(result).toEqual(['list1', 'list2']);
      });

      test('should throw error if readdir fails', async () => {
        mockFsPromises.readdir = jest.fn().mockRejectedValue(new Error('Read failed'));

        await expect(configService.getAllLists())
          .rejects.toThrow(CLIError);
      });
    });

    describe('saveLocalTodo', () => {
      test('should add todo to existing list', async () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFsPromises.readFile = jest.fn().mockResolvedValue(JSON.stringify(mockTodoList));
        mockFsPromises.writeFile = jest.fn().mockResolvedValue(undefined);

        await configService.saveLocalTodo(mockListName, mockTodo);

        expect(mockFsPromises.writeFile).toHaveBeenCalledWith(
          mockListPath,
          expect.stringContaining(mockTodo.id)
        );
      });

      test('should create new list if it does not exist', async () => {
        mockFs.existsSync.mockReturnValue(false);
        mockFsPromises.writeFile = jest.fn().mockResolvedValue(undefined);

        await configService.saveLocalTodo(mockListName, mockTodo);

        expect(mockFsPromises.writeFile).toHaveBeenCalledWith(
          mockListPath,
          expect.stringContaining(mockTodo.id)
        );
      });
    });

    describe('updateLocalTodo', () => {
      test('should update existing todo', async () => {
        const existingList = {
          ...mockTodoList,
          todos: [mockTodo]
        };
        const updatedTodo = { ...mockTodo, completed: true };

        mockFs.existsSync.mockReturnValue(true);
        mockFsPromises.readFile = jest.fn().mockResolvedValue(JSON.stringify(existingList));
        mockFsPromises.writeFile = jest.fn().mockResolvedValue(undefined);

        await configService.updateLocalTodo(mockListName, updatedTodo);

        expect(mockFsPromises.writeFile).toHaveBeenCalledWith(
          mockListPath,
          expect.stringContaining('"completed":true')
        );
      });

      test('should throw error if list not found', async () => {
        mockFs.existsSync.mockReturnValue(false);

        await expect(configService.updateLocalTodo(mockListName, mockTodo))
          .rejects.toThrow('List "test-list" not found');
      });

      test('should throw error if todo not found', async () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFsPromises.readFile = jest.fn().mockResolvedValue(JSON.stringify(mockTodoList));

        await expect(configService.updateLocalTodo(mockListName, mockTodo))
          .rejects.toThrow(`Todo "${mockTodo.id}" not found in list "${mockListName}"`);
      });
    });

    describe('deleteLocalTodo', () => {
      test('should delete todo from list', async () => {
        const existingList = {
          ...mockTodoList,
          todos: [mockTodo]
        };

        mockFs.existsSync.mockReturnValue(true);
        mockFsPromises.readFile = jest.fn().mockResolvedValue(JSON.stringify(existingList));
        mockFsPromises.writeFile = jest.fn().mockResolvedValue(undefined);

        await configService.deleteLocalTodo(mockListName, mockTodo.id);

        const writeCall = mockFsPromises.writeFile.mock.calls[0];
        const savedData = JSON.parse(writeCall[1] as string);
        expect(savedData.todos).toHaveLength(0);
      });

      test('should throw error if list not found', async () => {
        mockFs.existsSync.mockReturnValue(false);

        await expect(configService.deleteLocalTodo(mockListName, mockTodo.id))
          .rejects.toThrow('List "test-list" not found');
      });

      test('should throw error if todo not found', async () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFsPromises.readFile = jest.fn().mockResolvedValue(JSON.stringify(mockTodoList));

        await expect(configService.deleteLocalTodo(mockListName, 'non-existent'))
          .rejects.toThrow('Todo "non-existent" not found in list "test-list"');
      });
    });

    describe('deleteList', () => {
      test('should delete list file', async () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFsPromises.unlink = jest.fn().mockResolvedValue(undefined);

        await configService.deleteList(mockListName);

        expect(mockFsPromises.unlink).toHaveBeenCalledWith(mockListPath);
      });

      test('should not throw if list does not exist', async () => {
        mockFs.existsSync.mockReturnValue(false);

        await expect(configService.deleteList(mockListName))
          .resolves.not.toThrow();
      });

      test('should throw error if unlink fails', async () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFsPromises.unlink = jest.fn().mockRejectedValue(new Error('Permission denied'));

        await expect(configService.deleteList(mockListName))
          .rejects.toThrow(CLIError);
      });
    });

    describe('getLocalTodoById', () => {
      test('should find todo across all lists', async () => {
        mockFsPromises.readdir = jest.fn().mockResolvedValue(['list1.json', 'list2.json']);
        mockFs.existsSync.mockReturnValue(true);
        mockFsPromises.readFile = jest.fn()
          .mockResolvedValueOnce(JSON.stringify(mockTodoList))
          .mockResolvedValueOnce(JSON.stringify({
            ...mockTodoList,
            todos: [mockTodo]
          }));

        const result = await configService.getLocalTodoById(mockTodo.id);

        expect(result).toEqual(mockTodo);
      });

      test('should return null if todo not found', async () => {
        mockFsPromises.readdir = jest.fn().mockResolvedValue(['list1.json']);
        mockFs.existsSync.mockReturnValue(true);
        mockFsPromises.readFile = jest.fn().mockResolvedValue(JSON.stringify(mockTodoList));

        const result = await configService.getLocalTodoById('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('updateFromEnvironment', () => {
      beforeEach(() => {
        mockFs.existsSync.mockReturnValue(true);
        mockLoadConfigFile.mockReturnValue(mockConfig);
        configService = new ConfigService();
      });

      test('should update config from environment variables', () => {
        mockGetEnv.mockImplementation((key) => {
          if (key === 'NETWORK') return 'mainnet';
          if (key === 'WALLET_ADDRESS') return '0xnewaddress';
          return '';
        });
        mockSaveConfigToFile.mockReturnValue(undefined);

        configService.updateFromEnvironment();

        expect(mockSaveConfigToFile).toHaveBeenCalledWith(
          expect.objectContaining({
            network: 'mainnet',
            walletAddress: '0xnewaddress'
          }),
          mockConfigPath
        );
      });

      test('should not save if no changes', () => {
        mockGetEnv.mockImplementation((key) => {
          if (key === 'NETWORK') return 'testnet';
          if (key === 'WALLET_ADDRESS') return '0x123';
          return '';
        });

        configService.updateFromEnvironment();

        expect(mockSaveConfigToFile).not.toHaveBeenCalled();
      });

      test('should update encrypted storage', () => {
        mockGetEnv.mockImplementation((key) => {
          if (key === 'ENCRYPTED_STORAGE') return true;
          return '';
        });

        configService.updateFromEnvironment();

        expect(mockSaveConfigToFile).toHaveBeenCalledWith(
          expect.objectContaining({
            encryptedStorage: true
          }),
          mockConfigPath
        );
      });

      test('should update package and registry IDs', () => {
        mockGetEnv.mockImplementation((key) => {
          if (key === 'TODO_PACKAGE_ID') return '0xnewpackage';
          if (key === 'REGISTRY_ID') return '0xnewregistry';
          return '';
        });

        configService.updateFromEnvironment();

        expect(mockSaveConfigToFile).toHaveBeenCalledWith(
          expect.objectContaining({
            packageId: '0xnewpackage',
            registryId: '0xnewregistry'
          }),
          mockConfigPath
        );
      });
    });
  });

  describe('singleton instance', () => {
    test('should export singleton instance', () => {
      // Import the singleton
      const { configService: singleton } = require('../../../src/services/config-service');
      
      expect(singleton).toBeDefined();
      expect(singleton).toBeInstanceOf(ConfigService);
    });
  });
});