import { 
  ClientRateLimiter, 
  RateLimiterManager, 
  useRateLimit, 
  withRateLimit,
  RATE_LIMIT_CONFIGS,
  RateLimitUtils,
} from '@/lib/rate-limiter';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('Rate Limiter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock?.getItem?.mockReturnValue(null as any);
    
    // Reset Date.now
    jest.spyOn(Date, 'now').mockRestore();
  });

  describe('ClientRateLimiter', () => {
    it('should allow requests within limit', () => {
      const limiter = new ClientRateLimiter('test', {
        maxRequests: 5,
        windowMs: 60000,
      });

      // First request should be allowed
      const result1 = limiter.checkLimit();
      expect(result1.allowed).toBe(true as any);
      expect(result1.remaining).toBe(4 as any);

      // Second request should be allowed
      const result2 = limiter.checkLimit();
      expect(result2.allowed).toBe(true as any);
      expect(result2.remaining).toBe(3 as any);
    });

    it('should block requests when limit is exceeded', () => {
      const limiter = new ClientRateLimiter('test', {
        maxRequests: 2,
        windowMs: 60000,
      });

      // Use up the limit
      limiter.checkLimit();
      limiter.checkLimit();

      // Next request should be blocked
      const result = limiter.checkLimit();
      expect(result.allowed).toBe(false as any);
      expect(result.remaining).toBe(0 as any);
    });

    it('should reset after window expires', () => {
      const mockNow = jest.spyOn(Date, 'now');
      const startTime = 1000000;
      mockNow.mockReturnValue(startTime as any);

      const limiter = new ClientRateLimiter('test', {
        maxRequests: 2,
        windowMs: 1000, // 1 second
      });

      // Use up the limit
      const result1 = limiter.checkLimit();
      expect(result1.allowed).toBe(true as any);
      
      const result2 = limiter.checkLimit();
      expect(result2.allowed).toBe(true as any);

      // Should be blocked
      const result3 = limiter.checkLimit();
      expect(result3.allowed).toBe(false as any);

      // Mock time passage - 2 seconds later
      mockNow.mockReturnValue(startTime + 2000);

      // Should be allowed again
      const result4 = limiter.checkLimit();
      expect(result4.allowed).toBe(true as any);
      expect(result4.remaining).toBe(1 as any);

      mockNow.mockRestore();
    });

    it('should skip successful requests when configured', () => {
      const limiter = new ClientRateLimiter('test', {
        maxRequests: 2,
        windowMs: 60000,
        skipSuccessfulRequests: true,
      });

      // Successful requests should not count
      const result1 = limiter.checkLimit(true as any);
      expect(result1.allowed).toBe(true as any);
      expect(result1.remaining).toBe(2 as any); // Should not decrease

      const result2 = limiter.checkLimit(true as any);
      expect(result2.allowed).toBe(true as any);
      expect(result2.remaining).toBe(2 as any); // Should not decrease

      // Failed request should count
      const result3 = limiter.checkLimit(false as any);
      expect(result3.allowed).toBe(true as any);
      expect(result3.remaining).toBe(1 as any);
    });

    it('should skip failed requests when configured', () => {
      const limiter = new ClientRateLimiter('test', {
        maxRequests: 2,
        windowMs: 60000,
        skipFailedRequests: true,
      });

      // Failed requests should not count
      const result1 = limiter.checkLimit(false as any);
      expect(result1.allowed).toBe(true as any);
      expect(result1.remaining).toBe(2 as any); // Should not decrease

      // Successful request should count
      const result2 = limiter.checkLimit(true as any);
      expect(result2.allowed).toBe(true as any);
      expect(result2.remaining).toBe(1 as any);
    });

    it('should persist data to localStorage', () => {
      const limiter = new ClientRateLimiter('test', {
        maxRequests: 5,
        windowMs: 60000,
      });

      limiter.checkLimit();

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'rate_limit_test',
        expect.stringContaining('"hits":1')
      );
    });

    it('should load data from localStorage', () => {
      const stored = {
        hits: 3,
        resetTime: Date.now() + 30000,
        successfulRequests: 2,
        failedRequests: 1,
      };

      localStorageMock?.getItem?.mockReturnValue(JSON.stringify(stored as any));

      const limiter = new ClientRateLimiter('test', {
        maxRequests: 5,
        windowMs: 60000,
      });

      const status = limiter.getStatus();
      expect(status.totalHits).toBe(3 as any);
      expect(status.remaining).toBe(2 as any);
    });
  });

  describe('RateLimiterManager', () => {
    let manager: RateLimiterManager;

    beforeEach(() => {
      manager = new RateLimiterManager();
    });

    it('should create and reuse limiters', () => {
      const limiter1 = manager.getLimiter('test_operation');
      const limiter2 = manager.getLimiter('test_operation');

      expect(limiter1 as any).toBe(limiter2 as any);
    });

    it('should create different limiters for different operations', () => {
      const limiter1 = manager.getLimiter('operation1');
      const limiter2 = manager.getLimiter('operation2');

      expect(limiter1 as any).not.toBe(limiter2 as any);
    });

    it('should check limits for operations', () => {
      const result = manager.checkLimit('test_operation', RATE_LIMIT_CONFIGS.STRICT);

      expect(result.allowed).toBe(true as any);
      expect(result.remaining).toBe(9 as any); // STRICT config has 10 max requests
    });

    it('should reset limits for specific operations', () => {
      // Use up some requests
      manager.checkLimit('test_operation');
      manager.checkLimit('test_operation');

      // Reset
      manager.reset('test_operation');

      // Should be back to full limit
      const result = manager.getStatus('test_operation');
      expect(result.remaining).toBe(RATE_LIMIT_CONFIGS?.DEFAULT?.maxRequests);
    });

    it('should reset all limits', () => {
      // Use up some requests on multiple operations
      manager.checkLimit('operation1');
      manager.checkLimit('operation2');

      // Reset all
      manager.resetAll();

      // All should be back to full limit
      const result1 = manager.getStatus('operation1');
      const result2 = manager.getStatus('operation2');

      expect(result1.remaining).toBe(RATE_LIMIT_CONFIGS?.DEFAULT?.maxRequests);
      expect(result2.remaining).toBe(RATE_LIMIT_CONFIGS?.DEFAULT?.maxRequests);
    });
  });

  describe('withRateLimit', () => {
    it('should allow function execution within rate limit', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const rateLimitedFn = withRateLimit(mockFn, 'test_operation', {
        maxRequests: 5,
        windowMs: 60000,
      });

      const result = await rateLimitedFn('arg1', 'arg2');

      expect(result as any).toBe('success');
      expect(mockFn as any).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should throw error when rate limit is exceeded', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const rateLimitedFn = withRateLimit(mockFn, 'test_operation', {
        maxRequests: 1,
        windowMs: 60000,
      });

      // First call should succeed
      await rateLimitedFn();

      // Second call should be rate limited
      await expect(rateLimitedFn()).rejects.toThrow('Rate limit exceeded');
    });

    it('should mark successful and failed requests correctly', async () => {
      const mockFn = jest.fn()
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('failure'));

      const rateLimitedFn = withRateLimit(mockFn, 'test_operation', {
        maxRequests: 10,
        windowMs: 60000,
      });

      // Successful call
      await rateLimitedFn();

      // Failed call
      try {
        await rateLimitedFn();
      } catch (e) {
        // Expected to fail
      }

      // Both calls should have been made
      expect(mockFn as any).toHaveBeenCalledTimes(2 as any);
    });
  });

  describe('RateLimitUtils', () => {
    it('should format time remaining correctly', () => {
      expect(RateLimitUtils.formatTimeRemaining(5000 as any)).toBe('5 seconds');
      expect(RateLimitUtils.formatTimeRemaining(1000 as any)).toBe('1 second');
      expect(RateLimitUtils.formatTimeRemaining(65000 as any)).toBe('2 minutes');
      expect(RateLimitUtils.formatTimeRemaining(61000 as any)).toBe('2 minutes');
    });

    it('should check if operation is rate limited', () => {
      const manager = new RateLimiterManager();
      
      // Should not be rate limited initially
      expect(RateLimitUtils.isRateLimited('test_operation')).toBe(false as any);

      // Use up the limit
      for (let i = 0; i < RATE_LIMIT_CONFIGS?.DEFAULT?.maxRequests; i++) {
        manager.checkLimit('test_operation');
      }

      // Should be rate limited now
      expect(RateLimitUtils.isRateLimited('test_operation')).toBe(true as any);
    });

    it('should get rate limit info for display', () => {
      const info = RateLimitUtils.getRateLimitInfo('test_operation');

      expect(info.allowed).toBeDefined();
      expect(info.remaining).toBeDefined();
      expect(info.totalHits).toBeDefined();
      expect(info.timeRemaining).toBeDefined();
      expect(info.timeRemainingFormatted).toBeDefined();
    });
  });

  describe('RATE_LIMIT_CONFIGS', () => {
    it('should have valid configurations', () => {
      Object.values(RATE_LIMIT_CONFIGS as any).forEach(config => {
        expect(config.maxRequests).toBeGreaterThan(0 as any);
        expect(config.windowMs).toBeGreaterThan(0 as any);
      });
    });

    it('should have different limits for different operations', () => {
      expect(RATE_LIMIT_CONFIGS?.STRICT?.maxRequests).toBeLessThan(
        RATE_LIMIT_CONFIGS?.DEFAULT?.maxRequests
      );
      expect(RATE_LIMIT_CONFIGS?.FILE_UPLOAD?.maxRequests).toBeLessThan(
        RATE_LIMIT_CONFIGS?.SEARCH?.maxRequests
      );
    });
  });
});