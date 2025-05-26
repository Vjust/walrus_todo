/**
 * Network Error Handling Tests
 *
 * Tests the application's handling of various network-related errors
 * including timeouts, disconnections, and rate limiting.
 */

import { RetryManager } from '../../src/utils/retry-manager';
import { NetworkError } from '../../src/types/errors';
import { ErrorSimulator, ErrorType } from '../helpers/error-simulator';

describe('Network Error Handling', () => {
  // Mock network implementation
  // const _mockNetworkNode = {
  //   url: 'https://test-api.example.com',
  //   priority: 0,
  //   consecutiveFailures: 0,
  //   healthScore: 1.0,
  // };

  let retryManager: RetryManager;

  beforeEach(() => {
    jest.useFakeTimers();
    retryManager = new RetryManager(
      ['https://test-api.example.com', 'https://backup-api.example.com'],
      {
        initialDelay: 50,
        maxDelay: 1000,
        maxRetries: 3,
        maxDuration: 5000,
        timeout: 500,
      }
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('Intermittent Network Failures', () => {
    it('should retry on temporary network failures', async () => {
      // Mock a function that fails then succeeds
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce('success');

      // Execute with retry logic
      const result = await retryManager.execute(
        async () => mockOperation(),
        'test-operation'
      );

      // Fast-forward past all timeouts
      jest.runAllTimers();

      // Verify results
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should respect max retries for persistent failures', async () => {
      // Mock an operation that always fails
      const mockOperation = jest
        .fn()
        .mockRejectedValue(new Error('ECONNREFUSED'));

      // Execute with retry logic (should fail after retries)
      const promise = retryManager.execute(
        async () => mockOperation(),
        'test-operation'
      );

      // Fast-forward past all timeouts
      jest.runAllTimers();

      // Verify results
      await expect(promise).rejects.toThrow('Maximum retries');
      expect(mockOperation).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should use exponential backoff for retries', async () => {
      const mockTimers = jest.spyOn(global, 'setTimeout');

      // Mock operation that always fails
      const mockOperation = jest
        .fn()
        .mockRejectedValue(new Error('Network connection lost'));

      // Try to execute (will ultimately fail)
      const promise = retryManager
        .execute(async () => mockOperation(), 'test-operation')
        .catch(() => {}); // Catch to prevent test failure

      // Run all timers to force all retries
      jest.runAllTimers();
      await promise;

      // Verify delay timings follow exponential pattern
      const delays = mockTimers.mock.calls.map(call => call[1]);
      expect(delays[0]).toBeGreaterThan(50); // Base delay
      expect(delays[1]).toBeGreaterThan(delays[0]); // Should increase
      expect(delays[2]).toBeGreaterThan(delays[1]); // Should increase more
    });
  });

  describe('Timeout Handling', () => {
    it('should handle operation timeouts properly', async () => {
      // Mock a slow operation
      const mockOperation = jest
        .fn()
        .mockImplementation(
          () => new Promise(resolve => setTimeout(resolve, 1000))
        );

      // Execute with short timeout
      const promise = retryManager.execute(
        async () => mockOperation(),
        'test-operation'
      );

      // Fast-forward past timeout but before operation completes
      jest.advanceTimersByTime(600);

      // Should reject with timeout error
      await expect(promise).rejects.toThrow(/timeout/i);
    });

    it('should respect overall operation timeout', async () => {
      // Create retry manager with short max duration
      const shortTimeoutRetryManager = new RetryManager(
        ['https://test-api.example.com'],
        {
          maxDuration: 500,
          initialDelay: 100,
          maxRetries: 10,
        }
      );

      // Mock operation that fails but could succeed after many retries
      const mockOperation = jest
        .fn()
        .mockRejectedValue(new Error('ECONNRESET'));

      // Execute (should fail due to max duration)
      const promise = shortTimeoutRetryManager.execute(
        async () => mockOperation(),
        'test-operation'
      );

      // Fast-forward past max duration
      jest.advanceTimersByTime(600);

      // Verify it fails with timeout error
      await expect(promise).rejects.toThrow('Operation timed out');
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limit errors with appropriate backoff', async () => {
      // Mock an operation that returns rate limit errors
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce({ status: 429, message: 'Too Many Requests' })
        .mockRejectedValueOnce({ status: 429, message: 'Too Many Requests' })
        .mockResolvedValueOnce('success');

      // Create retry manager specific for rate limiting
      const rateLimitRetryManager = new RetryManager(
        ['https://test-api.example.com'],
        {
          initialDelay: 50,
          maxRetries: 5,
        }
      );

      // Execute with retry logic
      const promise = rateLimitRetryManager.execute(
        async () => mockOperation(),
        'rate-limited-operation'
      );

      // Fast-forward past all timeouts
      jest.runAllTimers();

      // Verify results
      const result = await promise;
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });
  });

  describe('Circuit Breaker Pattern', () => {
    it('should implement circuit breaker for failing nodes', async () => {
      // Create retry manager with circuit breaker
      const circuitBreakerRetryManager = new RetryManager(
        ['https://failing-api.example.com', 'https://working-api.example.com'],
        {
          initialDelay: 50,
          maxRetries: 5,
          circuitBreaker: {
            failureThreshold: 3,
            resetTimeout: 1000,
          },
        }
      );

      // Mock operations for different nodes
      const mockFailingOperation = jest
        .fn()
        .mockRejectedValue(new Error('Server error'));

      const mockWorkingOperation = jest.fn().mockResolvedValue('success');

      // Execute several operations to trigger circuit breaker
      const operations = [];
      for (let i = 0; i < 4; i++) {
        operations.push(
          circuitBreakerRetryManager
            .execute(async node => {
              if (node.url.includes('failing')) {
                return mockFailingOperation();
              } else {
                return mockWorkingOperation();
              }
            }, 'circuit-test')
            .catch(() => 'failed')
        );
      }

      // Fast-forward past all timeouts
      jest.runAllTimers();

      // Wait for all operations
      const results = await Promise.all(operations);

      // Verify circuit breaker avoided failing node after threshold
      expect(mockFailingOperation.mock.calls.length).toBeLessThan(10);
      expect(results[results.length - 1]).toBe('success');
    });
  });

  describe('Network Error Propagation', () => {
    it('should propagate specific network error details', async () => {
      // Create custom network error
      const customError = new NetworkError('Custom network failure', {
        network: 'test-network',
        operation: 'connect',
        recoverable: false,
      });

      // Mock an operation that throws this error
      const mockOperation = jest.fn().mockRejectedValue(customError);

      // Execute without retry for unrecoverable error
      await expect(
        retryManager.execute(
          async () => mockOperation(),
          'custom-error-operation'
        )
      ).rejects.toMatchObject({
        code: expect.stringContaining('NETWORK_CONNECT_ERROR'),
        shouldRetry: false,
      });
    });
  });

  describe('Error Simulation Integration', () => {
    it('should handle simulated progressive network degradation', async () => {
      // Create task that will be called multiple times
      const task = {
        performNetworkRequest: async () => 'success',
      };

      // Create progressive failure simulator
      const simulator = new ErrorSimulator({
        enabled: true,
        errorType: ErrorType.NETWORK,
        probability: 0.25,
        errorMessage: 'Simulated progressive failure',
        // Increase probability with each failure
        errorFactory: () => {
          simulator.updateConfig({
            probability: Math.min(1.0, (simulator as ErrorSimulator & { config: { probability: number } }).config.probability + 0.25),
          });
          return new NetworkError('Network degrading', {
            network: 'test',
            operation: 'request',
            recoverable: true,
          });
        },
      });

      // Apply simulator
      simulator.simulateErrorOnMethod(task, 'performNetworkRequest');

      // Track successes and failures
      const promises = Array.from({ length: 10 }, () =>
        task.performNetworkRequest().then(
          result => ({ success: true, result }),
          error => ({ success: false, error: error instanceof Error ? error.message : String(error) })
        )
      );

      const results = await Promise.all(promises);

      // Verify progressive failure pattern
      const successes = results.filter(r => r.success).length;
      const failures = results.filter(r => !r.success).length;

      // Should have some successes and some failures
      expect(successes).toBeGreaterThan(0);
      expect(failures).toBeGreaterThan(0);

      // Later requests should fail more often
      const firstHalf = results.slice(0, 5);
      const secondHalf = results.slice(5);

      const firstHalfSuccesses = firstHalf.filter(r => r.success).length;
      const secondHalfSuccesses = secondHalf.filter(r => r.success).length;

      // Second half should have fewer successes due to progressive degradation
      expect(secondHalfSuccesses).toBeLessThan(firstHalfSuccesses);
    });
  });
});
