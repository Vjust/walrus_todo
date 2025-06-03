/**
 * useAsyncError Hook
 * Provides consistent async operation handling with error management,
 * loading states, and recovery mechanisms
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { type ClassifiedError, errorManager, ErrorType, RecoveryStrategy } from '@/lib/error-manager';
import { toastService } from '@/lib/toast-service';

// Hook configuration interfaces
export interface AsyncErrorConfig {
  showToast?: boolean;
  autoRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  silentErrors?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: ClassifiedError) => void;
  onRetryAttempt?: (attempt: number, error: ClassifiedError) => void;
  onGiveUp?: (error: ClassifiedError) => void;
}

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: ClassifiedError | null;
  retryCount: number;
  canRetry: boolean;
}

export interface AsyncActions {
  execute: () => Promise<void>;
  retry: () => Promise<void>;
  reset: () => void;
  cancel: () => void;
}

export interface UseAsyncErrorReturn<T> extends AsyncState<T>, AsyncActions {
  isIdle: boolean;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
}

// Default configuration
const DEFAULT_CONFIG: Required<AsyncErrorConfig> = {
  showToast: true,
  autoRetry: false,
  maxRetries: 3,
  retryDelay: 1000,
  silentErrors: false,
  onSuccess: () => {},
  onError: () => {},
  onRetryAttempt: () => {},
  onGiveUp: () => {}
};

/**
 * Hook for handling async operations with comprehensive error management
 */
export function useAsyncError<T = any>(
  asyncFunction: () => Promise<T>,
  config: AsyncErrorConfig = {}
): UseAsyncErrorReturn<T> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // State management
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
    retryCount: 0,
    canRetry: false
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Cancel current operation
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    if (mountedRef.current) {
      setState(prev => ({
        ...prev,
        loading: false
      }));
    }
  }, []);

  // Reset state
  const reset = useCallback(() => {
    cancel();
    
    if (mountedRef.current) {
      setState({
        data: null,
        loading: false,
        error: null,
        retryCount: 0,
        canRetry: false
      });
    }
  }, [cancel]);

  // Delay function for retries
  const delay = useCallback((ms: number): Promise<void> => {
    return new Promise(resolve => {
      const timeoutId = setTimeout(resolve, ms);
      
      // Cancel delay if component unmounts or operation is cancelled
      if (abortControllerRef.current) {
        abortControllerRef.current.signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          resolve();
        });
      }
    });
  }, []);

  // Execute async operation with error handling
  const executeOperation = useCallback(async (isRetry = false): Promise<void> => {
    if (!mountedRef.current) {return;}

    // Cancel any existing operation
    if (abortControllerRef.current && !isRetry) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      setState(prev => ({
        ...prev,
        loading: true,
        error: isRetry ? prev.error : null
      }));

      // Execute the async function
      const result = await asyncFunction();

      // Check if operation was cancelled
      if (abortControllerRef.current.signal.aborted || !mountedRef.current) {
        return;
      }

      // Success
      setState(prev => ({
        ...prev,
        data: result,
        loading: false,
        error: null,
        canRetry: false
      }));

      mergedConfig.onSuccess(result);

      // Show success toast if configured
      if (mergedConfig.showToast && !mergedConfig.silentErrors) {
        toastService.success('Operation completed successfully');
      }

    } catch (error) {
      if (abortControllerRef.current?.signal.aborted || !mountedRef.current) {
        return;
      }

      // Classify the error
      const classifiedError = errorManager.classify(
        error instanceof Error ? error : new Error(String(error)),
        { operation: asyncFunction.name, isRetry }
      );

      const canRetry = isRetryableError(classifiedError) && 
        state.retryCount < mergedConfig.maxRetries;

      setState(prev => ({
        ...prev,
        loading: false,
        error: classifiedError,
        retryCount: isRetry ? prev.retryCount + 1 : 0,
        canRetry
      }));

      // Call error callback
      mergedConfig.onError(classifiedError);

      // Handle automatic retry
      if (mergedConfig.autoRetry && canRetry && !isRetry) {
        mergedConfig.onRetryAttempt(state.retryCount + 1, classifiedError);
        
        // Wait before retrying
        await delay(mergedConfig.retryDelay);
        
        if (mountedRef.current && !abortControllerRef.current?.signal.aborted) {
          await executeOperation(true);
        }
      } else if (state.retryCount >= mergedConfig.maxRetries) {
        // Max retries reached
        mergedConfig.onGiveUp(classifiedError);
      }

      // Show error toast if configured
      if (mergedConfig.showToast && !mergedConfig.silentErrors) {
        toastService.error(classifiedError.userMessage, {
          actions: canRetry ? [{
            label: 'Retry',
            action: () => executeOperation(true),
            style: 'primary' as const
          }] : undefined
        });
      }
    }
  }, [asyncFunction, mergedConfig, state.retryCount, delay]);

  // Execute function (external call)
  const execute = useCallback(async (): Promise<void> => {
    await executeOperation(false);
  }, [executeOperation]);

  // Retry function
  const retry = useCallback(async (): Promise<void> => {
    if (!state.canRetry) {
      console.warn('Cannot retry: operation is not retryable or max retries reached');
      return;
    }

    mergedConfig.onRetryAttempt(state.retryCount + 1, state.error!);
    await executeOperation(true);
  }, [executeOperation, state.canRetry, state.retryCount, state.error, mergedConfig]);

  // Computed state flags
  const isIdle = !state.loading && !state.error && !state.data;
  const isLoading = state.loading;
  const isError = !!state.error;
  const isSuccess = !!state.data && !state.error && !state.loading;

  return {
    // State
    ...state,
    
    // Computed flags
    isIdle,
    isLoading,
    isError,
    isSuccess,
    
    // Actions
    execute,
    retry,
    reset,
    cancel
  };
}

