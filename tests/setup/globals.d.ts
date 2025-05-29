/**
 * Global type declarations for Jest tests
 */

import type {
  MockSuiClient,
  MockTodoService,
  MockSuiNftStorage,
} from '../mocks';

declare global {
  // Global mock instances
  var MockTodoService: jest.MockedClass<any>;
  var MockSuiClient: jest.MockedClass<any>;
  var MockSuiNftStorage: jest.MockedClass<any>;

  // Make SuiClient available globally for legacy test compatibility
  var SuiClient: jest.MockedClass<any>;

  namespace jest {
    interface MockedClass<T> extends Mock<T> {
      prototype: {
        [K in keyof T]: T[K] extends (...args: any[]) => any
          ? jest.MockedFunction<T[K]>
          : T[K];
      };
    }
  }
}
