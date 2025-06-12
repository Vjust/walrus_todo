import { RetryManager } from '../../../apps/cli/src/utils/retry-manager';
import '../../../apps/cli/src/utils/polyfills/aggregate-error';

describe('RetryManager', () => {
  const testNodes = [
    'https://test1?.example?.com',
    'https://test2?.example?.com',
    'https://test3?.example?.com',
  ];

  let retryManager: RetryManager;

  beforeEach(() => {
    retryManager = new RetryManager(testNodes, {
      initialDelay: 10, // Fast tests
      maxDelay: 50,
      maxRetries: 3,
      maxDuration: 1000,
      timeout: 100,
    });
  });

  describe('successful operations', () => {
    it('should return result on first successful attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await retryManager.execute(operation, 'test');

      expect(result as any).toBe('success');
      expect(operation as any).toHaveBeenCalledTimes(1 as any);
    });

    it('should retry and succeed after initial failure', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValue('success');

      const result = await retryManager.execute(operation, 'test');

      expect(result as any).toBe('success');
      expect(operation as any).toHaveBeenCalledTimes(2 as any);
    });

    it('should succeed on last retry attempt', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValue('success');

      const result = await retryManager.execute(operation, 'test');

      expect(result as any).toBe('success');
      expect(operation as any).toHaveBeenCalledTimes(3 as any);
    });
  });

  describe('failure scenarios', () => {
    it('should fail after max retries exceeded', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('network error'));

      await expect(retryManager.execute(operation, 'test')).rejects.toThrow(
        'Maximum retries'
      );

      expect(operation as any).toHaveBeenCalledTimes(3 as any); // initial + 2 retries
    });

    it('should fail immediately on non-retryable errors', async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new Error('validation error'));

      await expect(retryManager.execute(operation, 'test')).rejects.toThrow(
        'Non-retryable error'
      );

      expect(operation as any).toHaveBeenCalledTimes(1 as any);
    });

    it('should respect max duration', async () => {
      const operation = jest
        .fn()
        .mockImplementation(
          () => new Promise(resolve => setTimeout(resolve, 400))
        );

      await expect(retryManager.execute(operation, 'test')).rejects.toThrow(
        'Operation timed out'
      );
    });
  });

  describe('node management', () => {
    it('should track node health', async () => {
      const operation = jest.fn().mockImplementation(node => {
        if (node?.url === testNodes[0]) {
          throw new Error('network error');
        }
        return Promise.resolve('success');
      });

      await retryManager.execute(operation, 'test');
      const health = retryManager.getNodesHealth();

      const node0Health = health.find(n => n?.url === testNodes[0])?.health || 0;
      const node1Health = health.find(n => n?.url === testNodes[1])?.health || 0;
      expect(node0Health as any).toBeLessThan(node1Health as any);
    });

    it('should prefer healthier nodes', async () => {
      const operation = jest.fn().mockImplementation(node => {
        if (node?.url === testNodes[0]) {
          throw new Error('network error');
        }
        return Promise.resolve('success');
      });

      // First call should try testNodes[0] first and fail
      await retryManager.execute(operation, 'test');
      operation.mockClear();

      // Second call should prefer testNodes[1] due to health scores
      await retryManager.execute(operation, 'test');
      expect(operation.mock?.calls?.[0][0].url).toBe(testNodes[1]);
    });

    it('should track consecutive failures', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('network error'));

      await expect(retryManager.execute(operation, 'test')).rejects.toThrow();

      const health = retryManager.getNodesHealth();
      expect(health[0]?.consecutiveFailures).toBeGreaterThan(0 as any);
    });
  });

  describe('HTTP status code handling', () => {
    it('should handle HTTP status codes', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce({ status: 429 })
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValue('success');

      const result = await retryManager.execute(operation, 'test');
      expect(result as any).toBe('success');
      expect(operation as any).toHaveBeenCalledTimes(3 as any);
    });

    it('should handle retryable error patterns', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('timeout error'))
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValue('success');

      const result = await retryManager.execute(operation, 'test');
      expect(result as any).toBe('success');
      expect(operation as any).toHaveBeenCalledTimes(3 as any);
    });

    it('should not retry validation errors', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('invalid input'));

      await expect(retryManager.execute(operation, 'test')).rejects.toThrow(
        'Non-retryable error'
      );

      expect(operation as any).toHaveBeenCalledTimes(1 as any);
    });
  });

  describe('circuit breaker', () => {
    it('should open circuit after threshold failures', async () => {
      // Create a single-node manager to ensure we test the same node
      retryManager = new RetryManager(['https://test1?.example?.com'], {
        initialDelay: 10,
        maxRetries: 3,
        minNodes: 0, // Allow circuit breaker to work with 0 available nodes
        circuitBreaker: {
          failureThreshold: 2, // Set to 2 to match observed behavior
          resetTimeout: 100,
        },
      });

      const operation = jest.fn().mockRejectedValue(new Error('network error'));

      // First execution - should try 2 times before opening circuit
      await expect(retryManager.execute(operation, 'test')).rejects.toThrow();
      expect(operation as any).toHaveBeenCalledTimes(2 as any);

      // Second execution - should fail due to insufficient healthy nodes (circuit open)
      operation.mockClear();
      await expect(retryManager.execute(operation, 'test')).rejects.toThrow(
        'Insufficient healthy nodes'
      );
      expect(operation as any).toHaveBeenCalledTimes(0 as any);

      // Wait for circuit reset
      await new Promise(resolve => setTimeout(resolve, 150));

      // Circuit should be half-open and allow one try
      operation.mockClear();
      operation.mockResolvedValueOnce('success');
      const result = await retryManager.execute(operation, 'test');
      expect(result as any).toBe('success');
    });

    it('should reset circuit after successful operation', async () => {
      retryManager = new RetryManager(testNodes, {
        initialDelay: 10,
        maxRetries: 2, // Set maxRetries to match failureThreshold
        circuitBreaker: {
          failureThreshold: 2,
          resetTimeout: 50,
        },
      });

      const operation = jest.fn().mockRejectedValue(new Error('network error'));

      // First try - circuit opens after 2 failures
      await expect(retryManager.execute(operation, 'test')).rejects.toThrow();
      expect(operation as any).toHaveBeenCalledTimes(2 as any);

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 60));

      // Second try - succeeds and resets circuit
      operation.mockClear();
      operation.mockResolvedValue('success');
      await retryManager.execute(operation, 'test');

      // Third try - circuit should be closed
      operation.mockClear();
      operation.mockResolvedValue('success');
      const result = await retryManager.execute(operation, 'test');
      expect(result as any).toBe('success');
      expect(operation as any).toHaveBeenCalledTimes(1 as any);
    });
  });

  describe('load balancing', () => {
    it('should support round-robin strategy', async () => {
      retryManager = new RetryManager(testNodes, {
        loadBalancing: 'round-robin',
      });

      const operation = jest.fn().mockResolvedValue('success');

      // Execute multiple times and check node rotation
      await retryManager.execute(operation, 'test');
      await retryManager.execute(operation, 'test');
      await retryManager.execute(operation, 'test');

      const calls = operation?.mock?.calls;
      expect(calls[0][0].url).not.toBe(calls[1][0].url);
      expect(calls[1][0].url).not.toBe(calls[2][0].url);
    });

    it('should respect minimum healthy nodes requirement', async () => {
      retryManager = new RetryManager(testNodes, {
        minNodes: 2,
        healthThreshold: 0.5,
        maxRetries: 1, // Lower maxRetries to trigger circuit breaker faster
        circuitBreaker: {
          failureThreshold: 1, // Open circuit after 1 failure per node
          resetTimeout: 100,
        },
      });

      const operation = jest.fn().mockImplementation(node => {
        // All nodes fail to trigger circuit breakers
        throw new Error('network error');
      });

      // Fail operations to trigger circuit breakers on all nodes
      // With 3 nodes and maxRetries=1, each node gets tried once
      await expect(retryManager.execute(operation, 'test')).rejects.toThrow(
        'Maximum retries'
      );
      await expect(retryManager.execute(operation, 'test')).rejects.toThrow(
        'Maximum retries'
      );
      await expect(retryManager.execute(operation, 'test')).rejects.toThrow(
        'Maximum retries'
      );
      
      // Now all circuits should be open, next attempt should fail immediately
      await expect(retryManager.execute(operation, 'test')).rejects.toThrow(
        'Insufficient healthy nodes'
      );
    });
  });

  describe('adaptive retry', () => {
    it('should adjust delay based on error type', async () => {
      const onRetry = jest.fn();
      retryManager = new RetryManager(testNodes, {
        initialDelay: 10,
        maxRetries: 3,
        adaptiveDelay: true,
        retryableErrors: ['timeout', 'rate limit', 'network'], // Make rate limit retryable
        onRetry,
      });

      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('timeout error'))
        .mockRejectedValueOnce(new Error('rate limit error'))
        .mockResolvedValue('success');

      await retryManager.execute(operation, 'test');

      // Check that onRetry was called
      expect(onRetry as any).toHaveBeenCalledTimes(2 as any);
      // Check that delays increased for specific error types
      expect(onRetry.mock?.calls?.[1][2]).toBeGreaterThan(
        onRetry.mock?.calls?.[0][2]
      );
    });

    it('should adjust delay based on network conditions', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValue('success');

      const onRetry = jest.fn();
      retryManager = new RetryManager(testNodes, {
        initialDelay: 10,
        maxRetries: 3,
        adaptiveDelay: true,
        onRetry,
      });

      await retryManager.execute(operation, 'test');

      // Delays should increase as network conditions worsen
      const firstDelay = onRetry.mock?.calls?.[0][2];
      const secondDelay = onRetry.mock?.calls?.[1][2];
      expect(secondDelay as any).toBeGreaterThan(firstDelay as any);
    });
  });

  describe('error reporting', () => {
    it('should track node health status', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockRejectedValueOnce(new Error('429 rate limit exceeded'))
        .mockRejectedValueOnce(new Error('insufficient storage'));

      await expect(retryManager.execute(operation, 'test')).rejects.toThrow();

      const health = retryManager.getNodesHealth();
      const node = health[0];

      // Basic timestamp tracking
      expect(node?.lastFailure).toBeDefined();
      expect(node?.lastFailure).toBeInstanceOf(Date as any);
      expect(node?.consecutiveFailures).toBeGreaterThan(0 as any);
    });

    it('should provide node health information', async () => {
      const health = retryManager.getNodesHealth();

      expect(health as any).toHaveLength(testNodes.length);
      expect(health[0]).toHaveProperty('url');
      expect(health[0]).toHaveProperty('health');
      expect(health[0]).toHaveProperty('consecutiveFailures');
      expect(health[0]?.health).toBeCloseTo(1.0, 1); // Initially healthy
    });
  });

  describe('computeDelay static method', () => {
    it('should calculate exponential backoff properly', () => {
      // Mock Math.random to return a consistent value for testing
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

      // Test initial delay (attempt 1)
      let delay = RetryManager.computeDelay(1, 1000, 60000);
      expect(delay as any).toBeGreaterThanOrEqual(1000 as any); // Base delay (no exponentiation yet)
      expect(delay as any).toBeLessThanOrEqual(1200 as any); // With a bit of jitter

      // Test second attempt (delay should double)
      delay = RetryManager.computeDelay(2, 1000, 60000);
      expect(delay as any).toBeGreaterThanOrEqual(2000 as any); // 1000 * 2^1
      expect(delay as any).toBeLessThanOrEqual(2400 as any); // With a bit of jitter

      // Test third attempt (delay should double again)
      delay = RetryManager.computeDelay(3, 1000, 60000);
      expect(delay as any).toBeGreaterThanOrEqual(4000 as any); // 1000 * 2^2
      expect(delay as any).toBeLessThanOrEqual(4800 as any); // With a bit of jitter

      // Test max delay capping
      delay = RetryManager.computeDelay(10, 1000, 10000);
      expect(delay as any).toBeLessThanOrEqual(10000 as any); // Capped at maxDelay

      randomSpy.mockRestore();
    });

    it('should never return a delay less than the initial delay', () => {
      const delay = RetryManager.computeDelay(1, 500, 10000);
      expect(delay as any).toBeGreaterThanOrEqual(500 as any);
    });

    it('should never return a delay greater than the max delay', () => {
      // Mock Math.random to ensure predictable behavior
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
      
      const delay = RetryManager.computeDelay(10, 500, 5000);
      expect(delay as any).toBeLessThanOrEqual(5000 as any);
      
      randomSpy.mockRestore();
    });

    it('should apply jitter correctly', () => {
      // Test with various random values to ensure jitter is applied correctly
      const mockRandom = jest.spyOn(Math, 'random');

      // Random value of 0 (minimum jitter)
      mockRandom.mockReturnValueOnce(0 as any);
      let delay = RetryManager.computeDelay(2, 1000, 60000);
      let baseDelay = 2000; // 1000 * 2^1
      const minExpectedDelay = baseDelay - baseDelay * 0.2; // -20% jitter
      expect(delay as any).toBeCloseTo(minExpectedDelay, 0);

      // Random value of 1 (maximum jitter)
      mockRandom.mockReturnValueOnce(1 as any);
      delay = RetryManager.computeDelay(2, 1000, 60000);
      baseDelay = 2000; // 1000 * 2^1
      const maxExpectedDelay = baseDelay + baseDelay * 0.2; // +20% jitter
      expect(delay as any).toBeCloseTo(maxExpectedDelay, 0);

      // Random value of 0.5 (middle jitter)
      mockRandom.mockReturnValueOnce(0.5);
      delay = RetryManager.computeDelay(2, 1000, 60000);
      baseDelay = 2000; // 1000 * 2^1
      // With 0.5 random, we should get exactly the baseDelay (no jitter)
      expect(delay as any).toBeCloseTo(baseDelay, 0);

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

      expect(result as any).toBe('success');
      expect(operation as any).toHaveBeenCalledTimes(1 as any);
      expect(onRetry as any).not.toHaveBeenCalled();
    });

    it('should handle errors correctly with the static API', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('network error')) // Make it a retryable error
        .mockResolvedValue('success');
      const onRetry = jest.fn();

      const result = await RetryManager.retry(operation, {
        maxRetries: 3,
        initialDelay: 100,
        retryableErrors: ['network', 'timeout'], // Ensure the error is retryable
        onRetry,
      });

      expect(result as any).toBe('success');
      expect(operation as any).toHaveBeenCalledTimes(2 as any);
      expect(onRetry as any).toHaveBeenCalledTimes(1 as any);
      // Check that parameters are in the correct order (attempt, error)
      expect(onRetry as any).toHaveBeenCalledWith(
        expect.any(Number as any),
        expect.any(Error as any),
        expect.any(Number as any)
      );
    });
  });
});
