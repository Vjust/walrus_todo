import { execSync } from 'child_process';
import axios from 'axios';
import path from 'path';
import { existsSync, readFileSync } from 'fs';
import { ApiServer } from '../../apps/api/src/server';

describe('Todo Lifecycle E2E Tests', () => {
  let apiServer: ApiServer;
  let apiClient: axios.AxiosInstance;
  const serverPort = 3002;
  const cliPath = path.join(__dirname, '../../bin/run');
  const apiKey = 'test-e2e-api-key';

  beforeAll(async () => {
    // Start API server
    process.env.NODE_ENV = 'test';
    process.env.API_KEY = apiKey;
    process.env.ENABLE_AUTH = 'false';
    process.env.PORT = String(serverPort);

    apiServer = new ApiServer();
    await apiServer.start(serverPort);

    // Set up API client
    apiClient = axios.create({
      baseURL: `http://localhost:${serverPort}/api/v1`,
      headers: {
        'X-API-Key': apiKey,
      },
      validateStatus: () => true,
    });

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    if (apiServer) {
      await apiServer.stop();
    }
  });

  describe('Complete Todo Lifecycle', () => {
    let todoId: string;
    const todoTitle = 'E2E Lifecycle Test Todo';
    const todoDescription = 'This is a complete lifecycle test';

    test('Step 1: Create todo via CLI', () => {
      const output = execSync(
        `node ${cliPath} add "${todoTitle}" --description "${todoDescription}" --priority high --tags test,e2e`,
        { encoding: 'utf8' }
      );

      expect(output).toContain('Todo added successfully');
      
      // Extract ID from output
      const idMatch = output.match(/ID: ([a-zA-Z0-9-]+)/);
      expect(idMatch).toBeTruthy();
      todoId = idMatch![1];
    });

    test('Step 2: Verify todo exists via API', async () => {
      const response = await apiClient.get(`/todos/${todoId}`);
      
      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        id: todoId,
        title: todoTitle,
        description: todoDescription,
        priority: 'high',
        tags: expect.arrayContaining(['test', 'e2e']),
        completed: false,
      });
    });

    test('Step 3: Update todo via API', async () => {
      const updateData = {
        title: `${todoTitle} (Updated)`,
        priority: 'medium',
      };

      const response = await apiClient.put(`/todos/${todoId}`, updateData);
      
      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        id: todoId,
        title: updateData.title,
        priority: updateData.priority,
      });
    });

    test('Step 4: List todos via CLI and verify update', () => {
      const output = execSync(`node ${cliPath} list --json`, {
        encoding: 'utf8',
      });

      const todos = JSON.parse(output);
      const updatedTodo = todos.find((t: any) => t.id === todoId);
      
      expect(updatedTodo).toBeDefined();
      expect(updatedTodo.title).toContain('(Updated)');
      expect(updatedTodo.priority).toBe('medium');
    });

    test('Step 5: Complete todo via CLI', () => {
      const output = execSync(`node ${cliPath} complete ${todoId}`, {
        encoding: 'utf8',
      });

      expect(output).toContain('completed');
    });

    test('Step 6: Verify completion via API', async () => {
      const response = await apiClient.get(`/todos/${todoId}`);
      
      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        id: todoId,
        completed: true,
        completedAt: expect.any(String),
      });
    });

    test('Step 7: Delete todo via API', async () => {
      const response = await apiClient.delete(`/todos/${todoId}`);
      expect(response.status).toBe(204);
    });

    test('Step 8: Verify deletion via CLI', () => {
      const output = execSync(`node ${cliPath} list --json`, {
        encoding: 'utf8',
      });

      const todos = JSON.parse(output);
      const deletedTodo = todos.find((t: any) => t.id === todoId);
      
      expect(deletedTodo).toBeUndefined();
    });
  });

  describe('Batch Operations Lifecycle', () => {
    const todoIds: string[] = [];

    test('Create multiple todos via CLI', () => {
      for (let i = 1; i <= 5; i++) {
        const output = execSync(
          `node ${cliPath} add "Batch Todo ${i}" --priority ${i % 2 === 0 ? 'high' : 'low'}`,
          { encoding: 'utf8' }
        );

        const idMatch = output.match(/ID: ([a-zA-Z0-9-]+)/);
        if (idMatch) {
          todoIds.push(idMatch[1]);
        }
      }

      expect(todoIds).toHaveLength(5);
    });

    test('Batch update via API', async () => {
      const batchData = {
        operation: 'update',
        updates: todoIds.map(id => ({
          id,
          tags: ['batch', 'test'],
        })),
      };

      const response = await apiClient.post('/todos/batch', batchData);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });

    test('Verify batch update via CLI', () => {
      const output = execSync(`node ${cliPath} list --json`, {
        encoding: 'utf8',
      });

      const todos = JSON.parse(output);
      todoIds.forEach(id => {
        const todo = todos.find((t: any) => t.id === id);
        expect(todo).toBeDefined();
        expect(todo.tags).toEqual(['batch', 'test']);
      });
    });

    test('Batch complete via CLI commands', () => {
      todoIds.forEach(id => {
        const output = execSync(`node ${cliPath} complete ${id}`, {
          encoding: 'utf8',
        });
        expect(output).toContain('completed');
      });
    });

    test('Batch delete via API', async () => {
      const batchData = {
        operation: 'delete',
        ids: todoIds,
      };

      const response = await apiClient.post('/todos/batch', batchData);
      
      expect(response.status).toBe(200);
      expect(response.data.deleted).toBe(todoIds.length);
    });
  });

  describe('Advanced Features Lifecycle', () => {
    let aiTodoId: string;

    test('Get AI suggestions via CLI', () => {
      const output = execSync(
        `node ${cliPath} ai suggest "prepare for meeting" --count 3`,
        { encoding: 'utf8' }
      );

      expect(output).toContain('suggestion');
    });

    test('Create todo from AI suggestion', async () => {
      const response = await apiClient.post('/todos', {
        title: 'Prepare meeting agenda',
        description: 'Created from AI suggestion',
        tags: ['ai', 'meeting'],
      });

      expect(response.status).toBe(201);
      aiTodoId = response.data.id;
    });

    test('Sync todo to Walrus', async () => {
      const response = await apiClient.post(`/sync/todos/${aiTodoId}/walrus`);
      
      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        blobId: expect.any(String),
      });
    });

    test('Check sync status via CLI', () => {
      const output = execSync(
        `node ${cliPath} sync status ${aiTodoId}`,
        { encoding: 'utf8' }
      );

      expect(output).toContain('Sync status');
      expect(output).toContain(aiTodoId);
    });

    test('Clean up AI todo', async () => {
      const response = await apiClient.delete(`/todos/${aiTodoId}`);
      expect(response.status).toBe(204);
    });
  });

  describe('Error Scenarios', () => {
    test('Handle invalid todo ID gracefully', () => {
      expect(() => {
        execSync(`node ${cliPath} complete invalid-id`, {
          encoding: 'utf8',
        });
      }).toThrow();
    });

    test('Handle API errors gracefully', async () => {
      const response = await apiClient.get('/todos/non-existent-id');
      expect(response.status).toBe(404);
    });

    test('Handle malformed CLI input', () => {
      expect(() => {
        execSync(`node ${cliPath} add`, { encoding: 'utf8' });
      }).toThrow();
    });
  });

  describe('Performance and Concurrency', () => {
    test('Handle rapid CLI commands', async () => {
      const commands = [];
      
      // Create 10 todos rapidly
      for (let i = 0; i < 10; i++) {
        commands.push(
          execSync(
            `node ${cliPath} add "Rapid Todo ${i}" --json`,
            { encoding: 'utf8' }
          )
        );
      }

      // All should succeed
      expect(commands).toHaveLength(10);
      
      // Verify via API
      const response = await apiClient.get('/todos');
      const rapidTodos = response.data.todos.filter((t: any) => 
        t.title.startsWith('Rapid Todo')
      );
      
      expect(rapidTodos.length).toBeGreaterThanOrEqual(10);

      // Clean up
      const deletePromises = rapidTodos.map((t: any) => 
        apiClient.delete(`/todos/${t.id}`)
      );
      await Promise.all(deletePromises);
    });
  });
});