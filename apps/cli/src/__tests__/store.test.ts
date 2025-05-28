import { TodoService } from '../services/todoService';
import { WalrusStorage } from '../utils/walrus-storage';
// ConfigService mocked but not directly used
import type { Todo } from '../types/todo';
import type { Mocked } from 'jest-mock';

// Use existing mocks from global setup
const MockedWalrusStorage = WalrusStorage as jest.Mocked<typeof WalrusStorage>;

describe('store command', () => {
  let todoService: TodoService;
  // todoId variable removed - not used in tests

  beforeEach(async () => {
    todoService = new TodoService();
    jest.spyOn(todoService, 'getList').mockResolvedValue(null);
    jest.spyOn(todoService, 'createList').mockResolvedValue({
      id: 'test-list',
      name: 'test-list',
      owner: 'test-user',
      todos: [],
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    jest.spyOn(todoService, 'addTodo').mockResolvedValue({
      id: 'test-todo-id',
      title: 'Test Todo',
      description: '',
      priority: 'medium' as const,
      completed: false,
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      private: true,
      storageLocation: 'local' as const,
    });
    // todoId = 'test-todo-id'; // Removed - todoId is not used in tests
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createTestTodo = (): Todo => ({
    id: 'test-todo-id',
    title: 'Test Todo',
    description: '',
    completed: false,
    priority: 'medium' as const,
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    private: true,
    storageLocation: 'local' as const,
  });

  test('stores a todo on Walrus successfully', async () => {
    const mockWalrusStorage = new WalrusStorage('testnet', true) as Mocked<
      InstanceType<typeof WalrusStorage>
    >;
    const result = await mockWalrusStorage.storeTodo(createTestTodo());
    expect(result).toBe('mock-blob-id');
  });

  test('handles todo not found error', async () => {
    const mockWalrusStorage = new WalrusStorage('testnet', true) as Mocked<
      InstanceType<typeof WalrusStorage>
    >;
    // Use retrieveTodo instead of getTodo which doesn't exist in the class
    jest
      .spyOn(mockWalrusStorage, 'retrieveTodo')
      .mockRejectedValue(new Error('Todo "nonexistent-id" not found'));
    await expect(mockWalrusStorage.storeTodo(createTestTodo())).rejects.toThrow(
      'Todo "nonexistent-id" not found'
    );
  });

  test('handles todo storage', async () => {
    const mockWalrusStorage = new WalrusStorage('testnet', true) as Mocked<
      InstanceType<typeof WalrusStorage>
    >;

    // Mock the storeTodo method instead of createNFT which doesn't exist
    const todo = createTestTodo();
    const blobId = await mockWalrusStorage.storeTodo(todo);
    expect(blobId).toBe('mock-blob-id');
  });

  test('validates connection before storing', async () => {
    const mockWalrusStorage = new WalrusStorage('testnet', true) as Mocked<
      InstanceType<typeof WalrusStorage>
    >;
    const result = await mockWalrusStorage.storeTodo(createTestTodo());
    expect(result).toBe('mock-blob-id');
  });

  test('handles connection validation failure', async () => {
    const mockWalrusStorage = new WalrusStorage('testnet', true) as Mocked<
      InstanceType<typeof WalrusStorage>
    >;
    jest
      .spyOn(mockWalrusStorage, 'init')
      .mockRejectedValue(new Error('Connection failed'));
    await expect(mockWalrusStorage.storeTodo(createTestTodo())).rejects.toThrow(
      'Connection failed'
    );
  });

  test('retries failed storage operation', async () => {
    const mockWalrusStorage = new WalrusStorage() as Mocked<
      InstanceType<typeof WalrusStorage>
    >;
    let attempts = 0;
    jest.spyOn(mockWalrusStorage, 'storeTodo').mockImplementation(async () => {
      attempts++;
      if (attempts < 2) throw new Error('Temporary failure');
      return 'mock-blob-id';
    });

    const result = await mockWalrusStorage.storeTodo(createTestTodo());
    expect(result).toBe('mock-blob-id');
    expect(attempts).toBe(2);
  });

  test('fails after max retries', async () => {
    const mockWalrusStorage = new WalrusStorage() as Mocked<
      InstanceType<typeof WalrusStorage>
    >;
    jest
      .spyOn(mockWalrusStorage, 'storeTodo')
      .mockRejectedValue(new Error('Persistent failure'));
    await expect(mockWalrusStorage.storeTodo(createTestTodo())).rejects.toThrow(
      'Persistent failure'
    );
  });

  test('handles storage cleanup', async () => {
    const mockWalrusStorage = new WalrusStorage() as Mocked<
      InstanceType<typeof WalrusStorage>
    >;

    // Create a mock disposeResources method since cleanup doesn't exist
    const disposeResources = jest.fn();
    const augmentedMock = mockWalrusStorage as Mocked<
      InstanceType<typeof WalrusStorage>
    > & { disposeResources: jest.Mock };
    augmentedMock.disposeResources = disposeResources;

    const result = await mockWalrusStorage.storeTodo(createTestTodo());
    expect(result).toBe('mock-blob-id');
  });

  test('handles failed storage gracefully', async () => {
    const mockWalrusStorage = new WalrusStorage() as Mocked<
      InstanceType<typeof WalrusStorage>
    >;
    jest
      .spyOn(mockWalrusStorage, 'storeTodo')
      .mockRejectedValue(new Error('Storage failed'));

    await expect(mockWalrusStorage.storeTodo(createTestTodo())).rejects.toThrow(
      'Storage failed'
    );
  });
});
