import { describe, test, expect } from '@jest/globals';
import { cli, testUtils } from './setup';

describe('Basic Todo Workflow E2E', () => {
  test('should add and list todos', async () => {
    // Add a new todo
    const addResult = await cli.expectSuccess('add', [
      '--title',
      'Test Todo',
      '--description',
      'This is a test todo',
    ]);

    expect(addResult.stdout).toContain('Todo added successfully');

    // List todos
    const todos = await cli.executeJSON('list', ['--json']);
    expect(todos).toHaveLength(1);
    expect(todos[0]).toMatchObject({
      title: 'Test Todo',
      description: 'This is a test todo',
      completed: false,
    });
  });

  test('should complete a todo', async () => {
    // Add a todo
    await testUtils.createTestTodo('Todo to Complete');

    // Get the todo
    const todos = await testUtils.getTodos();
    const todoId = todos[0].id;

    // Complete the todo
    const completeResult = await cli.expectSuccess('complete', [
      '--id',
      todoId,
    ]);
    expect(completeResult.stdout).toContain('Todo completed');

    // Verify it's completed
    const updatedTodos = await testUtils.getTodos();
    expect(updatedTodos[0].completed).toBe(true);
  });

  test('should delete a todo', async () => {
    // Add a todo
    await testUtils.createTestTodo('Todo to Delete');

    // Get the todo
    const todos = await testUtils.getTodos();
    const todoId = todos[0].id;

    // Delete the todo
    const deleteResult = await cli.expectSuccess('delete', ['--id', todoId]);
    expect(deleteResult.stdout).toContain('Todo deleted');

    // Verify it's deleted
    const remainingTodos = await testUtils.getTodos();
    expect(remainingTodos).toHaveLength(0);
  });

  test('should handle invalid commands gracefully', async () => {
    const result = await cli.expectFailure('invalid-command');
    expect(result.stderr).toContain('is not a walrus-todo command');
  });

  test('should support JSON output for all commands', async () => {
    // Add todo with JSON output
    const addResult = await cli.execute('add', [
      '--title',
      'JSON Test',
      '--json',
    ]);

    expect(() => JSON.parse(addResult.stdout)).not.toThrow();

    const addedTodo = JSON.parse(addResult.stdout);
    expect(addedTodo).toHaveProperty('id');
    expect(addedTodo).toHaveProperty('title', 'JSON Test');
  });

  test('should handle interactive mode', async () => {
    // Test interactive add command
    const result = await cli.executeInteractive(
      'add',
      ['--interactive'],
      [
        'Interactive Todo Title',
        'Interactive Todo Description',
        'high',
        'personal',
      ]
    );

    expect(result.stdout).toContain('Todo added successfully');

    // Verify the todo was created
    const todos = await testUtils.getTodos();
    expect(todos[0]).toMatchObject({
      title: 'Interactive Todo Title',
      description: 'Interactive Todo Description',
      priority: 'high',
      category: 'personal',
    });
  });
});
