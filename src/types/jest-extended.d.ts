/**
 * Extended Jest type definitions to properly handle SpyInstance types
 * This resolves the type errors related to SpyInstance in test files
 */

declare namespace jest {
  // Generic SpyInstance definition that properly handles return types and arguments
  export interface SpyInstance {
    mockImplementation(fn: (...args: any[]) => any): this;
    mockImplementationOnce(fn: (...args: any[]) => any): this;
    mockReturnValue(value: any): this;
    mockReturnValueOnce(value: any): this;
    mockResolvedValue(value: any): this;
    mockResolvedValueOnce(value: any): this;
    mockRejectedValue(value: any): this;
    mockRejectedValueOnce(value: any): this;
    mockReturnThis(): this;
    mockClear(): void;
    mockReset(): void;
    mockRestore(): void;
    mockName(name: string): this;
    getMockName(): string;
    getMockImplementation(): ((...args: any[]) => any) | undefined;
    mock: {
      calls: any[][];
      results: Array<{ type: 'return' | 'throw'; value: any }>;
      instances: any[];
      contexts: any[];
      lastCall: any[];
      invocationCallOrder: number[];
    };
  }

  // Console-specific SpyInstance
  export interface ConsoleSpyInstance extends SpyInstance {
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
  export type SpyInstance = jest.SpyInstance;
}

// Ensure module is properly exported
export {};
