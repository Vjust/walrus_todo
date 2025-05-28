# RetryManager Interface Mismatch Analysis

## Current RetryManager Implementation Analysis

### Constructor Signature (Implementation)
```typescript
constructor(
  private baseUrls: string[],
  private options: RetryOptions = {}
)
```

Where `RetryOptions` interface includes:
```typescript
interface RetryOptions {
  initialDelay?: number;
  maxDelay?: number;
  maxRetries?: number;
  maxDuration?: number;
  timeout?: number;
  retryableErrors?: Array<string | RegExp>;
  retryableStatuses?: number[];
  onRetry?: (error: Error, attempt: number, delay: number) => void;
  // Enhanced options
  minNodes?: number;
  healthThreshold?: number;
  adaptiveDelay?: boolean;
  circuitBreaker?: {
    failureThreshold: number;
    resetTimeout: number;
  };
  loadBalancing?: 'health' | 'round-robin' | 'priority';
}
```

### Method Signatures (Implementation)
1. **execute method**:
   ```typescript
   async execute<T>(
     operation: (node: NetworkNode) => Promise<T>,
     context: string
   ): Promise<T>
   ```

2. **retry method**:
   ```typescript
   async retry<T>(
     operation: (node: NetworkNode) => Promise<T>,
     context: string | Record<string, unknown>
   ): Promise<T>
   ```

3. **static retry method**:
   ```typescript
   static async retry<T>(
     operation: () => Promise<T>,
     options: {
       maxRetries?: number;
       initialDelay?: number;
       maxDelay?: number;
       retryableErrors?: Array<string | RegExp>;
       onRetry?: (attempt: number, error: Error, delay?: number) => void;
     } = {}
   ): Promise<T>
   ```

## Test Expectations vs Reality

### Test File: `tests/unit/utils/retry-manager.test.ts`

#### Major Mismatches Identified:

1. **Constructor Usage Mismatch**:
   - **Test expectation**: `new RetryManager(['https://example.com'])`
   - **Implementation**: Requires `baseUrls: string[]` as first parameter ✅ (This matches)

2. **execute Method Parameter Mismatch**:
   - **Test calls**: `retryManager.execute(operation)` with single parameter
   - **Test calls**: `retryManager.execute(operation, { maxRetries: 2 })` with options as second parameter
   - **Implementation expects**: `execute(operation, context: string)` - context must be a string, not options object

3. **Operation Function Signature Mismatch**:
   - **Test operations**: `jest.fn().mockResolvedValue('success')` - functions with no parameters
   - **Implementation expects**: `operation: (node: NetworkNode) => Promise<T>` - operation must accept NetworkNode parameter

4. **Options Parameter Confusion**:
   - **Tests pass options** to `execute()` method as second parameter
   - **Implementation expects** options in constructor, not in execute method

5. **Backoff Strategy Options Not Supported**:
   - Tests use: `backoffStrategy: 'fixed'`, `backoffStrategy: 'exponential'`, `baseDelay`
   - Implementation doesn't support these options in RetryOptions interface

6. **Missing Test Options**:
   - Tests use: `shouldRetry`, `jitter`, `signal`, `aggregateErrors`
   - Implementation doesn't support these in RetryOptions interface

7. **onRetry Callback Parameter Order Mismatch**:
   - **Test expectation**: `onRetry(error: Error, attempt: number)`
   - **Implementation**: `onRetry(error: Error, attempt: number, delay: number)` ✅ (This matches for instance method)
   - **Static method**: `onRetry(attempt: number, error: Error, delay?: number)` ❌ (Parameter order differs)

### Test File: `apps/cli/src/__tests__/retry-manager.test.ts`

This test file shows the **correct usage pattern**:

1. **Constructor**: `new RetryManager(testNodes, options)` ✅
2. **execute method**: `retryManager.execute(operation, 'test')` ✅ 
3. **Operation signature**: `operation: (node: NetworkNode) => Promise<T>` ✅
4. **Options in constructor**: Options passed to constructor, not execute method ✅

## Specific Parameter Type Mismatches

### 1. execute() Method Signature
- **Tests expect**: `execute(operation, options?)`
- **Implementation**: `execute(operation, context: string)`

### 2. Operation Function Type
- **Tests provide**: `() => Promise<T>`
- **Implementation expects**: `(node: NetworkNode) => Promise<T>`

### 3. Missing Interface Properties
The tests expect these RetryOptions properties not in implementation:
- `backoffStrategy: 'fixed' | 'exponential' | 'linear'`
- `baseDelay: number`
- `shouldRetry: (error: Error, attempt: number) => boolean`
- `jitter: boolean`
- `signal: AbortSignal`
- `aggregateErrors: boolean`

### 4. Static vs Instance Method Confusion
- Tests seem to expect both static and instance methods to behave identically
- Parameter orders differ between static and instance `onRetry` callbacks

## Root Cause Analysis

The main issue is that `tests/unit/utils/retry-manager.test.ts` appears to be testing an **older or different version** of RetryManager that had:

1. A different execute method signature that accepted options as second parameter
2. Different operation function signatures (no NetworkNode parameter)
3. Different RetryOptions interface with backoff strategies and other options

The `apps/cli/src/__tests__/retry-manager.test.ts` file shows the **correct current API**.

## Proposed Alignment Plan

### Option 1: Fix Tests to Match Implementation (Recommended)
1. Update `tests/unit/utils/retry-manager.test.ts` to use correct API:
   - Pass options to constructor, not execute method
   - Update operation functions to accept NetworkNode parameter
   - Remove unsupported options (backoffStrategy, baseDelay, etc.)
   - Fix execute calls to pass context string as second parameter

### Option 2: Update Implementation to Match Tests
1. Modify execute method to accept options as second parameter (breaking change)
2. Add support for missing RetryOptions properties
3. Change operation signature to not require NetworkNode (major architectural change)

### Option 3: Create Adapter/Compatibility Layer
1. Keep current implementation
2. Add backwards compatibility methods that match old test expectations
3. Gradually migrate tests to new API

## Impact Assessment

- **Option 1** is safest and maintains current architecture
- **Option 2** would require significant implementation changes and potential breaking changes
- **Option 3** adds complexity but provides transition path

## Recommendation

**Choose Option 1**: Update the failing test file to match the current implementation, using the working test file (`apps/cli/src/__tests__/retry-manager.test.ts`) as a reference for the correct API usage.