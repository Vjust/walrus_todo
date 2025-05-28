import { expect, jest } from '@jest/globals';

// Configure Jest timeout for CLI tests
jest.setTimeout(15000);

// CLI-specific adapter mocks (extend global mocks)
jest.mock('../utils/adapters/sui-client-adapter', () => ({
  createSuiClientAdapter: jest.fn().mockReturnValue({
    getObject: jest.fn().mockResolvedValue({ data: null }),
    multiGetObjects: jest.fn().mockResolvedValue([]),
    executeTransactionBlock: jest.fn().mockResolvedValue({
      digest: 'mock-digest',
      effects: { status: { status: 'success' } },
    }),
  }),
}));

jest.mock('../utils/adapters/walrus-client-adapter', () => ({
  createWalrusClientAdapter: jest.fn().mockReturnValue({
    store: jest.fn().mockResolvedValue({ blobId: 'mock-blob-id' }),
    read: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  }),
}));

jest.mock('../services/config-service', () => ({
  ConfigService: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockReturnValue('mock-value'),
    set: jest.fn(),
    getWalrusConfig: jest.fn().mockReturnValue({
      publisherUrl: 'http://mock-publisher',
      aggregatorUrl: 'http://mock-aggregator',
    }),
    getSuiConfig: jest.fn().mockReturnValue({
      rpcUrl: 'http://mock-sui-rpc',
      network: 'testnet',
    }),
  })),
}));

jest.mock('../utils/walrus-storage', () => ({
  WalrusStorage: jest.fn().mockImplementation(() => ({
    store: jest.fn().mockResolvedValue({ blobId: 'mock-blob-id' }),
    retrieve: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  })),
}));

// Reset CLI-specific mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  // Ensure test environment is set
  process.env.NODE_ENV = 'test';
  process.env.WALRUS_USE_MOCK = 'true';
});

// Setup test to verify mocks are working
describe('CLI Setup Test', () => {
  it('should have CLI mocks configured', () => {
    expect(jest.isMockFunction(require('../services/config-service').ConfigService)).toBe(true);
    expect(true).toBe(true);
  });
});
