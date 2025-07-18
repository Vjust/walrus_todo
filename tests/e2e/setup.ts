import 'jest-extended';
import { Logger } from '../../apps/cli/src/utils/Logger';

const logger = new Logger('setup');

// Setup for e2e tests
beforeAll(() => {
  // Mock process.exit to prevent tests from actually exiting
  jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
    logger.info(`Process exit called with code: ${code}`);
    return undefined as never;
  });

  // Set test environment flag
  process.env.NODE_ENV = 'test';
  process.env.WALRUS_USE_MOCK = 'true';
});

afterAll(() => {
  // Restore process.exit
  jest.restoreAllMocks();
});

// Increase timeout for e2e tests
jest.setTimeout(30000);
