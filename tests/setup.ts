import { expect, jest } from '@jest/globals';
import { TextDecoder, TextEncoder } from 'util';

// Setup TextDecoder/TextEncoder for image-size
global.TextDecoder = TextDecoder;
global.TextEncoder = TextEncoder;

// Configure Jest timeout
jest.setTimeout(10000);

// Ensure mocks are applied
jest.mock('@mysten/sui/dist/cjs/client');
jest.mock('@mysten/sui/dist/cjs/cryptography');
jest.mock('@mysten/sui/dist/cjs/keypairs/ed25519');
jest.mock('@mysten/sui/transactions');

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Configure Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toContain(expected: string): R;
      toHaveBeenCalled(): R;
      toHaveBeenCalledWith(...args: any[]): R;
      toMatchObject(expected: any): R;
      toBeTrue(): R;
      toBeFalse(): R;
      toBeUndefined(): R;
      toBeNull(): R;
      toBeDefined(): R;
      toBeInstanceOf(expected: any): R;
      toEqual(expected: any): R;
      toBe(expected: any): R;
      toMatch(expected: string | RegExp): R;
      toThrow(expected?: string | RegExp | Error): R;
      toHaveLength(expected: number): R;
      toContainEqual(expected: any): R;
      toStrictEqual(expected: any): R;
      objectContaining<E extends {}>(expected: E): R;
      contain(expected: any): R;
    }
  }

  interface ExpectStatic {
    objectContaining<E = {}>(actual: E): E;
  }
}

// Setup test
describe('Setup Test', () => {
  it('should have at least one test', () => {
    expect(true).toBe(true);
  });
});
