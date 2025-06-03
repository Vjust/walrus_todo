# WalTodo Zustand Stores

This directory contains the comprehensive state management implementation for WalTodo using Zustand stores. The architecture follows the **Command-Service-Adapter (CSA)** pattern with centralized, type-safe, and performant state management.

## Architecture Overview

### Store Structure

```
src/stores/
├── index.ts                 # Main exports and utilities
├── types.ts                 # TypeScript type definitions
├── StoreProvider.tsx        # SSR-safe initialization provider
├── README.md               # This documentation
├── 
├── Core Stores/
├── ui-store.ts             # UI state (modals, forms, loading, theme)
├── wallet-store.ts         # Wallet connection and session management
├── app-store.ts            # App-level state (network, features, performance)
├── todo-store.ts           # Todo and list management (local + blockchain)
├── 
├── Legacy Stores/
├── createTodoStore.ts      # Form state for todo creation
├── createTodoNFTStore.ts   # NFT creation form state
├── navbarStore.ts          # Navigation state
├── todoListStore.ts        # Todo list display state
├── 
└── middleware/
    ├── index.ts            # Middleware exports and factory
    ├── persist.ts          # SSR-safe persistence configuration
    ├── devtools.ts         # Development tools setup
    └── logger.ts           # Action logging and debugging
```

## Core Stores

### 1. UI Store (`ui-store.ts`)

Manages all user interface state including:

- **Modals**: createTodo, walletConnect, todoDetail, nftGallery, editTodo, confirmDelete
- **Loading States**: app, blockchain, transactions, todos, nfts
- **Forms**: createTodo and editTodo form state with validation
- **Navigation**: current page, sidebar, mobile menu
- **Preferences**: theme, display mode, language, currency
- **Errors**: global, form, transaction, network errors
- **Search & Filtering**: query, filters, sorting

#### Usage Examples

```typescript
import { useUIStore, useUIActions, useCreateTodoModal } from '@/stores';

// Using selectors for performance
const isCreateModalOpen = useCreateTodoModal();
const { openModal, closeModal } = useUIActions();

// Open create todo modal
openModal('createTodo');

// Access form state
const createForm = useUIStore(state => state.forms.createTodo);
```

### 2. Wallet Store (`wallet-store.ts`)

Manages wallet connection and session state:

- **Connection**: status, address, network, chainId, wallet name
- **Session**: activity tracking, timeout warnings, auto-disconnect
- **Transactions**: history, pending transactions, status tracking
- **Capabilities**: feature support detection
- **Security**: session timeout, activity monitoring

#### Usage Examples

```typescript
import { useWalletStore, useWalletActions, useIsConnected } from '@/stores';

const isConnected = useIsConnected();
const { connect, disconnect, updateActivity } = useWalletActions();

// Connect wallet
await connect();

// Track transaction
const { addTransaction } = useWalletActions();
addTransaction({
  id: 'tx-123',
  type: 'createTodo',
  status: 'pending',
});
```

### 3. App Store (`app-store.ts`)

Manages application-level state:

- **Initialization**: app ready state, hydration status
- **Network Health**: Sui, Walrus, API status monitoring
- **Feature Flags**: AI, blockchain verification, encryption
- **Performance**: render metrics, memory usage
- **Environment**: browser detection, mobile/touch support

#### Usage Examples

```typescript
import { useAppStore, useAppHealth, checkNetworkHealth } from '@/stores';

const { initialized, hydrated } = useAppStore(state => ({
  initialized: state.initialized,
  hydrated: state.hydrated,
}));

// Check network health
await checkNetworkHealth('sui', 'https://fullnode.testnet.sui.io');

// Get app health summary
const health = useAppHealth();
```

### 4. Todo Store (`todo-store.ts`)

Manages todo and list data:

- **Local Todos**: CRUD operations, list management
- **Blockchain Integration**: NFT todos, sync status
- **Cache Management**: size tracking, cleanup
- **Bulk Operations**: batch updates, replacements

#### Usage Examples

```typescript
import { useTodoStore, useTodoActions, useTodoStats } from '@/stores';

const { addTodo, updateTodo, deleteTodo } = useTodoActions();
const todos = useTodos('work');
const stats = useTodoStats('work');

// Add new todo
addTodo('work', {
  title: 'Implement feature',
  description: 'Add new functionality',
  priority: 'high',
  completed: false,
});
```

## Middleware

### Persistence (`middleware/persist.ts`)

- **SSR-Safe**: Uses safe localStorage wrapper
- **Selective Persistence**: Only persists safe, non-sensitive data
- **Migrations**: Handles store version upgrades
- **Partitioning**: Selective state persistence

