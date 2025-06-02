/**
 * Mock implementation for Sui client
 * Provides consistent Sui client mocking across all tests
 */

// Mock Sui client functions
export const mockInitializeSuiClient = jest.fn().mockResolvedValue(true);
export const mockIsSuiClientInitialized = jest.fn(() => false);
export const mockGetSuiClient = jest.fn(() => ({
  getObject: jest.fn(),
  getOwnedObjects: jest.fn(),
  executeTransaction: jest.fn(),
  dryRunTransaction: jest.fn(),
}));

// Mock the sui-client module
jest.mock('@/lib/sui-client', () => ({
  initializeSuiClient: mockInitializeSuiClient,
  isSuiClientInitialized: mockIsSuiClientInitialized,
  getSuiClient: mockGetSuiClient,
  Todo: jest.fn(),
}));

// Mock the sui-client-utils module
jest.mock('@/lib/sui-client-utils', () => ({
  validateNetwork: jest.fn(() => true),
  formatAddress: jest.fn((address: string) => address),
  isValidSuiAddress: jest.fn(() => true),
}));

// Helper to reset Sui client mocks
export const resetSuiClientMocks = () => {
  mockInitializeSuiClient.mockClear();
  mockInitializeSuiClient.mockResolvedValue(true);
  
  mockIsSuiClientInitialized.mockClear();
  mockIsSuiClientInitialized.mockReturnValue(false);
  
  mockGetSuiClient.mockClear();
};

// Auto-reset before each test
beforeEach(() => {
  resetSuiClientMocks();
});