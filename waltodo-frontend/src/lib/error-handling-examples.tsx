/**
 * Error Handling Examples
 * Demonstrates how to use the centralized error handling system
 */

import React from 'react';
import { useAsyncError } from '@/hooks/useAsyncError';
import { 
  showError, 
  showSuccess, 
  handleAsyncOperation, 
  createContextualErrorHandler 
} from '@/lib/error-handling';

// Example 1: Simple error handling in a component
export function SimpleErrorExample() {
  const handleButtonClick = async () => {
    try {
      const result = await fetch('/api/todos');
      if (!result.ok) {
        throw new Error('Failed to fetch todos');
      }
      showSuccess('Todos loaded successfully!');
    } catch (error) {
      // Automatically classified and user-friendly message shown
      showError(error as Error);
    }
  };

  return (
    <button onClick={handleButtonClick}>
      Load Todos (Simple)
    </button>
  );
}

// Example 2: Using handleAsyncOperation for automatic loading states
export function AsyncOperationExample() {
  const handleCreateTodo = async () => {
    const result = await handleAsyncOperation(
      () => fetch('/api/todos', {
        method: 'POST',
        body: JSON.stringify({ title: 'New Todo' })
      }),
      {
        loadingMessage: 'Creating todo...',
        successMessage: 'Todo created successfully!',
        retryable: true,
        onRetry: async () => {
          // Optional: refresh auth token before retry
          console.log('Retrying todo creation...');
        }
      }
    );

    if (result) {
      console.log('Todo created:', result);
    }
  };

  return (
    <button onClick={handleCreateTodo}>
      Create Todo (With Loading)
    </button>
  );
}

// Example 3: Using useAsyncError hook for component state management
export function AsyncErrorHookExample() {
  const {
    execute,
    retry,
    loading,
    error,
    data,
    canRetry,
    isSuccess
  } = useAsyncError(
    async () => {
      const response = await fetch('/api/todos');
      if (!response.ok) {
        throw new Error('Failed to fetch todos');
      }
      return response.json();
    },
    {
      showToast: true,
      autoRetry: false,
      maxRetries: 3,
      onSuccess: (todos) => {
        console.log('Loaded todos:', todos);
      },
      onError: (error) => {
        console.error('Error loading todos:', error);
      }
    }
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button 
          onClick={execute} 
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Load Todos'}
        </button>
        
        {error && canRetry && (
          <button 
            onClick={retry}
            className="px-4 py-2 bg-yellow-500 text-white rounded"
          >
            Retry ({error.maxRetries! - error.retryCount!} left)
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-800">{error.userMessage}</p>
          <p className="text-sm text-red-600">Type: {error.type}</p>
        </div>
      )}

      {isSuccess && data && (
        <div className="p-4 bg-green-50 border border-green-200 rounded">
          <p className="text-green-800">Successfully loaded {data.length} todos</p>
        </div>
      )}
    </div>
  );
}

// Example 4: Contextual error handler for specific features
const todoErrorHandler = createContextualErrorHandler('Todo Management', {
  showToast: true,
  autoRetry: true,
  maxRetries: 2
});

export function ContextualErrorExample() {
  const handleTodoOperation = async () => {
    // Using contextual error handler
    const result = await todoErrorHandler.withRetry(
      () => fetch('/api/todos/1', { method: 'DELETE' }),
      3 // max retries
    );

    if (result) {
      todoErrorHandler.toast.success('Todo deleted successfully');
    }
  };

  const handleDirectError = async () => {
    try {
      throw new Error('Something went wrong with todo validation');
    } catch (error) {
      // Handle error with context
      await todoErrorHandler.handle(error as Error);
    }
  };

  return (
    <div className="space-y-2">
      <button 
        onClick={handleTodoOperation}
        className="block px-4 py-2 bg-red-500 text-white rounded"
      >
        Delete Todo (With Context)
      </button>
      
      <button 
        onClick={handleDirectError}
        className="block px-4 py-2 bg-gray-500 text-white rounded"
      >
        Trigger Validation Error
      </button>
    </div>
  );
}