### DevTools (`middleware/devtools.ts`)

- **Development Only**: Automatically enabled in dev mode
- **Named Stores**: Proper store identification
- **Action Naming**: Consistent action naming conventions
- **Performance Monitoring**: Slow action detection

### Logger (`middleware/logger.ts`)

- **Action Logging**: Comprehensive action and state change tracking
- **Performance Metrics**: Execution time monitoring
- **State Diffing**: Shows state changes
- **Export/Import**: Debug data export capabilities

## SSR Safety

All stores are designed to work with Next.js SSR:

1. **Safe Storage**: Uses SSR-safe localStorage wrapper
2. **Hydration**: Manual hydration with proper guards
3. **Initialization**: Proper client-side only initialization
4. **Fallbacks**: Graceful degradation on server

### Usage in Next.js

```typescript
// pages/_app.tsx
import { StoreProvider } from '@/stores/StoreProvider';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <StoreProvider>
      <Component {...pageProps} />
    </StoreProvider>
  );
}
```

## Performance Optimization

### Selective Subscriptions

```typescript
// ✅ Good - Only subscribe to specific state
const isLoading = useUIStore(state => state.loading.todos);

// ❌ Bad - Subscribes to entire store
const store = useUIStore();
const isLoading = store.loading.todos;
```

### Computed Selectors

```typescript
// Pre-computed selectors for expensive operations
const todoStats = useTodoStats('work'); // Memoized calculations
const filteredTodos = useFilteredTodos('work', filters);
```

### Action Grouping

```typescript
// Group related actions for better performance
const actions = useUIActions(); // All UI actions in one selector
```

## Development Tools

### Debug Panel

In development mode, a debug panel shows store status:

```typescript
import { StoreDebugPanel } from '@/stores/StoreProvider';

// Add to your app
<StoreDebugPanel />
```

### Console Debugging

Access debug utilities in browser console:

```javascript
// Available in development
window.debugStores.exportLogs();
window.debugStores.getStats();
window.debugStores.clearLogs();
```

## Migration from Legacy Stores

The new stores coexist with legacy stores during migration:

1. **Incremental Migration**: Migrate components one by one
2. **Backward Compatibility**: Legacy stores remain functional
3. **Gradual Cleanup**: Remove legacy stores after migration

### Migration Example

```typescript
// Before (legacy)
import { useCreateTodoStore } from '@/stores/createTodoStore';

// After (new UI store)
import { useUIStore, useUIActions } from '@/stores';

const form = useUIStore(state => state.forms.createTodo);
const { updateForm } = useUIActions();
```

## Best Practices

### 1. Use Specific Selectors

```typescript
// ✅ Specific selector
const isCreateModalOpen = useCreateTodoModal();

// ❌ Generic selector
const modals = useUIModals();
const isCreateModalOpen = modals.createTodo;
```

### 2. Group Related Actions

```typescript
// ✅ Action group
const { openModal, closeModal, setLoading } = useUIActions();

// ❌ Individual action selectors
const openModal = useUIStore(state => state.openModal);
const closeModal = useUIStore(state => state.closeModal);
```

### 3. Handle Loading States

```typescript
const isLoading = useAppLoading();
const setLoading = useUIStore(state => state.setLoading);

// Set loading state
setLoading('todos', true);
// ... perform operation
setLoading('todos', false);
```

### 4. Error Handling

```typescript
const { setGlobalError, clearErrors } = useUIActions();

try {
  // ... operation
} catch (error) {
  setGlobalError(error.message);
}
```

## Type Safety

All stores are fully typed with TypeScript:

- **State Types**: Comprehensive type definitions
- **Action Types**: Type-safe action signatures
- **Selector Types**: Automatic type inference
- **Middleware Types**: Type-safe middleware configuration

## Testing

Store testing patterns:

```typescript
import { renderHook, act } from '@testing-library/react';
import { useUIStore } from '@/stores';

test('should open modal', () => {
  const { result } = renderHook(() => useUIStore());
  
  act(() => {
    result.current.openModal('createTodo');
  });
  
  expect(result.current.modals.createTodo).toBe(true);
});
```

## Performance Monitoring

The stores include built-in performance monitoring:

- **Render Tracking**: Monitor component re-renders
- **Memory Usage**: Track memory consumption
- **Action Performance**: Identify slow actions
- **Network Health**: Monitor service availability

Access performance data:

```typescript
const performance = usePerformanceMetrics();
const networkHealth = useNetworkHealth();
```