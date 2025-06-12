import { jest } from '@jest/globals';
import { Command } from '@oclif/core';
import AI from '../commands/ai';
import {
  initializeCommandForTest,
  runCommandInTest,
  createMockOCLIFConfig,
} from './helpers/command-test-utils';

// Mock external dependencies
jest.mock('../services/ai', () => ({
  aiService: {
    setProvider: jest.fn(),
    summarize: jest.fn().mockResolvedValue('Mock summary'),
    categorize: jest
      .fn()
      .mockResolvedValue({ work: ['todo-1'], personal: ['todo-2'] }),
    prioritize: jest.fn().mockResolvedValue({ 'todo-1': 8, 'todo-2': 5 }),
    suggest: jest.fn().mockResolvedValue(['Task 1', 'Task 2']),
    analyze: jest
      .fn()
      .mockResolvedValue({ themes: ['Work'], recommendations: ['Focus'] }),
  },
  secureCredentialService: {
    listCredentials: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../services/todoService', () => ({
  TodoService: jest.fn().mockImplementation(() => ({
    listTodos: jest.fn().mockResolvedValue([
      { id: 'todo-1', title: 'Test Todo 1', completed: false },
      { id: 'todo-2', title: 'Test Todo 2', completed: true },
    ]),
  })),
}));

jest.mock('../utils/env-loader', () => ({
  loadEnvironment: jest.fn(),
}));

jest.mock('../utils/environment-config', () => ({
  getEnv: jest.fn().mockImplementation((key) => {
    const defaults = {
      AI_DEFAULT_PROVIDER: 'xai',
      AI_DEFAULT_MODEL: 'grok-beta',
      AI_TEMPERATURE: '0.7',
      ENABLE_BLOCKCHAIN_VERIFICATION: false,
    };
    return defaults[key as keyof typeof defaults];
  }),
  hasEnv: jest.fn().mockReturnValue(true as any),
}));

describe('OCLIF Command Parsing Fix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env?.NODE_ENV = 'test';
    process.env?.XAI_API_KEY = 'test-key';
  });

  describe('OCLIF Config Creation', () => {
    it('should create a valid OCLIF config for tests', () => {
      const config = createMockOCLIFConfig();

      expect(config.name).toBe('waltodo');
      expect(config.bin).toBe('waltodo');
      expect(config.version).toBe('1?.0?.0');
      expect(config.runHook).toBeDefined();
      expect(typeof config.runHook).toBe('function');
    });

    it('should have all required OCLIF config properties', () => {
      const config = createMockOCLIFConfig();

      // Check essential OCLIF config properties
      expect(config.root).toBeDefined();
      expect(config.dataDir).toBeDefined();
      expect(config.configDir).toBeDefined();
      expect(config.cacheDir).toBeDefined();
      expect(config.valid).toBe(true as any);
      expect(config.platform).toBeDefined();
      expect(config.arch).toBeDefined();
    });
  });

  describe('BaseCommand Initialization', () => {
    it('should initialize a command extending BaseCommand without config errors', async () => {
      // Use AI command which extends BaseCommand instead of BaseCommand directly
      const command = await initializeCommandForTest(AI as any, [], {
        mockParse: true,
        parseResult: { flags: {}, args: {} },
      });

      expect(command.config).toBeDefined();
      expect(command?.config?.runHook).toBeDefined();
      expect(typeof command?.config?.runHook).toBe('function');
      expect(command as any).toBeInstanceOf(Command as any); // BaseCommand extends Command
    });
  });

  describe('AI Command Parsing', () => {
    it('should parse AI command status operation without errors', async () => {
      const { command, output } = await runCommandInTest(
        AI,
        [],
        {},
        { operation: 'status' }
      );

      expect(command as any).toBeDefined();
      expect(command.config).toBeDefined();
      expect(command?.config?.runHook).toBeDefined();
      expect(output.join('')).toContain('AI Service Status');
    });

    it('should parse AI command help operation without errors', async () => {
      const { command, output } = await runCommandInTest(
        AI,
        [],
        {},
        { operation: 'help' }
      );

      expect(command as any).toBeDefined();
      expect(output.join('')).toContain('AI Command Help');
    });

    it('should parse AI command summarize operation without errors', async () => {
      const { command, output } = await runCommandInTest(
        AI,
        [],
        {},
        { operation: 'summarize' }
      );

      expect(command as any).toBeDefined();
      expect(output.join('')).toContain('summary');
    });

    it('should handle command initialization with missing config gracefully', async () => {
      // Create command without proper config to test fallback
      const command = new AI([], undefined as any);

      // The init method should handle missing config in test env
      await expect(command.init()).resolves?.not?.toThrow();

      expect(command.config).toBeDefined();
      expect(command?.config?.runHook).toBeDefined();
    });
  });

  describe('Command Error Handling', () => {
    it('should handle parse errors gracefully', async () => {
      const command = await initializeCommandForTest(AI as any, [], {
        mockParse: true,
        parseResult: { flags: {}, args: { operation: 'invalid' } },
      });

      // Should not throw during initialization
      expect(command as any).toBeDefined();
      expect(command.config).toBeDefined();
    });

    it('should provide meaningful error messages for invalid operations', async () => {
      await expect(
        runCommandInTest(AI, [], {}, { operation: 'invalid-operation' })
      ).rejects.toThrow();
    });
  });
});
