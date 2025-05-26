/**
 * Extended Jest type definitions to properly handle SpyInstance types
 * This resolves the type errors related to SpyInstance in test files
 */

// Use interface declarations instead of namespace
interface JestSpyInstance {
  mockImplementation(fn: (...args: unknown[]) => unknown): JestSpyInstance;
  mockImplementationOnce(fn: (...args: unknown[]) => unknown): JestSpyInstance;
  mockReturnValue(value: unknown): JestSpyInstance;
  mockReturnValueOnce(value: unknown): JestSpyInstance;
  mockResolvedValue(value: unknown): JestSpyInstance;
  mockResolvedValueOnce(value: unknown): JestSpyInstance;
  mockRejectedValue(value: unknown): JestSpyInstance;
  mockRejectedValueOnce(value: unknown): JestSpyInstance;
  mockReturnThis(): JestSpyInstance;
  mockClear(): void;
  mockReset(): void;
  mockRestore(): void;
  mockName(name: string): JestSpyInstance;
  getMockName(): string;
  getMockImplementation(): ((...args: unknown[]) => unknown) | undefined;
  mock: {
    calls: unknown[][];
    results: Array<{ type: 'return' | 'throw'; value: unknown }>;
    instances: unknown[];
    contexts: unknown[];
    lastCall: unknown[];
    invocationCallOrder: number[];
  };
}

// Console-specific SpyInstance
interface ConsoleSpyInstance extends JestSpyInstance {
  mockImplementation(fn?: (...args: unknown[]) => void): ConsoleSpyInstance;
}

// Module augmentation for @jest/globals
declare module '@jest/globals' {
  export const expect: unknown;
  export const jest: typeof global.jest;
  export const describe: unknown;
  export const beforeEach: unknown;
  export const afterEach: unknown;
  export const beforeAll: unknown;
  export const afterAll: unknown;
  export const test: unknown;
  export const it: unknown;

  // Re-export the SpyInstance type
  export type SpyInstance = JestSpyInstance;
}

// Ensure module is properly exported
export {};
