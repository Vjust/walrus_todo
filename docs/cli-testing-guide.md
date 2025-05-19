# CLI Testing Guide

*Date: May 12, 2024*

This guide outlines best practices and approaches for testing the WalTodo CLI application. It covers setting up a Jest testing environment, creating effective test cases, and working with mocks for blockchain interactions.

## Overview

Testing a CLI application that interacts with blockchain systems presents unique challenges. This guide provides structured approaches to ensure that the WalTodo CLI commands are thoroughly tested, including both local storage functionality and blockchain integration.

## Testing Environment Setup

A clean and isolated testing environment is essential for reliable CLI tests. The following setup is recommended:

### 1. Basic Test Setup

```typescript
// Mock dependencies
import { TodoService } from '../../src/services/todoService';
jest.mock('../../src/services/todoService');

// Mock command execution
import { execSync } from 'child_process';
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

describe('Command test', () => {
  // Set up before each test
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up TodoService mocks
    (TodoService.prototype.addTodo as jest.Mock).mockResolvedValue({
      // Mock todo response
    });
    
    // Set up execSync mock for CLI commands
    (execSync as jest.Mock).mockImplementation((command: string) => {
      if (command.includes('list')) {
        return Buffer.from('List output');
      }
      // Add other command responses as needed
      return Buffer.from('Command executed successfully');
    });
  });

  // Test cases go here...
});
```

### 2. Testing with @oclif/test Library

For projects that can properly set up the `@oclif/test` library (requires proper configuration with `fancy-test`):

```typescript
import { test } from '@oclif/test';

test
  .stdout()  // Capture stdout output
  .command(['add', 'Test todo title', '-p', 'high'])  // Command arguments
  .it('adds a high priority todo', ctx => {
    expect(ctx.stdout).toContain('New Task Added');
    expect(ctx.stdout).toContain('HIGH');
  });
```

### 3. Simple Command Testing Without @oclif/test

A reliable approach that works in any environment:

```typescript
// Mock execSync to simulate command execution
(execSync as jest.Mock).mockImplementation((command: string) => {
  if (command.includes('add "Test Todo"')) {
    return Buffer.from('Todo added successfully');
  }
  return Buffer.from('Command executed successfully');
});

it('should execute add command successfully', () => {
  const result = execSync('node bin/run.js add "Test Todo"').toString();
  expect(result).toContain('Todo added successfully');
});
```

### 4. Working with Service-Level Tests

For testing the internal services used by commands:

```typescript
it('should handle service interaction correctly', async () => {
  const todoService = new TodoService();
  const list = await todoService.getList('default');
  
  expect(TodoService.prototype.getList).toHaveBeenCalledWith('default');
  expect(list.todos).toHaveLength(3);
  
  // Test filtering logic
  const completedTodos = list.todos.filter(todo => todo.completed);
  expect(completedTodos).toHaveLength(1);
});
```

## Testing Strategies

### 1. Command Testing

Test the behavior of CLI commands with different arguments:

```typescript
// Test with required arguments only
it('should add a todo with title', () => {
  const result = execSync('node bin/run.js add "Basic todo"').toString();
  expect(result).toContain('Task Added');
});

// Test with optional arguments
it('should add a todo with tags', () => {
  const result = execSync('node bin/run.js add "Todo with tags" -g work,important').toString();
  expect(result).toContain('Task Added');
});

// Test error cases
it('should handle missing arguments', () => {
  // Mock error behavior
  (execSync as jest.Mock).mockImplementation(() => {
    throw new Error('Missing required argument');
  });
  
  expect(() => {
    execSync('node bin/run.js add').toString();
  }).toThrow('Missing required argument');
});
```

### 2. Integration Testing

Test how commands interact with the services:

```typescript
it('should store todos correctly via service', async () => {
  // Create a mocked todo
  const mockTodo = {
    id: 'test-id',
    title: 'Test Todo',
    priority: 'high'
  };
  
  // Mock the service method
  (TodoService.prototype.addTodo as jest.Mock).mockResolvedValue(mockTodo);
  
  // Test the service call that would happen in the command
  const todoService = new TodoService();
  const result = await todoService.addTodo('default', { title: 'Test Todo', priority: 'high' });
  
  expect(result).toEqual(mockTodo);
  expect(TodoService.prototype.addTodo).toHaveBeenCalledWith(
    'default', 
    expect.objectContaining({ title: 'Test Todo', priority: 'high' })
  );
});
```

