import { describe, it, expect } from '@jest/globals';
import { SuiTestService } from '../services/SuiTestService';
import { AppConfig } from '../types/config';

describe('SuiTestService (in‑memory)', () => {
  const mockConfig: AppConfig = {
    activeNetwork: {
      name: 'testnet',
      fullnode: 'https://fullnode.testnet.sui.io:443',
    },
    activeAccount: {
      address: '0xabc',
    },
    storage: {
      defaultSize: 1000,
      defaultEpochs: 1,
      replicationFactor: 1,
      directory: '/tmp',
      temporaryDirectory: '/tmp',
      maxRetries: 3,
      retryDelay: 1000,
    },
    todo: {
      localStoragePath: '/tmp/todos',
      defaultCategories: [],
      defaultPriority: 'medium',
      maxTitleLength: 100,
      maxDescriptionLength: 500,
      defaultDueDateOffsetDays: 7,
      expiryCheckInterval: 3600000,
    },
    walrus: {
      network: 'testnet',
    },
    logging: {
      level: 'info',
      console: true,
    },
  };

  const service = new SuiTestService(mockConfig);

  it('returns the provided wallet address', async () => {
    const testService = new SuiTestService(mockConfig);
    expect(await testService.getWalletAddress()).toBe('0xabc');
  });

  it('creates a list and adds a todo', async () => {
    const listId = await service.createTodoList();
    const todoId = await service.addTodo(listId, 'write tests');
    const todos = await service.getTodos(listId);

    expect(todos).toHaveLength(1);
    expect(todos[0]).toMatchObject({ id: todoId, text: 'write tests' });
  });

  it('updates a todo item correctly', async () => {
    const listId = await service.createTodoList();
    const todoId = await service.addTodo(listId, 'initial');
    await service.updateTodo(listId, todoId, { completed: true });

    const todos = await service.getTodos(listId);
    const item = todos[0];
    expect(item?.completed).toBe(true);
  });

  it('deletes a todo list', async () => {
    const listId = await service.createTodoList();
    await service.deleteTodoList(listId);

    await expect(service.getTodos(listId)).rejects.toThrow();
  });
});
