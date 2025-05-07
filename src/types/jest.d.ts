/// <reference types="jest" />
/// <reference types="@testing-library/jest-dom" />

declare namespace jest {
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
}

declare module '@jest/expect' {
  interface Expect {
    objectContaining<T>(sample: T): jest.ObjectContaining<T>;
  }
}

export {};