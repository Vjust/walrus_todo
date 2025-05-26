import * as fs from 'fs';
import * as path from 'path';
import {
  describe,
  expect,
  test,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import { execSync } from 'child_process';

describe('Add Command E2E Tests', () => {
  const CLI_PATH = path.join(__dirname, '../../../bin/dev');
  const TEST_CONFIG_DIR = path.join(__dirname, '../temp-test-config');
  const TEST_CONFIG_PATH = path.join(TEST_CONFIG_DIR, 'config.json');

  // Helper function to execute CLI commands
  const runCLI = (
    args: string
  ): { stdout: string; stderr: string; error?: Error } => {
    try {
      const stdout = execSync(`node ${CLI_PATH} ${args}`, {
        env: {
          ...process.env,
          TODO_CONFIG_PATH: TEST_CONFIG_PATH,
          WALRUS_USE_MOCK: 'true', // Use mock mode for tests
          NODE_ENV: 'test',
        },
        encoding: 'utf8',
      });
      return { stdout, stderr: '' };
    } catch (error: unknown) {
      const execError = error as { stdout?: string; stderr?: string };
      return {
        stdout: execError.stdout || '',
        stderr: execError.stderr || '',
        error,
      };
    }
  };

  // Setup test environment
  beforeAll(() => {
    // Create test config directory
    fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });

    // Initialize with empty todo list
    const initialConfig = {
      todos: [],
      currentList: 'default',
      lists: { default: [] },
    };
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(initialConfig, null, 2));
  });

  // Cleanup after all tests
  afterAll(() => {
    // Remove test config directory
    if (fs.existsSync(TEST_CONFIG_DIR)) {
      fs.rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
    }
  });

  // Reset config before each test
  beforeEach(() => {
    const cleanConfig = {
      todos: [],
      currentList: 'default',
      lists: { default: [] },
    };
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(cleanConfig, null, 2));
  });

  describe('Success Cases', () => {
    test('should add a simple todo', () => {
      const result = runCLI('add "Complete documentation"');

      expect(result.error).toBeUndefined();
      expect(result.stdout).toContain('✓ Added todo:');
      expect(result.stdout).toContain('Complete documentation');

      // Verify todo was saved
      const config = JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8'));
      expect(config.todos).toHaveLength(1);
      expect(config.todos[0].text).toBe('Complete documentation');
      expect(config.todos[0].completed).toBe(false);
    });

    test('should add todo with priority', () => {
      const result = runCLI('add "High priority task" --priority high');

      expect(result.error).toBeUndefined();
      expect(result.stdout).toContain('✓ Added todo:');
      expect(result.stdout).toContain('High priority task');
      expect(result.stdout).toContain('[high]');

      const config = JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8'));
      expect(config.todos[0].priority).toBe('high');
    });

    test('should add todo with tags', () => {
      const result = runCLI('add "Tagged task" --tags work,urgent');

      expect(result.error).toBeUndefined();
      expect(result.stdout).toContain('✓ Added todo:');
      expect(result.stdout).toContain('Tagged task');
      expect(result.stdout).toContain('#work');
      expect(result.stdout).toContain('#urgent');

      const config = JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8'));
      expect(config.todos[0].tags).toEqual(['work', 'urgent']);
    });

    test('should add todo with due date', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const result = runCLI(`add "Due tomorrow" --due ${tomorrowStr}`);

      expect(result.error).toBeUndefined();
      expect(result.stdout).toContain('✓ Added todo:');
      expect(result.stdout).toContain('Due tomorrow');
      expect(result.stdout).toContain('Due:');

      const config = JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8'));
      expect(config.todos[0].dueDate).toBe(tomorrowStr);
    });

    test('should add todo with category', () => {
      const result = runCLI('add "Categorized task" --category personal');

      expect(result.error).toBeUndefined();
      expect(result.stdout).toContain('✓ Added todo:');
      expect(result.stdout).toContain('Categorized task');
      expect(result.stdout).toContain('[personal]');

      const config = JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8'));
      expect(config.todos[0].category).toBe('personal');
    });

    test('should add multiple todos sequentially', () => {
      const result1 = runCLI('add "First task"');
      const result2 = runCLI('add "Second task"');
      const result3 = runCLI('add "Third task"');

      expect(result1.error).toBeUndefined();
      expect(result2.error).toBeUndefined();
      expect(result3.error).toBeUndefined();

      const config = JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8'));
      expect(config.todos).toHaveLength(3);
      expect(config.todos[0].text).toBe('First task');
      expect(config.todos[1].text).toBe('Second task');
      expect(config.todos[2].text).toBe('Third task');
    });

    test('should add todo with all options combined', () => {
      const result = runCLI(
        'add "Complex task" --priority high --tags work,project --category development --due 2025-06-01'
      );

      expect(result.error).toBeUndefined();
      expect(result.stdout).toContain('✓ Added todo:');

      const config = JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8'));
      const todo = config.todos[0];
      expect(todo.text).toBe('Complex task');
      expect(todo.priority).toBe('high');
      expect(todo.tags).toEqual(['work', 'project']);
      expect(todo.category).toBe('development');
      expect(todo.dueDate).toBe('2025-06-01');
    });
  });

  describe('Error Handling', () => {
    test('should error when no text provided', () => {
      const result = runCLI('add');

      expect(result.error).toBeDefined();
      expect(result.stderr).toContain('Exactly one argument is required');
    });

    test('should error with empty text', () => {
      const result = runCLI('add ""');

      expect(result.error).toBeDefined();
      expect(result.stdout).toContain('Error: Todo text cannot be empty');
    });

    test('should error with invalid priority', () => {
      const result = runCLI('add "Task" --priority invalid');

      expect(result.error).toBeDefined();
      expect(result.stdout).toContain('Error: Invalid priority');
      expect(result.stdout).toContain('Must be one of: low, medium, high');
    });

    test('should error with invalid date format', () => {
      const result = runCLI('add "Task" --due "not-a-date"');

      expect(result.error).toBeDefined();
      expect(result.stdout).toContain('Error: Invalid date format');
    });

    test('should error with past due date', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const result = runCLI(`add "Task" --due ${yesterdayStr}`);

      expect(result.error).toBeDefined();
      expect(result.stdout).toContain('Error: Due date cannot be in the past');
    });

    test('should error with excessively long text', () => {
      const longText = 'a'.repeat(1001); // Assuming 1000 char limit
      const result = runCLI(`add "${longText}"`);

      expect(result.error).toBeDefined();
      expect(result.stdout).toContain('Error: Todo text is too long');
    });
  });

  describe('Input Validation', () => {
    test('should handle special characters in text', () => {
      const result = runCLI('add "Task with $pecial ch@racters & symbols!"');

      expect(result.error).toBeUndefined();
      const config = JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8'));
      expect(config.todos[0].text).toBe(
        'Task with $pecial ch@racters & symbols!'
      );
    });

    test('should handle quotes in text', () => {
      const result = runCLI('add "Task with \\"quotes\\" inside"');

      expect(result.error).toBeUndefined();
      const config = JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8'));
      expect(config.todos[0].text).toBe('Task with "quotes" inside');
    });

    test('should validate tag format', () => {
      const result = runCLI('add "Task" --tags "tag with spaces,123invalid"');

      expect(result.error).toBeDefined();
      expect(result.stdout).toContain('Error: Invalid tag format');
    });

    test('should validate category format', () => {
      const result = runCLI('add "Task" --category "category with spaces"');

      expect(result.error).toBeDefined();
      expect(result.stdout).toContain('Error: Invalid category format');
    });

    test('should handle multiple spaces in text', () => {
      const result = runCLI('add "Task   with   multiple   spaces"');

      expect(result.error).toBeUndefined();
      const config = JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8'));
      expect(config.todos[0].text).toBe('Task   with   multiple   spaces');
    });

    test('should trim whitespace from text', () => {
      const result = runCLI('add "  Trimmed task  "');

      expect(result.error).toBeUndefined();
      const config = JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8'));
      expect(config.todos[0].text).toBe('Trimmed task');
    });
  });

  describe('Edge Cases', () => {
    test('should handle unicode characters', () => {
      const result = runCLI('add "Task with emoji 🎉 and unicode ñ"');

      expect(result.error).toBeUndefined();
      const config = JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8'));
      expect(config.todos[0].text).toBe('Task with emoji 🎉 and unicode ñ');
    });

    test('should handle newlines in text', () => {
      const result = runCLI('add "Task\\nwith\\nnewlines"');

      expect(result.error).toBeUndefined();
      const config = JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8'));
      expect(config.todos[0].text).toContain('newlines');
    });

    test('should handle very short text', () => {
      const result = runCLI('add "a"');

      expect(result.error).toBeUndefined();
      const config = JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8'));
      expect(config.todos[0].text).toBe('a');
    });

    test('should handle maximum valid text length', () => {
      const maxText = 'a'.repeat(1000); // Assuming 1000 is the max
      const result = runCLI(`add "${maxText}"`);

      expect(result.error).toBeUndefined();
      const config = JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8'));
      expect(config.todos[0].text).toBe(maxText);
    });

    test('should handle empty tags array', () => {
      const result = runCLI('add "Task" --tags ""');

      expect(result.error).toBeDefined();
      expect(result.stdout).toContain('Error: Tags cannot be empty');
    });

    test('should handle duplicate tags', () => {
      const result = runCLI('add "Task" --tags work,work,urgent,work');

      expect(result.error).toBeUndefined();
      const config = JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8'));
      // Should deduplicate tags
      expect(config.todos[0].tags).toEqual(['work', 'urgent']);
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle rapid successive adds', async () => {
      const promises = [];

      // Add 5 todos concurrently
      for (let i = 1; i <= 5; i++) {
        promises.push(
          new Promise(resolve => {
            const result = runCLI(`add "Concurrent task ${i}"`);
            resolve(result);
          })
        );
      }

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((result: { error?: Error }) => {
        expect(result.error).toBeUndefined();
      });

      // Check final state
      const config = JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8'));
      expect(config.todos).toHaveLength(5);
    });
  });

  describe('Help and Documentation', () => {
    test('should show help with --help flag', () => {
      const result = runCLI('add --help');

      expect(result.error).toBeUndefined();
      expect(result.stdout).toContain('Add a new todo');
      expect(result.stdout).toContain('USAGE');
      expect(result.stdout).toContain('FLAGS');
      expect(result.stdout).toContain('--priority');
      expect(result.stdout).toContain('--tags');
      expect(result.stdout).toContain('--due');
      expect(result.stdout).toContain('--category');
    });
  });
});
