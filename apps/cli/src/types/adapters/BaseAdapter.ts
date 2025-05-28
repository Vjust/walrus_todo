/**
 * Adapter Pattern - Base Interface
 *
 * This file defines the foundational BaseAdapter interface that all adapters in the system
 * must implement. The adapter pattern is used throughout this application to:
 *
 * 1. Decouple the application from external dependencies and services
 * 2. Provide a consistent interface for similar components with different implementations
 * 3. Enable safe resource management with proper disposal patterns
 * 4. Allow for easier testing by enabling mock implementations
 * 5. Support version compatibility when external APIs change
 *
 * Adapters serve as an intermediate layer between our application code and external
 * systems (like blockchain clients, AI providers, storage mechanisms, etc.), establishing
 * a contract that all adapter implementations must follow.
 *
 * @template T The type of the underlying implementation being adapted
 */
export interface BaseAdapter<T> {
  /**
   * Retrieves the underlying implementation that this adapter wraps.
   *
   * This method provides access to the actual underlying object when direct
   * access is required for operations not covered by the adapter interface.
   * Use with caution as it breaks the abstraction provided by the adapter.
   *
   * @returns The original object being adapted
   * @throws Error if the adapter has been disposed and is no longer valid
   */
  getUnderlyingImplementation(): T;

  /**
   * Releases any resources held by this adapter and invalidates it.
   *
   * This method is essential for proper resource management, especially when dealing
   * with external services that may hold connections, memory, or other limited resources.
   * Implementations should ensure all resources are properly released and the adapter
   * is marked as disposed.
   *
   * This method is idempotent and can be called multiple times safely - subsequent calls
   * after the first should be no-ops.
   *
   * @returns A promise that resolves when all resources have been released
   */
  dispose(): Promise<void>;

  /**
   * Checks whether this adapter has been disposed.
   *
   * This method allows code to verify if an adapter is still valid before using it,
   * preventing errors from attempts to use disposed resources. It should be checked
   * before performing operations if there's any possibility the adapter might have
   * been disposed.
   *
   * @returns true if the adapter has been disposed and should no longer be used,
   *          false if the adapter is still valid
   */
  isDisposed(): boolean;
}

/**
 * Type guard function to verify if an object implements the BaseAdapter interface.
 *
 * This function performs runtime verification that an unknown object correctly
 * implements the BaseAdapter interface. It's useful in scenarios where you need
 * to safely determine if an object can be treated as an adapter.
 *
 * Usage examples:
 * ```typescript
 * // Safely check if an object is an adapter before using it
 * if (isBaseAdapter(obj)) {
 *   // TypeScript now knows obj is a BaseAdapter
 *   const implementation = obj.getUnderlyingImplementation();
 * }
 *
 * // Use with array filtering
 * const adaptersOnly = mixedObjects.filter(isBaseAdapter);
 * ```
 *
 * @template T The type of the underlying implementation
 * @param obj Any object to check for adapter interface compliance
 * @returns A type predicate indicating if the object implements BaseAdapter<T>
 */
export function isBaseAdapter<T>(obj: unknown): obj is BaseAdapter<T> {
  if (!obj || typeof obj !== 'object') return false;

  const adapter = obj as Partial<BaseAdapter<T>>;

  return (
    typeof adapter.getUnderlyingImplementation === 'function' &&
    typeof adapter.dispose === 'function' &&
    typeof adapter.isDisposed === 'function'
  );
}
