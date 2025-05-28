import { test, expect, Page, BrowserContext } from '@playwright/test';
import { CLIExecutor } from './helpers/cli-executor';
import { FrontendHelpers } from './helpers/frontend-helpers';
import * as path from 'path';

/**
 * CLI-Frontend Integration E2E Tests
 * Tests real-time synchronization between CLI backend and React frontend
 */

interface TestTodo {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: string;
}

interface WebSocketMessage {
  type: string;
  payload?: any;
  timestamp?: string;
}

test.describe('CLI-Frontend Real-time Integration', () => {
  let cli: CLIExecutor;
  let frontend: FrontendHelpers;
  let context: BrowserContext;
  let page: Page;
  let wsMessages: WebSocketMessage[] = [];

  test.beforeAll(async ({ browser }) => {
    // Initialize CLI executor
    cli = new CLIExecutor({
      cliPath: path.join(process.cwd(), 'bin', 'waltodo')
    });

    // Create persistent browser context for WebSocket connections
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      acceptDownloads: true,
    });

    page = await context.newPage();
    frontend = new FrontendHelpers(page);

    // Set up WebSocket message capture
    page.on('websocket', ws => {
      ws.on('framereceived', event => {
        try {
          const message = JSON.parse(event.payload);
          wsMessages.push({
            ...message,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          // Ignore non-JSON messages
        }
      });
    });

    // Navigate to frontend and wait for initialization
    await page.goto('/');
    await frontend.waitForAppReady();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.beforeEach(async () => {
    // Clear WebSocket message buffer
    wsMessages = [];
    
    // Ensure clean state
    await frontend.clearAllTodos();
  });

  test('CLI todo creation reflects in frontend within 2 seconds', async () => {
    const todoTitle = `CLI Test Todo ${Date.now()}`;
    const todoDescription = 'Created via CLI for real-time sync test';

    // Step 1: Execute CLI command to create todo
    const startTime = Date.now();
    const cliResult = await cli.expectSuccess('add', [
      todoTitle,
      todoDescription,
      '--priority', 'high',
      '--tags', 'cli,test'
    ]);

    expect(cliResult.stdout).toContain('Todo created successfully');

    // Step 2: Wait for todo to appear in frontend (max 2 seconds)
    const todoElement = await frontend.waitForTodoByTitle(todoTitle, 2000);
    const endTime = Date.now();
    const syncTime = endTime - startTime;

    // Verify sync time is under 2 seconds
    expect(syncTime).toBeLessThan(2000);

    // Step 3: Verify todo content in frontend
    const todoData = await frontend.getTodoData(todoElement);
    expect(todoData.title).toBe(todoTitle);
    expect(todoData.description).toBe(todoDescription);
    expect(todoData.completed).toBe(false);

    // Step 4: Verify WebSocket event was received
    const todoCreatedEvent = wsMessages.find(msg => 
      msg.type === 'todo:created' && 
      msg.payload?.title === todoTitle
    );
    expect(todoCreatedEvent).toBeTruthy();

    console.log(`✅ CLI→Frontend sync completed in ${syncTime}ms`);
  });

  test('Frontend todo completion syncs to CLI within 2 seconds', async () => {
    const todoTitle = `Frontend Test Todo ${Date.now()}`;
    
    // Step 1: Create todo via CLI
    await cli.expectSuccess('add', [todoTitle, 'Test description']);
    
    // Step 2: Wait for todo in frontend
    const todoElement = await frontend.waitForTodoByTitle(todoTitle, 2000);
    
    // Step 3: Complete todo via frontend
    const startTime = Date.now();
    await frontend.completeTodo(todoElement);
    
    // Step 4: Verify CLI reflects completion within 2 seconds
    let attempts = 0;
    let cliTodos: TestTodo[] = [];
    
    while (attempts < 10) { // 10 attempts = 2 seconds
      const cliResult = await cli.executeJSON<TestTodo[]>('list', ['--format', 'json']);
      cliTodos = cliResult;
      
      const completedTodo = cliTodos.find(todo => 
        todo.title === todoTitle && todo.completed === true
      );
      
      if (completedTodo) {
        const endTime = Date.now();
        const syncTime = endTime - startTime;
        expect(syncTime).toBeLessThan(2000);
        console.log(`✅ Frontend→CLI sync completed in ${syncTime}ms`);
        return;
      }
      
      await page.waitForTimeout(200);
      attempts++;
    }
    
    throw new Error('Todo completion did not sync from frontend to CLI within 2 seconds');
  });

  test('WebSocket connection maintains real-time sync', async () => {
    // Step 1: Verify WebSocket is connected
    await frontend.verifyWebSocketConnection();
    
    // Step 2: Create multiple todos rapidly via CLI
    const todoTitles = [
      `Rapid Todo 1 ${Date.now()}`,
      `Rapid Todo 2 ${Date.now()}`,
      `Rapid Todo 3 ${Date.now()}`
    ];
    
    const startTime = Date.now();
    
    // Create todos in parallel
    const cliPromises = todoTitles.map(title => 
      cli.expectSuccess('add', [title, 'Rapid sync test'])
    );
    
    await Promise.all(cliPromises);
    
    // Step 3: Verify all todos appear in frontend
    for (const title of todoTitles) {
      await frontend.waitForTodoByTitle(title, 3000);
    }
    
    const endTime = Date.now();
    const totalSyncTime = endTime - startTime;
    
    // Should sync all 3 todos within 5 seconds
    expect(totalSyncTime).toBeLessThan(5000);
    
    // Step 4: Verify WebSocket events for all todos
    for (const title of todoTitles) {
      const event = wsMessages.find(msg => 
        msg.type === 'todo:created' && 
        msg.payload?.title === title
      );
      expect(event).toBeTruthy();
    }
    
    console.log(`✅ Rapid sync of ${todoTitles.length} todos completed in ${totalSyncTime}ms`);
  });

  test('Wallet isolation works across CLI and frontend', async () => {
    // Step 1: Connect wallet in frontend
    await frontend.connectWallet();
    const walletAddress = await frontend.getConnectedWalletAddress();
    
    // Step 2: Verify CLI uses same wallet
    const cliConfig = await cli.executeJSON('config');
    expect(cliConfig.walletAddress).toBe(walletAddress);
    
    // Step 3: Create blockchain todo via CLI
    const todoTitle = `Blockchain Todo ${Date.now()}`;
    await cli.expectSuccess('add', [
      todoTitle,
      'Blockchain test',
      '--blockchain'
    ]);
    
    // Step 4: Verify blockchain todo appears in frontend with wallet data
    const todoElement = await frontend.waitForTodoByTitle(todoTitle, 5000);
    const todoData = await frontend.getTodoData(todoElement);
    
    expect(todoData.isBlockchain).toBe(true);
    expect(todoData.ownerAddress).toBe(walletAddress);
    
    // Step 5: Verify transaction history sync
    const txHistory = await frontend.getTransactionHistory();
    const createTx = txHistory.find(tx => 
      tx.type === 'todo:create' && 
      tx.todoTitle === todoTitle
    );
    expect(createTx).toBeTruthy();
  });

  test('Error handling propagates correctly between systems', async () => {
    // Step 1: Attempt invalid CLI operation
    const invalidResult = await cli.execute('add', ['', '']); // Empty title and description
    expect(invalidResult.failed).toBe(true);
    
    // Step 2: Verify error appears in frontend notification system
    await frontend.waitForErrorNotification(/invalid.*title/i);
    
    // Step 3: Test network error simulation
    await frontend.simulateNetworkError();
    
    // Step 4: Attempt CLI operation during network error
    const networkErrorResult = await cli.execute('add', [
      'Network Test Todo',
      'Should fail due to network'
    ]);
    
    // Should handle gracefully with appropriate error
    expect(networkErrorResult.failed).toBe(true);
    expect(networkErrorResult.stderr).toMatch(/network|connection/i);
    
    // Step 5: Restore network and verify recovery
    await frontend.restoreNetwork();
    await cli.expectSuccess('add', ['Recovery Test Todo', 'After network recovery']);
  });

  test('Performance: Bulk operations maintain responsiveness', async () => {
    const bulkSize = 10;
    const todoTitles = Array.from({ length: bulkSize }, (_, i) => 
      `Bulk Todo ${i + 1} ${Date.now()}`
    );
    
    // Step 1: Monitor frontend performance
    await frontend.startPerformanceMonitoring();
    
    // Step 2: Create bulk todos via CLI
    const startTime = Date.now();
    
    for (const title of todoTitles) {
      await cli.expectSuccess('add', [title, 'Bulk test todo']);
    }
    
    // Step 3: Wait for all todos to appear in frontend
    for (const title of todoTitles) {
      await frontend.waitForTodoByTitle(title, 1000);
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    // Step 4: Verify performance metrics
    const perfMetrics = await frontend.getPerformanceMetrics();
    
    // Should complete bulk operation within reasonable time
    expect(totalTime).toBeLessThan(15000); // 15 seconds for 10 todos
    
    // Frontend should remain responsive
    expect(perfMetrics.avgRenderTime).toBeLessThan(100); // <100ms average render
    expect(perfMetrics.memoryUsage).toBeLessThan(50 * 1024 * 1024); // <50MB
    
    console.log(`✅ Bulk sync of ${bulkSize} todos completed in ${totalTime}ms`);
    console.log(`📊 Average render time: ${perfMetrics.avgRenderTime}ms`);
  });

  test('Data consistency across system restart', async () => {
    const todoTitle = `Persistence Test ${Date.now()}`;
    
    // Step 1: Create todo via CLI
    await cli.expectSuccess('add', [todoTitle, 'Persistence test']);
    
    // Step 2: Verify in frontend
    await frontend.waitForTodoByTitle(todoTitle, 2000);
    
    // Step 3: Simulate page refresh (restart frontend)
    await page.reload();
    await frontend.waitForAppReady();
    
    // Step 4: Verify todo still exists after refresh
    await frontend.waitForTodoByTitle(todoTitle, 3000);
    
    // Step 5: Verify CLI still shows todo
    const cliTodos = await cli.executeJSON<TestTodo[]>('list', ['--format', 'json']);
    const persistedTodo = cliTodos.find(todo => todo.title === todoTitle);
    
    expect(persistedTodo).toBeTruthy();
    expect(persistedTodo!.title).toBe(todoTitle);
    
    console.log('✅ Data persistence verified across system restart');
  });
});