import { jest } from '@jest/globals';

const sinon = {
  stub: () => jest.fn(),
  spy: () => jest.fn(),
  mock: () => jest.fn(),
  fake: () => jest.fn(),
  replace: () => jest.fn(),
  restore: () => {},
  reset: () => {},
  resetHistory: () => {},
  verify: () => true
};

export default sinon;