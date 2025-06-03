# Zustand Stores Usage Examples

This document provides practical examples of how to use the new Zustand stores in your components.

## Basic Setup

First, wrap your app with the StoreProvider:

```tsx
// pages/_app.tsx or app/layout.tsx
import { StoreProvider } from '@/stores/StoreProvider';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <StoreProvider>
      <Component {...pageProps} />
    </StoreProvider>
  );
}
```

## UI Store Examples

### Modal Management

```tsx
import { useUIStore, useUIActions, useCreateTodoModal } from '@/stores';

function CreateTodoButton() {
  const { openModal } = useUIActions();
  
  return (
    <button onClick={() => openModal('createTodo')}>
      Create Todo
    </button>
  );
}

function CreateTodoModal() {
  const isOpen = useCreateTodoModal();
  const { closeModal } = useUIActions();
  
  if (!isOpen) return null;
  
  return (
    <div className="modal">
      <div className="modal-content">
        <button onClick={() => closeModal('createTodo')}>Close</button>
        {/* Modal content */}
      </div>
    </div>
  );
}
```

### Form State Management

```tsx
import { useCreateTodoForm, useUIActions } from '@/stores';

function CreateTodoForm() {
  const form = useCreateTodoForm();
  const { updateForm, resetForm } = useUIActions();
  
  const handleTitleChange = (title: string) => {
    updateForm('createTodo', { title });
  };
  
  const handleSubmit = async () => {
    updateForm('createTodo', { isSubmitting: true });
    
    try {
      // Submit logic here
      resetForm('createTodo');
    } catch (error) {
      updateForm('createTodo', { 
        isSubmitting: false,
        errors: { general: error.message }
      });
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input
        value={form.title}
        onChange={(e) => handleTitleChange(e.target.value)}
        placeholder="Todo title"
      />
      {form.errors.title && (
        <span className="error">{form.errors.title}</span>
      )}
      <button disabled={form.isSubmitting}>
        {form.isSubmitting ? 'Creating...' : 'Create Todo'}
      </button>
    </form>
  );
}
```

### Loading States

```tsx
import { useAppLoading, useUIActions } from '@/stores';

function LoadingWrapper({ children }: { children: React.ReactNode }) {
  const isLoading = useAppLoading();
  
  if (isLoading) {
    return <div className="spinner">Loading...</div>;
  }
  
  return <>{children}</>;
}

function DataFetcher() {
  const { setLoading } = useUIActions();
  
  const fetchData = async () => {
    setLoading('app', true);
    
    try {
      // Fetch data
    } finally {
      setLoading('app', false);
    }
  };
  
  return (
    <button onClick={fetchData}>Fetch Data</button>
  );
}
```

## Wallet Store Examples

### Connection Management

```tsx
import { 
  useIsConnected, 
  useWalletAddress, 
  useWalletActions,
  useWalletError 
} from '@/stores';

function WalletConnectButton() {
  const isConnected = useIsConnected();
  const address = useWalletAddress();
  const error = useWalletError();
  const { connect, disconnect } = useWalletActions();
  
  if (error) {
    return <div className="error">Wallet Error: {error}</div>;
  }
  
  if (isConnected) {
    return (
      <div>
        <span>Connected: {address?.slice(0, 6)}...{address?.slice(-4)}</span>
        <button onClick={disconnect}>Disconnect</button>
      </div>
    );
  }
  
  return (
    <button onClick={connect}>Connect Wallet</button>
  );
}
```

### Transaction Tracking

```tsx
import { 
  usePendingTransactions, 
  useTransactionHistory,
  useWalletActions 
} from '@/stores';

function TransactionStatus() {
  const pendingTxs = usePendingTransactions();
  const { addTransaction, updateTransaction } = useWalletActions();
  
  const createTodo = async () => {
    const txId = `tx-${Date.now()}`;
    
    // Track transaction as pending
    addTransaction({
      id: txId,
      type: 'createTodo',
      status: 'pending',
    });
    
    try {
      // Execute transaction
      const result = await executeTransaction();
      
      // Update to success
      updateTransaction(txId, {
        status: 'success',
        digest: result.digest,
      });
    } catch (error) {
      // Update to failed
      updateTransaction(txId, {
        status: 'failed',
        error: error.message,
      });
    }
  };
  
  return (
    <div>
      <button onClick={createTodo}>Create Todo</button>
      {Object.values(pendingTxs).map(tx => (
        <div key={tx.id}>
          {tx.type}: {tx.status}
        </div>
      ))}
    </div>
  );
}
```

## Todo Store Examples

### Todo Management

