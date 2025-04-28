"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuiClient = exports.setupMockObject = exports.resetMocks = exports.mockSuiClient = exports.MockSuiClient = exports.Ed25519Keypair = void 0;
const globals_1 = require("@jest/globals");
// Mock Ed25519Keypair
class Ed25519Keypair {
    constructor() {
        this.keypair = {
            publicKey: new Uint8Array(32),
            secretKey: new Uint8Array(64)
        };
    }
    getPublicKey() {
        return this.keypair.publicKey;
    }
    getKeyScheme() {
        return 'ED25519';
    }
    getSecretKey() {
        return this.keypair.secretKey;
    }
    sign(data) {
        return new Uint8Array(64); // Mock signature
    }
    signWithIntent(data, intent) {
        return new Uint8Array(64); // Mock signature
    }
    signData(data) {
        return this.sign(data);
    }
    toSuiAddress() {
        return '0x' + '0'.repeat(64);
    }
    export() {
        return {
            publicKey: Buffer.from(this.keypair.publicKey).toString('hex'),
            secretKey: Buffer.from(this.keypair.secretKey).toString('hex')
        };
    }
    signTransaction(data) {
        return new Uint8Array(64); // Mock signature
    }
    signPersonalMessage(data) {
        return new Uint8Array(64); // Mock signature
    }
}
exports.Ed25519Keypair = Ed25519Keypair;
// Simulated blockchain state
const mockBlockchain = {
    objects: new Map(),
    transactions: new Map(),
    latestTxSeq: 0
};
// Error types
class SuiError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'SuiError';
    }
}
// Transaction simulation helpers
const simulateTransaction = (tx) => {
    mockBlockchain.latestTxSeq += 1;
    const digest = `mock-tx-${mockBlockchain.latestTxSeq}`;
    const result = {
        digest,
        transaction: {
            data: {
                sender: tx.sender || 'mock-sender',
                gasData: {
                    payment: [],
                    owner: tx.sender || 'mock-sender',
                    price: '1000',
                    budget: '10000'
                }
            }
        },
        effects: {
            status: { status: 'success' },
            gasUsed: {
                computationCost: '1000',
                storageCost: '100',
                storageRebate: '10'
            },
            transactionDigest: digest,
            created: [],
            mutated: []
        },
        events: [],
        objectChanges: [],
        balanceChanges: []
    };
    mockBlockchain.transactions.set(digest, result);
    return result;
};
// Enhanced mock implementations
const mockGetTransactionBlock = globals_1.jest.fn(async (digest) => {
    const tx = mockBlockchain.transactions.get(digest);
    if (!tx) {
        throw new SuiError('Transaction not found', 'NOT_FOUND');
    }
    return tx;
});
const mockGetObject = globals_1.jest.fn(async (objectId) => {
    const obj = mockBlockchain.objects.get(objectId);
    if (!obj) {
        throw new SuiError('Object not found', 'NOT_FOUND');
    }
    return {
        data: {
            objectId,
            version: String(mockBlockchain.latestTxSeq),
            digest: `mock-digest-${objectId}`,
            ...obj
        }
    };
});
const mockExecuteTransactionBlock = globals_1.jest.fn(async (tx) => {
    try {
        return simulateTransaction(tx);
    }
    catch (error) {
        throw new SuiError('Transaction execution failed', 'EXECUTION_ERROR');
    }
});
function generateTransactionDigest() {
    return '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}
function mockSignAndExecuteTransaction({ transaction, signer, options = {} }) {
    const txDigest = generateTransactionDigest();
    const effects = {
        messageVersion: "v1",
        status: { status: "success" },
        executedEpoch: "0",
        gasUsed: {
            computationCost: "1000",
            storageCost: "100",
            storageRebate: "10",
            nonRefundableStorageFee: "1"
        },
        transactionDigest: txDigest,
        created: [],
        mutated: [],
        gasObject: {
            owner: { AddressOwner: signer.toSuiAddress() },
            reference: {
                objectId: "0x123",
                version: "1",
                digest: "digest"
            }
        },
        sharedObjects: [],
        deleted: [],
        unwrapped: [],
        wrapped: []
    };
    const response = {
        digest: txDigest,
        effects,
        confirmedLocalExecution: true,
        timestampMs: Date.now().toString(),
        checkpoint: "1",
        errors: []
    };
    mockBlockchain.transactions.set(txDigest, response);
    return Promise.resolve(response);
}
// Enhanced mock client
class MockSuiClient {
    constructor(options = {}) {
        this.mockBlockchain = mockBlockchain;
        // Initialize any options if needed
    }
    // Core RPC methods
    async getObject(input) {
        return mockGetObject(input.id);
    }
    async getObjectBatch(input) {
        return Promise.all(input.ids.map(id => mockGetObject(id)));
    }
    async getTransactionBlock(input) {
        return mockGetTransactionBlock(input.digest);
    }
    async signAndExecuteTransactionBlock(input) {
        return mockSignAndExecuteTransaction({
            transaction: input.transactionBlock,
            signer: input.signer,
            options: input.options
        });
    }
    // Additional required methods
    async getCoins(input) {
        return { data: [] };
    }
    async getAllCoins(input) {
        return { data: [] };
    }
    async getBalance(input) {
        return { coinType: input.coinType || '0x2::sui::SUI', totalBalance: '0' };
    }
    async getOwnedObjects(input) {
        return { data: [] };
    }
    async queryTransactionBlocks(input) {
        return { data: [] };
    }
    async multiGetObjects(input) {
        return [];
    }
    async getCheckpoint(input) {
        return {};
    }
    async getLatestCheckpointSequenceNumber() {
        return '0';
    }
    async getEvents(input) {
        return { data: [] };
    }
    async queryEvents(input) {
        return { data: [] };
    }
    async devInspectTransactionBlock(input) {
        return {};
    }
    async dryRunTransactionBlock(input) {
        return {};
    }
    async executeTransactionBlock(input) {
        return mockExecuteTransactionBlock(input);
    }
    async multiGetTransactionBlocks(input) {
        return [];
    }
    async subscribeEvent(input) {
        return () => { }; // Returns unsubscribe function
    }
    async subscribeTransaction(input) {
        return { unsubscribe: () => { } };
    }
    // Network info
    getRpcApiVersion() {
        return Promise.resolve('1.0.0');
    }
}
exports.MockSuiClient = MockSuiClient;
// Export the mock client instance
exports.mockSuiClient = new MockSuiClient();
exports.SuiClient = exports.mockSuiClient;
exports.mockSuiClient.executeTransactionBlock = mockExecuteTransactionBlock;
// Reset functionality
const resetMocks = () => {
    mockGetTransactionBlock.mockClear();
    mockGetObject.mockClear();
    mockExecuteTransactionBlock.mockClear();
    mockBlockchain.objects.clear();
    mockBlockchain.transactions.clear();
    mockBlockchain.latestTxSeq = 0;
};
exports.resetMocks = resetMocks;
// Helper for test setup
const setupMockObject = (objectId, data) => {
    mockBlockchain.objects.set(objectId, data);
    return objectId;
};
exports.setupMockObject = setupMockObject;
