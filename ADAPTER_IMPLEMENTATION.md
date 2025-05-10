# Adapter Pattern Implementation

This document summarizes the improvements made to the adapter pattern implementation in the project.

## BaseAdapter Interface

We've created a foundational `BaseAdapter<T>` interface to provide common functionality for all adapters:

```typescript
export interface BaseAdapter<T> {
  /**
   * Get the underlying implementation being adapted
   * @returns The original object being adapted
   * @throws Error if the adapter has been disposed
   */
  getUnderlyingImplementation(): T;
  
  /**
   * Release any resources held by this adapter
   * This method is idempotent and can be called multiple times
   */
  dispose(): Promise<void>;
  
  /**
   * Check if this adapter has been disposed
   * @returns true if the adapter has been disposed
   */
  isDisposed(): boolean;
}
```

With a type guard to check if an object is a BaseAdapter:

```typescript
export function isBaseAdapter<T>(obj: unknown): obj is BaseAdapter<T> {
  if (!obj || typeof obj !== 'object') return false;
  
  const adapter = obj as Partial<BaseAdapter<T>>;
  
  return (
    typeof adapter.getUnderlyingImplementation === 'function' &&
    typeof adapter.dispose === 'function' &&
    typeof adapter.isDisposed === 'function'
  );
}
```

## Enhanced Error Handling with BaseError

We've implemented a `BaseError` class to improve error handling across the codebase:

```typescript
export class BaseError extends Error {
  readonly code: string;
  readonly timestamp: Date;
  readonly cause?: Error;
  readonly context?: Record<string, unknown>;
  readonly retriable: boolean;

  constructor(options: {
    message: string;
    code: string;
    cause?: Error;
    context?: Record<string, unknown>;
    retriable?: boolean;
  }) {
    super(options.message);
    this.name = this.constructor.name;
    this.code = options.code;
    this.timestamp = new Date();
    this.cause = options.cause;
    this.context = options.context;
    this.retriable = options.retriable ?? false;
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
  
  /**
   * Creates a safe error report for logging
   * Removes sensitive information from context if present
   */
  toSafeErrorReport(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp.toISOString(),
      retriable: this.retriable,
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message
      } : undefined,
      // Filter sensitive data from context
      context: this.getSafeContext()
    };
  }
  
  /**
   * Returns a filtered version of the context without sensitive data
   */
  private getSafeContext(): Record<string, unknown> | undefined {
    if (!this.context) return undefined;
    
    // Create a copy of the context
    const safeContext = { ...this.context };
    
    // Remove potentially sensitive fields
    const sensitiveKeys = [
      'password', 'secret', 'token', 'apiKey', 'api_key', 'private', 
      'credential', 'auth', 'key', 'certificate', 'seed', 'mnemonic'
    ];
    
    // Check if any key contains sensitive patterns
    for (const key of Object.keys(safeContext)) {
      if (sensitiveKeys.some(pattern => key.toLowerCase().includes(pattern))) {
        safeContext[key] = '[REDACTED]';
      }
    }
    
    return safeContext;
  }
}
```

## Adapter Implementations

We've enhanced the following key adapters to use the new base interface:

### 1. TransactionBlockAdapter

The `TransactionBlockAdapter` provides a consistent interface for working with transaction blocks across different versions of the Sui SDK:

```typescript
export class TransactionBlockAdapter implements UnifiedTransactionBlock, BaseAdapter<Transaction | TransactionBlockSui> {
  // Methods to get underlying implementation
  getUnderlyingImplementation(): Transaction | TransactionBlockSui {
    this.checkDisposed();
    return this.transactionBlock;
  }
  
  // Resource management
  isDisposed(): boolean {
    return this._isDisposed;
  }

  async dispose(): Promise<void> {
    if (this._isDisposed) return;
    
    try {
      // Cleanup logic here
      this._isDisposed = true;
    } catch (error) {
      throw new TransactionAdapterError(
        `Failed to dispose TransactionBlockAdapter: ${error instanceof Error ? error.message : String(error)}`, 
        error instanceof Error ? error : undefined
      );
    }
  }
  
  // Improved error handling using BaseError
  private checkDisposed(): void {
    if (this._isDisposed) {
      throw new TransactionAdapterError('Cannot perform operations on a disposed adapter');
    }
  }
  
  // ...rest of implementation
}
```

