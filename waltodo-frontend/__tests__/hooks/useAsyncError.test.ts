/**
 * Comprehensive tests for useAsyncError hook
 * Tests async operation handling, error management, and recovery mechanisms
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useAsyncError,
  useAsyncOperation,
  useMultipleAsyncErrors,
  useAsyncErrorWithDeps,
  type AsyncErrorConfig
} from '@/hooks/useAsyncError';
import { errorManager, ErrorType } from '@/lib/error-manager';
import { toastService } from '@/lib/toast-service';

// Mock dependencies
jest.mock('@/lib/error-manager', () => ({
  errorManager: {
    classify: jest.fn(),
  },
  ErrorType: {
    NETWORK: 'network',
    VALIDATION: 'validation',
    BLOCKCHAIN: 'blockchain',
    UNKNOWN: 'unknown',
  },
}));

jest.mock('@/lib/toast-service', () => ({
  toastService: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockErrorManager = errorManager as jest.Mocked<typeof errorManager>;
const mockToastService = toastService as jest.Mocked<typeof toastService>;

describe('useAsyncError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });
  
  describe('Basic Functionality', () => {
    it('should initialize with idle state', () => {
      const asyncFn = jest.fn().mockResolvedValue('success');
      const { result } = renderHook(() => useAsyncError(asyncFn));
      
      expect(result.current.isIdle).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.retryCount).toBe(0);
      expect(result.current.canRetry).toBe(false);
    });
    
    it('should handle successful async operation', async () => {
      const asyncFn = jest.fn().mockResolvedValue('success data');
      const onSuccess = jest.fn();
      const { result } = renderHook(() => useAsyncError(asyncFn, { onSuccess }));
      
      act(() => {
        result.current.execute();
      });
      
      expect(result.current.isLoading).toBe(true);
      
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      
      expect(result.current.data).toBe('success data');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(onSuccess).toHaveBeenCalledWith('success data');
      expect(mockToastService.success).toHaveBeenCalledWith('Operation completed successfully');
    });
    
    it('should handle async operation failure', async () => {
      const error = new Error('Operation failed');
      const asyncFn = jest.fn().mockRejectedValue(error);
      const onError = jest.fn();
      
      const classifiedError = {
        type: ErrorType.NETWORK,
        message: 'Operation failed',
        userMessage: 'Network error occurred',
        retryable: true,
        maxRetries: 3,
      };
      
      mockErrorManager.classify.mockReturnValue(classifiedError as any);
      
      const { result } = renderHook(() => useAsyncError(asyncFn, { onError }));
      
      act(() => {
        result.current.execute();
      });
      
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
      
      expect(result.current.error).toEqual(classifiedError);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.canRetry).toBe(true);
      expect(onError).toHaveBeenCalledWith(classifiedError);
      expect(mockToastService.error).toHaveBeenCalled();
    });
  });
  
  describe('Configuration Options', () => {
    it('should respect silent errors configuration', async () => {
      const error = new Error('Silent error');
      const asyncFn = jest.fn().mockRejectedValue(error);
      
      mockErrorManager.classify.mockReturnValue({
        type: ErrorType.VALIDATION,
        userMessage: 'Validation error',
        retryable: false,
      } as any);
      
      const { result } = renderHook(() => 
        useAsyncError(asyncFn, { silentErrors: true })
      );
      
      act(() => {
        result.current.execute();
      });
      
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
      
      expect(mockToastService.success).not.toHaveBeenCalled();
      expect(mockToastService.error).not.toHaveBeenCalled();
    });
    
    it('should disable toast notifications', async () => {
      const asyncFn = jest.fn().mockResolvedValue('success');
      
      const { result } = renderHook(() => 
        useAsyncError(asyncFn, { showToast: false })
      );
      
      act(() => {
        result.current.execute();
      });
      
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      
      expect(mockToastService.success).not.toHaveBeenCalled();
    });
    
    it('should handle custom retry configuration', async () => {
      const error = new Error('Retryable error');
      const asyncFn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');
      
      const classifiedError = {
        type: ErrorType.NETWORK,
        userMessage: 'Network error',
        retryable: true,
        maxRetries: 2,
      };
      
      mockErrorManager.classify.mockReturnValue(classifiedError as any);
      
      const onRetryAttempt = jest.fn();
      const { result } = renderHook(() => 
        useAsyncError(asyncFn, {
          autoRetry: true,
          maxRetries: 2,
          retryDelay: 100,
          onRetryAttempt,
        })
      );
      
      act(() => {
        result.current.execute();
      });
      
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
      
      expect(result.current.retryCount).toBe(0);
      expect(onRetryAttempt).toHaveBeenCalledWith(1, classifiedError);
      
      // Fast-forward retry delay
      act(() => {
        jest.advanceTimersByTime(100);
      });
      
      await waitFor(() => {
        expect(asyncFn).toHaveBeenCalledTimes(2);
      });
    });
  });
  
  describe('Retry Functionality', () => {
    it('should allow manual retry', async () => {
      const error = new Error('Retry test');
      const asyncFn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success after retry');
      
      const classifiedError = {
        type: ErrorType.NETWORK,
        userMessage: 'Network error',
        retryable: true,
        maxRetries: 3,
      };
      
      mockErrorManager.classify.mockReturnValue(classifiedError as any);
      
      const { result } = renderHook(() => useAsyncError(asyncFn));
      
      // Initial execution
      act(() => {
        result.current.execute();
      });
      
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
      
      expect(result.current.canRetry).toBe(true);
      
      // Manual retry
      act(() => {
        result.current.retry();
      });
      
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      
      expect(result.current.data).toBe('success after retry');
      expect(result.current.retryCount).toBe(1);
    });
    
    it('should prevent retry when not retryable', async () => {
      const error = new Error('Non-retryable error');
      const asyncFn = jest.fn().mockRejectedValue(error);
      
      const classifiedError = {
        type: ErrorType.VALIDATION,
        userMessage: 'Validation error',
        retryable: false,
        maxRetries: 3,
      };
      
      mockErrorManager.classify.mockReturnValue(classifiedError as any);
      
      const { result } = renderHook(() => useAsyncError(asyncFn));
      
      act(() => {
        result.current.execute();
      });
      
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
      
      expect(result.current.canRetry).toBe(false);
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      act(() => {
        result.current.retry();
      });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Cannot retry: operation is not retryable or max retries reached'
      );
      
      consoleSpy.mockRestore();
    });
    
    it('should respect max retry limit', async () => {
      const error = new Error('Max retry test');
      const asyncFn = jest.fn().mockRejectedValue(error);
      
      const classifiedError = {
        type: ErrorType.NETWORK,
        userMessage: 'Network error',
        retryable: true,
        maxRetries: 2,
      };
      
      mockErrorManager.classify.mockReturnValue(classifiedError as any);
      
      const onGiveUp = jest.fn();
      const { result } = renderHook(() => 
        useAsyncError(asyncFn, { maxRetries: 2, onGiveUp })
      );
      
      // Initial attempt + 2 retries = 3 total attempts
      act(() => {
        result.current.execute();
      });
      
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
      
      // First retry
      act(() => {
        result.current.retry();
      });
      
      await waitFor(() => {
        expect(result.current.retryCount).toBe(1);
      });
      
      // Second retry (max reached)
      act(() => {
        result.current.retry();
      });
      
      await waitFor(() => {
        expect(result.current.retryCount).toBe(2);
      });
      
      expect(result.current.canRetry).toBe(false);
      expect(onGiveUp).toHaveBeenCalledWith(classifiedError);
    });
  });
  
  describe('State Management', () => {
    it('should reset state correctly', async () => {
      const asyncFn = jest.fn().mockResolvedValue('data');
      const { result } = renderHook(() => useAsyncError(asyncFn));
      
      act(() => {
        result.current.execute();
      });
      
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      
      act(() => {
        result.current.reset();
      });
      
      expect(result.current.isIdle).toBe(true);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.retryCount).toBe(0);
      expect(result.current.canRetry).toBe(false);
    });
    
    it('should cancel ongoing operations', async () => {
      let resolvePromise: (value: string) => void;
      const promise = new Promise<string>((resolve) => {
        resolvePromise = resolve;
      });
      
      const asyncFn = jest.fn().mockReturnValue(promise);
      const { result } = renderHook(() => useAsyncError(asyncFn));
      
      act(() => {
        result.current.execute();
      });
      
      expect(result.current.isLoading).toBe(true);
      
      act(() => {
        result.current.cancel();
      });
      
      expect(result.current.isLoading).toBe(false);
      
      // Resolve the promise after cancellation
      act(() => {
        resolvePromise('late result');
      });
      
      // Should not update state after cancellation
      await waitFor(() => {
        expect(result.current.data).toBeNull();
      });
    });
  });
  
  describe('Component Lifecycle', () => {
    it('should cleanup on unmount', async () => {
      let resolvePromise: (value: string) => void;
      const promise = new Promise<string>((resolve) => {
        resolvePromise = resolve;
      });
      
      const asyncFn = jest.fn().mockReturnValue(promise);
      const { result, unmount } = renderHook(() => useAsyncError(asyncFn));
      
      act(() => {
        result.current.execute();
      });
      
      expect(result.current.isLoading).toBe(true);
      
      unmount();
      
      // Resolve promise after unmount
      act(() => {
        resolvePromise('result after unmount');
      });
      
      // Should not cause any errors or state updates
    });
  });
  
  describe('Error Edge Cases', () => {
    it('should handle non-Error objects', async () => {
      const nonErrorObject = { message: 'Not an Error instance' };
      const asyncFn = jest.fn().mockRejectedValue(nonErrorObject);
      
      mockErrorManager.classify.mockReturnValue({
        type: ErrorType.UNKNOWN,
        userMessage: 'Unknown error',
        retryable: true,
      } as any);
      
      const { result } = renderHook(() => useAsyncError(asyncFn));
      
      act(() => {
        result.current.execute();
      });
      
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
      
      expect(mockErrorManager.classify).toHaveBeenCalledWith(
        expect.any(Error),
        expect.any(Object)
      );
    });
    
    it('should handle string errors', async () => {
      const stringError = 'String error message';
      const asyncFn = jest.fn().mockRejectedValue(stringError);
      
      mockErrorManager.classify.mockReturnValue({
        type: ErrorType.UNKNOWN,
        userMessage: 'Unknown error',
        retryable: false,
      } as any);
      
      const { result } = renderHook(() => useAsyncError(asyncFn));
      
      act(() => {
        result.current.execute();
      });
      
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
      
      expect(mockErrorManager.classify).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'String error message',
        }),
        expect.any(Object)
      );
    });
  });
});

describe('useAsyncOperation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should execute different async functions', async () => {
    const { result } = renderHook(() => useAsyncOperation());
    
    const [executeAsync, state] = result.current;
    
    expect(state.isIdle).toBe(true);
    
    const asyncFn1 = jest.fn().mockResolvedValue('result1');
    
    let returnedData: any;
    await act(async () => {
      returnedData = await executeAsync(asyncFn1);
    });
    
    expect(returnedData).toBe('result1');
    expect(state.isSuccess).toBe(true);
  });
});

describe('useMultipleAsyncErrors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should handle multiple async operations', async () => {
    const operations = {
      fetchUsers: jest.fn().mockResolvedValue('users'),
      fetchPosts: jest.fn().mockResolvedValue('posts'),
      fetchComments: jest.fn().mockResolvedValue('comments'),
    };
    
    const { result } = renderHook(() => useMultipleAsyncErrors(operations));
    
    expect(result.current.isAnyLoading).toBe(false);
    expect(result.current.hasAnyError).toBe(false);
    expect(result.current.allSuccessful).toBe(false);
    
    act(() => {
      result.current.executeAll();
    });
    
    await waitFor(() => {
      expect(result.current.allSuccessful).toBe(true);
    });
    
    expect(result.current.fetchUsers.data).toBe('users');
    expect(result.current.fetchPosts.data).toBe('posts');
    expect(result.current.fetchComments.data).toBe('comments');
  });
  
  it('should handle mixed success and failure', async () => {
    const operations = {
      success: jest.fn().mockResolvedValue('success'),
      failure: jest.fn().mockRejectedValue(new Error('failure')),
    };
    
    mockErrorManager.classify.mockReturnValue({
      type: ErrorType.UNKNOWN,
      userMessage: 'Error occurred',
      retryable: true,
    } as any);
    
    const { result } = renderHook(() => useMultipleAsyncErrors(operations));
    
    act(() => {
      result.current.executeAll();
    });
    
    await waitFor(() => {
      expect(result.current.success.isSuccess).toBe(true);
    });
    
    await waitFor(() => {
      expect(result.current.failure.isError).toBe(true);
    });
    
    expect(result.current.hasAnyError).toBe(true);
    expect(result.current.allSuccessful).toBe(false);
  });
  
  it('should reset all operations', async () => {
    const operations = {
      op1: jest.fn().mockResolvedValue('data1'),
      op2: jest.fn().mockResolvedValue('data2'),
    };
    
    const { result } = renderHook(() => useMultipleAsyncErrors(operations));
    
    act(() => {
      result.current.executeAll();
    });
    
    await waitFor(() => {
      expect(result.current.allSuccessful).toBe(true);
    });
    
    act(() => {
      result.current.resetAll();
    });
    
    expect(result.current.op1.isIdle).toBe(true);
    expect(result.current.op2.isIdle).toBe(true);
    expect(result.current.allSuccessful).toBe(false);
  });
});

describe('useAsyncErrorWithDeps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should re-execute when dependencies change', async () => {
    const asyncFn = jest.fn().mockResolvedValue('data');
    let deps = ['dep1'];
    
    const { result, rerender } = renderHook(
      ({ dependencies }) => useAsyncErrorWithDeps(asyncFn, dependencies),
      { initialProps: { dependencies: deps } }
    );
    
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    
    expect(asyncFn).toHaveBeenCalledTimes(1);
    
    // Change dependencies
    deps = ['dep2'];
    rerender({ dependencies: deps });
    
    await waitFor(() => {
      expect(asyncFn).toHaveBeenCalledTimes(2);
    });
  });
  
  it('should not re-execute when dependencies remain the same', async () => {
    const asyncFn = jest.fn().mockResolvedValue('data');
    const deps = ['dep1'];
    
    const { result, rerender } = renderHook(
      ({ dependencies }) => useAsyncErrorWithDeps(asyncFn, dependencies),
      { initialProps: { dependencies: deps } }
    );
    
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    
    expect(asyncFn).toHaveBeenCalledTimes(1);
    
    // Rerender with same dependencies
    rerender({ dependencies: deps });
    
    // Should not execute again
    expect(asyncFn).toHaveBeenCalledTimes(1);
  });
});
