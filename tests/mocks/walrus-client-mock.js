// Comprehensive mock for @mysten/walrus to prevent WASM loading issues in tests

// Mock all Walrus client exports
const mockWalrusClient = {
  readBlob: jest.fn().mockResolvedValue(Buffer.from('mock-blob-data')),
  storeBlob: jest.fn().mockResolvedValue({
    blobId: 'mock-blob-id',
    endEpoch: Date.now() + 1000000,
    size: 1024
  }),
  getBlobInfo: jest.fn().mockResolvedValue({
    blobId: 'mock-blob-id',
    size: 1024,
    endEpoch: Date.now() + 1000000
  })
};

// Mock client creation functions
const createWalrusClient = jest.fn().mockResolvedValue(mockWalrusClient);

// Mock all exports
module.exports = {
  // Client creation
  createWalrusClient,
  WalrusClient: jest.fn().mockImplementation(() => mockWalrusClient),
  
  // Client types (for TypeScript compatibility)
  WriteBlobOptions: {},
  StorageWithSizeOptions: {},
  
  // Mock WASM-related exports to prevent loading
  default: jest.fn(),
  __wbg_set_wasm: jest.fn(),
  
  // Export mock client instance
  mockWalrusClient
};