### 2. SignerAdapter

The `SignerAdapter` provides a consistent interface for working with signers from different Sui SDK versions:

```typescript
export interface SignerAdapter extends BaseAdapter<Signer> {
  // Core signing methods
  signData(data: Uint8Array): Promise<Uint8Array>;
  signTransaction(transaction: TransactionType): Promise<SignatureWithBytes>;
  signPersonalMessage(message: Uint8Array): Promise<SignatureWithBytes>;
  signWithIntent(message: Uint8Array, intent: IntentScope): Promise<SignatureWithBytes>;
  
  // Information methods
  getKeyScheme(): 'ED25519' | 'Secp256k1' | 'Secp256r1' | 'MultiSig' | 'ZkLogin' | 'Passkey';
  toSuiAddress(): string;
  getPublicKey(): PublicKey;
  
  // Advanced methods
  connect(client: SuiClient): SignerAdapter;
  signAndExecuteTransactionBlock(
    tx: TransactionType,
    options?: SuiTransactionBlockResponseOptions
  ): Promise<SuiTransactionBlockResponse>;
  
  // Version information
  getSDKVersion(): SuiSDKVersion;
}
```

The implementation includes proper resource management and enhanced error handling:

```typescript
export class SignerAdapterImpl implements SignerAdapter {
  // Resource management
  private _isDisposed = false;
  
  isDisposed(): boolean {
    return this._isDisposed;
  }
  
  async dispose(): Promise<void> {
    if (this._isDisposed) return;
    
    try {
      // Release connections
      this.suiClient = null;
      
      // Handle signer-specific cleanup
      if (typeof (this.signer as any).disconnect === 'function') {
        try {
          await (this.signer as any).disconnect();
        } catch (error) {
          console.warn('Error during signer disconnect:', error);
        }
      }
      
      this._isDisposed = true;
    } catch (error) {
      throw new SignerAdapterError(
        `Failed to dispose SignerAdapter: ${error instanceof Error ? error.message : String(error)}`, 
        error instanceof Error ? error : undefined
      );
    }
  }
  
  // Error checking before operations
  private checkDisposed(): void {
    if (this._isDisposed) {
      throw new SignerAdapterError('Cannot perform operations on a disposed adapter');
    }
  }
  
  // Enhanced adapter methods with proper error handling
  // ...rest of implementation
}
```

## Benefits of the New Adapter Implementation

1. **Consistent Resource Management**
   - All adapters now implement a common lifecycle management approach
   - Explicit `dispose()` method ensures resources are cleaned up properly
   - `isDisposed()` check prevents use of disposed resources

2. **Improved Error Handling**
   - Enhanced error class with context, cause, and timestamp
   - Proper propagation of underlying errors
   - Consistent error messages and error typing

3. **Type Safety**
   - Strong type guarantees for adapter interfaces
   - Type guards to ensure proper adapter usage
   - Explicit underlying implementation access

4. **Code Consistency**
   - All adapters follow the same pattern
   - Consistent method naming and behavior
   - Shared base functionality

5. **Better Compatibility**
   - Version detection and feature detection
   - Fallback mechanisms for different SDK versions
   - Consistent interface regardless of underlying implementation

These improvements address key error patterns identified in the project, including:

- Improper resource management
- Lack of disposal of connections and resources
- Unsafe type assertions without proper type guards
- Inconsistent error handling
- Missing error context for debugging

The new adapter pattern provides a solid foundation for implementing other adapters in the system, following the same principles of proper resource management, type safety, and enhanced error handling.