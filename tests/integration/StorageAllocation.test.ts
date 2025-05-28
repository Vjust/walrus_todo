/* eslint-disable jest/expect-expect */
import { jest } from '@jest/globals';
import { Logger } from '../../../apps/cli/src/utils/Logger';

// Mock external dependencies
jest.mock('@mysten/walrus', () => ({}));

// Mock internal utilities with proper implementations
jest.mock('../../../apps/cli/src/utils/VaultManager', () => ({
  VaultManager: jest.fn().mockImplementation(() => ({
    createVault: jest.fn(),
    getVaultMetadata: jest.fn(),
    storeBlob: jest.fn(),
    retrieveBlob: jest.fn(),
  })),
}));

jest.mock('../../../apps/cli/src/utils/Logger', () => ({
  Logger: {
    getInstance: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    })),
  },
}));

describe('Storage Allocation Integration', () => {
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    (Logger.getInstance as jest.Mock).mockReturnValue(mockLogger);
  });

  test('should setup mock infrastructure correctly', () => {
    expect(mockLogger).toBeDefined();
    expect(Logger.getInstance).toHaveBeenCalled();
  });
});
