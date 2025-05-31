/**
 * Global mock setup for Jest tests (JavaScript version)
 * This file provides global mock definitions that can be used across all test files
 * Ensures consistent mocking across edge-case and fuzz tests
 */

// Enable Jest extensions globally
const { jest } = require('@jest/globals');

// ==================== MOCK STORAGE FOR STATE PERSISTENCE ====================

// Global mock storage to maintain state across mocks
const globalMockStorage = {
  blobs: new Map(),
  todos: new Map(),
  transactions: new Map(),
  walletAccounts: new Map(),
  currentEpoch: 100,
  gasPrice: '1000',
  networkLatency: 0,
  errorSimulation: {
    enabled: false,
    failureRate: 0,
    errorTypes: [],
  },
};

// ==================== WALRUS CLIENT MOCKS ====================

/**
 * Creates memory-efficient mock for Walrus operations
 */
function createWalrusMock() {
  return {
    readBlob: jest.fn().mockImplementation(async params => {
      const blobId = typeof params === 'string' ? params : params.blobId;
      const blob = globalMockStorage.blobs.get(blobId);

      if (
        globalMockStorage.errorSimulation.enabled &&
        Math.random() < globalMockStorage.errorSimulation.failureRate
      ) {
        throw new Error('Simulated network error');
      }

      if (blob) {
        return blob.data;
      }
      return new Uint8Array([1, 2, 3, 4]); // Default fallback
    }),

    writeBlob: jest.fn().mockImplementation(async params => {
      const blobId =
        params.blobId ||
        `mock-blob-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const data = params.blob || params.data || new Uint8Array([1, 2, 3, 4]);
      const size = data.length;

      // Store in global mock storage
      globalMockStorage.blobs.set(blobId, {
        id: blobId,
        data,
        size,
        registered_epoch: globalMockStorage.currentEpoch,
        certified_epoch: globalMockStorage.currentEpoch + 50,
        contentType: params.contentType || 'application/octet-stream',
        metadata: {
          V1: {
            encoding_type: 0,
            unencoded_length: size.toString(),
            hashes: [
              {
                primary_hash: {
                  Digest: new Uint8Array([1, 2, 3, 4]),
                  $kind: 'Digest',
                },
                secondary_hash: {
                  Sha256: new Uint8Array([5, 6, 7, 8]),
                  $kind: 'Sha256',
                },
              },
            ],
            $kind: 'V1',
          },
          $kind: 'V1',
        },
      });

      return {
        blobId,
        blobObject: {
          id: { id: blobId },
          blob_id: blobId,
          registered_epoch: globalMockStorage.currentEpoch,
          certified_epoch: globalMockStorage.currentEpoch + 50,
          size: size.toString(),
          encoding_type: 0,
          deletable: true,
        },
      };
    }),

    getBlobInfo: jest.fn().mockImplementation(async blobId => {
      const blob = globalMockStorage.blobs.get(blobId);
      if (blob) {
        return {
          blob_id: blob.id,
          certified_epoch: blob.certified_epoch,
          registered_epoch: blob.registered_epoch,
          encoding_type: 0,
          unencoded_length: blob.size.toString(),
          size: blob.size.toString(),
          hashes: blob.metadata.V1.hashes,
          metadata: blob.metadata,
        };
      }

      return {
        blob_id: blobId,
        certified_epoch: 150,
        registered_epoch: 100,
        encoding_type: 0,
        unencoded_length: '1024',
        size: '1024',
        hashes: [
          {
            primary_hash: {
              Digest: new Uint8Array([1, 2, 3, 4]),
              $kind: 'Digest',
            },
            secondary_hash: {
              Digest: new Uint8Array([5, 6, 7, 8]),
              $kind: 'Digest',
            },
          },
        ],
      };
    }),

    getBlobObject: jest.fn().mockImplementation(async params => {
      const blobId = typeof params === 'string' ? params : params.blobId;
      const blob = globalMockStorage.blobs.get(blobId);

      if (blob) {
        return {
          id: { id: blob.id },
          blob_id: blob.id,
          registered_epoch: blob.registered_epoch,
          certified_epoch: blob.certified_epoch,
          size: blob.size.toString(),
          encoding_type: 0,
          deletable: true,
          metadata: blob.metadata,
        };
      }

      return {
        id: { id: blobId },
        blob_id: blobId,
        registered_epoch: 100,
        certified_epoch: 150,
        size: '1024',
        encoding_type: 0,
        deletable: true,
      };
    }),

    getBlobMetadata: jest.fn().mockImplementation(async params => {
      const blobId = typeof params === 'string' ? params : params.blobId;
      const blob = globalMockStorage.blobs.get(blobId);

      if (blob) {
        return blob.metadata;
      }

      return {
        V1: {
          encoding_type: 0,
          unencoded_length: '1024',
          hashes: [
            {
              primary_hash: {
                Digest: new Uint8Array([1, 2, 3, 4]),
                $kind: 'Digest',
              },
              secondary_hash: {
                Sha256: new Uint8Array([5, 6, 7, 8]),
                $kind: 'Sha256',
              },
            },
          ],
          $kind: 'V1',
        },
        $kind: 'V1',
      };
    }),

    verifyPoA: jest.fn().mockResolvedValue(true),
    getBlobSize: jest.fn().mockImplementation(async blobId => {
      const blob = globalMockStorage.blobs.get(blobId);
      return blob ? blob.size : 1024;
    }),

    storageCost: jest.fn().mockResolvedValue({
      storageCost: BigInt(100),
      writeCost: BigInt(50),
      totalCost: BigInt(150),
    }),

    executeCreateStorageTransaction: jest.fn().mockResolvedValue({
      digest: 'mock-transaction-digest',
      storage: {
        id: { id: 'storage1' },
        start_epoch: globalMockStorage.currentEpoch,
        end_epoch: globalMockStorage.currentEpoch + 100,
        storage_size: '2048',
      },
    }),

    executeCertifyBlobTransaction: jest.fn().mockResolvedValue({
      digest: 'mock-certify-digest',
    }),

    executeWriteBlobAttributesTransaction: jest.fn().mockResolvedValue({
      digest: 'mock-attributes-digest',
    }),

    deleteBlob: jest.fn().mockImplementation(
      () => tx =>
        Promise.resolve({
          digest: 'mock-delete-digest',
        })
    ),

    executeRegisterBlobTransaction: jest.fn().mockResolvedValue({
      blob: {
        id: { id: 'mock-blob-id' },
        blob_id: 'mock-blob-id',
        registered_epoch: globalMockStorage.currentEpoch,
        certified_epoch: globalMockStorage.currentEpoch + 50,
        size: '1024',
        encoding_type: 0,
        deletable: true,
      },
      digest: 'mock-register-digest',
    }),

    getStorageConfirmationFromNode: jest.fn().mockResolvedValue({
      confirmed: true,
      epoch: 150,
    }),

    createStorageBlock: jest.fn().mockResolvedValue({}),
    createStorage: jest.fn().mockImplementation(
      () => tx =>
        Promise.resolve({
          digest: 'mock-create-storage-digest',
          storage: {
            id: { id: 'storage1' },
            start_epoch: globalMockStorage.currentEpoch,
            end_epoch: globalMockStorage.currentEpoch + 100,
            storage_size: '2048',
          },
        })
    ),

    getStorageProviders: jest
      .fn()
      .mockResolvedValue(['provider1', 'provider2', 'provider3']),

    reset: jest.fn().mockImplementation(() => {
      globalMockStorage.blobs.clear();
      globalMockStorage.currentEpoch = 100;
    }),

    connect: jest.fn().mockResolvedValue(undefined),

    getConfig: jest.fn().mockResolvedValue({
      network: 'testnet',
      version: '1.0.0',
      maxSize: 10485760,
    }),

    getWalBalance: jest.fn().mockResolvedValue('1000'),

    getStorageUsage: jest.fn().mockResolvedValue({
      used: '100',
      total: '1000',
    }),

    experimental: {
      getBlobData: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4])),
    },
  };
}

// ==================== SUI CLIENT MOCKS ====================

/**
 * Creates comprehensive SuiClient mock
 */
function createSuiClientMock() {
  return {
    getLatestSuiSystemState: jest.fn().mockResolvedValue({
      activeValidators: [],
      safeMode: false,
      epoch: globalMockStorage.currentEpoch.toString(),
      referenceGasPrice: globalMockStorage.gasPrice,
      protocolVersion: '1',
      systemStateVersion: '1',
      maxValidatorCount: '100',
      minValidatorCount: '4',
      validatorCandidatesSize: '0',
      atRiskValidators: [],
      storageFundTotalObjectStorageRebates: '0',
      storageFundNonRefundableBalance: '1000000',
      stakeSubsidyCurrentDistributionAmount: '0',
      totalStake: '1000000',
    }),

    getObject: jest.fn().mockImplementation(async params => {
      const objectId = typeof params === 'string' ? params : params.id;
      const todo = globalMockStorage.todos.get(objectId);

      if (todo) {
        return {
          data: {
            objectId: todo.id,
            version: '1',
            digest: 'mock-digest',
            type: 'todo::Todo',
            content: {
              dataType: 'moveObject',
              type: 'todo::Todo',
              hasPublicTransfer: true,
              fields: todo,
            },
          },
          error: null,
        };
      }

      return {
        data: null,
        error: { code: 'objectNotExists', object_id: objectId },
      };
    }),

    executeTransactionBlock: jest.fn().mockImplementation(async params => {
      const transactionId = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Simulate transaction execution delay
      if (globalMockStorage.networkLatency > 0) {
        await new Promise(resolve =>
          setTimeout(resolve, globalMockStorage.networkLatency)
        );
      }

      // Store transaction
      globalMockStorage.transactions.set(transactionId, {
        id: transactionId,
        params,
        timestamp: Date.now(),
        status: 'success',
      });

      return {
        digest: transactionId,
        confirmedLocalExecution: true,
        effects: {
          status: { status: 'success' },
          gasUsed: {
            computationCost: '1000',
            storageCost: '2000',
            storageRebate: '500',
          },
          created: [],
          mutated: [],
          deleted: [],
        },
      };
    }),

    signAndExecuteTransactionBlock: jest
      .fn()
      .mockImplementation(async params => {
        // Reuse executeTransactionBlock logic
        return await createSuiClientMock().executeTransactionBlock(params);
      }),

    dryRunTransactionBlock: jest.fn().mockResolvedValue({
      effects: {
        status: { status: 'success' },
        gasUsed: {
          computationCost: '1000',
          storageCost: '2000',
          storageRebate: '500',
        },
      },
    }),

    multiGetObjects: jest.fn().mockImplementation(async objectIds => {
      return objectIds.map(id => {
        const todo = globalMockStorage.todos.get(id);
        if (todo) {
          return {
            data: {
              objectId: todo.id,
              version: '1',
              digest: 'mock-digest',
              type: 'todo::Todo',
              content: { fields: todo },
            },
            error: null,
          };
        }
        return {
          data: null,
          error: { code: 'objectNotExists', object_id: id },
        };
      });
    }),

    getTransactionBlock: jest.fn().mockImplementation(async digest => {
      const transaction = globalMockStorage.transactions.get(digest);
      if (transaction) {
        return {
          digest,
          transaction: transaction.params,
          effects: {
            status: { status: transaction.status },
          },
        };
      }

      return {
        digest,
        transaction: {},
        effects: {
          status: { status: 'success' },
        },
      };
    }),

    queryTransactionBlocks: jest.fn().mockResolvedValue({
      data: [],
      hasNextPage: false,
    }),

    getAllBalances: jest.fn().mockResolvedValue([]),

    getBalance: jest.fn().mockImplementation(async params => {
      const address = typeof params === 'string' ? params : params.owner;
      const account = globalMockStorage.walletAccounts.get(address);

      return {
        coinType: '0x2::sui::SUI',
        coinObjectCount: 1,
        totalBalance: account ? account.balance : '1000000',
      };
    }),

    getCoins: jest.fn().mockResolvedValue({
      data: [],
      hasNextPage: false,
    }),

    getReferenceGasPrice: jest
      .fn()
      .mockResolvedValue(globalMockStorage.gasPrice),

    getValidatorsApy: jest.fn().mockResolvedValue({
      apys: [],
      epoch: globalMockStorage.currentEpoch.toString(),
    }),

    getOwnedObjects: jest.fn().mockImplementation(async params => {
      const address = typeof params === 'string' ? params : params.owner;
      const account = globalMockStorage.walletAccounts.get(address);

      if (account && account.todos) {
        return {
          data: account.todos.map(todoId => {
            const todo = globalMockStorage.todos.get(todoId);
            return {
              data: {
                objectId: todoId,
                version: '1',
                digest: 'mock-digest',
                type: 'todo::Todo',
                content: { fields: todo },
              },
            };
          }),
          hasNextPage: false,
        };
      }

      return {
        data: [],
        hasNextPage: false,
      };
    }),

    getRpcApiVersion: jest.fn().mockResolvedValue('1.0.0'),

    requestSuiFromFaucet: jest.fn().mockResolvedValue({
      transferredGasObjects: [
        {
          amount: 1000000000,
          id: 'gas-object-id',
          transferTxDigest: 'faucet-tx-digest',
        },
      ],
    }),
  };
}

// ==================== AI SERVICE MOCKS ====================

/**
 * Creates AI service mocks for different providers
 */
function createAIServiceMocks() {
  return {
    openai: {
      chat: {
        completions: {
          create: jest.fn().mockImplementation(async params => {
            // Simulate AI response based on prompt
            const prompt = params.messages?.[0]?.content || '';
            let content = 'Mock AI response';

            if (prompt.includes('suggest') || prompt.includes('task')) {
              content = JSON.stringify({
                suggestions: [
                  'Complete the documentation',
                  'Add unit tests',
                  'Refactor the code',
                ],
              });
            } else if (
              prompt.includes('enhance') ||
              prompt.includes('improve')
            ) {
              content = 'Enhanced version: ' + prompt.substring(0, 100);
            }

            return {
              id: 'chatcmpl-mock',
              object: 'chat.completion',
              created: Math.floor(Date.now() / 1000),
              model: params.model || 'gpt-3.5-turbo',
              choices: [
                {
                  index: 0,
                  message: {
                    role: 'assistant',
                    content,
                  },
                  finish_reason: 'stop',
                },
              ],
              usage: {
                prompt_tokens: 50,
                completion_tokens: 25,
                total_tokens: 75,
              },
            };
          }),
        },
      },
    },

    anthropic: {
      messages: {
        create: jest.fn().mockImplementation(async params => {
          const prompt = params.messages?.[0]?.content || '';
          let content = 'Mock Claude response';

          if (prompt.includes('analyze') || prompt.includes('review')) {
            content = 'Analysis: This appears to be a well-structured request.';
          }

          return {
            id: 'msg_mock',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: content }],
            model: params.model || 'claude-3-sonnet-20240229',
            stop_reason: 'end_turn',
            stop_sequence: null,
            usage: {
              input_tokens: 50,
              output_tokens: 25,
            },
          };
        }),
      },
    },
  };
}

// ==================== FILESYSTEM MOCKS ====================

/**
 * Creates filesystem operation mocks
 */
function createFileSystemMocks() {
  const mockFileSystem = new Map();

  return {
    readFile: jest.fn().mockImplementation(async path => {
      const content = mockFileSystem.get(path);
      if (content !== undefined) {
        return content;
      }

      // Default content for common files
      if (path.includes('config.json')) {
        return JSON.stringify({ network: 'testnet', version: '1.0.0' });
      } else if (path.includes('.env')) {
        return 'NODE_ENV=test\nSUI_NETWORK=testnet';
      } else if (path.includes('todo')) {
        return JSON.stringify({
          id: 'test-todo',
          title: 'Test Todo',
          completed: false,
        });
      }

      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }),

    writeFile: jest.fn().mockImplementation(async (path, data) => {
      mockFileSystem.set(path, data);
    }),

    readdir: jest.fn().mockImplementation(async path => {
      // Return mock directory listings
      if (path.includes('Todos')) {
        return ['todo1.json', 'todo2.json'];
      } else if (path.includes('config')) {
        return ['config.json', 'wallet.json'];
      }
      return [];
    }),

    mkdir: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
      size: 1024,
      mtime: new Date(),
    }),

    // Helper to set mock file content
    _setMockFile: (path, content) => {
      mockFileSystem.set(path, content);
    },

    // Helper to clear mock filesystem
    _clearMockFiles: () => {
      mockFileSystem.clear();
    },
  };
}

// ==================== NETWORK MOCKS ====================

/**
 * Creates network operation mocks
 */
function createNetworkMocks() {
  return {
    fetch: jest.fn().mockImplementation(async (url, options = {}) => {
      // Simulate network latency
      if (globalMockStorage.networkLatency > 0) {
        await new Promise(resolve =>
          setTimeout(resolve, globalMockStorage.networkLatency)
        );
      }

      // Simulate network errors
      if (
        globalMockStorage.errorSimulation.enabled &&
        Math.random() < globalMockStorage.errorSimulation.failureRate
      ) {
        throw new Error('Network request failed');
      }

      // Mock responses based on URL
      let responseData = { success: true };

      if (url.includes('/api/v1/todos')) {
        responseData = { todos: [] };
      } else if (url.includes('/api/v1/ai/')) {
        responseData = { result: 'Mock AI response' };
      } else if (url.includes('faucet')) {
        responseData = { success: true, amount: 1000000000 };
      }

      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => responseData,
        text: async () => JSON.stringify(responseData),
        headers: new Map([['content-type', 'application/json']]),
      };
    }),

    WebSocket: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      readyState: 1, // OPEN
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
    })),
  };
}

// ==================== CRYPTO MOCKS ====================

/**
 * Creates cryptographic operation mocks
 */
function createCryptoMocks() {
  return {
    Ed25519Keypair: jest.fn().mockImplementation(() => ({
      getPublicKey: jest.fn().mockReturnValue({
        toSuiAddress: jest.fn().mockReturnValue('0xtest-address'),
        toBase64: jest.fn().mockReturnValue('mock-public-key-base64'),
      }),
      signData: jest.fn().mockResolvedValue(new Uint8Array(64)),
      getSecretKey: jest.fn().mockReturnValue(new Uint8Array(32)),
      export: jest.fn().mockReturnValue({
        privateKey: 'mock-private-key',
        schema: 'ED25519',
      }),
    })),

    Secp256k1Keypair: jest.fn().mockImplementation(() => ({
      getPublicKey: jest.fn().mockReturnValue({
        toSuiAddress: jest.fn().mockReturnValue('0xtest-secp256k1-address'),
        toBase64: jest.fn().mockReturnValue('mock-secp256k1-public-key-base64'),
      }),
      signData: jest.fn().mockResolvedValue(new Uint8Array(64)),
      getSecretKey: jest.fn().mockReturnValue(new Uint8Array(32)),
    })),

    // General crypto utilities
    randomBytes: jest.fn().mockImplementation(size => new Uint8Array(size)),
    createHash: jest.fn().mockImplementation(() => ({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('mock-hash'),
    })),
  };
}

// ==================== GLOBAL MOCK SETUP ====================

// Create all mock instances
const walrusMock = createWalrusMock();
const suiClientMock = createSuiClientMock();
const aiServiceMocks = createAIServiceMocks();
const fileSystemMocks = createFileSystemMocks();
const networkMocks = createNetworkMocks();
const cryptoMocks = createCryptoMocks();

// ==================== MODULE MOCKS ====================

const { 
  createModuleMock, 
  makePropertiesConfigurable 
} = require('../mocks/mock-factory.js');

// Mock @mysten/walrus with proper property handling
jest.mock('@mysten/walrus', () => {
  const mock = createModuleMock('@mysten/walrus', {
    WalrusClient: () => walrusMock,
    createWalrusClient: () => walrusMock,
  });
  return makePropertiesConfigurable(mock);
});

// Mock @mysten/sui/client with proper property handling
jest.mock('@mysten/sui/client', () => {
  const mock = createModuleMock('@mysten/sui/client', {
    SuiClient: () => suiClientMock,
    getFullnodeUrl: () => 'https://fullnode.testnet.sui.io:443',
  });
  return makePropertiesConfigurable(mock);
});

// Mock @mysten/sui/keypairs/ed25519
jest.mock('@mysten/sui/keypairs/ed25519', () => {
  const mock = createModuleMock('@mysten/sui/keypairs/ed25519', {
    Ed25519Keypair: cryptoMocks.Ed25519Keypair,
  });
  return makePropertiesConfigurable(mock);
});

// Mock @mysten/sui/keypairs/secp256k1
jest.mock('@mysten/sui/keypairs/secp256k1', () => {
  const mock = createModuleMock('@mysten/sui/keypairs/secp256k1', {
    Secp256k1Keypair: cryptoMocks.Secp256k1Keypair,
  });
  return makePropertiesConfigurable(mock);
});

// Mock fs/promises - already handled by moduleNameMapper

// Mock crypto module - already handled by moduleNameMapper

// Mock openai
jest.mock('openai', () => {
  const mock = createModuleMock('openai', {
    OpenAI: () => aiServiceMocks.openai,
  });
  return makePropertiesConfigurable(mock);
});

// Mock anthropic
jest.mock('@anthropic-ai/sdk', () => {
  const mock = createModuleMock('@anthropic-ai/sdk', {
    Anthropic: () => aiServiceMocks.anthropic,
  });
  return makePropertiesConfigurable(mock);
});

// ==================== GLOBAL UTILITIES ====================

/**
 * Global utility functions for test setup and teardown
 */
global.mockUtils = {
  // Storage utilities
  storage: globalMockStorage,

  // Reset all mocks
  resetAllMocks: () => {
    globalMockStorage.blobs.clear();
    globalMockStorage.todos.clear();
    globalMockStorage.transactions.clear();
    globalMockStorage.walletAccounts.clear();
    globalMockStorage.currentEpoch = 100;
    globalMockStorage.gasPrice = '1000';
    globalMockStorage.networkLatency = 0;
    globalMockStorage.errorSimulation = {
      enabled: false,
      failureRate: 0,
      errorTypes: [],
    };

    fileSystemMocks._clearMockFiles();
  },

  // Add mock todo
  addMockTodo: (todoId, todoData) => {
    globalMockStorage.todos.set(todoId, todoData);
  },

  // Add mock wallet account
  addMockWalletAccount: (address, accountData) => {
    globalMockStorage.walletAccounts.set(address, {
      balance: '1000000',
      todos: [],
      ...accountData,
    });
  },

  // Simulate network conditions
  simulateNetworkConditions: (latency = 0, errorRate = 0, errorTypes = []) => {
    globalMockStorage.networkLatency = latency;
    globalMockStorage.errorSimulation = {
      enabled: errorRate > 0,
      failureRate: errorRate,
      errorTypes,
    };
  },

  // Set mock file content
  setMockFile: fileSystemMocks._setMockFile,

  // Advance blockchain epoch
  advanceEpoch: (epochs = 1) => {
    globalMockStorage.currentEpoch += epochs;
  },

  // Get all mocks for cleanup
  getAllMocks: () => ({
    walrus: walrusMock,
    suiClient: suiClientMock,
    aiServices: aiServiceMocks,
    fileSystem: fileSystemMocks,
    network: networkMocks,
    crypto: cryptoMocks,
  }),
};

// ==================== ENVIRONMENT-SPECIFIC SETUP ====================

// CI environment optimizations
if (process.env.CI) {
  // Reduce timeouts in CI
  globalMockStorage.networkLatency = 0;

  // Mock console to reduce noise
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;

  console.log = jest.fn((...args) => {
    if (process.env.DEBUG) {
      originalConsoleLog(...args);
    }
  });

  console.warn = jest.fn((...args) => {
    if (process.env.DEBUG) {
      originalConsoleWarn(...args);
    }
  });
}

// Development environment setup
if (process.env.NODE_ENV === 'development') {
  // Enable more verbose logging in development
  globalMockStorage.networkLatency = 10; // Small delay to simulate real conditions
}

// ==================== MEMORY MANAGEMENT ====================

// Clean up mocks after each test to prevent memory leaks
afterEach(() => {
  // Only clear volatile state, keep persistent mock configurations
  globalMockStorage.blobs.clear();
  globalMockStorage.transactions.clear();

  // Reset mock call counts
  Object.values(walrusMock).forEach(mock => {
    if (mock && typeof mock.mockClear === 'function') {
      mock.mockClear();
    }
  });

  Object.values(suiClientMock).forEach(mock => {
    if (mock && typeof mock.mockClear === 'function') {
      mock.mockClear();
    }
  });
});

// Export storage and utilities for advanced test scenarios
module.exports = {
  globalMockStorage,
  mockUtils: global.mockUtils,
  walrusMock,
  suiClientMock,
  aiServiceMocks,
  fileSystemMocks,
  networkMocks,
  cryptoMocks,
};
