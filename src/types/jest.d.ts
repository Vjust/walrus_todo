declare namespace jest {
  type MockedFunction<T extends (...args: any[]) => any> = {
    (...args: Parameters<T>): ReturnType<T>;
    mockImplementation(fn: (...args: Parameters<T>) => ReturnType<T>): this;
    mockImplementationOnce(fn: (...args: Parameters<T>) => ReturnType<T>): this;
    mockReturnValue(value: ReturnType<T>): this;
    mockReturnValueOnce(value: ReturnType<T>): this;
    mockResolvedValue<U extends ReturnType<T>>(value: U extends Promise<infer R> ? R : U): this;
    mockResolvedValueOnce<U extends ReturnType<T>>(value: U extends Promise<infer R> ? R : U): this;
    mockRejectedValue(value: any): this;
    mockRejectedValueOnce(value: any): this;
    mockClear(): this;
    mockReset(): this;
    mockRestore(): this;
    mockName(name: string): this;
    getMockName(): string;
    mockReturnThis(): this;
    mockResolvedValueOnce<U>(value: U): this;
    mockResolvedValue<U>(value: U): this;
    mockRejectedValueOnce(value: any): this;
    mockRejectedValue(value: any): this;
    mock: {
      calls: any[][];
      instances: any[];
      invocationCallOrder: number[];
      results: Array<{
        type: string;
        value: any;
      }>;
    };
  };

  type MockedClass<T extends new (...args: any[]) => any> = {
    new (...args: ConstructorParameters<T>): jest.Mocked<InstanceType<T>>;
    prototype: jest.Mocked<InstanceType<T>>;
  } & T;

  type Mocked<T> = {
    [P in keyof T]: T[P] extends (...args: any[]) => any
      ? MockedFunction<T[P]>
      : T[P] extends new (...args: any[]) => any
      ? MockedClass<T[P]>
      : T[P];
  } & T;

  type SpyInstance<T extends (...args: any[]) => any> = {
    mockReturnValue(value: ReturnType<T>): SpyInstance<T>;
    mockReturnValueOnce(value: ReturnType<T>): SpyInstance<T>;
    mockResolvedValue<U>(value: U): SpyInstance<T>;
    mockResolvedValueOnce<U>(value: U): SpyInstance<T>;
    mockRejectedValue(value: any): SpyInstance<T>;
    mockRejectedValueOnce(value: any): SpyInstance<T>;
    mockImplementation(fn: (...args: Parameters<T>) => ReturnType<T>): SpyInstance<T>;
    mockImplementationOnce(fn: (...args: Parameters<T>) => ReturnType<T>): SpyInstance<T>;
    mockName(name: string): SpyInstance<T>;
    mockClear(): SpyInstance<T>;
    mockReset(): SpyInstance<T>;
    mockRestore(): SpyInstance<T>;
    getMockImplementation(): Function | undefined;
    getMockName(): string;
    mock: {
      calls: any[][];
      instances: any[];
      invocationCallOrder: number[];
      results: Array<{ type: string; value: any }>;
    };
    mockReturnThis(): SpyInstance<T>;
  };
}

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
  export type SpyInstance<T extends (...args: any[]) => any> = jest.SpyInstance<T>;
}