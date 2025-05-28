// Basic test to verify Jest setup
describe('Basic API Tests', () => {
  it('should run basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have access to mock factory', () => {
    expect(global.mockTodoFactory).toBeDefined();
    const todo = global.mockTodoFactory();
    expect(todo.id).toBe('test-todo-id');
  });
});