// Example 5: Error boundary integration
export function ErrorBoundaryExample() {
  const [shouldThrow, setShouldThrow] = React.useState(false);

  if (shouldThrow) {
    throw new Error('Component error for testing error boundary');
  }

  return (
    <div className="p-4 border rounded">
      <h3 className="font-semibold mb-2">Error Boundary Test</h3>
      <p className="text-sm text-gray-600 mb-4">
        This component can throw an error to test the error boundary.
      </p>
      <button 
        onClick={() => setShouldThrow(true)}
        className="px-4 py-2 bg-red-500 text-white rounded"
      >
        Throw Error
      </button>
    </div>
  );
}

// Example 6: Global error handling setup (for _app.tsx or layout.tsx)
export function GlobalErrorHandlingSetup() {
  React.useEffect(() => {
    // This would be called in your app's root component
    import('@/lib/error-handling').then(({ setupGlobalErrorHandling }) => {
      setupGlobalErrorHandling();
    });

    return () => {
      import('@/lib/error-handling').then(({ cleanupGlobalErrorHandling }) => {
        cleanupGlobalErrorHandling();
      });
    };
  }, []);

  return null; // This component doesn't render anything
}

// Example 7: Custom error recovery
export function CustomRecoveryExample() {
  const {
    execute,
    loading,
    error
  } = useAsyncError(
    async () => {
      // Simulate a blockchain transaction that might fail
      const response = await fetch('/api/blockchain/transaction', {
        method: 'POST',
        body: JSON.stringify({ action: 'create_nft' })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        const error = new Error(errorData.message);
        (error as any).code = errorData.code;
        throw error;
      }
      
      return response.json();
    },
    {
      showToast: true,
      maxRetries: 2,
      onRetry: async (attempt, error) => {
        console.log(`Retry attempt ${attempt} for error:`, error.type);
        
        // Custom recovery logic based on error type
        if (error.type === 'BLOCKCHAIN' && error.message.includes('gas')) {
          // Maybe refresh gas estimates or switch RPC endpoints
          console.log('Attempting to refresh gas estimates...');
        } else if (error.type === 'NETWORK') {
          // Maybe switch to a different network endpoint
          console.log('Attempting to switch network endpoint...');
        }
      },
      onGiveUp: (error) => {
        console.log('Giving up after max retries:', error);
        showError('Unable to complete transaction after multiple attempts. Please try again later.');
      }
    }
  );

  return (
    <div className="space-y-4">
      <button 
        onClick={execute} 
        disabled={loading}
        className="px-4 py-2 bg-purple-500 text-white rounded disabled:opacity-50"
      >
        {loading ? 'Processing Transaction...' : 'Create NFT'}
      </button>

      {error && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-yellow-800">
            Transaction failed: {error.userMessage}
          </p>
          <p className="text-sm text-yellow-600">
            Error type: {error.type}, Retries: {error.retryCount}/{error.maxRetries}
          </p>
        </div>
      )}
    </div>
  );
}

// Example component that demonstrates all features
export function ComprehensiveErrorExample() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold mb-4">Error Handling Examples</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-4 border rounded">
          <h3 className="font-semibold mb-2">Simple Error Handling</h3>
          <SimpleErrorExample />
        </div>

        <div className="p-4 border rounded">
          <h3 className="font-semibold mb-2">Async Operation with Loading</h3>
          <AsyncOperationExample />
        </div>

        <div className="p-4 border rounded">
          <h3 className="font-semibold mb-2">useAsyncError Hook</h3>
          <AsyncErrorHookExample />
        </div>

        <div className="p-4 border rounded">
          <h3 className="font-semibold mb-2">Contextual Error Handler</h3>
          <ContextualErrorExample />
        </div>

        <div className="p-4 border rounded">
          <h3 className="font-semibold mb-2">Error Boundary Test</h3>
          <ErrorBoundaryExample />
        </div>

        <div className="p-4 border rounded">
          <h3 className="font-semibold mb-2">Custom Recovery</h3>
          <CustomRecoveryExample />
        </div>
      </div>
    </div>
  );
}