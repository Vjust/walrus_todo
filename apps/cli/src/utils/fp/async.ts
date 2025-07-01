/**
 * Async Functional Programming Utilities
 * Async patterns and utilities for handling asynchronous operations functionally
 */

import { Result, Ok, Err, isOk, isErr, Option, Some, None, isSome } from './index';

// AsyncResult type for async error handling
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

// Async function composition
export const asyncPipe = <T>(...fns: Array<(arg: any) => Promise<any>>) => 
  async (value: T): Promise<any> => {
    let result = value;
    for (const fn of fns) {
      result = await fn(result);
    }
    return result;
  };

export const asyncCompose = <T>(...fns: Array<(arg: any) => Promise<any>>) =>
  asyncPipe(...fns.reverse());

// AsyncResult utilities
export const asyncOk = <T>(value: T): AsyncResult<T, never> => 
  Promise.resolve(Ok(value));

export const asyncErr = <E>(error: E): AsyncResult<never, E> => 
  Promise.resolve(Err(error));

export const mapAsyncResult = <T, U, E>(
  fn: (value: T) => U | Promise<U>
) => async (result: AsyncResult<T, E>): Promise<Result<U, E>> => {
  const resolved = await result;
  if (isOk(resolved)) {
    return Ok(await fn(resolved.value));
  }
  return resolved;
};

export const flatMapAsyncResult = <T, U, E>(
  fn: (value: T) => AsyncResult<U, E>
) => async (result: AsyncResult<T, E>): Promise<Result<U, E>> => {
  const resolved = await result;
  if (isOk(resolved)) {
    return fn(resolved.value);
  }
  return resolved;
};

export const mapAsyncErr = <T, E, F>(
  fn: (error: E) => F | Promise<F>
) => async (result: AsyncResult<T, E>): Promise<Result<T, F>> => {
  const resolved = await result;
  if (isErr(resolved)) {
    return Err(await fn(resolved.error));
  }
  return resolved;
};

// Retry with exponential backoff
export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  shouldRetry?: (error: any, attempt: number) => boolean;
  onRetry?: (error: any, attempt: number, nextDelay: number) => void;
}

const defaultRetryOptions: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  shouldRetry: () => true,
  onRetry: () => {}
};

export const retry = <T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const opts = { ...defaultRetryOptions, ...options };
  
  return new Promise<T>((resolve, reject) => {
    let attempt = 0;
    let delay = opts.initialDelay;
    
    const attemptFn = async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        attempt++;
        
        if (attempt >= opts.maxAttempts || !opts.shouldRetry(error, attempt)) {
          reject(error);
          return;
        }
        
        const nextDelay = Math.min(delay, opts.maxDelay);
        opts.onRetry(error, attempt, nextDelay);
        
        setTimeout(attemptFn, nextDelay);
        delay *= opts.backoffFactor;
      }
    };
    
    attemptFn();
  });
};

export const retryResult = <T, E = Error>(
  fn: () => AsyncResult<T, E>,
  options: RetryOptions = {}
): AsyncResult<T, E> => {
  const modifiedOptions = {
    ...options,
    shouldRetry: (error: any, attempt: number) => {
      // If it's a Result, check if it's an error
      if (error && typeof error === 'object' && 'ok' in error) {
        return !error.ok && (options.shouldRetry?.(error.error, attempt) ?? true);
      }
      return options.shouldRetry?.(error, attempt) ?? true;
    }
  };
  
  return retry(fn, modifiedOptions).catch(error => {
    // If the final error is a Result, return it
    if (error && typeof error === 'object' && 'ok' in error) {
      return error;
    }
    return Err(error);
  });
};

// Parallel and sequential execution helpers
export const parallel = <T>(
  fns: Array<() => Promise<T>>
): Promise<T[]> => Promise.all(fns.map(fn => fn()));

export const parallelLimit = <T>(
  limit: number
) => async (fns: Array<() => Promise<T>>): Promise<T[]> => {
  const results: T[] = [];
  const executing: Promise<void>[] = [];
  
  for (const fn of fns) {
    const promise = fn().then(result => {
      results.push(result);
    });
    
    executing.push(promise);
    
    if (executing.length >= limit) {
      await Promise.race(executing);
      executing.splice(executing.findIndex(p => p === promise), 1);
    }
  }
  
  await Promise.all(executing);
  return results;
};

