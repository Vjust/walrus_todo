import {
  withTimeout,
  safeParallel,
  withRetry,
  TimeoutError,
  OperationError,
  RetryError,
  AggregateOperationError,
} from '../../utils/promise-utils';

describe('Promise Utilities', () => {
  // Mock console.error to avoid test output pollution
  const originalConsoleError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  // Helper function for failing tests explicitly
  const fail = (message: string) => {
    throw new Error(message);
  };

  describe('withTimeout', () => {
    it('should resolve when promise completes within timeout', async () => {
      const result = await withTimeout(
        Promise.resolve('success'),
        1000,
        'test-operation'
      );
      expect(result).toBe('success');
    });

    it('should reject with TimeoutError when promise exceeds timeout', async () => {
      // Create a promise that never resolves
      const slowPromise = new Promise(resolve => {
        setTimeout(resolve, 1000);
      });

      await expect(
        withTimeout(slowPromise, 50, 'slow-operation')
      ).rejects.toThrow(TimeoutError);

      await expect(
        withTimeout(slowPromise, 50, 'slow-operation')
      ).rejects.toMatchObject({
        name: 'TimeoutError',
        context: {
          operationName: 'slow-operation',
          timeoutMs: 50,
        },
      });
    });

    it('should propagate errors from the original promise', async () => {
      const error = new Error('Original error');
      const failingPromise = Promise.reject(error);

      await expect(
        withTimeout(failingPromise, 1000, 'failing-operation')
      ).rejects.toThrow(OperationError);

      await expect(
        withTimeout(failingPromise, 1000, 'failing-operation')
      ).rejects.toMatchObject({
        name: 'OperationError',
        context: {
          operationName: 'failing-operation',
        },
        cause: error,
      });
    });

    it('should properly clear timeouts to avoid memory leaks', async () => {
      // Mock setTimeout and clearTimeout
      const originalSetTimeout = global.setTimeout;
      const originalClearTimeout = global.clearTimeout;

      const mockSetTimeout = jest.fn().mockImplementation(() => 123);
      const mockClearTimeout = jest.fn();

      global.setTimeout = mockSetTimeout as unknown as typeof setTimeout;
      global.clearTimeout = mockClearTimeout;

      try {
        // Success case
        await withTimeout(Promise.resolve('success'), 1000, 'test');
        expect(mockClearTimeout).toHaveBeenCalledWith(123);

        mockClearTimeout.mockClear();

        // Failure case
        await expect(
          withTimeout(Promise.reject(new Error('test')), 1000, 'test')
        ).rejects.toThrow();

        expect(mockClearTimeout).toHaveBeenCalledWith(123);
      } finally {
        // Restore original timers
        global.setTimeout = originalSetTimeout;
        global.clearTimeout = originalClearTimeout;
      }
    });
  });

  describe('safeParallel', () => {
    it('should return all results when all promises succeed', async () => {
      const promises = [
        Promise.resolve('result1'),
        Promise.resolve('result2'),
        Promise.resolve('result3'),
      ];

      const results = await safeParallel(promises, 'test-parallel');
      expect(results).toEqual(['result1', 'result2', 'result3']);
    });

    it('should throw AggregateOperationError when any promise fails', async () => {
      const promises = [
        Promise.resolve('result1'),
        Promise.reject(new Error('failure')),
        Promise.resolve('result3'),
      ];

      await expect(safeParallel(promises, 'test-parallel')).rejects.toThrow(
        AggregateOperationError
      );

      await expect(
        safeParallel(promises, 'test-parallel')
      ).rejects.toMatchObject({
        name: 'AggregateOperationError',
        context: {
          operationName: 'test-parallel',
        },
      });
    });

    it('should return empty array when given empty input', async () => {
      const results = await safeParallel([], 'empty-operation');
      expect(results).toEqual([]);
    });

    it('should include all errors in the aggregate error', async () => {
      const promises = [
        Promise.reject(new Error('error1')),
        Promise.reject(new Error('error2')),
        Promise.resolve('success'),
      ];

      let thrownError: unknown;
      try {
        await safeParallel(promises, 'multiple-failures');
        throw new Error('Expected safeParallel to throw');
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(AggregateOperationError);
      const aggregateError = thrownError as AggregateOperationError;
      expect(aggregateError.errors.length).toBe(2);

      // Check that the errors are properly captured and transformed
      expect(aggregateError.errors[0]).toBeInstanceOf(OperationError);
      expect(aggregateError.errors[0]?.message).toContain('error1');
      expect(aggregateError.errors[1]).toBeInstanceOf(OperationError);
      expect(aggregateError.errors[1]?.message).toContain('error2');
    });
  });

  describe('withRetry', () => {
    beforeEach(() => {
      jest.clearAllTimers();
    });

    afterEach(() => {
      if (jest.isMockFunction(setTimeout)) {
        jest.useRealTimers();
      }
      jest.clearAllTimers();
    });

    it('should return result when function succeeds on first try', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await withRetry(fn, 3, 10, 'test-retry');

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry and succeed after failures', async () => {
      // Fail twice, then succeed
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('fail1'))
        .mockRejectedValueOnce(new Error('fail2'))
        .mockResolvedValue('success');

      jest.useFakeTimers();

      // Start the retry operation
      const promise = withRetry(fn, 3, 10, 'test-retry');

      // Fast forward all timers to complete the retry sequence
      // The implementation uses exponential backoff, so we need to advance enough time
      await jest.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    }, 10000);

    it('should fail after maximum retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('persistent failure'));

      jest.useFakeTimers();

      const retryPromise = withRetry(fn, 2, 10, 'exhausted-retries');
      
      // Fast forward all timers to complete the retry sequence
      await jest.runAllTimersAsync();

      await expect(retryPromise).rejects.toThrow(RetryError);
      
      // Create a new promise for the second expectation to avoid "Cannot read properties of undefined" error
      const retryPromise2 = withRetry(fn, 2, 10, 'exhausted-retries');
      await jest.runAllTimersAsync();
      
      await expect(retryPromise2).rejects.toMatchObject({
        name: 'RetryError',
        context: {
          operationName: 'exhausted-retries',
          maxRetries: 2,
        },
      });

      expect(fn).toHaveBeenCalledTimes(6); // 3 calls for each promise (initial + 2 retries each)

      jest.useRealTimers();
    }, 10000);

    it('should respect shouldRetry function', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('retryable'))
        .mockRejectedValueOnce(new Error('non-retryable'))
        .mockResolvedValue('success');

      const shouldRetry = (error: Error) => error.message === 'retryable';

      jest.useFakeTimers();

      const retryPromise = withRetry(fn, 3, 10, 'selective-retry', shouldRetry);
      
      // Fast forward all timers to complete the retry sequence
      await jest.runAllTimersAsync();

      await expect(retryPromise).rejects.toThrow(RetryError);
      expect(fn).toHaveBeenCalledTimes(2); // Initial + 1 retry (second error isn't retried)

      jest.useRealTimers();
    }, 10000);
  });
});
