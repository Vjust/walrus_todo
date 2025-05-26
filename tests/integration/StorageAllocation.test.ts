/* eslint-disable jest/expect-expect */
import { jest } from '@jest/globals';
import { Logger } from '@/utils/Logger';

jest.mock('@mysten/walrus');
jest.mock('@/utils/VaultManager');
jest.mock('@/utils/Logger');

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