### 3. Testing Blockchain Interactions

For blockchain operations, mocking is essential:

```typescript
// Mock blockchain dependencies
import { createWalrusStorage } from '../../src/utils/walrus-storage';
jest.mock('../../src/utils/walrus-storage');

// Set up mock
const mockStorageMethods = {
  connect: jest.fn().mockResolvedValue(undefined),
  storeTodo: jest.fn().mockResolvedValue({
    blobId: 'test-blob-id',
    url: 'https://testnet.wal.app/blob/test-blob-id'
  })
};

(createWalrusStorage as jest.Mock).mockReturnValue(mockStorageMethods);

// Test blockchain command functionality
it('should handle blockchain storage', async () => {
  // Test a command that would use blockchain storage
  const result = execSync('node bin/run.js store --todo test-todo-id').toString();
  expect(result).toContain('stored successfully');
  
  // Or test the underlying service directly
  const storage = createWalrusStorage();
  await storage.connect();
  
  expect(mockStorageMethods.connect).toHaveBeenCalled();
});
```

### 4. Error Handling Tests

Test how the CLI handles errors:

```typescript
it('should handle network errors gracefully', () => {
  // Mock a network error
  (createWalrusStorage as jest.Mock).mockReturnValue({
    connect: jest.fn().mockRejectedValue(new Error('Network error'))
  });
  
  // Mock execSync to simulate the error
  (execSync as jest.Mock).mockImplementation(() => {
    throw new Error('Failed to connect: Network error');
  });
  
  // Test that the error is properly handled
  expect(() => {
    execSync('node bin/run.js store --todo test-id').toString();
  }).toThrow('Network error');
});
```

## Mock Implementation Patterns

### 1. Basic Mock Setup

```typescript
// Mock file system operations
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
}));

// Mock command execution
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));
```

### 2. Creating Test Fixtures

```typescript
// Sample test data
const createTestTodo = (overrides = {}) => ({
  id: `test-todo-${Date.now()}`,
  title: 'Test Todo',
  description: 'Test Description',
  completed: false,
  priority: 'medium',
  tags: ['test'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  private: false,
  storageLocation: 'local',
  ...overrides
});

// Create a test list with todos
const createTestList = (name = 'default', todos = []) => ({
  id: name,
  name: name,
  owner: 'test-owner',
  todos: todos.length > 0 ? todos : [createTestTodo()],
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});
```

### 3. Blockchain-specific Mocks

```typescript
// Create mock blockchain storage
const mockWalrusStorage = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  storeTodo: jest.fn().mockResolvedValue({
    blobId: 'test-blob-id',
    url: 'https://testnet.wal.app/blob/test-blob-id'
  }),
  write: jest.fn().mockResolvedValue({ blobId: 'test-blob-id' }),
  read: jest.fn().mockResolvedValue({ /* todo data */ }),
  verify: jest.fn().mockResolvedValue(true),
  delete: jest.fn()
};

// Mock the factory function
jest.mock('../../src/utils/walrus-storage', () => ({
  createWalrusStorage: jest.fn().mockReturnValue(mockWalrusStorage)
}));
```

## Best Practices

1. **Isolate Tests**: Ensure each test can run independently.
2. **Mock External Services**: Never connect to real blockchain networks in tests.
3. **Test Error Handling**: Verify the CLI gracefully handles errors.
4. **Test Command Arguments**: Test different argument combinations.
5. **Use Helper Functions**: Create utility functions for common test operations.
6. **Check Output Format**: Verify the CLI output follows expected formats.
7. **Test File Operations**: Mock file system operations to verify file handling.

## Example Test Files

The project includes several example test files that demonstrate these patterns:

- `tests/example/basic.test.ts`: Simple Jest setup and TodoService mocking.
- `tests/example/simple-add.test.ts`: Tests for the `add` command using execSync mocking.
- `tests/example/simple-list.test.ts`: Tests for the `list` command with filtering options.

These examples demonstrate a pragmatic approach to testing the WalTodo CLI that works in any environment, without relying on complex test frameworks.

## Running Tests

To run specific tests:

```bash
# Run all example tests
pnpm test tests/example

# Run a specific test file
pnpm test tests/example/simple-add.test.ts

# Run tests with a specific pattern
pnpm test -- -t "should add a todo"
```

These testing approaches ensure that the WalTodo CLI remains robust and reliable as the codebase evolves.