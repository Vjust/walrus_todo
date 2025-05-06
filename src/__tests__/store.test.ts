import { expect, test } from '@oclif/test';
import { TodoService } from '../services/todoService';

interface TestContext {
  stdout?: string;
  stderr?: string;
}

describe('store command', () => {
  let todoService: TodoService;
  let todoId!: string;  // Add definite assignment assertion

  // Setup: Create a test list and todo before running tests
  beforeAll(async () => {
    todoService = new TodoService();
    await todoService.createList('test-list', 'test-user');
    const newTodo = await todoService.addTodo('test-list', {
      title: 'Test Store Todo',
      priority: 'medium',
      tags: [],
      completed: false
    });
    todoId = newTodo.id;
  });

  // Cleanup: Delete the test list after tests
  afterAll(async () => {
    await todoService.deleteList('test-list');
  });

  test
    .stdout()
    .command(['store', '--todo', todoId, '--list', 'test-list'])
    .it('stores a todo on Walrus successfully', (ctx: TestContext) => {
      expect(ctx.stdout).to.contain('Todo stored successfully on Walrus');
      expect(ctx.stdout).to.contain('Blob ID:'); // Check for blob ID in output
    });

  test
    .stderr()
    .command(['store', '--todo', 'nonexistent-id', '--list', 'test-list'])
    .exit(1)
    .it('handles todo not found error', (ctx: TestContext) => {
      expect(ctx.stderr).to.contain('Todo "nonexistent-id" not found'); // Verify error message
    });

  test
    .stdout()
    .command(['store', '--todo', todoId, '--list', 'test-list', '--create-nft'])
    .it('creates an NFT for the todo', (ctx: TestContext) => {
      expect(ctx.stdout).to.contain('NFT created successfully'); // Check for success message
      expect(ctx.stdout).to.contain('Transaction:'); // Verify transaction digest output
    });
});
