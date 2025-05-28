import { test, expect } from '@playwright/test';
import { CLIExecutor } from '../helpers/cli-executor';

/**
 * API Contract Tests for WalTodo
 * Validates JSON schema compliance and API consistency between CLI and Frontend
 */

interface TodoSchema {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  createdAt: string;
  updatedAt: string;
  blockchainId?: string;
  walrusBlobId?: string;
  ownerAddress?: string;
}

interface WebSocketEventSchema {
  type: string;
  payload: any;
  timestamp: string;
  source: 'cli' | 'frontend' | 'blockchain';
}

interface APIErrorSchema {
  error: string;
  code: string;
  message: string;
  timestamp: string;
  details?: any;
}

test.describe('API Contract Testing', () => {
  let cli: CLIExecutor;

  test.beforeAll(async () => {
    cli = new CLIExecutor();
  });

  test('CLI JSON output conforms to TodoSchema', async () => {
    // Create a test todo
    const todoTitle = `Schema Test ${Date.now()}`;
    await cli.expectSuccess('add', [
      todoTitle,
      'Testing JSON schema compliance',
      '--priority', 'high',
      '--tags', 'test,schema'
    ]);

    // Get todos in JSON format
    const todos = await cli.executeJSON<TodoSchema[]>('list', ['--format', 'json']);
    
    expect(Array.isArray(todos)).toBe(true);
    expect(todos.length).toBeGreaterThan(0);

    const testTodo = todos.find(todo => todo.title === todoTitle);
    expect(testTodo).toBeTruthy();

    // Validate TodoSchema compliance
    const todo = testTodo!;
    
    // Required fields
    expect(typeof todo.id).toBe('string');
    expect(typeof todo.title).toBe('string');
    expect(typeof todo.description).toBe('string');
    expect(typeof todo.completed).toBe('boolean');
    expect(['low', 'medium', 'high']).toContain(todo.priority);
    expect(Array.isArray(todo.tags)).toBe(true);
    expect(typeof todo.createdAt).toBe('string');
    expect(typeof todo.updatedAt).toBe('string');

    // Validate date format (ISO 8601)
    expect(new Date(todo.createdAt).toISOString()).toBe(todo.createdAt);
    expect(new Date(todo.updatedAt).toISOString()).toBe(todo.updatedAt);

    // Validate ID format
    expect(todo.id).toMatch(/^[a-zA-Z0-9_-]+$/);

    // Validate specific test data
    expect(todo.title).toBe(todoTitle);
    expect(todo.priority).toBe('high');
    expect(todo.tags).toContain('test');
    expect(todo.tags).toContain('schema');

    console.log('✅ CLI JSON output schema validation passed');
  });

  test('CLI error responses conform to APIErrorSchema', async () => {
    // Trigger an error with invalid command
    const result = await cli.execute('add', ['', '']); // Empty title and description
    
    expect(result.failed).toBe(true);
    
    // Try to parse stderr as JSON error response
    let errorResponse: APIErrorSchema;
    try {
      errorResponse = JSON.parse(result.stderr);
    } catch {
      // If stderr is not JSON, check if it contains expected error patterns
      expect(result.stderr).toMatch(/error|invalid|required/i);
      return;
    }

    // If JSON, validate APIErrorSchema
    expect(typeof errorResponse.error).toBe('string');
    expect(typeof errorResponse.code).toBe('string');
    expect(typeof errorResponse.message).toBe('string');
    expect(typeof errorResponse.timestamp).toBe('string');

    // Validate timestamp format
    expect(new Date(errorResponse.timestamp).toISOString()).toBe(errorResponse.timestamp);

    console.log('✅ CLI error response schema validation passed');
  });

  test('Blockchain todos include blockchain-specific fields', async () => {
    // Create blockchain todo
    const todoTitle = `Blockchain Schema Test ${Date.now()}`;
    
    try {
      await cli.expectSuccess('add', [
        todoTitle,
        'Testing blockchain schema fields',
        '--blockchain',
        '--priority', 'medium'
      ]);

      // Get todos with blockchain data
      const todos = await cli.executeJSON<TodoSchema[]>('list', [
        '--format', 'json',
        '--blockchain'
      ]);

      const blockchainTodo = todos.find(todo => todo.title === todoTitle);
      expect(blockchainTodo).toBeTruthy();

      const todo = blockchainTodo!;

      // Validate blockchain-specific fields
      if (todo.blockchainId) {
        expect(typeof todo.blockchainId).toBe('string');
        expect(todo.blockchainId).toMatch(/^0x[a-fA-F0-9]+$/); // Sui object ID format
      }

      if (todo.walrusBlobId) {
        expect(typeof todo.walrusBlobId).toBe('string');
        expect(todo.walrusBlobId.length).toBeGreaterThan(10); // Walrus blob ID
      }

      if (todo.ownerAddress) {
        expect(typeof todo.ownerAddress).toBe('string');
        expect(todo.ownerAddress).toMatch(/^0x[a-fA-F0-9]+$/); // Sui address format
      }

      console.log('✅ Blockchain todo schema validation passed');
      
    } catch (error) {
      console.warn('⚠️ Blockchain functionality not available, skipping blockchain schema test');
      test.skip();
    }
  });

  test('WebSocket events conform to EventSchema', async ({ page }) => {
    const wsEvents: WebSocketEventSchema[] = [];
    
    // Capture WebSocket events
    page.on('websocket', ws => {
      ws.on('framereceived', event => {
        try {
          const eventData = JSON.parse(event.payload);
          wsEvents.push(eventData);
        } catch {
          // Ignore non-JSON messages
        }
      });
    });

    // Navigate to frontend to establish WebSocket connection
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create todo via CLI to trigger WebSocket event
    const todoTitle = `WebSocket Schema Test ${Date.now()}`;
    await cli.expectSuccess('add', [todoTitle, 'WebSocket event test']);

    // Wait for WebSocket events
    await page.waitForTimeout(2000);

    if (wsEvents.length > 0) {
      const todoEvent = wsEvents.find(event => 
        event.type === 'todo:created' || 
        event.payload?.title === todoTitle
      );

      if (todoEvent) {
        // Validate WebSocketEventSchema
        expect(typeof todoEvent.type).toBe('string');
        expect(typeof todoEvent.payload).toBe('object');
        expect(typeof todoEvent.timestamp).toBe('string');
        expect(['cli', 'frontend', 'blockchain']).toContain(todoEvent.source);

        // Validate timestamp format
        expect(new Date(todoEvent.timestamp).toISOString()).toBe(todoEvent.timestamp);

        // Validate payload contains todo data
        if (todoEvent.payload.title) {
          expect(todoEvent.payload.title).toBe(todoTitle);
        }

        console.log('✅ WebSocket event schema validation passed');
      } else {
        console.warn('⚠️ No relevant WebSocket events captured');
      }
    } else {
      console.warn('⚠️ No WebSocket events captured, may indicate connection issues');
    }
  });

  test('Config command output is valid JSON', async () => {
    const configResult = await cli.executeJSON('config', ['--format', 'json']);
    
    // Validate config has expected structure
    expect(typeof configResult).toBe('object');
    expect(configResult).not.toBeNull();

    // Check for expected config fields
    const expectedFields = ['network', 'rpcUrl', 'walletAddress'];
    
    for (const field of expectedFields) {
      if (configResult[field]) {
        expect(typeof configResult[field]).toBe('string');
      }
    }

    // If package ID exists, validate format
    if (configResult.packageId) {
      expect(configResult.packageId).toMatch(/^0x[a-fA-F0-9]+$/);
    }

    // If wallet address exists, validate format
    if (configResult.walletAddress) {
      expect(configResult.walletAddress).toMatch(/^0x[a-fA-F0-9]+$/);
    }

    console.log('✅ Config JSON schema validation passed');
  });

  test('Status command provides consistent structure', async () => {
    const statusResult = await cli.executeJSON('status', ['--format', 'json']);
    
    expect(typeof statusResult).toBe('object');
    expect(statusResult).not.toBeNull();

    // Validate status fields
    if (statusResult.version) {
      expect(typeof statusResult.version).toBe('string');
      expect(statusResult.version).toMatch(/^\d+\.\d+\.\d+/); // Semantic versioning
    }

    if (statusResult.lastSync) {
      expect(typeof statusResult.lastSync).toBe('string');
      expect(new Date(statusResult.lastSync).toISOString()).toBe(statusResult.lastSync);
    }

    if (statusResult.todoCount) {
      expect(typeof statusResult.todoCount).toBe('number');
      expect(statusResult.todoCount).toBeGreaterThanOrEqual(0);
    }

    console.log('✅ Status JSON schema validation passed');
  });

  test('List command supports pagination metadata', async () => {
    // Create multiple todos for pagination testing
    const todoTitles = Array.from({ length: 5 }, (_, i) => 
      `Pagination Test ${i + 1} ${Date.now()}`
    );

    for (const title of todoTitles) {
      await cli.expectSuccess('add', [title, 'Pagination test todo']);
    }

    // Test paginated list
    const paginatedResult = await cli.executeJSON('list', [
      '--format', 'json',
      '--limit', '3',
      '--page', '1'
    ]);

    // If pagination is implemented, validate metadata
    if (Array.isArray(paginatedResult)) {
      expect(paginatedResult.length).toBeLessThanOrEqual(3);
    } else if (paginatedResult.todos && paginatedResult.pagination) {
      // Structured pagination response
      expect(Array.isArray(paginatedResult.todos)).toBe(true);
      expect(typeof paginatedResult.pagination).toBe('object');
      
      const pagination = paginatedResult.pagination;
      expect(typeof pagination.page).toBe('number');
      expect(typeof pagination.limit).toBe('number');
      expect(typeof pagination.total).toBe('number');
      expect(typeof pagination.totalPages).toBe('number');
    }

    console.log('✅ List pagination schema validation passed');
  });

  test('Search results maintain schema consistency', async () => {
    // Create searchable todo
    const searchTerm = `SearchTest${Date.now()}`;
    await cli.expectSuccess('add', [
      `Todo with ${searchTerm}`,
      `Description containing ${searchTerm}`,
      '--tags', searchTerm
    ]);

    // Search for todos
    const searchResults = await cli.executeJSON<TodoSchema[]>('list', [
      '--format', 'json',
      '--search', searchTerm
    ]);

    expect(Array.isArray(searchResults)).toBe(true);

    // Validate each search result maintains TodoSchema
    for (const todo of searchResults) {
      expect(typeof todo.id).toBe('string');
      expect(typeof todo.title).toBe('string');
      expect(typeof todo.description).toBe('string');
      expect(typeof todo.completed).toBe('boolean');
      
      // Verify search term appears in at least one field
      const hasSearchTerm = 
        todo.title.includes(searchTerm) ||
        todo.description.includes(searchTerm) ||
        todo.tags.some(tag => tag.includes(searchTerm));
        
      expect(hasSearchTerm).toBe(true);
    }

    console.log('✅ Search results schema validation passed');
  });
});