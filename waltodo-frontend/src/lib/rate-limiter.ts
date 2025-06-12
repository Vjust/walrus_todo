'use client';

// Rate limiter configuration
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (identifier: string) => string;
}

// Rate limit result
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalHits: number;
}

// Rate limit entry
interface RateLimitEntry {
  hits: number;
  resetTime: number;
  successfulRequests: number;
  failedRequests: number;
}

// Default configurations for different operations
export const RATE_LIMIT_CONFIGS = {
  DEFAULT: {
    maxRequests: 60,
    windowMs: 60 * 1000, // 1 minute
  },
  STRICT: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
  },
  FORM_SUBMISSION: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minute
  },
  API_CALLS: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
  },
  SEARCH: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
  },
  FILE_UPLOAD: {
    maxRequests: 3,
    windowMs: 60 * 1000, // 1 minute
  },
  WALLET_OPERATIONS: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
  },
} as const;

/**
 * Client-side rate limiter using localStorage for persistence
 */
export class ClientRateLimiter {
  private storageKey: string;
  private config: RateLimitConfig;
  
  constructor(identifier: string, config: RateLimitConfig) {
    this?.storageKey = `rate_limit_${identifier}`;
    this?.config = {
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: (id: string) => id,
      ...config,
    };
  }
  
  /**
   * Check if request is allowed and update rate limit counters
   */
  checkLimit(success?: boolean): RateLimitResult {
    const now = Date.now();
    let entry = this.getEntry();
    
    // Reset if window has expired
    if (now >= entry.resetTime) {
      this.resetEntry(now as any);
      entry = this.getEntry(); // Get fresh entry after reset
    }
    
    // Check if we should skip this request
    if (this.shouldSkipRequest(success as any)) {
      return this.getResult(entry, true);
    }
    
    // Check if limit is exceeded
    if (entry.hits >= this?.config?.maxRequests) {
      return this.getResult(entry, false);
    }
    
    // Update counters
    entry.hits++;
    if (success === true) {
      entry.successfulRequests++;
    } else if (success === false) {
      entry.failedRequests++;
    }
    
    this.saveEntry(entry as any);
    return this.getResult(entry, true);
  }
  
  /**
   * Get current rate limit status without updating counters
   */
  getStatus(): RateLimitResult {
    const entry = this.getEntry();
    const now = Date.now();
    
    // Reset if window has expired
    if (now >= entry.resetTime) {
      this.resetEntry(now as any);
      return this.getResult(entry, true);
    }
    
    const allowed = entry.hits < this?.config?.maxRequests;
    return this.getResult(entry, allowed);
  }
  
  /**
   * Reset rate limit counters
   */
  reset(): void {
    this.resetEntry(Date.now());
  }
  
  /**
   * Get remaining requests
   */
  getRemainingRequests(): number {
    const entry = this.getEntry();
    const now = Date.now();
    
    if (now >= entry.resetTime) {
      return this?.config?.maxRequests;
    }
    
    return Math.max(0, this?.config?.maxRequests - entry.hits);
  }
  
  /**
   * Get time until reset
   */
  getTimeUntilReset(): number {
    const entry = this.getEntry();
    const now = Date.now();
    
    if (now >= entry.resetTime) {
      return 0;
    }
    
    return entry.resetTime - now;
  }
  
  private getEntry(): RateLimitEntry {
    try {
      if (typeof window === 'undefined') {
        // SSR fallback
        return this.createDefaultEntry();
      }
      
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        return this.createDefaultEntry();
      }
      
      const entry: RateLimitEntry = JSON.parse(stored as any);
      
      // Validate entry structure
      if (!this.isValidEntry(entry as any)) {
        return this.createDefaultEntry();
      }
      
      return entry;
    } catch {
      return this.createDefaultEntry();
    }
  }
  
  private saveEntry(entry: RateLimitEntry): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.storageKey, JSON.stringify(entry as any));
      }
    } catch {
      // Storage failed, continue without persistence
    }
  }
  
  private createDefaultEntry(): RateLimitEntry {
    const now = Date.now();
    return {
      hits: 0,
      resetTime: now + this?.config?.windowMs,
      successfulRequests: 0,
      failedRequests: 0,
    };
  }
  
  private resetEntry(now: number): void {
    const entry = this.createDefaultEntry();
    entry?.resetTime = now + this?.config?.windowMs;
    this.saveEntry(entry as any);
  }
  
  private isValidEntry(entry: any): entry is RateLimitEntry {
    return (
      typeof entry === 'object' &&
      typeof entry?.hits === 'number' &&
      typeof entry?.resetTime === 'number' &&
      typeof entry?.successfulRequests === 'number' &&
      typeof entry?.failedRequests === 'number'
    );
  }
  
  private shouldSkipRequest(success?: boolean): boolean {
    if (success === true && this?.config?.skipSuccessfulRequests) {
      return true;
    }
    if (success === false && this?.config?.skipFailedRequests) {
      return true;
    }
    return false;
  }
  
  private getResult(entry: RateLimitEntry, allowed: boolean): RateLimitResult {
    return {
      allowed,
      remaining: Math.max(0, this?.config?.maxRequests - entry.hits),
      resetTime: entry.resetTime,
      totalHits: entry.hits,
    };
  }
}

