// Use interface declarations instead of namespace
type MockedFunction<T extends (...args: unknown[]) => unknown> = {
  (...args: Parameters<T>): ReturnType<T>;
  mockImplementation(fn: (...args: Parameters<T>) => ReturnType<T>): MockedFunction<T>;
  mockImplementationOnce(fn: (...args: Parameters<T>) => ReturnType<T>): MockedFunction<T>;
  mockReturnValue(value: ReturnType<T>): MockedFunction<T>;
  mockReturnValueOnce(value: ReturnType<T>): MockedFunction<T>;
  mockResolvedValue<U extends ReturnType<T>>(
    value: U extends Promise<infer R> ? R : U
  ): MockedFunction<T>;
  mockResolvedValueOnce<U extends ReturnType<T>>(
    value: U extends Promise<infer R> ? R : U
  ): MockedFunction<T>;
  mockRejectedValue(value: unknown): MockedFunction<T>;
  mockRejectedValueOnce(value: unknown): MockedFunction<T>;
  mockClear(): MockedFunction<T>;
  mockReset(): MockedFunction<T>;
  mockRestore(): MockedFunction<T>;
  mockName(name: string): MockedFunction<T>;
  getMockName(): string;
  mockReturnThis(): MockedFunction<T>;
  mock: {
    calls: unknown[][];
    instances: unknown[];
    invocationCallOrder: number[];
    results: Array<{
      type: 'return' | 'throw';
      value: unknown;
    }>;
  };
};

type MockedClass<T extends new (...args: unknown[]) => unknown> = {
  new (...args: ConstructorParameters<T>): Mocked<InstanceType<T>>;
  prototype: Mocked<InstanceType<T>>;
} & T;

type Mocked<T> = {
  [P in keyof T]: T[P] extends (...args: any[]) => any
    ? MockedFunction<T[P]>
    : T[P] extends new (...args: unknown[]) => unknown
      ? MockedClass<T[P]>
      : T[P];
} & T;

type SpyInstance = {
  mockReturnValue(value: unknown): SpyInstance;
  mockReturnValueOnce(value: unknown): SpyInstance;
  mockResolvedValue<U>(value: U): SpyInstance;
  mockResolvedValueOnce<U>(value: U): SpyInstance;
  mockRejectedValue(value: unknown): SpyInstance;
  mockRejectedValueOnce(value: unknown): SpyInstance;
  mockImplementation(fn: (...args: unknown[]) => unknown): SpyInstance;
  mockImplementationOnce(fn: (...args: unknown[]) => unknown): SpyInstance;
  mockName(name: string): SpyInstance;
  mockClear(): SpyInstance;
  mockReset(): SpyInstance;
  mockRestore(): SpyInstance;
  getMockImplementation(): ((...args: unknown[]) => unknown) | undefined;
  getMockName(): string;
  mock: {
    calls: unknown[][];
    instances: unknown[];
    invocationCallOrder: number[];
    results: Array<{ type: string; value: unknown }>;
  };
  mockReturnThis(): SpyInstance;
};

// Declare module interfaces for Jest globals
declare module '@jest/globals' {
  export const jest: typeof global.jest;
  export const expect: typeof global.expect;
  export const test: typeof global.test;
  export const describe: typeof global.describe;
  export const beforeEach: typeof global.beforeEach;
  export const afterEach: typeof global.afterEach;
  export const beforeAll: typeof global.beforeAll;
  export const afterAll: typeof global.afterAll;
  export const it: typeof global.it;
  export type SpyInstance = SpyInstance;
}
