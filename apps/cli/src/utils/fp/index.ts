/**
 * Functional Programming Utilities
 * Core FP patterns and utilities for the WalTodo application
 */

// Function composition
export const pipe = <T>(...fns: Array<(arg: any) => any>) => (value: T): any =>
  fns.reduce((acc, fn) => fn(acc), value);

export const compose = <T>(...fns: Array<(arg: any) => any>) => (value: T): any =>
  pipe(...fns.reverse())(value);

// Result type for error handling
export type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

export const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// Result utilities
export const isOk = <T, E>(result: Result<T, E>): result is { ok: true; value: T } => result.ok;
export const isErr = <T, E>(result: Result<T, E>): result is { ok: false; error: E } => !result.ok;

export const mapResult = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> => {
  if (isOk(result)) {
    return Ok(fn(result.value));
  }
  return result;
};

export const flatMapResult = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> => {
  if (isOk(result)) {
    return fn(result.value);
  }
  return result;
};

export const mapErr = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> => {
  if (isErr(result)) {
    return Err(fn(result.error));
  }
  return result;
};

// Option type
export type Option<T> = 
  | { some: true; value: T }
  | { some: false };

export const Some = <T>(value: T): Option<T> => ({ some: true, value });
export const None = (): Option<never> => ({ some: false });

// Option utilities
export const isSome = <T>(option: Option<T>): option is { some: true; value: T } => option.some;
export const isNone = <T>(option: Option<T>): option is { some: false } => !option.some;

export const mapOption = <T, U>(
  option: Option<T>,
  fn: (value: T) => U
): Option<U> => {
  if (isSome(option)) {
    return Some(fn(option.value));
  }
  return None();
};

export const flatMapOption = <T, U>(
  option: Option<T>,
  fn: (value: T) => Option<U>
): Option<U> => {
  if (isSome(option)) {
    return fn(option.value);
  }
  return None();
};

export const optionToResult = <T, E>(
  option: Option<T>,
  error: E
): Result<T, E> => {
  if (isSome(option)) {
    return Ok(option.value);
  }
  return Err(error);
};

export const resultToOption = <T, E>(
  result: Result<T, E>
): Option<T> => {
  if (isOk(result)) {
    return Some(result.value);
  }
  return None();
};

// Higher-order functions
export const curry = <T extends (...args: any[]) => any>(fn: T) => {
  const curried = (...args: any[]): any => {
    if (args.length >= fn.length) {
      return fn(...args);
    }
    return (...remainingArgs: any[]) => curried(...args, ...remainingArgs);
  };
  return curried;
};

export const partial = <T extends (...args: any[]) => any>(
  fn: T,
  ...partialArgs: any[]
) => (...remainingArgs: any[]) => fn(...partialArgs, ...remainingArgs);

// Immutability helpers
export const freeze = <T extends object>(obj: T): Readonly<T> => Object.freeze(obj);

export const deepFreeze = <T extends object>(obj: T): Readonly<T> => {
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach(prop => {
    const value = (obj)[prop];
    if (value !== null && (typeof value === 'object' || typeof value === 'function')) {
      deepFreeze(value);
    }
  });
  return obj;
};

// Immutable update helper
export const update = <T extends object>(
  obj: T,
  path: string | string[],
  value: any
): T => {
  const pathArray = Array.isArray(path) ? path : path.split('.');
  
  if (pathArray.length === 0) {
    return value;
  }
  
  const [head, ...tail] = pathArray;
  const currentValue = (obj)[head];
  
  if (tail.length === 0) {
    return {
      ...obj,
      [head]: value
    };
  }
  
  return {
    ...obj,
    [head]: update(currentValue || {}, tail, value)
  };
};

// Utility functions
export const identity = <T>(x: T): T => x;

export const constant = <T>(x: T) => () => x;

export const tap = <T>(fn: (x: T) => void) => (x: T): T => {
  fn(x);
  return x;
};

export const memoize = <T extends (...args: any[]) => any>(
  fn: T,
  keyFn: (...args: Parameters<T>) => string = (...args) => JSON.stringify(args)
): T => {
  const cache = new Map<string, ReturnType<T>>();
  
  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = keyFn(...args);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
};

// List operations
export const head = <T>(list: T[]): Option<T> =>
  list.length > 0 ? Some(list[0]) : None();

export const tail = <T>(list: T[]): T[] =>
  list.slice(1);

export const last = <T>(list: T[]): Option<T> =>
  list.length > 0 ? Some(list[list.length - 1]) : None();

export const init = <T>(list: T[]): T[] =>
  list.slice(0, -1);

export const take = <T>(n: number) => (list: T[]): T[] =>
  list.slice(0, n);

export const drop = <T>(n: number) => (list: T[]): T[] =>
  list.slice(n);

export const partition = <T>(
  predicate: (value: T) => boolean
) => (list: T[]): [T[], T[]] => {
  const pass: T[] = [];
  const fail: T[] = [];
  
  for (const item of list) {
    if (predicate(item)) {
      pass.push(item);
    } else {
      fail.push(item);
    }
  }
  
  return [pass, fail];
};

export const groupBy = <T, K extends string | number | symbol>(
  keyFn: (value: T) => K
) => (list: T[]): Record<K, T[]> => {
  return list.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {} as Record<K, T[]>);
};

// Predicate combinators
export const not = <T>(predicate: (value: T) => boolean) =>
  (value: T): boolean => !predicate(value);

export const and = <T>(...predicates: Array<(value: T) => boolean>) =>
  (value: T): boolean => predicates.every(p => p(value));

export const or = <T>(...predicates: Array<(value: T) => boolean>) =>
  (value: T): boolean => predicates.some(p => p(value));

// Type guards
export const isNotNull = <T>(value: T | null): value is T => value !== null;
export const isNotUndefined = <T>(value: T | undefined): value is T => value !== undefined;
export const isDefined = <T>(value: T | null | undefined): value is T => 
  value !== null && value !== undefined;

// Re-export async utilities
export * from './async';