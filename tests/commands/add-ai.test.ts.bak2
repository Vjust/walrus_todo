import { aiService } from '../../src/services/ai';
import AddCommand from '../../src/commands/add';
import { TodoService } from '../../src/services/todoService';

// Mock aiService
jest.mock('../../src/services/ai', () => {
  return {
    aiService: {
      suggestTags: jest.fn().mockResolvedValue(['ai-suggested', 'important']),
      suggestPriority: jest.fn().mockResolvedValue('high'),
    },
  };
});

// Mock TodoService
jest.mock('../../src/services/todoService', () => {
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
  let command: AddCommand;
  let stdoutSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env = { ...originalEnv, XAI_API_KEY: 'mock-api-key' };
    command = new AddCommand();
    stdoutSpy = jest.spyOn(command, 'log').mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    stdoutSpy.mockRestore();
  });

  test('should add a todo without AI', async () => {
    await command.run();

    expect(aiService.suggestTags).not.toHaveBeenCalled();
    expect(TodoService).toHaveBeenCalled();
    expect(TodoService.mock.results[0].value.addTodo).toHaveBeenCalled();
  });

  test('should add a todo with AI suggestions', async () => {
    // Mock parse to return ai flag as true
    command.parse = jest.fn().mockResolvedValue({
      args: { title: 'Test todo with AI' },
      flags: {
        list: 'default',
        priority: 'medium',
        ai: true,
      },
    });

    await command.run();

    expect(aiService.suggestTags).toHaveBeenCalled();
    expect(aiService.suggestPriority).toHaveBeenCalled();
    expect(TodoService.mock.results[0].value.addTodo).toHaveBeenCalled();

    // Check AI suggestions were logged
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining('AI suggested tags')
    );
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining('AI suggested priority')
    );
  });

  test('should handle AI error gracefully', async () => {
    // Mock aiService to throw error
    (aiService.suggestTags as jest.Mock).mockRejectedValueOnce(
      new Error('API key error')
    );

    // Mock parse to return ai flag as true
    command.parse = jest.fn().mockResolvedValue({
      args: { title: 'Test todo with AI error' },
      flags: {
        list: 'default',
        priority: 'medium',
        ai: true,
      },
    });

    await command.run();

    // Should continue with regular todo creation
    expect(TodoService.mock.results[0].value.addTodo).toHaveBeenCalled();
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining('AI enhancement failed')
    );
  });

  test('should use custom API key when provided', async () => {
    // Mock parse to return ai flag and apiKey
    command.parse = jest.fn().mockResolvedValue({
      args: { title: 'Test todo with custom API key' },
      flags: {
        list: 'default',
        priority: 'medium',
        ai: true,
        apiKey: 'custom-api-key',
      },
    });

    await command.run();

    expect(aiService.suggestTags).toHaveBeenCalled();
  });
});
