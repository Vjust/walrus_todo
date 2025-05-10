/**
 * Base interface for all adapters in the system.
 * Provides common functionality for adapter lifecycle management and type safety.
 */
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

/**
 * Type guard to check if an object is a BaseAdapter
 * @param obj Object to check
 * @returns true if the object is a BaseAdapter
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