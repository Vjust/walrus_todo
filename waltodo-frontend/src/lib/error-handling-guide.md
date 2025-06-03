# Centralized Error Handling System

This document provides comprehensive guidance on using the centralized error handling system in the WalTodo frontend application.

## Overview

The centralized error handling system provides:
- **Automatic error classification** by type and severity
- **Consistent toast notifications** with theming and actions
- **Retry mechanisms** with intelligent backoff strategies
- **SSR-safe implementations** for Next.js compatibility
- **Comprehensive async operation handling** with loading states
- **Error boundary integration** for React component errors

## Core Components

### 1. ErrorManager (`error-manager.ts`)

The `ErrorManager` class handles error classification, recovery, and user notification.

```typescript
import { errorManager, ErrorType, ErrorSeverity } from '@/lib/error-manager';

// Classify an error
const classified = errorManager.classify(new Error('Network timeout'));
console.log(classified.type); // ErrorType.NETWORK
console.log(classified.userMessage); // "Network connection failed..."

// Handle an error with automatic recovery
await errorManager.handle(error, { context: 'todo-creation' });
```

### 2. ToastService (`toast-service.ts`)

The `ToastService` provides standardized toast notifications with consistent styling.

```typescript
import { toastService } from '@/lib/toast-service';

// Show different types of toasts
toastService.success('Todo created successfully!');
toastService.error('Failed to create todo');
toastService.warning('This action cannot be undone');
toastService.info('New features available');

// Show toast with actions
toastService.error('Operation failed', {
  actions: [{
    label: 'Retry',
    action: () => retryOperation(),
    style: 'primary'
  }]
});
```

### 3. useAsyncError Hook (`useAsyncError.ts`)

React hook for handling async operations with comprehensive error management.

```typescript
import { useAsyncError } from '@/hooks/useAsyncError';

function TodoCreator() {
  const {
    execute,
    retry,
    loading,
    error,
    data,
    canRetry
  } = useAsyncError(
    () => createTodo({ title, description }),
    {
      showToast: true,
      autoRetry: true,
      maxRetries: 3,
      onSuccess: (todo) => console.log('Created:', todo),
      onError: (error) => console.error('Failed:', error)
    }
  );

  return (
    <div>
      <button onClick={execute} disabled={loading}>
        {loading ? 'Creating...' : 'Create Todo'}
      </button>
      
      {error && canRetry && (
        <button onClick={retry}>
          Retry ({error.maxRetries - error.retryCount} attempts left)
        </button>
      )}
    </div>
  );
}
```

## Error Classification

Errors are automatically classified into types with corresponding user messages:

### Error Types

- **NETWORK**: Connection timeouts, CORS errors, DNS failures
- **BLOCKCHAIN**: Wallet errors, transaction failures, gas issues
- **AUTHENTICATION**: Login failures, token expiration
- **STORAGE**: File operations, database errors, Walrus storage issues
- **VALIDATION**: Invalid input, format errors, constraint violations
- **PERMISSION**: Access denied, unauthorized operations
- **RATE_LIMIT**: Too many requests, API throttling
- **UNKNOWN**: Unclassified errors

### Error Severity

- **LOW**: Minor validation errors, warnings
- **MEDIUM**: Network timeouts, temporary failures
- **HIGH**: Blockchain transaction failures, storage errors
- **CRITICAL**: Authentication failures, system corruption

## Usage Patterns

### 1. Simple Error Display

```typescript
import { showError, showSuccess } from '@/lib/error-handling';

try {
  const result = await apiCall();
  showSuccess('Operation completed successfully');
} catch (error) {
  showError(error); // Automatically classified and user-friendly
}
```

### 2. Async Operations with Loading

```typescript
import { handleAsyncOperation } from '@/lib/error-handling';

const result = await handleAsyncOperation(
  () => uploadTodoImage(file),
  {
    loadingMessage: 'Uploading image...',
    successMessage: 'Image uploaded successfully',
    retryable: true,
    onRetry: async () => {
      // Optional retry logic
      await refreshAuthToken();
    }
  }
);
```

### 3. Component Error Boundaries

```typescript
import { createErrorBoundaryHandler } from '@/lib/error-handling';

class TodoListErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
    this.handleError = createErrorBoundaryHandler('TodoList');
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ hasError: true });
    this.handleError(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}
```

### 4. Promise-based Toasts

