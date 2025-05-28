import { runCommand } from '../../helpers/test-utils';
// import { Todo } from '../../../src/types/todo';
import * as fs from 'fs';
import * as path from 'path';
import { AIProviderFactory } from '../../../apps/cli/src/services/ai/AIProviderFactory';

// Mock the AIProviderFactory to avoid API calls
jest.mock('../../../apps/cli/src/services/ai/AIProviderFactory', () => ({
  AIProviderFactory: {
    setAIFeatureRequested: jest.fn(),
    createDefaultAdapter: jest.fn().mockReturnValue({
      processWithPromptTemplate: jest
        .fn()
        .mockResolvedValue({ result: 'Mock response' }),
      completeStructured: jest.fn().mockResolvedValue({ result: {} }),
    }),
    createFallbackAdapter: jest.fn().mockReturnValue({
      processWithPromptTemplate: jest
        .fn()
        .mockResolvedValue({ result: 'Mock fallback response' }),
      completeStructured: jest.fn().mockResolvedValue({ result: {} }),
    }),
    createProvider: jest.fn().mockImplementation(({ provider: _provider }) => ({
      processWithPromptTemplate: jest
        .fn()
        .mockImplementation((_prompt, _input) => {
          // Mock responses based on operation type
          if (prompt.template.includes('Summarize')) {
            return Promise.resolve({
              result: 'Your todos focus on financial and project work.',
            });
          }
          return Promise.resolve({ result: 'Mock response' });
        }),
      completeStructured: jest
        .fn()
        .mockImplementation(({ prompt: _prompt, metadata }) => {
          // Mock structured responses based on operation
          if (metadata?.operation === 'categorize') {
            return Promise.resolve({
              result: {
                work: ['todo-1', 'todo-2'],
                personal: ['todo-3'],
              },
            });
          }
          if (metadata?.operation === 'prioritize') {
            return Promise.resolve({
              result: {
                'todo-1': 8,
                'todo-2': 5,
                'todo-3': 3,
              },
            });
          }
          if (metadata?.operation === 'suggest') {
            return Promise.resolve({
              result: [
                'Review quarterly reports',
                'Schedule team meeting',
                'Update project timeline',
              ],
            });
          }
          if (metadata?.operation === 'analyze') {
            return Promise.resolve({
              result: {
                themes: ['Financial planning', 'Project management'],
                bottlenecks: ['Pending reviews'],
                recommendations: [
                  'Prioritize urgent tasks',
                  'Block time for focused work',
                ],
              },
            });
          }
          return Promise.resolve({ result: {} });
        }),
    })),
    getDefaultProvider: jest.fn().mockResolvedValue({
      provider: 'xai',
      modelName: 'grok-beta',
    }),
  },
}));

// Mock the environment loader
jest.mock('../../../apps/cli/src/utils/env-loader', () => ({
  loadEnvironment: jest.fn(),
}));

