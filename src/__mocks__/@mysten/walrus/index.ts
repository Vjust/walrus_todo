import { jest } from '@jest/globals';
import { MockWalrusClient } from './client';

export const WalrusClient = jest.fn().mockImplementation(() => {
  return new MockWalrusClient();
});