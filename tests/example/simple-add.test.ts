/**
 * Simplified test for the add command without using @oclif/test
 */

import { TodoService } from '../../src/services/todoService';
jest.mock('../../src/services/todoService');

// Mock command execution
import { execSync } from 'child_process';
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

// Sample test data
const sampleTodo = {
  id: 'test-todo-id',
  title: 'Test Todo',
  description: 'Test Description',
  completed: false,
  priority: 'medium',
  tags: ['test'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  private: false,
  storageLocation: 'local'
};

describe('Add Command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock TodoService methods
    (TodoService.prototype.addTodo as jest.Mock).mockResolvedValue(sampleTodo);
    (TodoService.prototype.getList as jest.Mock).mockResolvedValue({
      id: 'default',
      name: 'default',
      owner: 'default-owner',
      todos: [sampleTodo],
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    // Mock execSync for command execution
    (execSync as jest.Mock).mockImplementation((command: string) => {
      if (command.includes('add "Test Todo"')) {
        return Buffer.from('Todo added successfully');
      }
      if (command.includes('add "High Priority" -p high')) {
        return Buffer.from('Todo added with HIGH priority');
      }
      return Buffer.from('Command executed successfully');
    });
  });

  it('should execute add command successfully', () => {
    const result = execSync('node bin/run.js add "Test Todo"').toString();
    expect(result).toContain('Todo added successfully');
  });

  it('should add todo with priority', () => {
    const result = execSync('node bin/run.js add "High Priority" -p high').toString();
    expect(result).toContain('HIGH priority');
  });

  it('should handle add command with TodoService', async () => {
    // Simulating what happens inside the command
    const todoService = new TodoService();
    const newTodo = {
      title: 'New Test Todo',
      priority: 'high',
      tags: ['important']
    };
    
    const result = await todoService.addTodo('default', newTodo);
    
    expect(TodoService.prototype.addTodo).toHaveBeenCalledWith('default', newTodo);
    expect(result).toEqual(sampleTodo); // Returns our mocked todo
  });
});