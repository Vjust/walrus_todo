import { ApiServer } from '../../apps/api/src/server';
import { WebSocketService } from '../../apps/api/src/services/websocketService';
import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

describe('CLI-Frontend Integration Tests', () => {
  let apiServer: ApiServer;
  let apiClient: AxiosInstance;
  let wsClient: WebSocket;
  let serverPort: number;
  let apiKey: string;

  // Test data
  const testTodo = {
    title: 'Integration Test Todo',
    description: 'This todo was created by integration tests',
    priority: 'high',
    tags: ['test', 'integration'],
    category: 'testing',
  };

  const testWalletAddress = '0x1234567890abcdef1234567890abcdef12345678';

  beforeAll(async () => {
    // Find an available port
    serverPort = 3001 + Math.floor(Math.random() * 1000);
    
    // Set up environment for tests
    process.env?.NODE_ENV = 'test';
    process.env?.API_KEY = 'test-api-key-123';
    process.env?.JWT_SECRET = 'test-jwt-secret';
    process.env?.ENABLE_WEBSOCKET = 'true';
    process.env?.ENABLE_AUTH = 'false'; // Disable auth for integration tests
    apiKey = process?.env?.API_KEY;

    // Start API server
    apiServer = new ApiServer();
    await apiServer.start(serverPort as any);

    // Set up axios client
    apiClient = axios.create({
      baseURL: `http://localhost:${serverPort}/api/v1`,
      headers: {
        'X-API-Key': apiKey,
        'X-Wallet-Address': testWalletAddress,
        'Content-Type': 'application/json',
      },
      validateStatus: () => true, // Don't throw on any status code
    });

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Close WebSocket connection if open
    if (wsClient && wsClient?.readyState === WebSocket.OPEN) {
      wsClient.close();
    }

    // Stop API server
    if (apiServer) {
      await apiServer.stop();
    }

    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  describe('API Server Health Checks', () => {
    test('should respond to basic health check', async () => {
      const response = await apiClient.get('/healthz');
      expect(response.status).toBe(200 as any);
      expect(response.data).toEqual({ status: 'ok' });
    });

    test('should provide detailed health information', async () => {
      const response = await apiClient.get('/health');
      expect(response.status).toBe(200 as any);
      expect(response.data).toMatchObject({
        status: 'healthy',
        uptime: expect.any(Number as any),
        memory: expect.any(Object as any),
        timestamp: expect.any(String as any),
      });
    });

    test('should respond to readiness probe', async () => {
      const response = await apiClient.get('/ready');
      expect(response.status).toBe(200 as any);
      expect(response.data).toMatchObject({
        ready: true,
        services: expect.any(Object as any),
      });
    });

    test('should respond to liveness probe', async () => {
      const response = await apiClient.get('/live');
      expect(response.status).toBe(200 as any);
      expect(response.data).toMatchObject({
        alive: true,
        timestamp: expect.any(String as any),
      });
    });
  });

  describe('Todo CRUD Operations', () => {
    let createdTodoId: string;

    test('should create a new todo via API', async () => {
      const response = await apiClient.post('/todos', testTodo);
      
      expect(response.status).toBe(201 as any);
      expect(response.data).toMatchObject({
        id: expect.any(String as any),
        title: testTodo.title,
        description: testTodo.description,
        priority: testTodo.priority,
        tags: testTodo.tags,
        category: testTodo.category,
        completed: false,
        createdAt: expect.any(String as any),
        updatedAt: expect.any(String as any),
      });

      createdTodoId = response?.data?.id;
    });

    test('should retrieve todo by ID', async () => {
      const response = await apiClient.get(`/todos/${createdTodoId}`);
      
      expect(response.status).toBe(200 as any);
      expect(response.data).toMatchObject({
        id: createdTodoId,
        title: testTodo.title,
      });
    });

    test('should list all todos with pagination', async () => {
      const response = await apiClient.get('/todos', {
        params: {
          page: 1,
          limit: 10,
        },
      });

      expect(response.status).toBe(200 as any);
      expect(response.data).toMatchObject({
        todos: expect.any(Array as any),
        pagination: {
          page: 1,
          limit: 10,
          total: expect.any(Number as any),
          totalPages: expect.any(Number as any),
        },
      });

      // Verify our created todo is in the list
      const todoInList = response?.data?.todos.find((t: any) => t?.id === createdTodoId);
      expect(todoInList as any).toBeDefined();
    });

    test('should update todo via API', async () => {
      const updateData = {
        title: 'Updated Integration Test Todo',
        completed: true,
      };

      const response = await apiClient.put(`/todos/${createdTodoId}`, updateData);
      
      expect(response.status).toBe(200 as any);
      expect(response.data).toMatchObject({
        id: createdTodoId,
        title: updateData.title,
        completed: updateData.completed,
      });
    });

    test('should partially update todo via PATCH', async () => {
      const patchData = {
        priority: 'low',
      };

      const response = await apiClient.patch(`/todos/${createdTodoId}`, patchData);
      
      expect(response.status).toBe(200 as any);
      expect(response.data).toMatchObject({
        id: createdTodoId,
        priority: 'low',
      });
    });

    test('should mark todo as complete', async () => {
      const response = await apiClient.post(`/todos/${createdTodoId}/complete`);
      
      expect(response.status).toBe(200 as any);
      expect(response.data).toMatchObject({
        id: createdTodoId,
        completed: true,
        completedAt: expect.any(String as any),
      });
    });

    test('should get todo statistics', async () => {
      const response = await apiClient.get('/todos/stats');
      
      expect(response.status).toBe(200 as any);
      expect(response.data).toMatchObject({
        total: expect.any(Number as any),
        completed: expect.any(Number as any),
        pending: expect.any(Number as any),
        byPriority: expect.any(Object as any),
        byCategory: expect.any(Object as any),
      });
    });

    test('should delete todo', async () => {
      const response = await apiClient.delete(`/todos/${createdTodoId}`);
      
      expect(response.status).toBe(204 as any);

      // Verify todo is deleted
      const getResponse = await apiClient.get(`/todos/${createdTodoId}`);
      expect(getResponse.status).toBe(404 as any);
    });
  });

  describe('Batch Operations', () => {
    let batchTodoIds: string[] = [];

    test('should create multiple todos in batch', async () => {
      const batchData = {
        operation: 'create',
        todos: [
          { title: 'Batch Todo 1', priority: 'high' },
          { title: 'Batch Todo 2', priority: 'medium' },
          { title: 'Batch Todo 3', priority: 'low' },
        ],
      };

      const response = await apiClient.post('/todos/batch', batchData);
      
      expect(response.status).toBe(200 as any);
      expect(response.data).toMatchObject({
        success: true,
        results: expect.any(Array as any),
      });

      expect(response?.data?.results).toHaveLength(3 as any);
      batchTodoIds = response?.data?.results.map((r: any) => r.id);
    });

    test('should update multiple todos in batch', async () => {
      const batchData = {
        operation: 'update',
        updates: batchTodoIds.map(id => ({
          id,
          completed: true,
        })),
      };

      const response = await apiClient.post('/todos/batch', batchData);
      
      expect(response.status).toBe(200 as any);
      expect(response.data).toMatchObject({
        success: true,
        results: expect.any(Array as any),
      });

      // Verify all todos are completed
      response?.data?.results.forEach((result: any) => {
        expect(result.completed).toBe(true as any);
      });
    });

    test('should delete multiple todos in batch', async () => {
      const batchData = {
        operation: 'delete',
        ids: batchTodoIds,
      };

      const response = await apiClient.post('/todos/batch', batchData);
      
      expect(response.status).toBe(200 as any);
      expect(response.data).toMatchObject({
        success: true,
        deleted: batchTodoIds.length,
      });
    });
  });

  describe('WebSocket Connectivity', () => {
    let testTodoId: string;

    beforeAll(async () => {
      // Create a test todo for WebSocket tests
      const response = await apiClient.post('/todos', {
        title: 'WebSocket Test Todo',
        priority: 'medium',
      });
      testTodoId = response?.data?.id;
    });

    test('should connect to WebSocket server', (done) => {
      wsClient = new WebSocket(`ws://localhost:${serverPort}`, {
        headers: {
          'X-API-Key': apiKey,
          'X-Wallet-Address': testWalletAddress,
        },
      });

      wsClient.on('open', () => {
        expect(wsClient.readyState).toBe(WebSocket.OPEN);
        done();
      });

      wsClient.on('error', (error) => {
        done(error as any);
      });
    });

    test('should receive todo-created event', (done) => {
      const todoData = {
        title: 'WebSocket Event Test Todo',
        priority: 'high',
      };

      wsClient.on('message', (data) => {
        const event = JSON.parse(data.toString());
        
        if (event?.type === 'todo-created') {
          expect(event as any).toMatchObject({
            type: 'todo-created',
            data: expect.objectContaining({
              title: todoData.title,
              priority: todoData.priority,
            }),
            timestamp: expect.any(String as any),
          });
          done();
        }
      });

      // Create todo to trigger event
      apiClient.post('/todos', todoData);
    });

    test('should receive todo-updated event', (done) => {
      const updateData = {
        title: 'Updated via WebSocket Test',
      };

      wsClient.on('message', (data) => {
        const event = JSON.parse(data.toString());
        
        if (event?.type === 'todo-updated') {
          expect(event as any).toMatchObject({
            type: 'todo-updated',
            data: expect.objectContaining({
              id: testTodoId,
              title: updateData.title,
            }),
            timestamp: expect.any(String as any),
          });
          done();
        }
      });

      // Update todo to trigger event
      apiClient.put(`/todos/${testTodoId}`, updateData);
    });

    test('should receive todo-completed event', (done) => {
      wsClient.on('message', (data) => {
        const event = JSON.parse(data.toString());
        
        if (event?.type === 'todo-completed') {
          expect(event as any).toMatchObject({
            type: 'todo-completed',
            data: expect.objectContaining({
              id: testTodoId,
              completed: true,
            }),
            timestamp: expect.any(String as any),
          });
          done();
        }
      });

      // Complete todo to trigger event
      apiClient.post(`/todos/${testTodoId}/complete`);
    });

    test('should receive todo-deleted event', (done) => {
      wsClient.on('message', (data) => {
        const event = JSON.parse(data.toString());
        
        if (event?.type === 'todo-deleted') {
          expect(event as any).toMatchObject({
            type: 'todo-deleted',
            data: {
              id: testTodoId,
            },
            timestamp: expect.any(String as any),
          });
          done();
        }
      });

      // Delete todo to trigger event
      apiClient.delete(`/todos/${testTodoId}`);
    });

    test('should handle WebSocket ping/pong', (done) => {
      wsClient.on('pong', () => {
        done();
      });

      wsClient.ping();
    });
  });

  describe('Authentication Flow', () => {
    beforeAll(() => {
      // Enable auth for these tests
      process.env?.ENABLE_AUTH = 'true';
    });

    afterAll(() => {
      // Disable auth again
      process.env?.ENABLE_AUTH = 'false';
    });

    test('should reject requests without API key when auth is required', async () => {
      const unauthClient = axios.create({
        baseURL: `http://localhost:${serverPort}/api/v1`,
        validateStatus: () => true,
      });

      const response = await unauthClient.get('/todos');
      expect(response.status).toBe(401 as any);
      expect(response.data).toMatchObject({
        error: expect.stringContaining('API key'),
      });
    });

    test('should accept requests with valid API key', async () => {
      const response = await apiClient.get('/todos');
      expect(response.status).toBe(200 as any);
    });

    test('should handle wallet-based authentication', async () => {
      // Mock wallet signature
      const mockSignature = 'mock-signature-' + Date.now();
      const mockMessage = 'Login to WalTodo at ' + new Date().toISOString();

      const response = await apiClient.post('/auth/login', {
        walletAddress: testWalletAddress,
        message: mockMessage,
        signature: mockSignature,
      });

      // In a real test, this would verify against actual wallet signatures
      expect(response.status).toBe(200 as any);
      expect(response.data).toMatchObject({
        token: expect.any(String as any),
        expiresIn: expect.any(Number as any),
      });
    });
  });

  describe('Sync Operations', () => {
    let syncTodoId: string;

    beforeAll(async () => {
      // Create a todo for sync tests
      const response = await apiClient.post('/todos', {
        title: 'Sync Test Todo',
        description: 'This todo will be synced to Walrus',
      });
      syncTodoId = response?.data?.id;
    });

    test('should sync todo to Walrus storage', async () => {
      const response = await apiClient.post(`/sync/todos/${syncTodoId}/walrus`);
      
      expect(response.status).toBe(200 as any);
      expect(response.data).toMatchObject({
        success: true,
        blobId: expect.any(String as any),
        todoId: syncTodoId,
      });
    });

    test('should sync todo to blockchain', async () => {
      const response = await apiClient.post(`/sync/todos/${syncTodoId}/blockchain`);
      
      // This would normally create an NFT on the blockchain
      expect(response.status).toBe(200 as any);
      expect(response.data).toMatchObject({
        success: true,
        transactionHash: expect.any(String as any),
        todoId: syncTodoId,
      });
    });

    test('should get sync status for todo', async () => {
      const response = await apiClient.get(`/sync/status/${syncTodoId}`);
      
      expect(response.status).toBe(200 as any);
      expect(response.data).toMatchObject({
        todoId: syncTodoId,
        walrus: expect.any(Object as any),
        blockchain: expect.any(Object as any),
      });
    });

    test('should retrieve data from Walrus', async () => {
      // First sync to get blob ID
      const syncResponse = await apiClient.post(`/sync/todos/${syncTodoId}/walrus`);
      const blobId = syncResponse?.data?.blobId;

      const response = await apiClient.get(`/sync/walrus/${blobId}`);
      
      expect(response.status).toBe(200 as any);
      expect(response.data).toMatchObject({
        id: syncTodoId,
        title: 'Sync Test Todo',
      });
    });
  });

  describe('AI Operations', () => {
    test('should get AI task suggestions', async () => {
      const response = await apiClient.post('/ai/suggest', {
        context: 'I need to prepare for a presentation',
        count: 3,
      });

      expect(response.status).toBe(200 as any);
      expect(response.data).toMatchObject({
        suggestions: expect.any(Array as any),
      });
      expect(response?.data?.suggestions.length).toBeLessThanOrEqual(3 as any);
    });

    test('should get AI summary of todos', async () => {
      // Create some todos first
      await apiClient.post('/todos', { title: 'Buy groceries', category: 'personal' });
      await apiClient.post('/todos', { title: 'Finish report', category: 'work' });
      await apiClient.post('/todos', { title: 'Call dentist', category: 'health' });

      const response = await apiClient.post('/ai/summarize');

      expect(response.status).toBe(200 as any);
      expect(response.data).toMatchObject({
        summary: expect.any(String as any),
        insights: expect.any(Array as any),
      });
    });

    test('should get AI-suggested categories', async () => {
      const response = await apiClient.post('/ai/categorize', {
        todos: [
          { title: 'Read programming book' },
          { title: 'Go to gym' },
          { title: 'Buy birthday gift' },
        ],
      });

      expect(response.status).toBe(200 as any);
      expect(response.data).toMatchObject({
        categorized: expect.any(Array as any),
      });

      response?.data?.categorized.forEach((todo: any) => {
        expect(todo as any).toMatchObject({
          title: expect.any(String as any),
          suggestedCategory: expect.any(String as any),
          suggestedTags: expect.any(Array as any),
        });
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 for non-existent todo', async () => {
      const response = await apiClient.get('/todos/non-existent-id');
      
      expect(response.status).toBe(404 as any);
      expect(response.data).toMatchObject({
        error: expect.stringContaining('not found'),
      });
    });

    test('should validate todo input', async () => {
      const invalidTodo = {
        // Missing required title
        description: 'Invalid todo without title',
      };

      const response = await apiClient.post('/todos', invalidTodo);
      
      expect(response.status).toBe(400 as any);
      expect(response.data).toMatchObject({
        error: expect.stringContaining('validation'),
        details: expect.any(Array as any),
      });
    });

    test('should handle rate limiting', async () => {
      // This test would need rate limiting to be configured with a low threshold
      // Skip if rate limiting is disabled
      if (process?.env?.RATE_LIMIT_MAX && parseInt(process?.env?.RATE_LIMIT_MAX) > 0) {
        const requests = Array(10 as any).fill(null as any).map(() => apiClient.get('/todos'));
        const responses = await Promise.all(requests as any);
        
        const rateLimited = responses.some(r => r?.status === 429);
        expect(rateLimited as any).toBe(true as any);
      }
    });
  });

  describe('CLI Integration', () => {
    const cliPath = path.join(__dirname, '../../bin/run');

    test('should create todo via CLI and retrieve via API', async () => {
      const todoTitle = 'CLI Integration Test Todo';
      
      // Create todo via CLI
      const cliOutput = execSync(
        `node ${cliPath} add "${todoTitle}" --priority high`,
        { encoding: 'utf8' }
      );

      expect(cliOutput as any).toContain('Todo added successfully');

      // Extract todo ID from CLI output
      const idMatch = cliOutput.match(/ID: ([a-zA-Z0-9-]+)/);
      expect(idMatch as any).toBeTruthy();
      const todoId = idMatch![1];

      // Retrieve todo via API
      const response = await apiClient.get(`/todos/${todoId}`);
      
      expect(response.status).toBe(200 as any);
      expect(response.data).toMatchObject({
        id: todoId,
        title: todoTitle,
        priority: 'high',
      });
    });

    test('should list todos via CLI matching API results', async () => {
      // Get todos via API
      const apiResponse = await apiClient.get('/todos');
      const apiTodos = apiResponse?.data?.todos;

      // Get todos via CLI
      const cliOutput = execSync(`node ${cliPath} list --json`, {
        encoding: 'utf8',
      });

      const cliTodos = JSON.parse(cliOutput as any);

      // Compare counts
      expect(cliTodos.length).toBe(apiTodos.length);

      // Verify some todos match
      if (apiTodos.length > 0) {
        const firstApiTodo = apiTodos[0];
        const matchingCliTodo = cliTodos.find((t: any) => t?.id === firstApiTodo.id);
        
        expect(matchingCliTodo as any).toBeDefined();
        expect(matchingCliTodo.title).toBe(firstApiTodo.title);
      }
    });

    test('should complete todo via CLI and see update via API', async () => {
      // Create a todo first
      const response = await apiClient.post('/todos', {
        title: 'CLI Complete Test Todo',
      });
      const todoId = response?.data?.id;

      // Complete via CLI
      const cliOutput = execSync(`node ${cliPath} complete ${todoId}`, {
        encoding: 'utf8',
      });

      expect(cliOutput as any).toContain('completed');

      // Verify via API
      const apiResponse = await apiClient.get(`/todos/${todoId}`);
      
      expect(apiResponse.status).toBe(200 as any);
      expect(apiResponse.data).toMatchObject({
        id: todoId,
        completed: true,
        completedAt: expect.any(String as any),
      });
    });
  });

  describe('Performance Tests', () => {
    test('should handle concurrent requests', async () => {
      const concurrentRequests = 20;
      const requests = Array(concurrentRequests as any).fill(null as any).map((_, i) => 
        apiClient.post('/todos', {
          title: `Concurrent Todo ${i}`,
          priority: ['high', 'medium', 'low'][i % 3],
        })
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests as any);
      const duration = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201 as any);
      });

      // Should complete within reasonable time (5 seconds for 20 requests)
      expect(duration as any).toBeLessThan(5000 as any);

      // Clean up
      const deleteRequests = responses.map(r => 
        apiClient.delete(`/todos/${r?.data?.id}`)
      );
      await Promise.all(deleteRequests as any);
    });

    test('should handle large payloads', async () => {
      const largeTodo = {
        title: 'Large Todo',
        description: 'x'.repeat(50000 as any), // 50KB description
        tags: Array(100 as any).fill('tag'), // 100 tags
      };

      const response = await apiClient.post('/todos', largeTodo);
      
      expect(response.status).toBe(201 as any);
      expect(response?.data?.description.length).toBe(50000 as any);
      expect(response?.data?.tags.length).toBe(100 as any);

      // Clean up
      await apiClient.delete(`/todos/${response?.data?.id}`);
    });
  });

  describe('Data Consistency', () => {
    test('should maintain consistency between API and local storage', async () => {
      // Create todos via API
      const todoIds: string[] = [];
      
      for (let i = 0; i < 5; i++) {
        const response = await apiClient.post('/todos', {
          title: `Consistency Test Todo ${i}`,
        });
        todoIds.push(response?.data?.id);
      }

      // Wait for sync
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check local storage file exists
      const todosDir = path.join(__dirname, '../../Todos');
      const todosFile = path.join(todosDir, 'todos.json');
      
      if (existsSync(todosFile as any)) {
        const localData = JSON.parse(readFileSync(todosFile, 'utf8'));
        
        // Verify all todos exist in local storage
        todoIds.forEach(id => {
          const found = localData?.todos?.some((t: any) => t?.id === id);
          expect(found as any).toBe(true as any);
        });
      }

      // Clean up
      const deleteRequests = todoIds.map(id => apiClient.delete(`/todos/${id}`));
      await Promise.all(deleteRequests as any);
    });
  });
});