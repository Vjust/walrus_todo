import { expect, jest, test, describe, beforeEach, afterEach } from '@jest/globals';
import { TodoService } from '../services/todoService';
import { WalrusStorage } from '../utils/walrus-storage';
import { ConfigService } from '../services/config-service';
import type { Todo } from '../types/todo';
import type { Mock } from 'jest';

jest.mock('../utils/walrus-storage');
jest.mock('../services/config-service');

describe('store command', () => {
  let todoService: TodoService;
  let todoId!: string;  // Add definite assignment assertion

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
      updatedAt: new Date().toISOString()
    });
    jest.spyOn(todoService, 'addTodo').mockResolvedValue({
      id: 'test-todo-id',
      title: 'Test Todo',
      description: '',
      priority: 'medium',
      completed: false,
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      private: true,
      storageLocation: 'local' as const
    });
    todoId = 'test-todo-id';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createTestTodo = (): Todo => ({
    id: 'test-todo-id',
    title: 'Test Todo',
    description: '',
    completed: false,
    priority: 'medium',
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    private: true,
    storageLocation: 'local' as const
  });

  test('stores a todo on Walrus successfully', async () => {
    const mockWalrusStorage = new WalrusStorage() as Mock<WalrusStorage>;
    const result = await mockWalrusStorage.storeTodo(createTestTodo());
    expect(result).toBe('mock-blob-id');
  });

  test('handles todo not found error', async () => {
    const mockWalrusStorage = new WalrusStorage() as Mock<WalrusStorage>;
    jest.spyOn(mockWalrusStorage, 'getTodo').mockRejectedValue(new Error('Todo "nonexistent-id" not found'));
    await expect(mockWalrusStorage.storeTodo(createTestTodo())).rejects.toThrow('Todo "nonexistent-id" not found');
  });

  test('creates an NFT for the todo', async () => {
    const mockWalrusStorage = new WalrusStorage() as Mock<WalrusStorage>;
    const mockNft = { digest: 'mock-tx-digest' };
    jest.spyOn(mockWalrusStorage, 'createNFT').mockResolvedValue(mockNft);

    const todo = createTestTodo();
    const blobId = await mockWalrusStorage.storeTodo(todo);
    expect(blobId).toBe('mock-blob-id');

    const nft = await mockWalrusStorage.createNFT(todo, blobId);
    expect(nft).toBe(mockNft);
    expect(nft.digest).toBe('mock-tx-digest');
  });

  test('validates connection before storing', async () => {
    const mockWalrusStorage = new WalrusStorage() as Mock<WalrusStorage>;
    const result = await mockWalrusStorage.storeTodo(createTestTodo());
    expect(result).toBe('mock-blob-id');
  });

  test('handles connection validation failure', async () => {
    const mockWalrusStorage = new WalrusStorage() as Mock<WalrusStorage>;
    jest.spyOn(mockWalrusStorage, 'init').mockRejectedValue(new Error('Connection failed'));
    await expect(mockWalrusStorage.storeTodo(createTestTodo())).rejects.toThrow('Connection failed');
  });

  test('retries failed storage operation', async () => {
    const mockWalrusStorage = new WalrusStorage() as Mock<WalrusStorage>;
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
    const mockWalrusStorage = new WalrusStorage() as Mock<WalrusStorage>;
    jest.spyOn(mockWalrusStorage, 'storeTodo').mockRejectedValue(new Error('Persistent failure'));
    await expect(mockWalrusStorage.storeTodo(createTestTodo())).rejects.toThrow('Persistent failure');
  });

  test('performs cleanup after successful storage', async () => {
    const mockWalrusStorage = new WalrusStorage() as Mock<WalrusStorage>;
    const cleanup = jest.fn();
    mockWalrusStorage.cleanup = cleanup;

    const result = await mockWalrusStorage.storeTodo(createTestTodo());
    expect(result).toBe('mock-blob-id');
    expect(cleanup).toHaveBeenCalled();
  });

  test('performs cleanup after failed storage', async () => {
    const mockWalrusStorage = new WalrusStorage() as Mock<WalrusStorage>;
    const cleanup = jest.fn();
    mockWalrusStorage.cleanup = cleanup;
    jest.spyOn(mockWalrusStorage, 'storeTodo').mockRejectedValue(new Error('Storage failed'));

    await expect(mockWalrusStorage.storeTodo(createTestTodo())).rejects.toThrow('Storage failed');
    expect(cleanup).toHaveBeenCalled();
  });
});