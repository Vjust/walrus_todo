import * as fs from 'fs';
import * as path from 'path';

describe('Todo Lifecycle E2E Workflow', () => {
  const CLI_PATH = path.join(__dirname, '../../../bin/run');
  const TEMP_DIR = path.join(__dirname, '../temp');
  const CONFIG_FILE = path.join(TEMP_DIR, 'test-config.json');
  
  // Helper to execute CLI commands
  const runCommand = (command: string): { output: string; error: string } => {
    try {
      const output = execSync(`${CLI_PATH} ${command}`, {
        env: {
          ...process.env,
          WALRUS_USE_MOCK: 'true',
          TODO_CONFIG_PATH: CONFIG_FILE,
          NODE_ENV: 'test'
        },
        encoding: 'utf8'
      });
      return { output, error: '' };
    } catch (error: any) {
      return { 
        output: error.stdout || '', 
        error: error.stderr || error.message 
      };
    }
  };

  beforeAll(() => {
    // Create temp directory and clean config
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
    
    // Initialize empty config
    const config = {
      todos: [],
      defaultContext: 'testnet',
      contexts: {
        testnet: {
          name: 'testnet',
          rpcUrl: 'https://fullnode.testnet.sui.io:443',
          walrusUrl: 'https://walrus-testnet.walrus.space',
          walrusPublisher: 'https://walrus-testnet-publisher.walrus.space'
        }
      }
    };
    
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  });

  afterAll(() => {
    // Clean up temp directory
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  });

  describe('Basic Todo Workflow', () => {
    let todoId: string;

    test('should create a new todo', () => {
      const { output, error } = runCommand('add "Complete E2E testing" --priority high');
      
      expect(error).toBe('');
      expect(output).toContain('Todo added successfully');
      expect(output).toContain('Complete E2E testing');
      
      // Extract todo ID from output
      const match = output.match(/ID: ([a-f0-9-]+)/);
      expect(match).toBeTruthy();
      todoId = match![1];
    });

    test('should list todos including the new one', () => {
      const { output, error } = runCommand('list');
      
      expect(error).toBe('');
      expect(output).toContain('Complete E2E testing');
      expect(output).toContain('pending');
      expect(output).toContain('high');
      expect(output).toContain(todoId);
    });

    test('should show full details of a specific todo', () => {
      const { output, error } = runCommand(`list ${todoId}`);
      
      expect(error).toBe('');
      expect(output).toContain(todoId);
      expect(output).toContain('Complete E2E testing');
      expect(output).toContain('Status: pending');
      expect(output).toContain('Priority: high');
    });

    test('should update todo status to in-progress', () => {
      const { output, error } = runCommand(`update ${todoId} --status in-progress`);
      
      expect(error).toBe('');
      expect(output).toContain('Todo updated successfully');
    });

    test('should verify todo status was updated', () => {
      const { output, error } = runCommand(`list ${todoId}`);
      
      expect(error).toBe('');
      expect(output).toContain('Status: in-progress');
    });

    test('should update todo content', () => {
      const { output, error } = runCommand(`update ${todoId} --content "Complete E2E testing with comprehensive coverage"`);
      
      expect(error).toBe('');
      expect(output).toContain('Todo updated successfully');
    });

    test('should complete the todo', () => {
      const { output, error } = runCommand(`complete ${todoId}`);
      
      expect(error).toBe('');
      expect(output).toContain('Todo completed');
      expect(output).toContain(todoId);
    });

    test('should verify todo is completed', () => {
      const { output, error } = runCommand(`list ${todoId}`);
      
      expect(error).toBe('');
      expect(output).toContain('Status: completed');
    });

    test('should not list completed todos by default', () => {
      const { output, error } = runCommand('list');
      
      expect(error).toBe('');
      expect(output).not.toContain('Complete E2E testing');
    });

    test('should list completed todos with --all flag', () => {
      const { output, error } = runCommand('list --all');
      
      expect(error).toBe('');
      expect(output).toContain('Complete E2E testing');
      expect(output).toContain('completed');
    });

    test('should delete the todo', () => {
      const { output, error } = runCommand(`delete ${todoId}`);
      
      expect(error).toBe('');
      expect(output).toContain('Todo deleted');
    });

    test('should not find deleted todo', () => {
      const { output, error } = runCommand(`list ${todoId}`);
      
      expect(error).toContain('Todo not found');
    });
  });

  describe('Batch Todo Operations', () => {
    const todoIds: string[] = [];

    test('should create multiple todos', () => {
      const todos = [
        'First batch todo',
        'Second batch todo',
        'Third batch todo'
      ];

      todos.forEach(todo => {
        const { output, error } = runCommand(`add "${todo}"`);
        
        expect(error).toBe('');
        const match = output.match(/ID: ([a-f0-9-]+)/);
        expect(match).toBeTruthy();
        todoIds.push(match![1]);
      });

      expect(todoIds).toHaveLength(3);
    });

    test('should list all created todos', () => {
      const { output, error } = runCommand('list');
      
      expect(error).toBe('');
      expect(output).toContain('First batch todo');
      expect(output).toContain('Second batch todo');
      expect(output).toContain('Third batch todo');
    });

    test('should filter todos by priority', () => {
      // Update one todo to high priority
      runCommand(`update ${todoIds[0]} --priority high`);
      
      const { output, error } = runCommand('list --priority high');
      
      expect(error).toBe('');
      expect(output).toContain('First batch todo');
      expect(output).not.toContain('Second batch todo');
    });

    test('should complete multiple todos', () => {
      todoIds.forEach(id => {
        const { output, error } = runCommand(`complete ${id}`);
        expect(error).toBe('');
        expect(output).toContain('Todo completed');
      });
    });

    test('should show completed count', () => {
      const { output, error } = runCommand('list --all');
      
      expect(error).toBe('');
      expect(output).toMatch(/3 completed/i);
    });
  });

  describe('Advanced Features', () => {
    let todoId: string;

    test('should create todo with tags', () => {
      const { output, error } = runCommand('add "Tagged todo" --tags testing,e2e,workflow');
      
      expect(error).toBe('');
      const match = output.match(/ID: ([a-f0-9-]+)/);
      expect(match).toBeTruthy();
      todoId = match![1];
    });

    test('should filter by tags', () => {
      const { output, error } = runCommand('list --tag e2e');
      
      expect(error).toBe('');
      expect(output).toContain('Tagged todo');
    });

    test('should update multiple properties at once', () => {
      const { output, error } = runCommand(`update ${todoId} --priority high --status in-progress --content "Updated tagged todo"`);
      
      expect(error).toBe('');
      expect(output).toContain('Todo updated successfully');
    });

    test('should verify all updates', () => {
      const { output, error } = runCommand(`list ${todoId}`);
      
      expect(error).toBe('');
      expect(output).toContain('Updated tagged todo');
      expect(output).toContain('Priority: high');
      expect(output).toContain('Status: in-progress');
    });
  });

  describe('Storage Operations', () => {
    let localTodoId: string;
    let storedTodoId: string;

    test('should create local todo', () => {
      const { output, error } = runCommand('add "Local todo item"');
      
      expect(error).toBe('');
      const match = output.match(/ID: ([a-f0-9-]+)/);
      expect(match).toBeTruthy();
      localTodoId = match![1];
    });

    test('should store todo to Walrus', () => {
      const { output, error } = runCommand(`store ${localTodoId} --mock`);
      
      expect(error).toBe('');
      expect(output).toContain('stored to Walrus');
      
      // Extract stored blob ID (in mock mode it'll be a generated ID)
      const blobMatch = output.match(/Blob ID: ([a-zA-Z0-9]+)/);
      expect(blobMatch).toBeTruthy();
    });

    test('should create and store in one command', () => {
      const { output, error } = runCommand('add "Direct store todo" --store --mock');
      
      expect(error).toBe('');
      expect(output).toContain('Todo added and stored');
      
      const match = output.match(/ID: ([a-f0-9-]+)/);
      expect(match).toBeTruthy();
      storedTodoId = match![1];
    });

    test('should retrieve stored todo', () => {
      const { output, error } = runCommand(`fetch ${storedTodoId}`);
      
      expect(error).toBe('');
      expect(output).toContain('Direct store todo');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid todo ID', () => {
      const { output, error } = runCommand('complete invalid-id');
      
      expect(error).toContain('Todo not found');
    });

    test('should handle missing required parameters', () => {
      const { output, error } = runCommand('add');
      
      expect(error).toContain('required');
    });

    test('should handle invalid priority', () => {
      const { output, error } = runCommand('add "Test" --priority invalid');
      
      expect(error).toContain('Invalid priority');
    });

    test('should handle conflicting status updates', () => {
      const { output } = runCommand('add "Test todo"');
      const match = output.match(/ID: ([a-f0-9-]+)/);
      const id = match![1];
      
      // Complete the todo
      runCommand(`complete ${id}`);
      
      // Try to update completed todo
      const { error } = runCommand(`update ${id} --status in-progress`);
      
      expect(error).toContain('Cannot update completed todo');
    });
  });

  describe('Complex Workflows', () => {
    test('should handle full lifecycle with all features', () => {
      // Create
      const { output: createOutput } = runCommand('add "Full lifecycle todo" --priority medium --tags important,test');
      const match = createOutput.match(/ID: ([a-f0-9-]+)/);
      const todoId = match![1];
      
      // Update multiple times
      runCommand(`update ${todoId} --priority high`);
      runCommand(`update ${todoId} --status in-progress`);
      runCommand(`update ${todoId} --content "Full lifecycle todo - updated"`);
      
      // Store
      const { output: storeOutput } = runCommand(`store ${todoId} --mock`);
      expect(storeOutput).toContain('stored to Walrus');
      
      // Complete
      const { output: completeOutput } = runCommand(`complete ${todoId}`);
      expect(completeOutput).toContain('Todo completed');
      
      // Verify final state
      const { output: listOutput } = runCommand(`list ${todoId} --all`);
      expect(listOutput).toContain('Status: completed');
      expect(listOutput).toContain('Priority: high');
      expect(listOutput).toContain('Full lifecycle todo - updated');
    });

    test('should handle concurrent operations gracefully', async () => {
      // Create multiple todos
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(new Promise(resolve => {
          const { output, error } = runCommand(`add "Concurrent todo ${i}"`);
          resolve({ output, error, index: i });
        }));
      }
      
      const results = await Promise.all(promises);
      
      // Verify all todos were created successfully
      results.forEach((result: any) => {
        expect(result.error).toBe('');
        expect(result.output).toContain('Todo added successfully');
      });
      
      // List all todos
      const { output: listOutput } = runCommand('list');
      for (let i = 0; i < 5; i++) {
        expect(listOutput).toContain(`Concurrent todo ${i}`);
      }
    });
  });
});