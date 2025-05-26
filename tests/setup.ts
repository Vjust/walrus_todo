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

// Configure Jest matchers - using module augmentation instead of namespace
declare module '@jest/expect' {
  interface Matchers<R> {
    toContain(expected: string): R;
    toHaveBeenCalled(): R;
    toHaveBeenCalledWith(...args: unknown[]): R;
    toMatchObject(expected: unknown): R;
    toBeTrue(): R;
    toBeFalse(): R;
    toBeUndefined(): R;
    toBeNull(): R;
    toBeDefined(): R;
    toBeInstanceOf(expected: unknown): R;
    toEqual(expected: unknown): R;
    toBe(expected: unknown): R;
    toMatch(expected: string | RegExp): R;
    toThrow(expected?: string | RegExp | Error): R;
    toHaveLength(expected: number): R;
    toContainEqual(expected: unknown): R;
    toStrictEqual(expected: unknown): R;
    objectContaining<E extends Record<string, unknown>>(expected: E): R;
    contain(expected: unknown): R;
  }
}

declare global {
  interface ExpectStatic {
    objectContaining<E = Record<string, unknown>>(actual: E): E;
  }
}

// Setup test
describe('Setup Test', () => {
  it('should have at least one test', () => {
    expect(true).toBe(true);
  });
});
