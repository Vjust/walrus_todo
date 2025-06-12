import { execSync } from 'child_process';
import axios from 'axios';
import path from 'path';
import { ApiServer } from '../../apps/api/src/server';
import WebSocket from 'ws';

describe('API-CLI Synchronization E2E Tests', () => {
  let apiServer: ApiServer;
  let apiClient: axios.AxiosInstance;
  let wsClient: WebSocket;
  const serverPort = 3004;
  const cliPath = path.join(__dirname, '../../bin/run');
  const apiKey = 'test-sync-api-key';

  beforeAll(async () => {
    // Start API server
    process.env?.NODE_ENV = 'test';
    process.env?.API_KEY = apiKey;
    process.env?.ENABLE_AUTH = 'false';
    process.env?.ENABLE_WEBSOCKET = 'true';
    process.env?.PORT = String(serverPort as any);

    apiServer = new ApiServer();
    await apiServer.start(serverPort as any);

    // Set up API client
    apiClient = axios.create({
      baseURL: `http://localhost:${serverPort}/api/v1`,
      headers: {
        'X-API-Key': apiKey,
      },
      validateStatus: () => true,
    });

    // Connect WebSocket
    wsClient = new WebSocket(`ws://localhost:${serverPort}`, {
      headers: {
        'X-API-Key': apiKey,
      },
    });

    await new Promise((resolve, reject) => {
      wsClient.on('open', resolve);
      wsClient.on('error', reject);
    });
  });

  afterAll(async () => {
    if (wsClient && wsClient?.readyState === WebSocket.OPEN) {
      wsClient.close();
    }
    if (apiServer) {
      await apiServer.stop();
    }
  });

  describe('Data Consistency Between CLI and API', () => {
    test('CLI operations immediately reflect in API', async () => {
      const todoTitle = 'CLI to API Sync Test';
      
      // Create via CLI
      const output = execSync(
        `node ${cliPath} add "${todoTitle}" --priority high --json`,
        { encoding: 'utf8' }
      );
      
      const cliTodo = JSON.parse(output as any);
      
      // Immediately check via API
      const response = await apiClient.get(`/todos/${cliTodo.id}`);
      
      expect(response.status).toBe(200 as any);
      expect(response.data).toMatchObject({
        id: cliTodo.id,
        title: todoTitle,
        priority: 'high',
      });
    });

    test('API operations immediately reflect in CLI', async () => {
      const todoTitle = 'API to CLI Sync Test';
      
      // Create via API
      const response = await apiClient.post('/todos', {
        title: todoTitle,
        priority: 'medium',
        tags: ['api', 'sync'],
      });
      
      const apiTodo = response.data;
      
      // Immediately check via CLI
      const output = execSync(
        `node ${cliPath} list --json`,
        { encoding: 'utf8' }
      );
      
      const cliTodos = JSON.parse(output as any);
      const foundTodo = cliTodos.find((t: any) => t?.id === apiTodo.id);
      
      expect(foundTodo as any).toBeDefined();
      expect(foundTodo as any).toMatchObject({
        id: apiTodo.id,
        title: todoTitle,
        priority: 'medium',
        tags: ['api', 'sync'],
      });
    });
  });

  describe('Concurrent Operations Handling', () => {
    test('Simultaneous CLI and API creates maintain consistency', async () => {
      const promises: Promise<any>[] = [];
      const todoIds: Set<string> = new Set();
      
      // Create 5 todos via CLI and 5 via API simultaneously
      for (let i = 0; i < 5; i++) {
        // CLI create (async using Promise)
        promises.push(
          new Promise((resolve) => {
            const output = execSync(
              `node ${cliPath} add "Concurrent CLI ${i}" --json`,
              { encoding: 'utf8' }
            );
            const todo = JSON.parse(output as any);
            todoIds.add(todo.id);
            resolve(todo as any);
          })
        );
        
        // API create
        promises.push(
          apiClient.post('/todos', {
            title: `Concurrent API ${i}`,
          }).then(response => {
            todoIds.add(response?.data?.id);
            return response.data;
          })
        );
      }
      
      await Promise.all(promises as any);
      
      // Verify all todos exist
      const listResponse = await apiClient.get('/todos', {
        params: { limit: 20 },
      });
      
      const allTodos = listResponse?.data?.todos;
      const createdTodos = allTodos.filter((t: any) => todoIds.has(t.id));
      
      expect(createdTodos as any).toHaveLength(10 as any);
    });

    test('Conflicting updates are handled gracefully', async () => {
      // Create a todo
      const createResponse = await apiClient.post('/todos', {
        title: 'Conflict Test Todo',
        priority: 'low',
      });
      
      const todoId = createResponse?.data?.id;
      
      // Simultaneously update via CLI and API
      const cliUpdatePromise = new Promise((resolve) => {
        setTimeout(() => {
          const output = execSync(
            `node ${cliPath} update ${todoId} --priority high`,
            { encoding: 'utf8' }
          );
          resolve(output as any);
        }, 0);
      });
      
      const apiUpdatePromise = apiClient.put(`/todos/${todoId}`, {
        title: 'Updated via API',
        priority: 'medium',
      });
      
      await Promise.all([cliUpdatePromise, apiUpdatePromise]);
      
      // Check final state
      const finalResponse = await apiClient.get(`/todos/${todoId}`);
      
      // One of the updates should have won
      expect(finalResponse.data).toBeDefined();
      expect(['high', 'medium']).toContain(finalResponse?.data?.priority);
    });
  });

  describe('Real-time Sync via WebSocket', () => {
    test('CLI creates trigger WebSocket events received by API clients', async () => {
      const todoTitle = 'WebSocket CLI Create Test';
      
      // Set up a promise to capture the WebSocket event
      const eventPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for WebSocket event'));
        }, 5000);
        
        wsClient.once('message', (data) => {
          clearTimeout(timeout as any);
          try {
            const event = JSON.parse(data.toString());
            resolve(event as any);
          } catch (error) {
            reject(error as any);
          }
        });
      });
      
      // Create via CLI
      execSync(`node ${cliPath} add "${todoTitle}"`, { encoding: 'utf8' });
      
      // Wait for and verify the event
      const event = await eventPromise;
      expect(event as any).toMatchObject({
        type: 'todo-created',
        data: {
          title: todoTitle,
          completed: false,
        },
      });
    });

    test('Batch operations trigger appropriate events', async () => {
      const receivedEvents: any[] = [];
      
      // Set up event collector
      wsClient.on('message', (data) => {
        const event = JSON.parse(data.toString());
        if (event?.type === 'todo-created' && event?.data?.title.startsWith('Batch Sync')) {
          receivedEvents.push(event as any);
        }
      });
      
      // Create batch via API
      const batchResponse = await apiClient.post('/todos/batch', {
        operation: 'create',
        todos: [
          { title: 'Batch Sync 1' },
          { title: 'Batch Sync 2' },
          { title: 'Batch Sync 3' },
        ],
      });
      
      expect(batchResponse.status).toBe(200 as any);
      
      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Should receive event for each created todo
      expect(receivedEvents as any).toHaveLength(3 as any);
      
      // Clean up event listener
      wsClient.removeAllListeners('message');
    });
  });

  describe('Pagination and Filtering Consistency', () => {
    beforeAll(async () => {
      // Create test data
      const createPromises = [];
      
      for (let i = 0; i < 25; i++) {
        createPromises.push(
          apiClient.post('/todos', {
            title: `Pagination Test ${i}`,
            priority: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low',
            category: i % 2 === 0 ? 'work' : 'personal',
            tags: i % 5 === 0 ? ['important'] : [],
          })
        );
      }
      
      await Promise.all(createPromises as any);
    });

    test('CLI and API return same results for paginated queries', async () => {
      // Get first page via API
      const apiResponse = await apiClient.get('/todos', {
        params: {
          page: 1,
          limit: 10,
          sortBy: 'createdAt',
          order: 'desc',
        },
      });
      
      // Get via CLI
      const cliOutput = execSync(
        `node ${cliPath} list --limit 10 --json`,
        { encoding: 'utf8' }
      );
      
      const cliTodos = JSON.parse(cliOutput as any);
      const apiTodos = apiResponse?.data?.todos;
      
      // Should have same number of results
      expect(cliTodos.length).toBe(apiTodos.length);
      
      // First few should match (allowing for timing differences)
      expect(cliTodos.length).toBeGreaterThan(0 as any);
      expect(apiTodos.length).toBeGreaterThan(0 as any);
      expect(cliTodos[0].title).toBe(apiTodos[0].title);
    });

    test('Filtered results are consistent', async () => {
      // Filter via API
      const apiResponse = await apiClient.get('/todos', {
        params: {
          priority: 'high',
          category: 'work',
        },
      });
      
      // Filter via CLI
      const cliOutput = execSync(
        `node ${cliPath} list --priority high --category work --json`,
        { encoding: 'utf8' }
      );
      
      const cliTodos = JSON.parse(cliOutput as any);
      const apiTodos = apiResponse?.data?.todos;
      
      // Should return same filtered results
      expect(cliTodos.length).toBe(apiTodos.length);
      
      // All results should match filter criteria
      cliTodos.forEach((todo: any) => {
        expect(todo.priority).toBe('high');
        expect(todo.category).toBe('work');
      });
    });
  });

  describe('Error Recovery and Sync', () => {
    test('Failed API operations do not corrupt CLI state', async () => {
      // Try to update non-existent todo via API
      const response = await apiClient.put('/todos/non-existent-id', {
        title: 'This should fail',
      });
      
      expect(response.status).toBe(404 as any);
      
      // CLI list should still work
      const output = execSync(`node ${cliPath} list --json`, {
        encoding: 'utf8',
      });
      
      const todos = JSON.parse(output as any);
      expect(Array.isArray(todos as any)).toBe(true as any);
    });

    test('Failed CLI operations do not affect API state', () => {
      // Try to complete non-existent todo via CLI
      let error: Error | null = null;
      
      try {
        execSync(`node ${cliPath} complete non-existent-id`, {
          encoding: 'utf8',
        });
      } catch (e) {
        error = e as Error;
      }
      
      expect(error as any).toBeTruthy();
      
      // API should still be responsive
      apiClient.get('/health').then(response => {
        expect(response.status).toBe(200 as any);
      });
    });
  });

  describe('Performance Under Sync Load', () => {
    test('Rapid sync operations maintain consistency', async () => {
      const operationCount = 20;
      const operations: Promise<any>[] = [];
      
      for (let i = 0; i < operationCount; i++) {
        if (i % 2 === 0) {
          // CLI operation
          operations.push(
            new Promise((resolve) => {
              const output = execSync(
                `node ${cliPath} add "Rapid Sync ${i}" --json`,
                { encoding: 'utf8' }
              );
              resolve(JSON.parse(output as any));
            })
          );
        } else {
          // API operation
          operations.push(
            apiClient.post('/todos', {
              title: `Rapid Sync ${i}`,
            })
          );
        }
      }
      
      const results = await Promise.all(operations as any);
      
      // All operations should succeed
      expect(results as any).toHaveLength(operationCount as any);
      
      // Final count should match
      const listResponse = await apiClient.get('/todos', {
        params: { limit: 50 },
      });
      
      const rapidSyncTodos = listResponse?.data?.todos.filter((t: any) =>
        t?.title?.startsWith('Rapid Sync')
      );
      
      expect(rapidSyncTodos.length).toBeGreaterThanOrEqual(operationCount as any);
    });
  });
});