# Error Handling Guide

**Date:** May 13, 2025  
**Author:** Development Team

## Introduction

This guide explains the consolidated error handling framework for the WalTodo application. The framework provides consistent error handling, reporting, and recovery mechanisms across the codebase.

## Error Framework Overview

The error handling framework is based on a hierarchy of error classes, each tailored for specific error scenarios. At the root is the `BaseError` class, which provides core functionality like:

- Error codes for programmatic handling
- Timestamp tracking
- Detailed context with automatic sanitization for sensitive data
- Error chaining (cause tracking)
- Recovery information
- Public/private message separation
- Serialization utilities

### Error Class Hierarchy

```
BaseError
├── ValidationError   - Input validation failures
├── NetworkError      - Network communication failures
├── StorageError      - Storage operations failures
├── BlockchainError   - Blockchain interaction failures
├── CLIError          - Command-line interface errors
└── TransactionError  - Transaction-specific failures
```

## Using the Error Framework

### Throwing Errors

All error classes follow a consistent options-based pattern:

```typescript
// Basic error
throw new BaseError({
  message: 'Something went wrong',
  code: 'OPERATION_FAILED'
});

// Error with context
throw new ValidationError('Invalid input', {
  field: 'email',
  value: 'not-an-email',
  recoverable: false,
  code: 'VALIDATION_ERROR'
});

// Error with cause
try {
  // Some operation
} catch (error) {
  throw new StorageError('Failed to save data', {
    operation: 'file write',
    recoverable: true,
    cause: error instanceof Error ? error : undefined
  });
}
```

### Error Handling

The framework provides utilities for consistent error handling:

```typescript
import { handleError, toBaseError, isTransientError } from '../types/errors/consolidated';

try {
  // Some operation
} catch (error) {
  // Display error to user with context
  handleError(error, 'Failed during operation');
  
  // Or handle with more options
  handleError(error, {
    prefix: '❌',
    exit: true,
    exitCode: 2,
    logStack: true,
    context: { operationId: 123 }
  });
}
```

### Retry with Error Handling

For operations that might fail temporarily, use the `withRetry` utility:

```typescript
import { withRetry } from '../utils/consolidated/error-handler';

const result = await withRetry(
  async () => {
    // Operation that might fail transiently
    return fetchDataFromNetwork();
  },
  {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    retryIf: (error) => isNetworkError(error) && isTransientError(error)
  }
);
```

## Error Types Reference

### BaseError

The foundation for all error types with core functionality:

```typescript
new BaseError({
  message: string;         // Error message
  code?: string;           // Error code (default: 'UNKNOWN_ERROR')
  context?: Record<string, unknown>; // Additional context
  cause?: Error;           // Original error that caused this
  recoverable?: boolean;   // Whether operation can be recovered
  shouldRetry?: boolean;   // Whether operation should be retried
  retryDelay?: number;     // Suggested delay before retrying (ms)
  publicMessage?: string;  // User-friendly message
});
```

### ValidationError

Specialized for input validation failures:

```typescript
new ValidationError(
  message: string,
  options?: {
    field?: string;         // Field that failed validation
    value?: unknown;        // Invalid value
    code?: string;          // Error code
    context?: Record<string, unknown>; // Additional context
    recoverable?: boolean;  // Whether operation can be recovered
    constraint?: string;    // Validation constraint that failed
  }
);
```

### NetworkError

For network-related failures:

```typescript
new NetworkError(
  message: string,
  options?: {
    network?: string;       // Network name or endpoint
    statusCode?: number;    // HTTP status code
    requestId?: string;     // Request ID for tracing
    operation?: string;     // Network operation being performed
    recoverable?: boolean;  // Whether operation can be recovered
    // ... all BaseError options
  }
);
```

### StorageError

For storage-related failures:

```typescript
new StorageError(
  message: string,
  options?: {
    operation?: string;     // Storage operation being performed
    itemId?: string;        // ID of the storage item
    storageType?: string;   // Type of storage
    path?: string;          // Path to the file or resource
    // ... all BaseError options
  }
);
```

### BlockchainError

For blockchain-related failures:

```typescript
new BlockchainError(
  message: string,
  options?: {
    operation?: string;     // Blockchain operation being performed
    transactionId?: string; // Transaction ID if applicable
    objectId?: string;      // Object ID if applicable
    chain?: string;         // Chain ID or network name
    // ... all BaseError options
  }
);
```

### CLIError

For command-line interface errors:

```typescript
new CLIError(
  message: string,
  options?: {
    command?: string;       // Command name
    exitCode?: number;      // Exit code when exiting process
    invalidParams?: string[]; // Invalid parameters
    // ... all BaseError options
  }
);
```

## Error Utilities

The framework provides useful utilities:

- `isErrorWithMessage(error)`: Checks if error has a message property
- `getErrorMessage(error)`: Safely extracts message from any error
- `isErrorType(error, ErrorClass)`: Type-safe check for error types
- `getErrorCode(error, defaultCode)`: Safely extracts error code
- `isTransientError(error)`: Checks if error is likely transient
- `toBaseError(error)`: Converts any error to BaseError

## Migration from Legacy Errors

When migrating from legacy error handling:

1. Update imports to use consolidated error framework:
   ```typescript
   // Old
   import { CLIError } from "../types/error";
   
   // New
   import { CLIError } from "../types/errors/consolidated";
   ```

2. Update error instantiation to use options-based approach:
   ```typescript
   // Old
   throw new CLIError("message", "ERROR_CODE");
   
   // New
   throw new CLIError("message", { code: "ERROR_CODE" });
   ```

3. Update error handling to use the consolidated error handler:
   ```typescript
   // Old
   handleError("Failed to do something", error);
   
   // New
   handleError(error, "Failed to do something");
   ```

## Best Practices

1. **Be Specific**: Use the most specific error type for the situation
2. **Provide Context**: Include relevant context in your errors
3. **Include Recoverable Flag**: Indicate whether errors can be recovered from
4. **Chain Errors**: Use the cause parameter to preserve error chain
5. **Sanitize Sensitive Data**: Don't include passwords, keys, or tokens in error context
6. **Use Codes**: Assign specific error codes for programmatic handling
7. **User-Friendly Messages**: Separate technical details from user-facing messages

## Error Display Guidelines

- **CLI Errors**: Display with command context and suggestions
- **Validation Errors**: Highlight the specific field and constraint
- **Network Errors**: Include retry information when appropriate
- **Storage Errors**: Provide context about the operation
- **Blockchain Errors**: Include transaction IDs when available