```typescript
import { toastService } from '@/lib/toast-service';

// Automatically updates based on promise state
const result = await toastService.promise(
  deleteTodo(todoId),
  {
    loading: 'Deleting todo...',
    success: 'Todo deleted successfully',
    error: (error) => `Failed to delete todo: ${error.message}`
  }
);
```

### 5. Multiple Async Operations

```typescript
import { useMultipleAsyncErrors } from '@/hooks/useAsyncError';

function TodoDashboard() {
  const {
    fetchTodos,
    fetchStats,
    executeAll,
    isAnyLoading,
    hasAnyError
  } = useMultipleAsyncErrors({
    fetchTodos: () => api.getTodos(),
    fetchStats: () => api.getStats()
  });

  useEffect(() => {
    executeAll();
  }, []);

  if (isAnyLoading) return <Loading />;
  if (hasAnyError) return <ErrorDisplay />;
  
  return <Dashboard />;
}
```

## Global Setup

### Application Root Setup

```typescript
// In _app.tsx or layout.tsx
import { setupGlobalErrorHandling } from '@/lib/error-handling';
import { Toaster } from 'react-hot-toast';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    setupGlobalErrorHandling();
    
    return () => {
      cleanupGlobalErrorHandling();
    };
  }, []);

  return (
    <>
      <Component {...pageProps} />
      <Toaster position="top-right" />
    </>
  );
}
```

### Configuration

```typescript
import { errorManager, toastService } from '@/lib/error-handling';

// Configure error manager
errorManager.updateConfig({
  enableLogging: process.env.NODE_ENV === 'development',
  autoRetry: true,
  maxRetries: 3,
  showToasts: true
});

// Configure toast service theme
toastService.updateTheme({
  error: {
    background: '#FEE2E2',
    color: '#991B1B',
    border: '#FCA5A5',
    icon: '❌'
  }
});
```

## Advanced Features

### Custom Recovery Strategies

```typescript
import { RecoveryStrategy } from '@/lib/error-manager';

const customRecovery = {
  strategy: RecoveryStrategy.MANUAL,
  customRecovery: async () => {
    // Custom recovery logic
    await refreshConnectionPool();
    await retryFailedOperations();
  }
};

await errorManager.handle(error, context, customRecovery);
```

### Error Analytics

```typescript
// Get error statistics
const stats = errorManager.getErrorStats();
console.log('Total errors:', stats.total);
console.log('By type:', stats.byType);
console.log('Recent errors:', stats.recent);
```

### Conditional Error Handling

```typescript
import { 
  isNetworkError, 
  isBlockchainError, 
  getErrorSeverity 
} from '@/lib/error-handling';

try {
  await performOperation();
} catch (error) {
  if (isNetworkError(error)) {
    // Handle network-specific recovery
    await retryWithBackoff();
  } else if (isBlockchainError(error)) {
    // Handle blockchain-specific issues
    await checkWalletConnection();
  } else if (getErrorSeverity(error) === ErrorSeverity.CRITICAL) {
    // Handle critical errors differently
    await notifySupport(error);
  }
  
  throw error; // Re-throw if needed
}
```

## Best Practices

### 1. Use Appropriate Error Types
- Always use the error classification system
- Provide context when handling errors
- Use specific error types for better user experience

### 2. Consistent Error Messages
- Let the system generate user-friendly messages
- Avoid exposing technical details to users
- Provide actionable guidance when possible

### 3. Graceful Degradation
- Always provide fallback values or states
- Use error boundaries to prevent app crashes
- Implement proper loading and error states

### 4. Performance Considerations
- Limit the number of simultaneous toasts
- Clean up error handlers on component unmount
- Use debouncing for rapid error scenarios

### 5. Development vs Production
- Enable detailed logging in development
- Use error reporting services in production
- Configure appropriate retry limits

## Integration with Existing Components

The error handling system is designed to integrate seamlessly with existing components:

```typescript
// Before
try {
  const todo = await createTodo(data);
  toast.success('Todo created');
} catch (error) {
  toast.error(error.message);
}

// After
import { handleAsyncOperation } from '@/lib/error-handling';

const todo = await handleAsyncOperation(
  () => createTodo(data),
  {
    loadingMessage: 'Creating todo...',
    successMessage: 'Todo created successfully'
  }
);
```

This system provides a robust foundation for error handling across the entire application while maintaining consistency and improving user experience.