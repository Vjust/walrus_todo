/**
 * E2E tests for batch command operations
 * Tests the batch functionality of commands like store-list and store-batch
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';

describe('Batch Operations E2E Tests', () => {
  const tempDir = path.join(__dirname, `../../.tmp-e2e-${uuidv4()}`);
  const walrusCLI = path.join(__dirname, '../../bin/dev');

  beforeAll(async () => {
    // Create temporary directory for test files
    await fs.ensureDir(tempDir);

    // Set up environment variables for CLI
    process.env.WALRUS_USE_MOCK = 'true';
    process.env.WALRUS_CLI_DEV_TODOS_PATH = path.join(tempDir, 'todos.json');
  });

  afterAll(async () => {
    // Clean up temporary directory
    await fs.remove(tempDir);
  });

  describe('Store List Command', () => {
    it('should successfully store all local todos to Walrus', () => {
      // Add some test todos first
      execSync(`${walrusCLI} add "Test todo 1" --priority high`);
      execSync(`${walrusCLI} add "Test todo 2" --priority medium`);
      execSync(`${walrusCLI} add "Test todo 3" --priority low`);

      // Run store-list command
      const output = execSync(`${walrusCLI} store-list --mock`).toString();

      // Verify the output
      expect(output).toContain('Storing todos to Walrus...');
      expect(output).toContain('✅ Successfully stored 3 todos');
      expect(output).toMatch(/Blob ID: [a-fA-F0-9]{64}/);
    });

    it('should handle empty todo list gracefully', () => {
      // Clear todos
      const todosPath =
        process.env.WALRUS_CLI_DEV_TODOS_PATH ||
        path.join(os.homedir(), '.walrus-cli/todos.json');
      await fs.writeJson(todosPath, { todos: [] });

      // Run store-list command
      const output = execSync(`${walrusCLI} store-list --mock`).toString();

      // Verify appropriate message for empty list
      expect(output).toContain('No todos to store');
    });

    it('should handle errors during storage', () => {
      // Add a todo
      execSync(`${walrusCLI} add "Test todo for error"`);

      // Force an error by using invalid environment
      process.env.WALRUS_SIMULATE_ERROR = 'true';

      await expect(async () => {
        execSync(`${walrusCLI} store-list --mock`);
      }).rejects.toThrow();
      
      try {
        execSync(`${walrusCLI} store-list --mock`);
        throw new Error('Expected command to throw error');
      } catch (error: any) {
        expect(error.message).toContain('Failed to store todos');
      }

      // Clean up error simulation
      delete process.env.WALRUS_SIMULATE_ERROR;
    });
  });

  describe('Store Batch Command', () => {
    beforeEach(async () => {
      // Clear todos for each test
      await fs.writeJson(process.env.WALRUS_CLI_DEV_TODOS_PATH!, { todos: [] });
    });

    it('should batch store todos efficiently', async () => {
      // Add multiple todos
      const todoCount = 10;
      for (let i = 1; i <= todoCount; i++) {
        execSync(`${walrusCLI} add "Batch todo ${i}"`);
      }

      // Run batch store command
      const output = execSync(`${walrusCLI} store-batch --mock`).toString();

      // Verify batch processing
      expect(output).toContain(`Processing ${todoCount} todos in batch`);
      expect(output).toContain('Batch storage completed successfully');
      expect(output).toMatch(/Total time: \d+\.\d+s/);
    });

    it('should optimize storage for similar todos', async () => {
      // Add similar todos that could be optimized
      execSync(`${walrusCLI} add "Complete project task 1"`);
      execSync(`${walrusCLI} add "Complete project task 2"`);
      execSync(`${walrusCLI} add "Complete project task 3"`);
      execSync(`${walrusCLI} add "Review documentation"`);
      execSync(`${walrusCLI} add "Review documentation update"`);

      // Run batch store with optimization
      const output = execSync(
        `${walrusCLI} store-batch --optimize --mock`
      ).toString();

      // Verify optimization occurred
      expect(output).toContain('Storage optimization enabled');
      expect(output).toMatch(/Saved \d+ tokens through optimization/);
    });

    it('should display batch processing metrics', async () => {
      // Add various todos
      const priorities = ['high', 'medium', 'low'];
      for (let i = 0; i < 9; i++) {
        const priority = priorities[i % 3];
        execSync(`${walrusCLI} add "Todo ${i}" --priority ${priority}`);
      }

      // Run batch store with verbose output
      const output = execSync(
        `${walrusCLI} store-batch --verbose --mock`
      ).toString();

      // Verify detailed metrics
      expect(output).toContain('Batch processing metrics:');
      expect(output).toContain('Total todos: 9');
      expect(output).toContain('High priority: 3');
      expect(output).toContain('Medium priority: 3');
      expect(output).toContain('Low priority: 3');
      expect(output).toMatch(/Average processing time: \d+\.\d+ms/);
    });
  });

  describe('Batch Operations with Filters', () => {
    beforeEach(async () => {
      // Set up variety of todos for filtering
      await fs.writeJson(process.env.WALRUS_CLI_DEV_TODOS_PATH!, { todos: [] });

      execSync(`${walrusCLI} add "High priority task 1" --priority high`);
      execSync(`${walrusCLI} add "High priority task 2" --priority high`);
      execSync(`${walrusCLI} add "Medium priority task" --priority medium`);
      execSync(`${walrusCLI} add "Low priority task" --priority low`);
      execSync(`${walrusCLI} add "Personal task" --category personal`);
      execSync(`${walrusCLI} add "Work task" --category work`);
    });

    it('should support filtering by priority in batch operations', () => {
      // Store only high priority todos
      const output = execSync(
        `${walrusCLI} store-list --priority high --mock`
      ).toString();

      expect(output).toContain('Filtering todos by priority: high');
      expect(output).toContain('Successfully stored 2 todos');
    });

    it('should support filtering by category in batch operations', () => {
      // Store only work category todos
      const output = execSync(
        `${walrusCLI} store-list --category work --mock`
      ).toString();

      expect(output).toContain('Filtering todos by category: work');
      expect(output).toContain('Successfully stored 1 todo');
    });

    it('should support combined filters in batch operations', () => {
      // Add todo that matches both filters
      execSync(
        `${walrusCLI} add "Urgent work task" --priority high --category work`
      );

      // Store with combined filters
      const output = execSync(
        `${walrusCLI} store-list --priority high --category work --mock`
      ).toString();

      expect(output).toContain('Filtering todos by priority: high');
      expect(output).toContain('Filtering todos by category: work');
      expect(output).toContain('Successfully stored 1 todo');
    });
  });

  describe('Batch Error Handling and Recovery', () => {
    it('should handle partial batch failures gracefully', async () => {
      // Add multiple todos
      for (let i = 1; i <= 5; i++) {
        execSync(`${walrusCLI} add "Recovery test todo ${i}"`);
      }

      // Simulate partial failure
      process.env.WALRUS_FAIL_ON_THIRD = 'true';

      let errorCaught = false;
      let output = '';
      try {
        execSync(`${walrusCLI} store-batch --mock`);
      } catch (error: any) {
        errorCaught = true;
        output = error.stdout.toString();
      }
      
      expect(errorCaught).toBe(true);
      expect(output).toContain('Partial batch failure');
      expect(output).toContain('Successfully stored: 2 todos');
      expect(output).toContain('Failed: 1 todo');
      expect(output).toContain('Remaining: 2 todos');

      // Clean up
      delete process.env.WALRUS_FAIL_ON_THIRD;
    });

    it('should support retry mechanism for failed items', async () => {
      // Add todos
      for (let i = 1; i <= 3; i++) {
        execSync(`${walrusCLI} add "Retry test todo ${i}"`);
      }

      // Simulate failure then success on retry
      process.env.WALRUS_FAIL_FIRST_ATTEMPT = 'true';

      const output = execSync(
        `${walrusCLI} store-batch --retry --mock`
      ).toString();

      expect(output).toContain('Retrying failed items...');
      expect(output).toContain('All todos stored successfully after retry');

      // Clean up
      delete process.env.WALRUS_FAIL_FIRST_ATTEMPT;
    });
  });

  describe('Performance and Progress Tracking', () => {
    it('should show progress bar for large batch operations', async () => {
      // Add many todos
      const largeBatchSize = 50;
      for (let i = 1; i <= largeBatchSize; i++) {
        execSync(`${walrusCLI} add "Large batch todo ${i}"`);
      }

      // Run with progress indicator
      const output = execSync(
        `${walrusCLI} store-batch --progress --mock`
      ).toString();

      expect(output).toContain('Processing batch...');
      expect(output).toMatch(/\[.*\] \d+\/\d+ todos processed/);
      expect(output).toContain(`Successfully stored ${largeBatchSize} todos`);
    });

    it('should provide ETA for long-running operations', async () => {
      // Add todos that simulate longer processing
      for (let i = 1; i <= 20; i++) {
        execSync(`${walrusCLI} add "Long processing todo ${i}"`);
      }

      // Simulate slow processing
      process.env.WALRUS_SLOW_MODE = 'true';

      const output = execSync(
        `${walrusCLI} store-batch --eta --mock`
      ).toString();

      expect(output).toMatch(/ETA: \d+:\d+/);
      expect(output).toContain('Batch processing completed');

      // Clean up
      delete process.env.WALRUS_SLOW_MODE;
    });
  });

  describe('Batch Operations Integration', () => {
    it('should integrate with other commands seamlessly', async () => {
      // Create todos with AI-generated content
      execSync(`${walrusCLI} ai suggest --count 5 --mock-ai`);

      // Store the suggested todos in batch
      const storeOutput = execSync(`${walrusCLI} store-list --mock`).toString();
      expect(storeOutput).toContain('Successfully stored 5 todos');

      // Verify todos can be retrieved
      const listOutput = execSync(`${walrusCLI} list`).toString();
      expect(listOutput).toContain('AI-suggested todo');
    });

    it('should maintain data integrity across batch operations', async () => {
      // Add todos with specific data
      const testData = [
        { title: 'Test 1', priority: 'high', tags: ['urgent', 'work'] },
        { title: 'Test 2', priority: 'medium', tags: ['personal'] },
        { title: 'Test 3', priority: 'low', tags: ['optional'] },
      ];

      for (const item of testData) {
        execSync(
          `${walrusCLI} add "${item.title}" --priority ${item.priority} --tags ${item.tags.join(',')}`
        );
      }

      // Store in batch
      execSync(`${walrusCLI} store-list --mock`);

      // Clear local and retrieve from storage
      await fs.writeJson(process.env.WALRUS_CLI_DEV_TODOS_PATH!, { todos: [] });
      execSync(`${walrusCLI} retrieve --mock`);

      // Verify data integrity
      const listOutput = execSync(`${walrusCLI} list --json`).toString();
      const retrievedTodos = JSON.parse(listOutput);

      expect(retrievedTodos).toHaveLength(3);
      expect(retrievedTodos[0]).toMatchObject({
        title: 'Test 1',
        priority: 'high',
        tags: expect.arrayContaining(['urgent', 'work']),
      });
    });
  });
});
