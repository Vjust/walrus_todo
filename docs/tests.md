# 📋 Understanding the Test Suites

This document explains our automated test suites from a developer's perspective, **without requiring any blockchain knowledge**. We'll cover:

1. The **three test suites** we use and what they verify
2. **Why** we built a mock Sui service for testing
3. **How** to run the tests yourself

## Overview of Our Test Suites

Our application has three Jest test suites:

| Test Suite | File Location | Purpose |
|------------|---------------|---------|
| Basic Tests | `src/__tests__/basic.test.ts` | Verifies CLI functionality and command structure |
| Todo Service Tests | `src/__tests__/todoService.test.ts` | Tests our storage service operations |
| Sui Test Service | `src/__tests__/suiTestService.test.ts` | Validates our in-memory blockchain mock |

Let's explore each one in detail.

## 1. Basic Tests (`basic.test.ts`)

These tests ensure that our CLI application is correctly structured and that the command handlers are properly registered. They verify:

- The main command structure is valid
- CLI options are properly defined
- Help text is available
- Error handling for invalid commands works correctly

These are fundamental smoke tests that catch issues with the application's command structure.

## 2. Todo Service Tests (`todoService.test.ts`)

These tests validate our storage layer, which manages todo items in Walrus storage. They check:

- Todo items can be created with the correct structure
- Items can be retrieved by ID or as collections
- Updates to todo items persist correctly
- Deletion works as expected
- Error cases are handled properly

These tests ensure our storage operations work correctly before they're connected to the blockchain.

## 3. Sui Test Service (`suiTestService.test.ts`)

### Why an In-Memory Service?

The real Sui blockchain is **decentralized** and **network-based**.  
• Talking to it in unit tests would be **slow**, **flaky** (network issues) and could even **cost real tokens**.  
• Instead we built a *pretend* version that lives entirely in JavaScript memory—think of it as a very fast, local "mock" blockchain.

### What Does `SuiTestService` Do?

| Real Blockchain Action | In-Memory Equivalent |
| ---------------------- | -------------------- |
| Create a new todo list | Generates a random `list_xxx` id and stores it in a Map |
| Add a todo item        | Adds an object `{ id, text, completed }` to that Map   |
| Fetch todos            | Returns everything in the Map for that list            |
| Update a todo          | Edits the object in place                               |
| Delete a list          | Removes the Map entry                                   |

Internally we use:

* **JavaScript `Map`** – like a simple, super-fast key-value store.  
* **`crypto.randomBytes`** – only to create unique IDs such as `todo_a1b2c3`.

### What Do the Jest Tests Check?

The `suiTestService.test.ts` file contains **three** tests:

1. **Wallet Address Handling** – Verifies that wallet addresses are properly managed
2. **Create → Add → Fetch** – Ensures that after creating a list and adding a todo, we can retrieve it correctly
3. **Update Flow** – Confirms that changes to todo items are persisted and retrievable

These tests guarantee that our mock blockchain service behaves consistently with what we expect from the real blockchain.

## How to Run the Tests

```bash
# from the project root
npm test
```

You should see output similar to:

```
PASS  src/__tests__/basic.test.ts
PASS  src/__tests__/todoService.test.ts
PASS  src/__tests__/suiTestService.test.ts

Test Suites: 3 passed, 3 total
Tests:       5+ passed, 5+ total
```

To run a specific test suite:

```bash
npm test -- -t "SuiTestService"
```

## Key Takeaways

- **No real blockchain required**: Our tests run completely offline
- **Fast execution**: In-memory operations instead of network calls
- **Deterministic results**: Predictable test outcomes every time
- **Safe experimentation**: No risk of spending real tokens or modifying production data

By setting up these three test suites, we ensure the entire application works properly from the command-line interface through the storage layer and down to the blockchain interaction layer.
