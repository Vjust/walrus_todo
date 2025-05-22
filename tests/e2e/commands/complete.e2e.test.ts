import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

describe('E2E: complete command', () => {
  const testConfigDir = path.join(__dirname, '..', '..', '.test-config');
  const testDataFile = path.join(testConfigDir, 'todos.json');
  const originalConfigDir = process.env.TODO_CONFIG_DIR;
  
  // Helper to run CLI commands
  const runCommand = (cmd: string): { stdout: string; stderr: string } => {
    try {
      const stdout = execSync(cmd, { 
        encoding: 'utf8',
        env: { ...process.env, TODO_CONFIG_DIR: testConfigDir }
      });
      return { stdout, stderr: '' };
    } catch (error: any) {
      return { 
        stdout: error.stdout || '', 
        stderr: error.stderr || error.message 
      };
    }
  };

  // Helper to add a test todo and get its ID
  const addTodo = (title: string, aiGenerated: boolean = false): string => {
    const result = runCommand(`walrus-todo add "${title}"`);
    const match = result.stdout.match(/Todo added with ID: ([\w-]+)/);
    if (!match) {
      throw new Error('Failed to extract todo ID from output');
    }
    return match[1];
  };

  // Helper to set up a todo with a specific ID for testing
  const setupTodoWithId = (id: string, title: string, completed: boolean = false): void => {
    const todos = [{
      id,
      title,
      completed,
      createdAt: new Date().toISOString(),
      aiGenerated: false
    }];
    fs.writeFileSync(testDataFile, JSON.stringify(todos, null, 2));
  };

  beforeAll(() => {
    // Ensure the global CLI is installed
    execSync('pnpm link --global', { cwd: path.join(__dirname, '..', '..', '..') });
  });

  beforeEach(() => {
    // Create test config directory
    if (!fs.existsSync(testConfigDir)) {
      fs.mkdirSync(testConfigDir, { recursive: true });
    }
    // Initialize empty todos file
    fs.writeFileSync(testDataFile, '[]');
  });

  afterEach(() => {
    // Clean up test config directory
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Restore original config directory
    if (originalConfigDir) {
      process.env.TODO_CONFIG_DIR = originalConfigDir;
    }
  });

  describe('successful completion scenarios', () => {
    it('should complete a todo by full ID', () => {
      const todoId = addTodo('Test todo to complete');
      
      const result = runCommand(`walrus-todo complete ${todoId}`);
      
      expect(result.stdout).toContain('Todo completed successfully');
      expect(result.stdout).toContain(todoId);
      
      // Verify the todo is marked as completed
      const todos = JSON.parse(fs.readFileSync(testDataFile, 'utf8'));
      const completedTodo = todos.find((t: any) => t.id === todoId);
      expect(completedTodo.completed).toBe(true);
      expect(completedTodo.status).toBe('completed');
      expect(completedTodo.completedAt).toBeDefined();
    });

    it('should complete a todo by partial ID', () => {
      const todoId = addTodo('Test todo for partial ID');
      const partialId = todoId.substring(0, 6);
      
      const result = runCommand(`walrus-todo complete ${partialId}`);
      
      expect(result.stdout).toContain('Todo completed successfully');
      expect(result.stdout).toContain(todoId);
      
      const todos = JSON.parse(fs.readFileSync(testDataFile, 'utf8'));
      const completedTodo = todos.find((t: any) => t.id === todoId);
      expect(completedTodo.completed).toBe(true);
    });

    it('should complete a todo by name when unique', () => {
      const todoTitle = 'Unique todo name for completion';
      const todoId = addTodo(todoTitle);
      
      const result = runCommand(`walrus-todo complete "${todoTitle.substring(0, 10)}"`);
      
      expect(result.stdout).toContain('Todo completed successfully');
      expect(result.stdout).toContain(todoId);
      
      const todos = JSON.parse(fs.readFileSync(testDataFile, 'utf8'));
      const completedTodo = todos.find((t: any) => t.id === todoId);
      expect(completedTodo.completed).toBe(true);
    });

    it('should complete multiple todos with --all flag', () => {
      const todoId1 = addTodo('First todo to complete');
      const todoId2 = addTodo('Second todo to complete');
      const todoId3 = addTodo('Third todo to complete');
      
      const result = runCommand(`walrus-todo complete ${todoId1} ${todoId2} ${todoId3} --all`);
      
      expect(result.stdout).toContain('3 todos completed successfully');
      
      const todos = JSON.parse(fs.readFileSync(testDataFile, 'utf8'));
      const completedTodos = todos.filter((t: any) => t.completed);
      expect(completedTodos).toHaveLength(3);
    });

    it('should complete already completed todo with success message', () => {
      const todoId = uuidv4();
      setupTodoWithId(todoId, 'Already completed todo', true);
      
      const result = runCommand(`walrus-todo complete ${todoId}`);
      
      expect(result.stdout).toContain('Todo is already completed');
      expect(result.stderr).toBe('');
    });

    it('should complete todo with metadata', () => {
      const todoId = addTodo('Todo with metadata');
      
      const result = runCommand(`walrus-todo complete ${todoId} --note "Completed ahead of schedule"`);
      
      expect(result.stdout).toContain('Todo completed successfully');
      
      const todos = JSON.parse(fs.readFileSync(testDataFile, 'utf8'));
      const completedTodo = todos.find((t: any) => t.id === todoId);
      expect(completedTodo.completionNote).toBe('Completed ahead of schedule');
    });

    it('should complete todo with category', () => {
      const todoId = addTodo('Categorized todo');
      
      const result = runCommand(`walrus-todo complete ${todoId} --category "work"`);
      
      expect(result.stdout).toContain('Todo completed successfully');
      
      const todos = JSON.parse(fs.readFileSync(testDataFile, 'utf8'));
      const completedTodo = todos.find((t: any) => t.id === todoId);
      expect(completedTodo.category).toBe('work');
    });
  });

  describe('error scenarios', () => {
    it('should error when no ID provided', () => {
      const result = runCommand('walrus-todo complete');
      
      expect(result.stderr).toContain('Missing required argument');
      expect(result.stdout).not.toContain('completed successfully');
    });

    it('should error when todo not found', () => {
      const nonExistentId = uuidv4();
      
      const result = runCommand(`walrus-todo complete ${nonExistentId}`);
      
      expect(result.stderr).toContain('Todo not found');
      expect(result.stdout).not.toContain('completed successfully');
    });

    it('should error when multiple todos match partial name', () => {
      addTodo('Complete this task');
      addTodo('Complete that task');
      
      const result = runCommand('walrus-todo complete "Complete"');
      
      expect(result.stderr).toContain('Multiple todos match');
      expect(result.stdout).not.toContain('completed successfully');
    });

    it('should error with invalid ID format', () => {
      const result = runCommand('walrus-todo complete invalid-id-!@#');
      
      expect(result.stderr).toContain('Invalid todo ID format');
      expect(result.stdout).not.toContain('completed successfully');
    });

    it('should handle empty todos list gracefully', () => {
      const result = runCommand('walrus-todo complete abc123');
      
      expect(result.stderr).toContain('Todo not found');
      expect(result.stdout).not.toContain('completed successfully');
    });

    it('should error when config file is corrupted', () => {
      // Write invalid JSON to test file
      fs.writeFileSync(testDataFile, 'invalid json content');
      
      const result = runCommand('walrus-todo complete test-id');
      
      expect(result.stderr).toContain('Failed to read todos');
      expect(result.stdout).not.toContain('completed successfully');
    });

    it('should error with --all flag but no IDs provided', () => {
      const result = runCommand('walrus-todo complete --all');
      
      expect(result.stderr).toContain('No todo IDs provided');
      expect(result.stdout).not.toContain('completed successfully');
    });
  });

  describe('output format scenarios', () => {
    it('should support JSON output format', () => {
      const todoId = addTodo('JSON output test');
      
      const result = runCommand(`walrus-todo complete ${todoId} --format json`);
      
      expect(() => JSON.parse(result.stdout)).not.toThrow();
      const output = JSON.parse(result.stdout);
      expect(output.status).toBe('success');
      expect(output.completed).toHaveLength(1);
      expect(output.completed[0].id).toBe(todoId);
    });

    it('should support minimal output format', () => {
      const todoId = addTodo('Minimal output test');
      
      const result = runCommand(`walrus-todo complete ${todoId} --format minimal`);
      
      expect(result.stdout.trim()).toBe(todoId);
    });

    it('should support verbose output format', () => {
      const todoId = addTodo('Verbose output test');
      
      const result = runCommand(`walrus-todo complete ${todoId} --verbose`);
      
      expect(result.stdout).toContain('Todo ID:');
      expect(result.stdout).toContain('Title:');
      expect(result.stdout).toContain('Completed at:');
      expect(result.stdout).toContain('Status: completed');
    });
  });

  describe('integration scenarios', () => {
    it('should work with piped input', () => {
      const todoId = addTodo('Piped input test');
      
      const result = execSync(`echo "${todoId}" | walrus-todo complete`, {
        encoding: 'utf8',
        env: { ...process.env, TODO_CONFIG_DIR: testConfigDir }
      });
      
      expect(result).toContain('Todo completed successfully');
    });

    it('should integrate with list command', () => {
      const todoId1 = addTodo('Active todo');
      const todoId2 = addTodo('To be completed');
      
      // Complete one todo
      runCommand(`walrus-todo complete ${todoId2}`);
      
      // List active todos
      const listResult = runCommand('walrus-todo list --active');
      
      expect(listResult.stdout).toContain('Active todo');
      expect(listResult.stdout).not.toContain('To be completed');
      
      // List completed todos
      const completedResult = runCommand('walrus-todo list --completed');
      
      expect(completedResult.stdout).not.toContain('Active todo');
      expect(completedResult.stdout).toContain('To be completed');
    });

    it('should handle concurrent completions', () => {
      const todoIds = [];
      for (let i = 0; i < 5; i++) {
        todoIds.push(addTodo(`Concurrent todo ${i}`));
      }
      
      // Attempt to complete all todos concurrently
      const promises = todoIds.map(id => 
        new Promise((resolve) => {
          const result = runCommand(`walrus-todo complete ${id}`);
          resolve(result);
        })
      );
      
      return Promise.all(promises).then(results => {
        const successCount = results.filter((r: any) => 
          r.stdout.includes('completed successfully')
        ).length;
        expect(successCount).toBe(5);
        
        // Verify all todos are completed
        const todos = JSON.parse(fs.readFileSync(testDataFile, 'utf8'));
        const completedCount = todos.filter((t: any) => t.completed).length;
        expect(completedCount).toBe(5);
      });
    });
  });

  describe('special cases', () => {
    it('should handle todos with special characters', () => {
      const specialTitle = 'Todo with "quotes" and \\backslashes\\ and $pecial chars!';
      const todoId = addTodo(specialTitle);
      
      const result = runCommand(`walrus-todo complete ${todoId}`);
      
      expect(result.stdout).toContain('Todo completed successfully');
      
      const todos = JSON.parse(fs.readFileSync(testDataFile, 'utf8'));
      const completedTodo = todos.find((t: any) => t.id === todoId);
      expect(completedTodo.title).toBe(specialTitle);
      expect(completedTodo.completed).toBe(true);
    });

    it('should handle very long todo titles', () => {
      const longTitle = 'A'.repeat(1000);
      const todoId = addTodo(longTitle);
      
      const result = runCommand(`walrus-todo complete ${todoId}`);
      
      expect(result.stdout).toContain('Todo completed successfully');
      
      const todos = JSON.parse(fs.readFileSync(testDataFile, 'utf8'));
      const completedTodo = todos.find((t: any) => t.id === todoId);
      expect(completedTodo.completed).toBe(true);
    });

    it('should preserve todo properties after completion', () => {
      const todoId = uuidv4();
      const originalTodo = {
        id: todoId,
        title: 'Todo with extra props',
        completed: false,
        createdAt: new Date().toISOString(),
        aiGenerated: true,
        priority: 'high',
        tags: ['important', 'urgent'],
        customField: 'custom value'
      };
      
      fs.writeFileSync(testDataFile, JSON.stringify([originalTodo], null, 2));
      
      const result = runCommand(`walrus-todo complete ${todoId}`);
      
      expect(result.stdout).toContain('Todo completed successfully');
      
      const todos = JSON.parse(fs.readFileSync(testDataFile, 'utf8'));
      const completedTodo = todos.find((t: any) => t.id === todoId);
      
      expect(completedTodo.completed).toBe(true);
      expect(completedTodo.aiGenerated).toBe(true);
      expect(completedTodo.priority).toBe('high');
      expect(completedTodo.tags).toEqual(['important', 'urgent']);
      expect(completedTodo.customField).toBe('custom value');
    });
  });
});