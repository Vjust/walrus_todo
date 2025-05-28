/* eslint-disable jest/expect-expect */
import { jest } from '@jest/globals';
import { Logger } from '../../../apps/cli/src/utils/Logger';

jest.mock('@mysten/walrus');
jest.mock('../../../apps/cli/src/utils/VaultManager');
jest.mock('../../../apps/cli/src/utils/Logger');

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