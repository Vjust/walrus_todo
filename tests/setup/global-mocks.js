/**
 * Global mock setup for Jest tests (JavaScript version)
 * This file provides global mock definitions that can be used across all test files
 */

// Create simple mock classes
function createMockTodoService() {
  return {
    getAllLists: jest.fn(),
    getAllListsSync: jest.fn(),
    listTodos: jest.fn(),
    getAllListsWithContent: jest.fn(),
    createList: jest.fn(),
    getList: jest.fn(),
    getTodo: jest.fn(),
    getTodoByTitle: jest.fn(),
    getTodoByTitleOrId: jest.fn(),
    addTodo: jest.fn(),
    updateTodo: jest.fn(),
    toggleItemStatus: jest.fn(),
    completeTodo: jest.fn(),
    deleteTodo: jest.fn(),
    saveList: jest.fn(),
    deleteList: jest.fn(),
    findTodoByIdOrTitle: jest.fn(),
    findTodoByIdOrTitleAcrossLists: jest.fn(),
  };
}

function createMockSuiClient() {
  return {
    getLatestSuiSystemState: jest.fn().mockResolvedValue({
      activeValidators: [],
      safeMode: false,
      epoch: '0',
      referenceGasPrice: '1000',
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
    getObject: jest.fn().mockResolvedValue({ data: null, error: null }),
    executeTransactionBlock: jest.fn().mockResolvedValue({
      digest: 'mock-digest',
      confirmedLocalExecution: true,
      effects: {
        status: { status: 'success' },
        gasUsed: { computationCost: '1000', storageCost: '2000', storageRebate: '500' },
      },
    }),
    signAndExecuteTransactionBlock: jest.fn().mockResolvedValue({
      digest: 'mock-digest',
      confirmedLocalExecution: true,
      effects: {
        status: { status: 'success' },
        gasUsed: { computationCost: '1000', storageCost: '2000', storageRebate: '500' },
      },
    }),
  };
}

function createMockSuiNftStorage() {
  return {
    createTodoNft: jest.fn().mockResolvedValue({
      objectId: 'mock-nft-object-id',
      digest: 'mock-digest',
      transaction: {},
    }),
    updateTodoNftCompletionStatus: jest.fn().mockResolvedValue({
      objectId: 'mock-nft-object-id',
      digest: 'mock-update-digest',
      transaction: {},
    }),
    deleteTodoNft: jest.fn().mockResolvedValue({
      digest: 'mock-delete-digest',
      transaction: {},
    }),
    getTodoNft: jest.fn().mockResolvedValue({
      objectId: 'mock-nft-object-id',
      data: {
        title: 'Mock Todo',
        description: 'Mock Description',
        completed: false,
      },
    }),
    getAllTodoNfts: jest.fn().mockResolvedValue([]),
    verifyTodoNftOwnership: jest.fn().mockResolvedValue(true),
  };
}

// Create mock class constructors
function MockTodoServiceClass() {
  return createMockTodoService();
}
MockTodoServiceClass.prototype = createMockTodoService();

function MockSuiClientClass() {
  return createMockSuiClient();
}
MockSuiClientClass.prototype = createMockSuiClient();

function MockSuiNftStorageClass() {
  return createMockSuiNftStorage();
}
MockSuiNftStorageClass.prototype = createMockSuiNftStorage();

// Make available globally
global.MockTodoService = MockTodoServiceClass;
global.MockSuiClient = MockSuiClientClass;
global.MockSuiNftStorage = MockSuiNftStorageClass;

// Make SuiClient available globally for legacy test compatibility
global.SuiClient = MockSuiClientClass;

// Setup global Jest mocks for common modules
jest.doMock('@mysten/sui/client', () => ({
  SuiClient: MockSuiClientClass,
  getFullnodeUrl: jest.fn(() => 'https://test.endpoint'),
}));

jest.doMock('@mysten/sui/keypairs/ed25519', () => ({
  Ed25519Keypair: jest.fn().mockImplementation(() => ({
    getPublicKey: jest.fn().mockReturnValue({
      toSuiAddress: jest.fn().mockReturnValue('0xtest-address'),
    }),
    signData: jest.fn().mockResolvedValue(new Uint8Array()),
  })),
}));

// Mock Walrus client
jest.doMock('@mysten/walrus', () => ({
  WalrusClient: jest.fn().mockImplementation(() => ({
    readBlob: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4])),
    writeBlob: jest.fn().mockResolvedValue({
      blobId: 'mock-blob-id',
      blobObject: { id: { id: 'mock-blob-id' } }
    }),
  })),
}));