export const sequential = <T>(
  fns: Array<() => Promise<T>>
): Promise<T[]> => {
  return fns.reduce(
    async (acc, fn) => {
      const results = await acc;
      const result = await fn();
      return [...results, result];
    },
    Promise.resolve([] as T[])
  );
};

// Async Option utilities
export type AsyncOption<T> = Promise<Option<T>>;

export const asyncSome = <T>(value: T): AsyncOption<T> => 
  Promise.resolve(Some(value));

export const asyncNone = (): AsyncOption<never> => 
  Promise.resolve(None());

export const mapAsyncOption = <T, U>(
  fn: (value: T) => U | Promise<U>
) => async (option: AsyncOption<T>): Promise<Option<U>> => {
  const resolved = await option;
  if (isSome(resolved)) {
    return Some(await fn(resolved.value));
  }
  return None();
};

// Timeout wrapper
export const withTimeout = <T>(
  ms: number,
  promise: Promise<T>,
  timeoutError?: Error
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(timeoutError || new Error(`Operation timed out after ${ms}ms`)),
        ms
      )
    )
  ]);
};

export const withTimeoutResult = <T, E = Error>(
  ms: number,
  promise: AsyncResult<T, E>,
  timeoutError?: E
): AsyncResult<T, E> => {
  return withTimeout(
    ms,
    promise,
    new Error(`Operation timed out after ${ms}ms`)
  ).catch(error => 
    Err(timeoutError || error)
  );
};

// Debounce and throttle for async functions
export const debounceAsync = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number
): T => {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastPromise: Promise<any> | null = null;
  
  return ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    return new Promise((resolve, reject) => {
      timeoutId = setTimeout(async () => {
        try {
          lastPromise = fn(...args);
          const result = await lastPromise;
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  }) as T;
};

export const throttleAsync = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  limit: number
): T => {
  let inThrottle = false;
  let lastResult: any;
  
  return (async (...args: Parameters<T>) => {
    if (!inThrottle) {
      inThrottle = true;
      lastResult = await fn(...args);
      
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
    
    return lastResult;
  }) as T;
};

// Queue for managing async operations
export class AsyncQueue<T> {
  private queue: Array<() => Promise<T>> = [];
  private running = false;
  private concurrency: number;
  private active = 0;
  
  constructor(concurrency = 1) {
    this.concurrency = concurrency;
  }
  
  async add(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
          return result;
        } catch (error) {
          reject(error);
          throw error;
        }
      });
      
      if (!this.running) {
        this.run();
      }
    });
  }
  
  private async run() {
    this.running = true;
    
    while (this.queue.length > 0 && this.active < this.concurrency) {
      const fn = this.queue.shift();
      if (fn) {
        this.active++;
        fn().finally(() => {
          this.active--;
          if (this.queue.length > 0) {
            this.run();
          } else if (this.active === 0) {
            this.running = false;
          }
        });
      }
    }
  }
  
  get size(): number {
    return this.queue.length;
  }
  
  get isRunning(): boolean {
    return this.running;
  }
  
  clear(): void {
    this.queue = [];
  }
}

// Async memoization
export const memoizeAsync = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyFn: (...args: Parameters<T>) => string = (...args) => JSON.stringify(args),
  ttl?: number
): T => {
  const cache = new Map<string, { value: any; timestamp: number }>();
  
  return (async (...args: Parameters<T>) => {
    const key = keyFn(...args);
    const cached = cache.get(key);
    
    if (cached) {
      if (!ttl || Date.now() - cached.timestamp < ttl) {
        return cached.value;
      }
    }
    
    const result = await fn(...args);
    cache.set(key, { value: result, timestamp: Date.now() });
    
    return result;
  }) as T;
};

// Async tap for debugging
export const asyncTap = <T>(fn: (value: T) => void | Promise<void>) =>
  async (value: T): Promise<T> => {
    await fn(value);
    return value;
  };

// Race with index to know which promise resolved/rejected first
export const raceWithIndex = <T>(
  promises: Promise<T>[]
): Promise<{ value: T; index: number }> => {
  return Promise.race(
    promises.map((promise, index) =>
      promise.then(value => ({ value, index }))
    )
  );
};

// All settled with typed results
export const allSettledTyped = <T>(
  promises: Promise<T>[]
): Promise<Array<Result<T, any>>> => {
  return Promise.allSettled(promises).then(results =>
    results.map(result =>
      result.status === 'fulfilled'
        ? Ok(result.value)
        : Err(result.reason)
    )
  );
};