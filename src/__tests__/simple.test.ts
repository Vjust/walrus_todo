import { expect, test } from '@oclif/test';
import { TodoService } from '../services/todoService';

describe('simple list command', () => {
  let todoService: TodoService;

  // Setup test data before running tests
  beforeAll(async () => {
    todoService = new TodoService();
    await todoService.createList('test-list', 'test-user');
    await todoService.addTodo('test-list', {
      title: 'Test Todo 1',
      priority: 'high',
      tags: ['tag1'],
      completed: false
    });
    await todoService.addTodo('test-list', {
      title: 'Test Todo 2',
      priority: 'low',
      tags: ['tag2'],
      completed: true
    });
  });

  // Clean up after tests using the existing deleteList method
  afterAll(async () => {
    await todoService.deleteList('test-list');
  });

  test
    .stdout()
    .command(['simple', 'list', 'test-list'])
    .it('lists all todos in the list', (ctx: any) => {
      expect(ctx.stdout).to.contain('Test Todo 1');
      expect(ctx.stdout).to.contain('Test Todo 2');
    });

  test
    .stdout()
    .command(['simple', 'list', 'test-list', '--sort', 'priority'])
    .it('sorts todos by priority', (ctx: any) => {
      // Expect high priority first; adjust expectation if output format changes
      expect(ctx.stdout).to.match(/✓.*⚠️.*Test Todo 1/);
    });

  test
    .stdout()
    .command(['simple', 'list', 'test-list', '--filter', 'completed'])
    .it('filters completed todos', (ctx: any) => {
      expect(ctx.stdout).to.contain('Test Todo 2'); // Completed todo
      expect(ctx.stdout).not.to.contain('Test Todo 1'); // Incomplete todo
    });

  test
    .stdout()
    .command(['simple', 'list', 'test-list', '--filter', 'incomplete'])
    .it('filters incomplete todos', (ctx: any) => {
      expect(ctx.stdout).to.contain('Test Todo 1'); // Incomplete todo
      expect(ctx.stdout).not.to.contain('Test Todo 2'); // Completed todo
    });
});
