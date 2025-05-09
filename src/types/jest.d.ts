/// <reference types="jest" />
/// <reference types="@testing-library/jest-dom" />

// Declare the @jest/globals module
declare module '@jest/globals' {
  // Re-export global variables from Jest
  export const jest: typeof globalThis.jest;
  export const expect: typeof globalThis.expect;
  export const it: typeof globalThis.it;
  export const describe: typeof globalThis.describe;
  export const beforeAll: typeof globalThis.beforeAll;
  export const afterAll: typeof globalThis.afterAll;
  export const beforeEach: typeof globalThis.beforeEach;
  export const afterEach: typeof globalThis.afterEach;
  export const test: typeof globalThis.test;
  
  // Export SpyInstance type
  export type SpyInstance<T extends (...args: any[]) => any> = jest.SpyInstance<T>;
}

// Declare Jest global namespace
declare namespace jest {
  // SpyInstance interface
  interface SpyInstance<T extends (...args: any[]) => any> {
    mockImplementation(fn: (...args: Parameters<T>) => ReturnType<T>): this;
    mockImplementationOnce(fn: (...args: Parameters<T>) => ReturnType<T>): this;
    mockReturnValue(value: ReturnType<T>): this;
    mockReturnValueOnce(value: ReturnType<T>): this;
    mockResolvedValue<U extends ReturnType<T>>(value: U extends Promise<infer V> ? V : U): this;
    mockResolvedValueOnce<U extends ReturnType<T>>(value: U extends Promise<infer V> ? V : U): this;
    mockRejectedValue(value: any): this;
    mockRejectedValueOnce(value: any): this;
    mockReturnThis(): this;
    mockClear(): void;
    mockReset(): void;
    mockRestore(): void;
    mockName(name: string): this;
    getMockName(): string;
    getMockImplementation(): Function | undefined;
    mock: {
      calls: Parameters<T>[][];
      results: Array<{ type: 'return' | 'throw'; value: any }>;
      instances: any[];
      contexts: any[];
      lastCall: Parameters<T>[];
      invocationCallOrder: number[];
    };
  }
  
  // Mock Class
  type MockedClass<T> = {
    [K in keyof T]: T[K] extends (...args: infer A) => infer R
      ? jest.Mock<R, A>
      : T[K];
  } & {
    prototype: {
      [K in keyof T['prototype']]: T['prototype'][K] extends (...args: infer A) => infer R
        ? jest.Mock<R, A>
        : T['prototype'][K];
    };
  } & T;

  // Mock object
  type MockedObject<T> = {
    [K in keyof T]: T[K] extends (...args: infer A) => infer R
      ? jest.Mock<R, A>
      : T[K];
  };

  // Mock function helper types
  interface Mock<R = any, Args extends any[] = any[]> extends Function {
    (...args: Args): R;
    mockImplementation(fn: (...args: Args) => R): this;
    mockImplementationOnce(fn: (...args: Args) => R): this;
    mockReturnValue(value: R): this;
    mockReturnValueOnce(value: R): this;
    mockResolvedValue(value: R extends Promise<infer U> ? U : R): this;
    mockResolvedValueOnce(value: R extends Promise<infer U> ? U : R): this;
    mockRejectedValue(value: any): this;
    mockRejectedValueOnce(value: any): this;
    mockClear(): this;
    mockReset(): this;
    mockRestore(): this;
    getMockName(): string;
    mockName(name: string): this;
    mockReturnThis(): this;
    mockResolvedThis(): this;
    mockResults: any[];
    mock: {
      calls: Args[];
      instances: any[];
      invocationCallOrder: number[];
      results: any[];
    };
  }

  type MockFn<R = any, Args extends any[] = any[]> = Mock<R, Args>;

  // Generic mock function type
  type MockFunction<T extends (...args: any) => any> = Mock<ReturnType<T>, Parameters<T>>;

  // Mock constructor
  function fn<T extends (...args: any[]) => any>(implementation?: T): MockFunction<T>;
  function fn<T>(): Mock<T>;
  function fn(): Mock;

  // Spy methods
  function spyOn<T, M extends keyof T>(object: T, method: M): T[M] extends (...args: any[]) => any
    ? SpyInstance<T[M]>
    : Mock<T[M] extends (...args: any[]) => any ? ReturnType<T[M]> : any>;
  
  // Mock functions
  function clearAllMocks(): void;
  function resetAllMocks(): void;
  function restoreAllMocks(): void;
  function mocked<T>(item: T, deep?: boolean): T extends (...args: any[]) => any ? MockFunction<T> : MockedObject<T>;
  
  // Matchers interfaces
  interface Matchers<R, T = any> {
    toHaveBeenCalled(): R;
    toHaveBeenCalledWith(...args: any[]): R;
    toContain(item: any): R;
    toBe(expected: any): R;
    toEqual(expected: any): R;
    toMatchObject(expected: any): R;
    toMatchSnapshot(): R;
    toThrow(expected?: string | RegExp | Error): R;
    toThrowError(expected?: string | RegExp | Error): R;
    toBeNull(): R;
    toBeTruthy(): R;
    toBeFalsy(): R;
    toBeDefined(): R;
    toBeUndefined(): R;
    toBeNaN(): R;
    toBeCloseTo(expected: number, precision?: number): R;
    toMatch(expected: string | RegExp): R;
    toHaveLength(expected: number): R;
    toHaveBeenCalledTimes(expected: number): R;
    toHaveBeenLastCalledWith(...args: any[]): R;
    toHaveBeenNthCalledWith(n: number, ...args: any[]): R;
    toHaveProperty(property: string, value?: any): R;
    toBeInstanceOf(expected: any): R;
  }

  // Mock module helper
  function mock(moduleName: string, factory?: any, options?: any): typeof jest;
  function unmock(moduleName: string): typeof jest;
  function doMock(moduleName: string, factory?: any, options?: any): typeof jest;
  function dontMock(moduleName: string): typeof jest;
  
  // Types for common mocks
  interface ObjectContaining<T> {
    asymmetricMatch(other: any): boolean;
    jasmineToString?(): string;
    sample: T;
  }
}

// Mock expectation module
declare module '@jest/expect' {
  interface Expect {
    objectContaining<T>(sample: T): jest.ObjectContaining<T>;
  }
}

export {};