describe('AI Command E2E Tests', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let testDataDir: string;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };

    // Setup test environment
    process.env.XAI_API_KEY = 'test-api-key';
    process.env.AI_DEFAULT_PROVIDER = 'xai';
    process.env.AI_DEFAULT_MODEL = 'grok-beta';
    process.env.NODE_ENV = 'test';

    // Create test data directory
    testDataDir = path.join(process.cwd(), 'test-data');
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }

    // Create test todos
    const testTodos = [
      {
        id: 'todo-1',
        title: 'Complete financial report',
        description: 'Q4 financial analysis and projections',
        completed: false,
        priority: 'high',
        tags: ['finance', 'urgent'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        private: false,
        storageLocation: 'local',
      },
      {
        id: 'todo-2',
        title: 'Update project roadmap',
        description: 'Revise timeline and deliverables',
        completed: false,
        priority: 'medium',
        tags: ['project'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        private: false,
        storageLocation: 'local',
      },
      {
        id: 'todo-3',
        title: 'Buy groceries',
        description: 'Weekly grocery shopping',
        completed: false,
        priority: 'low',
        tags: ['personal'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        private: false,
        storageLocation: 'local',
      },
    ];

    fs.writeFileSync(
      path.join(testDataDir, 'todos.json'),
      JSON.stringify(testTodos, null, 2)
    );

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;

    // Clean up test data
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }

    // Restore console methods
    jest.restoreAllMocks();
  });

  describe('summarize operation', () => {
    test('should generate a summary of todos', async () => {
      const result = await runCommand(['ai', 'summarize']);

      expect(result.stdout).toContain('Generating AI summary...');
      expect(result.stdout).toContain('Summary of your todos:');
      expect(result.stdout).toContain(
        'Your todos focus on financial and project work.'
      );
      expect(result.exitCode).toBe(0);
    });

    test('should handle empty todo list', async () => {
      // Create empty todos file
      fs.writeFileSync(
        path.join(testDataDir, 'todos.json'),
        JSON.stringify([], null, 2)
      );

      await expect(runCommand(['ai', 'summarize'])).rejects.toThrow(
        'No todos found. Add some todos first with "walrus_todo add"'
      );
    });

    test('should output JSON when flag is set', async () => {
      const result = await runCommand(['ai', 'summarize', '--json']);

      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('summary');
      expect(output.summary).toBe(
        'Your todos focus on financial and project work.'
      );
      expect(result.exitCode).toBe(0);
    });
  });

  describe('categorize operation', () => {
    test('should categorize todos into groups', async () => {
      const result = await runCommand(['ai', 'categorize']);

      expect(result.stdout).toContain('Categorizing todos...');
      expect(result.stdout).toContain('Todo Categories:');
      expect(result.stdout).toContain('work:');
      expect(result.stdout).toContain('personal:');
      expect(result.stdout).toContain('Complete financial report');
      expect(result.stdout).toContain('Buy groceries');
      expect(result.exitCode).toBe(0);
    });

    test('should handle specific list', async () => {
      const result = await runCommand(['ai', 'categorize', '--list', 'work']);

      expect(result.stdout).toContain('Todo Categories:');
      expect(result.exitCode).toBe(0);
    });

    test('should output JSON when flag is set', async () => {
      const result = await runCommand(['ai', 'categorize', '--json']);

      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('categories');
      expect(output.categories).toHaveProperty('work');
      expect(output.categories.work).toContain('todo-1');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('prioritize operation', () => {
    test('should assign priority scores to todos', async () => {
      const result = await runCommand(['ai', 'prioritize']);

      expect(result.stdout).toContain('Prioritizing todos...');
      expect(result.stdout).toContain('Prioritized Todos:');
      expect(result.stdout).toContain('[8]'); // High priority todo
      expect(result.stdout).toContain('[5]'); // Medium priority todo
      expect(result.stdout).toContain('[3]'); // Low priority todo
      expect(result.stdout).toContain('Complete financial report');
      expect(result.exitCode).toBe(0);
    });

    test('should show color-coded priorities', async () => {
      const result = await runCommand(['ai', 'prioritize']);

      // Note: In test environment, chalk might not add actual color codes,
      // but the structure should be present
      expect(result.stdout).toMatch(/\[\d+\]/); // Priority scores in brackets
      expect(result.exitCode).toBe(0);
    });

    test('should output JSON when flag is set', async () => {
      const result = await runCommand(['ai', 'prioritize', '--json']);

      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('priorities');
      expect(output.priorities).toHaveProperty('todo-1');
      expect(output.priorities['todo-1']).toBe(8);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('suggest operation', () => {
    test('should suggest new todos', async () => {
      const result = await runCommand(['ai', 'suggest']);

      expect(result.stdout).toContain('Generating todo suggestions...');
      expect(result.stdout).toContain('Suggested Todos:');
      expect(result.stdout).toContain('Review quarterly reports');
      expect(result.stdout).toContain('Schedule team meeting');
      expect(result.stdout).toContain('Update project timeline');
      expect(result.stdout).toContain('To add a suggested todo:');
      expect(result.exitCode).toBe(0);
    });

    test('should handle empty suggestions', async () => {
      // Mock empty suggestions
      (AIProviderFactory.createProvider as jest.Mock).mockImplementationOnce(
        () => ({
          completeStructured: jest.fn().mockResolvedValue({ result: [] }),
        })
      );

      const result = await runCommand(['ai', 'suggest']);

      expect(result.stdout).toContain('Suggested Todos:');
      expect(result.exitCode).toBe(0);
    });

    test('should output JSON when flag is set', async () => {
      const result = await runCommand(['ai', 'suggest', '--json']);

      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('suggestions');
      expect(Array.isArray(output.suggestions)).toBe(true);
      expect(output.suggestions).toContain('Review quarterly reports');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('analyze operation', () => {
    test('should analyze todos for patterns and insights', async () => {
      const result = await runCommand(['ai', 'analyze']);

      expect(result.stdout).toContain('Analyzing todos...');
      expect(result.stdout).toContain('Todo Analysis:');
      expect(result.stdout).toContain('themes:');
      expect(result.stdout).toContain('Financial planning');
      expect(result.stdout).toContain('bottlenecks:');
      expect(result.stdout).toContain('Pending reviews');
      expect(result.stdout).toContain('recommendations:');
      expect(result.stdout).toContain('Prioritize urgent tasks');
      expect(result.exitCode).toBe(0);
    });

    test('should handle complex analysis objects', async () => {
      const result = await runCommand(['ai', 'analyze']);

      expect(result.stdout).not.toContain('[object Object]');
      expect(result.exitCode).toBe(0);
    });

    test('should output JSON when flag is set', async () => {
      const result = await runCommand(['ai', 'analyze', '--json']);

      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('analysis');
      expect(output.analysis).toHaveProperty('themes');
      expect(output.analysis).toHaveProperty('bottlenecks');
      expect(output.analysis).toHaveProperty('recommendations');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('error handling', () => {
    test('should handle missing API key', async () => {
      delete process.env.XAI_API_KEY;

      await expect(runCommand(['ai', 'summarize'])).rejects.toThrow(
        'XAI API key is required for AI operations'
      );
    });

    test('should handle invalid operation', async () => {
      await expect(runCommand(['ai', 'invalid-operation'])).rejects.toThrow(
        'Unknown AI operation: invalid-operation'
      );
    });

    test('should handle AI service errors gracefully', async () => {
      // Mock AI service to throw an error
      (AIProviderFactory.createProvider as jest.Mock).mockImplementationOnce(
        () => ({
          processWithPromptTemplate: jest
            .fn()
            .mockRejectedValue(new Error('AI service error')),
        })
      );

      await expect(runCommand(['ai', 'summarize'])).rejects.toThrow(
        'AI summarization failed: AI service error'
      );
    });

    test('should handle malformed responses', async () => {
      // Mock malformed response
      (AIProviderFactory.createProvider as jest.Mock).mockImplementationOnce(
        () => ({
          completeStructured: jest.fn().mockResolvedValue({
            result: 'not-an-object-when-expecting-one',
          }),
        })
      );

      const result = await runCommand(['ai', 'categorize']);

      // Should handle gracefully with fallback
      expect(result.stdout).toContain('Todo Categories:');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('provider flags', () => {
    test('should use specified provider', async () => {
      const result = await runCommand([
        'ai',
        'summarize',
        '--provider',
        'openai',
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Summary of your todos:');
    });

    test('should use specified model', async () => {
      const result = await runCommand(['ai', 'summarize', '--model', 'gpt-4']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Summary of your todos:');
    });

    test('should use specified temperature', async () => {
      const result = await runCommand([
        'ai',
        'summarize',
        '--temperature',
        '0.2',
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Summary of your todos:');
    });
  });

  describe('status and help operations', () => {
    test('should show AI service status', async () => {
      const result = await runCommand(['ai', 'status']);

      expect(result.stdout).toContain('AI Service Status:');
      expect(result.stdout).toContain('Active provider:');
      expect(result.stdout).toContain('API Key Status:');
      expect(result.stdout).toContain('Available Commands:');
      expect(result.exitCode).toBe(0);
    });

    test('should show detailed help', async () => {
      const result = await runCommand(['ai', 'help']);

      expect(result.stdout).toContain('AI Command Help:');
      expect(result.stdout).toContain('walrus_todo ai summarize');
      expect(result.stdout).toContain('walrus_todo ai categorize');
      expect(result.stdout).toContain('walrus_todo ai prioritize');
      expect(result.stdout).toContain('walrus_todo ai suggest');
      expect(result.stdout).toContain('walrus_todo ai analyze');
      expect(result.stdout).toContain('Global Options:');
      expect(result.stdout).toContain('Environment Configuration:');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('blockchain verification flags', () => {
    test('should handle verify flag', async () => {
      const result = await runCommand(['ai', 'summarize', '--verify']);

      // Should work but skip actual verification in test environment
      expect(result.stdout).toContain('Summary of your todos:');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('edge cases', () => {
    test('should handle very large todo lists', async () => {
      // Create a large todo list
      const largeTodos = Array.from({ length: 100 }, (_, i) => ({
        id: `todo-${i}`,
        title: `Task ${i}`,
        description: `Description for task ${i}`,
        completed: false,
        priority: ['high', 'medium', 'low'][i % 3],
        tags: [`tag-${i % 5}`],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        private: false,
        storageLocation: 'local',
      }));

      fs.writeFileSync(
        path.join(testDataDir, 'todos.json'),
        JSON.stringify(largeTodos, null, 2)
      );

      const result = await runCommand(['ai', 'summarize']);

      expect(result.stdout).toContain('Summary of your todos:');
      expect(result.exitCode).toBe(0);
    });

    test('should handle todos with missing fields', async () => {
      const incompleteTodos = [
        {
          id: 'todo-incomplete',
          title: 'Task without description',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          private: false,
          storageLocation: 'local',
        },
      ];

      fs.writeFileSync(
        path.join(testDataDir, 'todos.json'),
        JSON.stringify(incompleteTodos, null, 2)
      );

      const result = await runCommand(['ai', 'summarize']);

      expect(result.stdout).toContain('Summary of your todos:');
      expect(result.exitCode).toBe(0);
    });

    test('should handle special characters in todos', async () => {
      const specialTodos = [
        {
          id: 'todo-special',
          title: 'Task with "quotes" and special chars: $@#!',
          description: 'Description with\nnewlines\tand\ttabs',
          completed: false,
          priority: 'medium',
          tags: ['tag-with-dash', 'tag_with_underscore'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          private: false,
          storageLocation: 'local',
        },
      ];

      fs.writeFileSync(
        path.join(testDataDir, 'todos.json'),
        JSON.stringify(specialTodos, null, 2)
      );

      const result = await runCommand(['ai', 'analyze']);

      expect(result.stdout).toContain('Todo Analysis:');
      expect(result.exitCode).toBe(0);
    });
  });
});
