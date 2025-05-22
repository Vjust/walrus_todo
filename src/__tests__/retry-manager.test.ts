import { RetryManager } from '../utils/retry-manager';

describe('RetryManager', () => {
  const testNodes = [
    'https://test1.example.com',
    'https://test2.example.com',
    'https://test3.example.com'
  ];

  let retryManager: RetryManager;

  beforeEach(() => {
    retryManager = new RetryManager(testNodes, {
      initialDelay: 10,     // Fast tests
      maxDelay: 50,
      maxRetries: 3,
      maxDuration: 1000,
      timeout: 100
    });
  });

  describe('retry logic', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await retryManager.execute(operation, 'test');
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValue('success');

      const result = await retryManager.execute(operation, 'test');
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should fail immediately on non-retryable errors', async () => {
      const operation = jest.fn()
        .mockRejectedValue(new Error('validation error'));

      await expect(retryManager.execute(operation, 'test'))
        .rejects.toThrow('Non-retryable error');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should respect max retries', async () => {
      const operation = jest.fn()
        .mockRejectedValue(new Error('network error'));

      await expect(retryManager.execute(operation, 'test'))
        .rejects.toThrow('Maximum retries');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should respect max duration', async () => {
      const operation = jest.fn()
        .mockImplementation(() => new Promise(resolve => setTimeout(resolve, 400)));

      await expect(retryManager.execute(operation, 'test'))
        .rejects.toThrow('Operation timed out');
    });

    it('should handle HTTP status codes', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce({ status: 429 })
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValue('success');

      const result = await retryManager.execute(operation, 'test');
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('node management', () => {
    it('should track node health', async () => {
      const operation = jest.fn()
        .mockImplementation((node) => {
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
      const operation = jest.fn()
        .mockImplementation((node) => {
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
      const operation = jest.fn()
        .mockRejectedValue(new Error('network error'));

      try {
        await retryManager.execute(operation, 'test');
      } catch (_error) {
        // Expected to fail
      }

      const health = retryManager.getNodesHealth();
      expect(health[0].consecutiveFailures).toBeGreaterThan(0);
    });
  });

  describe('circuit breaker', () => {
    it('should open circuit after threshold failures', async () => {
      retryManager = new RetryManager(testNodes, {
        initialDelay: 10,
        maxRetries: 5,
        circuitBreaker: {
          failureThreshold: 3,
          resetTimeout: 100
        }
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
          resetTimeout: 50
        }
      });

      const operation = jest.fn()
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

  describe('adaptive retry', () => {
    it('should adjust delay based on error type', async () => {
      retryManager = new RetryManager(testNodes, {
        initialDelay: 10,
        maxRetries: 3,
        adaptiveDelay: true
      });

      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('rate limit'))
        .mockResolvedValue('success');

      const onRetry = jest.fn();
      retryManager = new RetryManager(testNodes, {
        initialDelay: 10,
        maxRetries: 3,
        adaptiveDelay: true,
        onRetry
      });

      await retryManager.execute(operation, 'test');

      // Check that delays increased for specific error types
      expect(onRetry.mock.calls[1][2]).toBeGreaterThan(onRetry.mock.calls[0][2]);
    });

    it('should adjust delay based on network conditions', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValue('success');

      const onRetry = jest.fn();
      retryManager = new RetryManager(testNodes, {
        initialDelay: 10,
        maxRetries: 3,
        adaptiveDelay: true,
        onRetry
      });

      await retryManager.execute(operation, 'test');

      // Delays should increase as network conditions worsen
      const firstDelay = onRetry.mock.calls[0][2];
      const secondDelay = onRetry.mock.calls[1][2];
      expect(secondDelay).toBeGreaterThan(firstDelay);
    });
  });

  describe('load balancing', () => {
    it('should support round-robin strategy', async () => {
      retryManager = new RetryManager(testNodes, {
        loadBalancing: 'round-robin'
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
        healthThreshold: 0.5
      });

      const operation = jest.fn()
        .mockImplementation((node) => {
          if (node.url === testNodes[0] || node.url === testNodes[1]) {
            throw new Error('network error');
          }
          return Promise.resolve('success');
        });

      // Fail a couple nodes to drop below minimum
      for (let i = 0; i < 3; i++) {
        try {
          await retryManager.execute(operation, 'test');
        } catch {
          // Ignore errors - we're intentionally failing nodes
        }
      }

      // Next attempt should fail due to insufficient healthy nodes
      await expect(retryManager.execute(operation, 'test'))
        .rejects.toThrow('Insufficient healthy nodes');
    });
  });

  describe('error reporting', () => {
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      (retryManager as any).logger = mockLogger;
    });

    it('should provide detailed error summaries with categorization', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockRejectedValueOnce(new Error('429 rate limit exceeded'))
        .mockRejectedValueOnce(new Error('insufficient storage'));

      const onRetry = jest.fn();
      retryManager = new RetryManager(testNodes, {
        initialDelay: 10,
        maxRetries: 3,
        onRetry
      });
      (retryManager as any).logger = mockLogger;

      try {
        await retryManager.execute(operation, 'test');
      } catch (_error) {
        // Verify error categorization
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('timeout'),
          expect.any(Object)
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('rate_limit'),
          expect.any(Object)
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('storage'),
          expect.any(Object)
        );

        // Verify retry delays were adjusted based on error type
        const delays = onRetry.mock.calls.map(call => call[2]);
        expect(delays[1]).toBeGreaterThan(delays[0]); // Rate limit causes longer delay
        expect(delays[2]).toBeGreaterThan(delays[1]); // Storage error causes longest delay
      }
    });

    it('should track attempt timestamps and error patterns', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('rate limit'));

      try {
        await retryManager.execute(operation, 'test');
      } catch (_error) {
        const health = retryManager.getNodesHealth();
        const node = health[0];
        
        // Basic timestamp tracking
        expect(node.lastFailure).toBeDefined();
        expect(node.lastFailure).toBeInstanceOf(Date);

        // Error pattern analysis
        const errorLogs = mockLogger.warn.mock.calls
          .map(call => call[0])
          .filter(msg => msg.includes('Retry attempt'));

        // Should see increasing delays due to repeated timeout errors
        const delays = errorLogs
          .map(log => parseInt(log.match(/Retrying in (\d+)ms/)?.[1] || '0'));
        expect(delays[1]).toBeGreaterThan(delays[0]);

        // Should see higher delay for rate limit error
        const rateLimitDelay = delays[delays.length - 1];
        expect(rateLimitDelay).toBeGreaterThan(delays[delays.length - 2]);
      }
    });

    it('should log long retry delays with context', async () => {
      retryManager = new RetryManager(testNodes, {
        initialDelay: 1000,
        maxRetries: 3,
        adaptiveDelay: true
      });
      (retryManager as any).logger = mockLogger;

      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('rate limit'))
        .mockRejectedValueOnce(new Error('insufficient storage'))
        .mockResolvedValue('success');

      await retryManager.execute(operation, 'test');

      // Should log delays over 5000ms
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Long delay'),
        expect.objectContaining({
          networkScore: expect.any(Number)
        })
      );
    });
  });
});