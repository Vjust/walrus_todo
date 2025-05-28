import { RetryManager } from '../../../apps/cli/src/utils/retry-manager';
import '../../../apps/cli/src/utils/polyfills/aggregate-error';

describe('RetryManager', () => {
  let retryManager: RetryManager;

  beforeEach(() => {
    // Start with default configuration using a single node URL
    retryManager = new RetryManager(['https://example.com']);
  });

  describe('successful operations', () => {
    it('should return result on first successful attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await retryManager.execute(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry and succeed after initial failure', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValue('success');

      const result = await retryManager.execute(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should succeed on last retry attempt', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValue('success');

      const result = await retryManager.execute(operation, {
        maxRetries: 2,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('failure scenarios', () => {
    it('should fail after max retries exceeded', async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new Error('Persistent failure'));

      await expect(
        retryManager.execute(operation, { maxRetries: 2 })
      ).rejects.toThrow('Persistent failure');

      expect(operation).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('should handle non-Error objects', async () => {
      const operation = jest.fn().mockRejectedValue('String error');

      await expect(
        retryManager.execute(operation, { maxRetries: 1 })
      ).rejects.toBe('String error');

      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry when maxRetries is 0', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('No retry'));

      await expect(
        retryManager.execute(operation, { maxRetries: 0 })
      ).rejects.toThrow('No retry');

      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('backoff strategies', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should use fixed backoff strategy', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValue('success');

      const promise = retryManager.execute(operation, {
        maxRetries: 2,
        backoffStrategy: 'fixed',
        baseDelay: 1000,
      });

      // First attempt
      expect(operation).toHaveBeenCalledTimes(1);

      // After first failure, wait 1000ms
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      expect(operation).toHaveBeenCalledTimes(2);

      // After second failure, wait another 1000ms
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      expect(operation).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toBe('success');
    });

    it('should use exponential backoff strategy', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockRejectedValueOnce(new Error('Failure 3'))
        .mockResolvedValue('success');

      const promise = retryManager.execute(operation, {
        maxRetries: 3,
        backoffStrategy: 'exponential',
        baseDelay: 1000,
      });

      // First attempt
      expect(operation).toHaveBeenCalledTimes(1);

      // After first failure, wait 1000ms
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      expect(operation).toHaveBeenCalledTimes(2);

      // After second failure, wait 2000ms (exponential)
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
      expect(operation).toHaveBeenCalledTimes(3);

      // After third failure, wait 4000ms (exponential)
      jest.advanceTimersByTime(4000);
      await Promise.resolve();
      expect(operation).toHaveBeenCalledTimes(4);

      const result = await promise;
      expect(result).toBe('success');
    });

    it('should use linear backoff strategy', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValue('success');

      const promise = retryManager.execute(operation, {
        maxRetries: 2,
        backoffStrategy: 'linear',
        baseDelay: 1000,
      });

      // First attempt
      expect(operation).toHaveBeenCalledTimes(1);

      // After first failure, wait 1000ms
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      expect(operation).toHaveBeenCalledTimes(2);

      // After second failure, wait 2000ms (linear)
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
      expect(operation).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toBe('success');
    });

    it('should respect maxDelay limit', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValue('success');

      const promise = retryManager.execute(operation, {
        maxRetries: 2,
        backoffStrategy: 'exponential',
        baseDelay: 5000,
        maxDelay: 6000,
      });

      // First attempt
      expect(operation).toHaveBeenCalledTimes(1);

      // After first failure, wait 5000ms
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      expect(operation).toHaveBeenCalledTimes(2);

      // After second failure, wait 6000ms (capped by maxDelay)
      jest.advanceTimersByTime(6000);
      await Promise.resolve();
      expect(operation).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toBe('success');
    });

    it('should add jitter to delays when enabled', async () => {
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockResolvedValue('success');

      const promise = retryManager.execute(operation, {
        maxRetries: 1,
        baseDelay: 1000,
        jitter: true,
      });

      // First attempt
      expect(operation).toHaveBeenCalledTimes(1);

      // After first failure, wait ~1500ms (1000 + 0.5 * 1000)
      jest.advanceTimersByTime(1500);
      await Promise.resolve();
      expect(operation).toHaveBeenCalledTimes(2);

      const result = await promise;
      expect(result).toBe('success');

      randomSpy.mockRestore();
    });
  });

  describe('shouldRetry predicate', () => {
    it('should not retry when predicate returns false', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Non-retryable'));
      const shouldRetry = jest.fn().mockReturnValue(false);

      await expect(
        retryManager.execute(operation, {
          maxRetries: 3,
          shouldRetry,
        })
      ).rejects.toThrow('Non-retryable');

      expect(operation).toHaveBeenCalledTimes(1);
      expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error), 0);
    });

    it('should retry when predicate returns true', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Retryable'))
        .mockResolvedValue('success');
      const shouldRetry = jest.fn().mockReturnValue(true);

      const result = await retryManager.execute(operation, {
        maxRetries: 3,
        shouldRetry,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
      expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error), 0);
    });

    it('should check error type in predicate', async () => {
      class RetryableError extends Error {}
      class NonRetryableError extends Error {}

      const operation = jest
        .fn()
        .mockRejectedValueOnce(new RetryableError('Retry this'))
        .mockRejectedValueOnce(new NonRetryableError('Do not retry'))
        .mockResolvedValue('success');

      const shouldRetry = (error: Error) => error instanceof RetryableError;

      await expect(
        retryManager.execute(operation, {
          maxRetries: 3,
          shouldRetry,
        })
      ).rejects.toThrow(NonRetryableError);

      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('onRetry callback', () => {
    it('should call onRetry before each retry attempt', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValue('success');

      const onRetry = jest.fn();

      await retryManager.execute(operation, {
        maxRetries: 2,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(1, expect.any(Error), 0);
      expect(onRetry).toHaveBeenNthCalledWith(2, expect.any(Error), 1);
    });

    it('should not call onRetry on initial attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const onRetry = jest.fn();

      await retryManager.execute(operation, {
        maxRetries: 2,
        onRetry,
      });

      expect(onRetry).not.toHaveBeenCalled();
    });
  });

  describe('abort signal', () => {
    it('should abort operation when signal is triggered', async () => {
      const controller = new AbortController();
      const operation = jest.fn().mockImplementation(() => {
        return new Promise((resolve, reject) => {
          setTimeout(() => resolve('success'), 1000);
          controller.signal.addEventListener('abort', () => {
            reject(new Error('Operation aborted'));
          });
        });
      });

      const promise = retryManager.execute(operation, {
        signal: controller.signal,
      });

      controller.abort();

      await expect(promise).rejects.toThrow('Operation aborted');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should not retry after abort', async () => {
      const controller = new AbortController();
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValue('success');

      const promise = retryManager.execute(operation, {
        maxRetries: 3,
        signal: controller.signal,
      });

      // Abort after first failure
      setTimeout(() => controller.abort(), 0);

      await expect(promise).rejects.toThrow('First failure');
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('error aggregation', () => {
    it('should aggregate all errors in AggregateError', async () => {
      const error1 = new Error('Failure 1');
      const error2 = new Error('Failure 2');
      const error3 = new Error('Failure 3');

      const operation = jest
        .fn()
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error2)
        .mockRejectedValue(error3);

      await expect(
        retryManager.execute(operation, 'operation-name', {
          maxRetries: 2,
          aggregateErrors: true,
        })
      ).rejects.toSatisfy((error: unknown) => {
        const AggregateErrorClass = (globalThis as { AggregateError?: typeof Error }).AggregateError;
        expect(error).toBeInstanceOf(AggregateErrorClass || Error);
        
        const isAggregateError = AggregateErrorClass && error instanceof AggregateErrorClass;
        const errors = isAggregateError ? (error as { errors: Error[] }).errors : [];
        const message = (error as Error).message;
        
        // Verify aggregate error properties when available
        expect(!isAggregateError || errors.length === 3).toBe(true);
        expect(!isAggregateError || JSON.stringify(errors) === JSON.stringify([error1, error2, error3])).toBe(true);
        expect(!isAggregateError || message.includes('Failed after 3 attempts')).toBe(true);
        
        return true;
      });
    });

    it('should not aggregate errors when disabled', async () => {
      const finalError = new Error('Final failure');
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockRejectedValue(finalError);

      await expect(
        retryManager.execute(operation, 'operation-name', {
          maxRetries: 2,
          aggregateErrors: false,
        })
      ).rejects.toBe(finalError);
    });
  });

  describe('nested retry scenarios', () => {
    it('should handle nested retry operations', async () => {
      const innerOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Inner failure'))
        .mockResolvedValue('inner success');

      const outerOperation = jest.fn().mockImplementation(async () => {
        const innerManager = new RetryManager();
        const result = await innerManager.execute(innerOperation, {
          maxRetries: 1,
        });
        return `outer: ${result}`;
      });

      const result = await retryManager.execute(outerOperation);

      expect(result).toBe('outer: inner success');
      expect(outerOperation).toHaveBeenCalledTimes(1);
      expect(innerOperation).toHaveBeenCalledTimes(2);
    });
  });

  describe('computeDelay static method', () => {
    it('should calculate exponential backoff properly', () => {
      // Mock Math.random to return a consistent value for testing
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

      // Test initial delay (attempt 1)
      let delay = RetryManager.computeDelay(1, 1000, 60000);
      expect(delay).toBeGreaterThanOrEqual(1000); // Base delay (no exponentiation yet)
      expect(delay).toBeLessThanOrEqual(1200); // With a bit of jitter

      // Test second attempt (delay should double)
      delay = RetryManager.computeDelay(2, 1000, 60000);
      expect(delay).toBeGreaterThanOrEqual(2000); // 1000 * 2^1
      expect(delay).toBeLessThanOrEqual(2400); // With a bit of jitter

      // Test third attempt (delay should double again)
      delay = RetryManager.computeDelay(3, 1000, 60000);
      expect(delay).toBeGreaterThanOrEqual(4000); // 1000 * 2^2
      expect(delay).toBeLessThanOrEqual(4800); // With a bit of jitter

      // Test max delay capping
      delay = RetryManager.computeDelay(10, 1000, 10000);
      expect(delay).toBeLessThanOrEqual(10000); // Capped at maxDelay

      randomSpy.mockRestore();
    });

    it('should never return a delay less than the initial delay', () => {
      const delay = RetryManager.computeDelay(1, 500, 10000);
      expect(delay).toBeGreaterThanOrEqual(500);
    });

    it('should never return a delay greater than the max delay', () => {
      const delay = RetryManager.computeDelay(10, 500, 5000);
      expect(delay).toBeLessThanOrEqual(5000);
    });

    it('should apply jitter correctly', () => {
      // Test with various random values to ensure jitter is applied correctly
      const mockRandom = jest.spyOn(Math, 'random');

      // Random value of 0 (minimum jitter)
      mockRandom.mockReturnValueOnce(0);
      let delay = RetryManager.computeDelay(2, 1000, 60000);
      let baseDelay = 2000; // 1000 * 2^1
      const minExpectedDelay = baseDelay - baseDelay * 0.2; // -20% jitter
      expect(delay).toBeCloseTo(minExpectedDelay, 0);

      // Random value of 1 (maximum jitter)
      mockRandom.mockReturnValueOnce(1);
      delay = RetryManager.computeDelay(2, 1000, 60000);
      baseDelay = 2000; // 1000 * 2^1
      const maxExpectedDelay = baseDelay + baseDelay * 0.2; // +20% jitter
      expect(delay).toBeCloseTo(maxExpectedDelay, 0);

      // Random value of 0.5 (middle jitter)
      mockRandom.mockReturnValueOnce(0.5);
      delay = RetryManager.computeDelay(2, 1000, 60000);
      baseDelay = 2000; // 1000 * 2^1
      // With 0.5 random, we should get exactly the baseDelay (no jitter)
      expect(delay).toBeCloseTo(baseDelay, 0);

      mockRandom.mockRestore();
    });
  });

  describe('static retry method', () => {
    it('should provide backward compatibility with the static API', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const onRetry = jest.fn();

      const result = await RetryManager.retry(operation, {
        maxRetries: 3,
        initialDelay: 100,
        onRetry,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(onRetry).not.toHaveBeenCalled();
    });

    it('should handle errors correctly with the static API', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Test error'))
        .mockResolvedValue('success');
      const onRetry = jest.fn();

      const result = await RetryManager.retry(operation, {
        maxRetries: 3,
        initialDelay: 100,
        onRetry,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledTimes(1);
      // Check that parameters are in the correct order (attempt, error)
      expect(onRetry).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Error),
        expect.any(Number)
      );
    });
  });
});