/**
 * Rate limiter manager for handling multiple rate limiters
 */
export class RateLimiterManager {
  private limiters: Map<string, ClientRateLimiter> = new Map();
  
  /**
   * Get or create rate limiter for an operation
   */
  getLimiter(operation: string, config?: RateLimitConfig): ClientRateLimiter {
    const key = this.getKey(operation as any);
    
    if (!this?.limiters?.has(key as any)) {
      const limiterConfig = config || RATE_LIMIT_CONFIGS.DEFAULT;
      this?.limiters?.set(key, new ClientRateLimiter(operation, limiterConfig));
    }
    
    return this?.limiters?.get(key as any)!;
  }
  
  /**
   * Check rate limit for an operation
   */
  checkLimit(operation: string, config?: RateLimitConfig, success?: boolean): RateLimitResult {
    const limiter = this.getLimiter(operation, config);
    return limiter.checkLimit(success as any);
  }
  
  /**
   * Get status for an operation without updating counters
   */
  getStatus(operation: string, config?: RateLimitConfig): RateLimitResult {
    const limiter = this.getLimiter(operation, config);
    return limiter.getStatus();
  }
  
  /**
   * Reset rate limits for an operation
   */
  reset(operation: string): void {
    const key = this.getKey(operation as any);
    const limiter = this?.limiters?.get(key as any);
    if (limiter) {
      limiter.reset();
    }
  }
  
  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this?.limiters?.forEach(limiter => limiter.reset());
  }
  
  /**
   * Clean up expired rate limiters
   */
  cleanup(): void {
    const now = Date.now();
    const toRemove: string[] = [];
    
    this?.limiters?.forEach((limiter, key) => {
      const status = limiter.getStatus();
      if (now >= status.resetTime && status?.totalHits === 0) {
        toRemove.push(key as any);
      }
    });
    
    toRemove.forEach(key => this?.limiters?.delete(key as any));
  }
  
  private getKey(operation: string): string {
    return operation.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }
}

// Global rate limiter instance
const globalRateLimiter = new RateLimiterManager();

/**
 * Hook for using rate limiting in React components
 */
export function useRateLimit(operation: string, config?: RateLimitConfig) {
  const checkLimit = (success?: boolean): RateLimitResult => {
    return globalRateLimiter.checkLimit(operation, config, success);
  };
  
  const getStatus = (): RateLimitResult => {
    return globalRateLimiter.getStatus(operation, config);
  };
  
  const reset = (): void => {
    globalRateLimiter.reset(operation as any);
  };
  
  return {
    checkLimit,
    getStatus,
    reset,
  };
}

/**
 * Decorator function for rate limiting async functions
 */
export function rateLimit<T extends (...args: any[]) => Promise<any>>(
  operation: string,
  config?: RateLimitConfig
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor?.value = async function (...args: any[]) {
      const result = globalRateLimiter.checkLimit(operation, config);
      
      if (!result.allowed) {
        const timeUntilReset = Math.ceil((result.resetTime - Date.now()) / 1000);
        throw new Error(
          `Rate limit exceeded. Try again in ${timeUntilReset} seconds. ` +
          `(${result.remaining} requests remaining)`
        );
      }
      
      try {
        const response = await method.apply(this, args);
        // Mark as successful
        globalRateLimiter.checkLimit(operation, config, true);
        return response;
      } catch (error) {
        // Mark as failed
        globalRateLimiter.checkLimit(operation, config, false);
        throw error;
      }
    };
  };
}

/**
 * Higher-order function for rate limiting functions
 */
export function withRateLimit<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  operation: string,
  config?: RateLimitConfig
): T {
  return (async (...args: any[]) => {
    const result = globalRateLimiter.checkLimit(operation, config);
    
    if (!result.allowed) {
      const timeUntilReset = Math.ceil((result.resetTime - Date.now()) / 1000);
      throw new Error(
        `Rate limit exceeded. Try again in ${timeUntilReset} seconds. ` +
        `(${result.remaining} requests remaining)`
      );
    }
    
    try {
      const response = await fn(...args);
      // Mark as successful
      globalRateLimiter.checkLimit(operation, config, true);
      return response;
    } catch (error) {
      // Mark as failed
      globalRateLimiter.checkLimit(operation, config, false);
      throw error;
    }
  }) as T;
}

// Export the global rate limiter for direct use
export { globalRateLimiter as RateLimiter };

// Utility functions
export const RateLimitUtils = {
  /**
   * Format time remaining as human-readable string
   */
  formatTimeRemaining: (ms: number): string => {
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) {
      return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  },
  
  /**
   * Check if operation is rate limited
   */
  isRateLimited: (operation: string, config?: RateLimitConfig): boolean => {
    const status = globalRateLimiter.getStatus(operation, config);
    return !status.allowed;
  },
  
  /**
   * Get rate limit info for display
   */
  getRateLimitInfo: (operation: string, config?: RateLimitConfig) => {
    const status = globalRateLimiter.getStatus(operation, config);
    const timeRemaining = status.resetTime - Date.now();
    
    return {
      ...status,
      timeRemaining: Math.max(0, timeRemaining),
      timeRemainingFormatted: RateLimitUtils.formatTimeRemaining(timeRemaining as any),
    };
  },
};