```tsx
import { 
  useTodos, 
  useTodoActions, 
  useTodoStats,
  useCurrentList 
} from '@/stores';

function TodoList() {
  const currentList = useCurrentList();
  const todos = useTodos(currentList);
  const stats = useTodoStats(currentList);
  const { addTodo, updateTodo, deleteTodo, completeTodo } = useTodoActions();
  
  const handleAddTodo = () => {
    addTodo(currentList, {
      title: 'New Todo',
      description: '',
      priority: 'medium',
      completed: false,
      tags: [],
      private: false,
    });
  };
  
  return (
    <div>
      <div className="stats">
        Total: {stats.total} | Completed: {stats.completed} | Pending: {stats.pending}
      </div>
      
      <button onClick={handleAddTodo}>Add Todo</button>
      
      <ul>
        {todos.map(todo => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => completeTodo(currentList, todo.id)}
            />
            <span className={todo.completed ? 'completed' : ''}>
              {todo.title}
            </span>
            <button onClick={() => deleteTodo(currentList, todo.id)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Filtered Todos

```tsx
import { useFilteredTodos, useUIStore } from '@/stores';

function FilteredTodoList() {
  const searchQuery = useUIStore(state => state.search.query);
  const filters = useUIStore(state => state.search.filters);
  const todos = useFilteredTodos('work', {
    status: filters.status,
    priority: filters.priority,
    search: searchQuery,
  });
  
  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
}
```

## App Store Examples

### Network Health Monitoring

```tsx
import { 
  useNetworkHealth, 
  useOverallNetworkHealth,
  checkNetworkHealth 
} from '@/stores';

function NetworkStatus() {
  const networkHealth = useNetworkHealth();
  const overallHealth = useOverallNetworkHealth();
  
  const checkHealth = async () => {
    await Promise.all([
      checkNetworkHealth('sui', 'https://fullnode.testnet.sui.io'),
      checkNetworkHealth('walrus', 'https://publisher.walrus-testnet.walrus.space'),
    ]);
  };
  
  return (
    <div>
      <div className={`status ${overallHealth}`}>
        Network Status: {overallHealth}
      </div>
      
      <div>
        Sui: {networkHealth.sui.status} ({networkHealth.sui.latency}ms)
      </div>
      <div>
        Walrus: {networkHealth.walrus.status} ({networkHealth.walrus.latency}ms)
      </div>
      
      <button onClick={checkHealth}>Check Health</button>
    </div>
  );
}
```

### Feature Flags

```tsx
import { useAIEnabled, useDebugMode, useAppActions } from '@/stores';

function AIFeature() {
  const aiEnabled = useAIEnabled();
  const debugMode = useDebugMode();
  const { toggleFeature } = useAppActions();
  
  if (!aiEnabled) {
    return (
      <div>
        AI features disabled
        {debugMode && (
          <button onClick={() => toggleFeature('aiEnabled')}>
            Enable AI
          </button>
        )}
      </div>
    );
  }
  
  return <div>AI features are active</div>;
}
```

## Performance Optimization

### Selective Subscriptions

```tsx
// ✅ Good - Only subscribes to specific state
const isLoading = useUIStore(state => state.loading.todos);

// ❌ Bad - Subscribes to entire store
const store = useUIStore();
const isLoading = store.loading.todos;
```

### Memoized Selectors

```tsx
import { useMemo } from 'react';
import { useTodos } from '@/stores';

function ExpensiveComponent() {
  const todos = useTodos();
  
  // Memoize expensive calculations
  const expensiveData = useMemo(() => {
    return todos.reduce((acc, todo) => {
      // Complex calculation
      return acc + todo.title.length;
    }, 0);
  }, [todos]);
  
  return <div>Total characters: {expensiveData}</div>;
}
```

## Error Handling

```tsx
import { useGlobalError, useNetworkError, useUIActions } from '@/stores';

function ErrorDisplay() {
  const globalError = useGlobalError();
  const networkError = useNetworkError();
  const { setGlobalError, setNetworkError } = useUIActions();
  
  if (globalError) {
    return (
      <div className="error">
        {globalError}
        <button onClick={() => setGlobalError(null)}>Dismiss</button>
      </div>
    );
  }
  
  if (networkError) {
    return (
      <div className="warning">
        Network issue: {networkError}
        <button onClick={() => setNetworkError(null)}>Dismiss</button>
      </div>
    );
  }
  
  return null;
}
```

## Development Debugging

```tsx
import { useStoreDevtools } from '@/stores/StoreProvider';

function DebugPanel() {
  const devtools = useStoreDevtools();
  
  if (!devtools) return null; // Production
  
  return (
    <div className="debug-panel">
      <button onClick={() => console.log(devtools.getStats())}>
        Log Performance Stats
      </button>
      <button onClick={() => console.log(devtools.stores)}>
        Log Store State
      </button>
      <button onClick={devtools.clearLogs}>
        Clear Logs
      </button>
    </div>
  );
}
```

## Testing

```tsx
import { renderHook, act } from '@testing-library/react';
import { useUIStore } from '@/stores';

test('should toggle modal', () => {
  const { result } = renderHook(() => useUIStore());
  
  act(() => {
    result.current.openModal('createTodo');
  });
  
  expect(result.current.modals.createTodo).toBe(true);
  
  act(() => {
    result.current.closeModal('createTodo');
  });
  
  expect(result.current.modals.createTodo).toBe(false);
});
```

These examples show the most common patterns for using the Zustand stores effectively in your application.