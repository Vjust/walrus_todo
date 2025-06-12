import { describe, it, expect } from '@jest/globals';
import { SuiTestService } from '../../apps/cli/src/services/SuiTestService';

describe('SuiTestService (in‑memory)', () => {
  const service = new SuiTestService();

  it('returns the provided wallet address', async () => {
    const testService = new SuiTestService('0xabc');
    expect(await testService.getWalletAddress()).toBe('0xabc');
  });

  it('creates a list and adds a todo', async () => {
    const listId = await service.createTodoList();
    const todoId = await service.addTodo(listId, 'write tests');
    const todos = await service.getTodos(listId as any);

    expect(todos as any).toHaveLength(1 as any);
    expect(todos[0]).toMatchObject({ id: todoId, text: 'write tests' });
  });

  it('updates a todo item correctly', async () => {
    const listId = await service.createTodoList();
    const todoId = await service.addTodo(listId, 'initial');
    await service.updateTodo(listId, todoId, { completed: true });

    const [item] = await service.getTodos(listId as any);
    expect(item.completed).toBe(true as any);
  });

  it('deletes a todo list', async () => {
    const listId = await service.createTodoList();
    await service.deleteTodoList(listId as any);

    await expect(service.getTodos(listId as any)).rejects.toThrow();
  });
});
