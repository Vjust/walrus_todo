# Service Mocking Documentation

This document explains how we simulate both the Sui blockchain and Walrus storage services for testing, making development faster and more reliable without requiring actual blockchain or remote storage connections.

## Table of Contents

1. [Introduction to Mocking](#introduction-to-mocking)
2. [Sui Service Mocking](#sui-service-mocking)
   - [Implementation Overview](#sui-implementation-overview)
   - [Key Features](#sui-key-features)
   - [Usage in Tests](#sui-usage-in-tests)
3. [Walrus Storage Mocking](#walrus-storage-mocking)
   - [Implementation Overview](#walrus-implementation-overview)
   - [Key Features](#walrus-key-features)
   - [Usage in Tests](#walrus-usage-in-tests)
4. [Combined Testing Strategy](#combined-testing-strategy)
5. [Best Practices](#best-practices)

## Introduction to Mocking

Our application interacts with two external services:
- **Sui Blockchain**: For decentralized storage and verification of todo lists
- **Walrus Storage**: For encrypted, user-controlled data storage

When testing, connecting to these real services would be:
- **Slow**: Network calls take time
- **Flaky**: Tests could fail due to network issues
- **Expensive**: Real blockchain operations cost tokens
- **Complex**: Requires test environment setup

Instead, we use in-memory mocks that simulate these services' behavior without external dependencies.

## Sui Service Mocking

### Sui Implementation Overview

Our Sui blockchain mocking is implemented with the `SuiTestService` class, which provides an in-memory implementation of the blockchain's behavior:

```typescript
// In-memory blockchain representation
private walletAddress: string;
private lists = new Map<string, TodoList>();
```

### Sui Key Features

1. **Todo List Management**
   - Creates lists with unique IDs
   - Manages list ownership through wallet addresses
   - Handles CRUD operations for todo items

2. **Authorization Simulation**
   - Validates wallet access to lists
   - Prevents unauthorized operations
   - Simulates ownership verification

3. **Deterministic Testing**
   - Provides predictable testing results
   - Uses seeded random values for IDs (when needed)
   - Allows resetting state between tests

### Sui Usage in Tests

```typescript
import { SuiTestService } from "../services/SuiTestService";

describe("Todo Operations", () => {
  it("creates and retrieves a todo", async () => {
    const service = new SuiTestService();
    const listId = await service.createTodoList();
    const todoId = await service.addTodo(listId, "Test task");
    
    const todos = await service.getTodos(listId);
    expect(todos).toHaveLength(1);
    expect(todos[0].text).toBe("Test task");
  });
});
```

## Walrus Storage Mocking

### Walrus Implementation Overview

Our Walrus storage mocking simulates the encrypted storage system with an in-memory implementation:

```typescript
// Simplified representation of in-memory storage
private storage = new Map<string, Map<string, any>>();
```

### Walrus Key Features

1. **Encrypted Storage Simulation**
   - Simulates data encryption/decryption
   - Maintains user-specific storage namespaces
   - Handles concurrent access patterns

2. **Storage Operations**
   - Put/get operations for data storage
   - List operations for collections
   - Delete operations for data removal

3. **Error Simulation**
   - Can simulate storage failures
   - Replicates permission errors
   - Handles quota limitations

### Walrus Usage in Tests

```typescript
import { WalrusTestService } from "../services/WalrusTestService";

describe("Walrus Storage", () => {
  it("stores and retrieves data", async () => {
    const storage = new WalrusTestService();
    await storage.put("user1", "settings", { theme: "dark" });
    
    const result = await storage.get("user1", "settings");
    expect(result).toEqual({ theme: "dark" });
  });
});
```

## Combined Testing Strategy

Our test suites leverage both mocks to create end-to-end tests without external dependencies:

```typescript
describe("Todo App Integration", () => {
  it("syncs todo lists between blockchain and storage", async () => {
    // Setup both mocks
    const suiService = new SuiTestService();
    const walrusService = new WalrusTestService();
    
    // Create a todo on the blockchain
    const listId = await suiService.createTodoList();
    await suiService.addTodo(listId, "Integration test");
    
    // Sync to storage
    const todoSync = new TodoSyncService(suiService, walrusService);
    await todoSync.syncToStorage("user1");
    
    // Verify in storage
    const storedLists = await walrusService.get("user1", "todoLists");
    expect(storedLists[0].items[0].text).toBe("Integration test");
  });
});
```

## Best Practices

1. **Reset State Between Tests**
   ```typescript
   beforeEach(() => {
     // Create fresh instances or reset existing ones
     suiService = new SuiTestService();
     walrusService = new WalrusTestService();
   });
   ```

2. **Test Isolation**
   - Each test should be independent
   - Don't rely on state created by other tests
   - Use unique identifiers when needed

3. **Error Testing**
   ```typescript
   it("handles unauthorized access", async () => {
     const service = new SuiTestService("user1");
     const listId = await service.createTodoList();
     
     // Try to access with different user
     const unauthorizedService = new SuiTestService("user2");
     await expect(unauthorizedService.getTodos(listId))
       .rejects.toThrow("Unauthorized access");
   });
   ```

4. **Simulate Edge Cases**
   - Test timeout handling
   - Test offline behavior
   - Test data corruption scenarios

By using these mocking strategies, we can develop and test our application with confidence, knowing that the core logic works correctly before deploying to real blockchain and storage environments.
