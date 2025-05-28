// Mock for @mysten/walrus-wasm to avoid WebAssembly loading issues in tests
module.exports = {
  // Mock WASM module exports
  WalrusClient: class MockWalrusClient {
    constructor() {
      this.isReady = true;
    }

    async readBlob(blobId) {
      return Buffer.from(`mock-blob-data-for-${blobId}`);
    }

    async storeBlob(data, options = {}) {
      return {
        blobId: `mock-blob-id-${Date.now()}`,
        endEpoch: Date.now() + 1000000,
        size: data.length,
        ...options
      };
    }

    async getBlobInfo(blobId) {
      return {
        blobId,
        size: 1024,
        endEpoch: Date.now() + 1000000,
        storageNodes: ['node1', 'node2']
      };
    }
  },

  // Mock WASM initialization
  init: jest.fn().mockResolvedValue(true),
  
  // Mock other WASM exports
  default: jest.fn(),
  __wbg_set_wasm: jest.fn(),
  __wbindgen_malloc: jest.fn(),
  __wbindgen_free: jest.fn(),
  
  // Mock WebAssembly module
  wasmModule: {
    instance: {
      exports: {}
    }
  }
};