# Frontend Test Suite

This directory contains the test suite for the Waltodo frontend application.

## Test Structure

```
__tests__/
├── components/          # Component tests
├── contexts/           # Context provider tests
├── hooks/              # Custom hook tests
├── integration/        # Integration tests
├── mocks/              # Centralized mock implementations
├── test-utils.tsx      # Common test utilities and helpers
├── setup.ts            # Global test setup
└── README.md           # This file
```

## Using Test Utilities

### Basic Test Setup

For most tests, import the test utilities and mocks:

```typescript
import { render, screen, waitFor, act } from '../test-utils';
import '../mocks'; // Import all common mocks
```

### Testing Hooks

Use the safe `renderHook` function that ensures proper typing:

```typescript
import { renderHook, act } from '../test-utils';

const { result } = renderHook(() => useCustomHook());
```

### Mocking Blockchain Events

The blockchain event manager is automatically mocked. To trigger events in tests:

```typescript
import { mockBlockchainEventManager } from '../mocks';

// Trigger an event
mockBlockchainEventManager.__triggerEvent('created', {
  type: 'created',
  data: { todo_id: '1', title: 'Test' }
});
```

### Mocking Wallet Context

Update wallet context values for specific tests:

```typescript
import { updateMockWalletContext } from '../mocks';

updateMockWalletContext({
  connected: true,
  address: '0x123456789'
});
```

### Creating Mock Data

Use the provided factories:

```typescript
import { createMockTodo, createMockTransactionResult } from '../test-utils';

const todo = createMockTodo({ title: 'Custom Todo' });
const txResult = createMockTransactionResult();
```

## Common Patterns

### Testing Async Operations

```typescript
it('should handle async operations', async () => {
  const { result } = renderHook(() => useAsyncHook());
  
  await act(async () => {
    await result.current.performAsyncAction();
  });
  
  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });
});
```

### Testing Error States

```typescript
it('should handle errors', async () => {
  mockSomeFunction.mockRejectedValue(new Error('Test error'));
  
  const { result } = renderHook(() => useErrorHandling());
  
  await waitFor(() => {
    expect(result.current.error).toEqual(new Error('Test error'));
  });
});
```

### Testing with Providers

```typescript
const TestWrapper = ({ children }) => (
  <AppWalletProvider>
    <QueryClientProvider client={createTestQueryClient()}>
      {children}
    </QueryClientProvider>
  </AppWalletProvider>
);

const { result } = renderHook(() => useHookWithContext(), {
  wrapper: TestWrapper
});
```

## Mock Configuration

### Global Mocks

The following are mocked globally:
- `localStorage` and `sessionStorage`
- `window.matchMedia`
- `IntersectionObserver` and `ResizeObserver`
- React Query providers
- Sui/Mysten libraries
- Blockchain event manager

### Resetting Mocks

Mocks are automatically reset before each test. To manually reset:

```typescript
import { resetBlockchainEventManager, resetMockWalletContext } from '../mocks';

beforeEach(() => {
  resetBlockchainEventManager();
  resetMockWalletContext();
});
```

## Best Practices

1. **Import Order**: Always import test utilities before component/hook imports
2. **Mock Isolation**: Each test should reset relevant mocks to avoid cross-test contamination
3. **Async Testing**: Use `waitFor` for assertions on async state changes
4. **Error Handling**: Test both success and error paths
5. **Type Safety**: Use the provided type-safe utilities and mock factories

## Debugging Tests

### View Mock Calls

```typescript
console.log(mockFunction.mock.calls); // See all calls
console.log(mockFunction.mock.results); // See return values
```

### Check Event Listeners

```typescript
const listenerCount = mockBlockchainEventManager.__getListenerCount('created');
console.log(`Active listeners: ${listenerCount}`);
```

### Inspect localStorage

```typescript
const store = localStorageMock.__getStore();
console.log('localStorage contents:', store);
```