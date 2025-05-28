import { Todo } from '../../apps/cli/src/types/todo';
import { TodoService } from '../../apps/cli/src/services/todoService';

describe('TodoService', () => {
  let todoService: TodoService;
  const testListName = 'test';

  beforeEach(async () => {
    todoService = new TodoService();
    // Clean up test list if it exists
    await todoService.deleteList(testListName).catch(() => {});
  });

  afterEach(async () => {
    // Clean up test list
    await todoService.deleteList(testListName).catch(() => {});
  });

  it('creates a new todo list', async () => {
    const list = await todoService.createList(testListName, 'test-owner');
    expect(list).toBeDefined();
    expect(list.name).toBe(testListName);
    expect(list.todos).toHaveLength(0);
  });

  it('creates todo item', async () => {
    // First create the list
    await todoService.createList(testListName, 'test-owner');

    // Then add a todo
    const todo: Partial<Todo> = {
      title: 'Test Todo',
      description: 'Test Description',
      priority: 'high',
      tags: ['test'],
    };

    const newTodo = await todoService.addTodo(testListName, todo);
    expect(newTodo).toBeDefined();
    expect(newTodo.title).toBe(todo.title);
    expect(newTodo.description).toBe(todo.description);
    expect(newTodo.priority).toBe(todo.priority);
    expect(newTodo.tags).toEqual(todo.tags);
    expect(newTodo.completed).toBe(false);
  });
});