/**
 * Hook for handling async operations with promise resolution tracking
 */
export function useAsyncOperation<T = any>(
  config: AsyncErrorConfig = {}
): [
  (asyncFn: () => Promise<T>) => Promise<T | null>,
  AsyncState<T> & { isIdle: boolean; isLoading: boolean; isError: boolean; isSuccess: boolean }
] {
  const [currentAsyncFn, setCurrentAsyncFn] = useState<(() => Promise<T>) | null>(null);
  const asyncResult = useAsyncError(currentAsyncFn || (() => Promise.resolve(null as any)), config);

  const executeAsync = useCallback(async (asyncFn: () => Promise<T>): Promise<T | null> => {
    setCurrentAsyncFn(() => asyncFn);
    await asyncResult.execute();
    return asyncResult.data;
  }, [asyncResult]);

  return [executeAsync, asyncResult];
}

/**
 * Hook for handling multiple async operations with individual error states
 */
export function useMultipleAsyncErrors<T extends Record<string, () => Promise<any>>>(
  operations: T,
  config: AsyncErrorConfig = {}
): {
  [K in keyof T]: UseAsyncErrorReturn<Awaited<ReturnType<T[K]>>>;
} & {
  executeAll: () => Promise<void>;
  resetAll: () => void;
  isAnyLoading: boolean;
  hasAnyError: boolean;
  allSuccessful: boolean;
} {
  const results = Object.keys(operations).reduce((acc, key) => {
    acc[key] = useAsyncError(operations[key], config);
    return acc;
  }, {} as any);

  const executeAll = useCallback(async () => {
    await Promise.all(
      Object.values(results).map((result: any) => result.execute())
    );
  }, [results]);

  const resetAll = useCallback(() => {
    Object.values(results).forEach((result: any) => result.reset());
  }, [results]);

  // Computed states
  const isAnyLoading = Object.values(results).some((result: any) => result.isLoading);
  const hasAnyError = Object.values(results).some((result: any) => result.isError);
  const allSuccessful = Object.values(results).every((result: any) => result.isSuccess);

  return {
    ...results,
    executeAll,
    resetAll,
    isAnyLoading,
    hasAnyError,
    allSuccessful
  };
}

/**
 * Utility function to determine if an error is retryable
 */
function isRetryableError(error: ClassifiedError): boolean {
  // Network errors are generally retryable
  if (error.type === ErrorType.NETWORK) {
    return true;
  }

  // Blockchain errors might be retryable depending on the specific error
  if (error.type === ErrorType.BLOCKCHAIN) {
    const message = error.message.toLowerCase();
    
    // Non-retryable blockchain errors
    if (
      message.includes('insufficient funds') ||
      message.includes('invalid signature') ||
      message.includes('unauthorized') ||
      message.includes('forbidden')
    ) {
      return false;
    }
    
    return true;
  }

  // Storage errors are often retryable
  if (error.type === ErrorType.STORAGE) {
    return true;
  }

  // Rate limit errors should be retryable with delay
  if (error.type === ErrorType.RATE_LIMIT) {
    return true;
  }

  // Validation and permission errors are not retryable
  if (
    error.type === ErrorType.VALIDATION ||
    error.type === ErrorType.PERMISSION ||
    error.type === ErrorType.AUTHENTICATION
  ) {
    return false;
  }

  // Default to retryable for unknown errors
  return true;
}

/**
 * Hook for handling async operations with automatic dependency invalidation
 */
export function useAsyncErrorWithDeps<T = any>(
  asyncFunction: () => Promise<T>,
  dependencies: readonly unknown[],
  config: AsyncErrorConfig = {}
): UseAsyncErrorReturn<T> {
  const result = useAsyncError(asyncFunction, config);

  // Re-execute when dependencies change
  useEffect(() => {
    result.execute();
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps

  return result;
}