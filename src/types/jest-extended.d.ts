/**
 * Extended Jest type definitions to properly handle SpyInstance types
 * This resolves the type errors related to SpyInstance in test files
 */

declare namespace jest {
  // Generic SpyInstance definition that properly handles return types and arguments
  export interface SpyInstance<T extends (...args: any[]) => any, Y extends any[] = any[]> {
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
      calls: Y[][];
      results: Array<{ type: 'return' | 'throw'; value: any }>;
      instances: any[];
      contexts: any[];
      lastCall: Y[];
      invocationCallOrder: number[];
    };
  }

  // Console-specific SpyInstance
  export interface SpyInstance<void, [message?: any, ...args: any[]], any> extends SpyInstance<(...args: any[]) => void> {
    mockImplementation(fn?: (...args: any[]) => void): this;
  }
}

// Module augmentation for @jest/globals
declare module '@jest/globals' {
  export const expect: jest.Expect;
  export const jest: typeof global.jest;
  export const describe: jest.Describe;
  export const beforeEach: jest.Lifecycle;
  export const afterEach: jest.Lifecycle;
  export const beforeAll: jest.Lifecycle;
  export const afterAll: jest.Lifecycle;
  export const test: jest.It;
  export const it: jest.It;
  
  // Re-export the SpyInstance type
  export type SpyInstance<T extends (...args: any[]) => any, Y extends any[] = Parameters<T>> = jest.SpyInstance<T, Y>;
}

// Ensure module is properly exported
export {};