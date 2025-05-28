import { aiService } from '../../apps/cli/src/services/ai';
import AddCommand from '../../apps/cli/src/commands/add';
import { TodoService } from '../../apps/cli/src/services/todoService';
import {
  AddCommandArgs,
  AddCommandFlags,
  ParsedOutput,
} from '../../apps/cli/src/types/command-types';
import { runCommandInTest } from '../../apps/cli/src/__tests__/helpers/command-test-utils';

// Mock aiService
jest.mock('../../apps/cli/src/services/ai', () => {
  return {
    aiService: {
      suggestTags: jest.fn().mockResolvedValue(['ai-suggested', 'important']),
      suggestPriority: jest.fn().mockResolvedValue('high'),
    },
  };
});

// Mock TodoService
jest.mock('../../apps/cli/src/services/todoService', () => {
  return {
    TodoService: jest.fn().mockImplementation(() => {
      return {
        getList: jest
          .fn()
          .mockResolvedValue({ id: 'list-1', name: 'default', todos: [] }),
        createList: jest
          .fn()
          .mockResolvedValue({ id: 'list-1', name: 'default', todos: [] }),
        addTodo: jest.fn().mockImplementation((listName, todo) => {
          return Promise.resolve({
            id: 'todo-123',
            ...todo,
            createdAt: '2023-01-01T12:00:00Z',
            updatedAt: '2023-01-01T12:00:00Z',
          });
        }),
      };
    }),
  };
});

describe('Add Command with AI', () => {
  // Save environment variables
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, XAI_API_KEY: 'mock-api-key' };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('should add a todo without AI', async () => {
    const { output } = await runCommandInTest(
      AddCommand,
      ['add', 'Test todo'],
      { list: 'default', priority: 'medium', ai: false },
      { listOrTitle: 'Test todo' }
    );

    expect(aiService.suggestTags).not.toHaveBeenCalled();
    expect(TodoService).toHaveBeenCalled();
    expect(
      (TodoService as jest.MockedClass<typeof TodoService>).mock.results[0]
        ?.value.addTodo
    ).toHaveBeenCalled();
    expect(output.length).toBeGreaterThan(0);
  });

  test('should add a todo with AI suggestions', async () => {
    const { output } = await runCommandInTest(
      AddCommand,
      ['add', 'Test todo with AI'],
      { list: 'default', priority: 'medium', ai: true },
      { listOrTitle: 'Test todo with AI' }
    );

    expect(aiService.suggestTags).toHaveBeenCalled();
    expect(aiService.suggestPriority).toHaveBeenCalled();
    expect(
      (TodoService as jest.MockedClass<typeof TodoService>).mock.results[0]
        ?.value.addTodo
    ).toHaveBeenCalled();

    // Check AI suggestions were logged
    expect(output.join(' ')).toContain('AI suggested tags');
    expect(output.join(' ')).toContain('AI suggested priority');
  });

  test('should handle AI error gracefully', async () => {
    // Mock aiService to throw error
    (aiService.suggestTags as jest.Mock).mockRejectedValueOnce(
      new Error('API key error')
    );

    const { output } = await runCommandInTest(
      AddCommand,
      ['add', 'Test todo with AI error'],
      { list: 'default', priority: 'medium', ai: true },
      { listOrTitle: 'Test todo with AI error' }
    );

    // Should continue with regular todo creation
    expect(
      (TodoService as jest.MockedClass<typeof TodoService>).mock.results[0]
        ?.value.addTodo
    ).toHaveBeenCalled();
    expect(output.join(' ')).toContain('AI enhancement failed');
  });

  test('should use custom API key when provided', async () => {
    await runCommandInTest(
      AddCommand,
      ['add', 'Test todo with custom API key'],
      {
        list: 'default',
        priority: 'medium',
        ai: true,
        apiKey: 'custom-api-key',
      },
      { listOrTitle: 'Test todo with custom API key' }
    );

    expect(aiService.suggestTags).toHaveBeenCalled();
  });
});
