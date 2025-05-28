import { RetryManager } from '../../../apps/cli/src/utils/retry-manager';
import '../../../apps/cli/src/utils/polyfills/aggregate-error';

describe('RetryManager', () => {
  const testNodes = [
    'https://test1.example.com',
    'https://test2.example.com',
    'https://test3.example.com',
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

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry and succeed after initial failure', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValue('success');

      const result = await retryManager.execute(operation, 'test');

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should succeed on last retry attempt', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValue('success');

      const result = await retryManager.execute(operation, 'test');

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('failure scenarios', () => {
    it('should fail after max retries exceeded', async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new Error('network error'));

      await expect(
        retryManager.execute(operation, 'test')
      ).rejects.toThrow('Maximum retries');

      expect(operation).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('should fail immediately on non-retryable errors', async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new Error('validation error'));

      await expect(
        retryManager.execute(operation, 'test')
      ).rejects.toThrow('Non-retryable error');

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should respect max duration', async () => {
      const operation = jest
        .fn()
        .mockImplementation(
          () => new Promise(resolve => setTimeout(resolve, 400))
        );

      await expect(
        retryManager.execute(operation, 'test')
      ).rejects.toThrow('Operation timed out');
    });
  });

  describe('node management', () => {
    it('should track node health', async () => {
      const operation = jest.fn().mockImplementation(node => {
        if (node.url === testNodes[0]) {
          throw new Error('network error');
        }
        return Promise.resolve('success');
      });

      await retryManager.execute(operation, 'test');
      const health = retryManager.getNodesHealth();

      const node0Health = health.find(n => n.url === testNodes[0])?.health || 0;
      const node1Health = health.find(n => n.url === testNodes[1])?.health || 0;
      expect(node0Health).toBeLessThan(node1Health);
    });

    it('should prefer healthier nodes', async () => {
      const operation = jest.fn().mockImplementation(node => {
        if (node.url === testNodes[0]) {
          throw new Error('network error');
        }
        return Promise.resolve('success');
      });

      // First call should try testNodes[0] first and fail
      await retryManager.execute(operation, 'test');
      operation.mockClear();

      // Second call should prefer testNodes[1] due to health scores
      await retryManager.execute(operation, 'test');
      expect(operation.mock.calls[0][0].url).toBe(testNodes[1]);
    });

    it('should track consecutive failures', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('network error'));

      await expect(retryManager.execute(operation, 'test')).rejects.toThrow();

      const health = retryManager.getNodesHealth();
      expect(health[0]?.consecutiveFailures).toBeGreaterThan(0);
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
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should handle retryable error patterns', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('timeout error'))
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValue('success');

      const result = await retryManager.execute(operation, 'test');
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should not retry validation errors', async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new Error('invalid input'));

      await expect(
        retryManager.execute(operation, 'test')
      ).rejects.toThrow('Non-retryable error');

      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('circuit breaker', () => {
    it('should open circuit after threshold failures', async () => {
      retryManager = new RetryManager(testNodes, {
        initialDelay: 10,
        maxRetries: 5,
        circuitBreaker: {
          failureThreshold: 3,
          resetTimeout: 100,
        },
      });

      const operation = jest.fn().mockRejectedValue(new Error('network error'));

      // First execution - should try 3 times before opening circuit
      await expect(retryManager.execute(operation, 'test')).rejects.toThrow();
      expect(operation).toHaveBeenCalledTimes(3);

      // Second execution - should fail fast due to open circuit
      operation.mockClear();
      await expect(retryManager.execute(operation, 'test')).rejects.toThrow();
      expect(operation).toHaveBeenCalledTimes(1);

      // Wait for circuit reset
      await new Promise(resolve => setTimeout(resolve, 150));

      // Circuit should be half-open and allow one try
      operation.mockClear();
      operation.mockResolvedValueOnce('success');
      const result = await retryManager.execute(operation, 'test');
      expect(result).toBe('success');
    });

    it('should reset circuit after successful operation', async () => {
      retryManager = new RetryManager(testNodes, {
        initialDelay: 10,
        maxRetries: 5,
        circuitBreaker: {
          failureThreshold: 2,
          resetTimeout: 50,
        },
      });

      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValue('success');

      // First try - circuit opens
      await expect(retryManager.execute(operation, 'test')).rejects.toThrow();

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 60));

      // Second try - succeeds and resets circuit
      operation.mockClear();
      await retryManager.execute(operation, 'test');

      // Third try - circuit should be closed
      operation.mockClear();
      operation.mockResolvedValue('success');
      const result = await retryManager.execute(operation, 'test');
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
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

      const calls = operation.mock.calls;
      expect(calls[0][0].url).not.toBe(calls[1][0].url);
      expect(calls[1][0].url).not.toBe(calls[2][0].url);
    });

    it('should respect minimum healthy nodes requirement', async () => {
      retryManager = new RetryManager(testNodes, {
        minNodes: 2,
        healthThreshold: 0.5,
      });

      const operation = jest.fn().mockImplementation(node => {
        if (node.url === testNodes[0] || node.url === testNodes[1]) {
          throw new Error('network error');
        }
        return Promise.resolve('success');
      });

      // Fail a couple nodes to drop below minimum
      for (let i = 0; i < 3; i++) {
        await expect(retryManager.execute(operation, 'test')).rejects.toThrow();
      }

      // Next attempt should fail due to insufficient healthy nodes
      await expect(retryManager.execute(operation, 'test')).rejects.toThrow(
        'Insufficient healthy nodes'
      );
    });
  });

  describe('adaptive retry', () => {
    it('should adjust delay based on error type', async () => {
      retryManager = new RetryManager(testNodes, {
        initialDelay: 10,
        maxRetries: 3,
        adaptiveDelay: true,
      });

      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('rate limit'))
        .mockResolvedValue('success');

      const onRetry = jest.fn();
      retryManager = new RetryManager(testNodes, {
        initialDelay: 10,
        maxRetries: 3,
        adaptiveDelay: true,
        onRetry,
      });

      await retryManager.execute(operation, 'test');

      // Check that delays increased for specific error types
      expect(onRetry.mock.calls[1][2]).toBeGreaterThan(
        onRetry.mock.calls[0][2]
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
      const firstDelay = onRetry.mock.calls[0][2];
      const secondDelay = onRetry.mock.calls[1][2];
      expect(secondDelay).toBeGreaterThan(firstDelay);
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
      expect(node?.lastFailure).toBeInstanceOf(Date);
      expect(node?.consecutiveFailures).toBeGreaterThan(0);
    });

    it('should provide node health information', async () => {
      const health = retryManager.getNodesHealth();
      
      expect(health).toHaveLength(testNodes.length);
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
