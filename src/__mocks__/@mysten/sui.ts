import { jest } from '@jest/globals';
import { Transaction } from '@mysten/sui/transactions';
import { 
  SuiClient,
  type SuiTransactionBlockResponse,
  type TransactionEffects
} from '@mysten/sui/client';
import type { Keypair } from '@mysten/sui/cryptography';

// Mock Ed25519Keypair
export class Ed25519Keypair {
  private keypair: { publicKey: Uint8Array; secretKey: Uint8Array };

  constructor() {
    this.keypair = {
      publicKey: new Uint8Array(32),
      secretKey: new Uint8Array(64)
    };
  }

  getPublicKey(): Uint8Array {
    return this.keypair.publicKey;
  }

  getKeyScheme(): string {
    return 'ED25519';
  }

  getSecretKey(): Uint8Array {
    return this.keypair.secretKey;
  }

  sign(data: Uint8Array): Uint8Array {
    return new Uint8Array(64); // Mock signature
  }

  signWithIntent(data: Uint8Array, intent: string): Uint8Array {
    return new Uint8Array(64); // Mock signature
  }

  signData(data: Uint8Array): Uint8Array {
    return this.sign(data);
  }

  toSuiAddress(): string {
    return '0x' + '0'.repeat(64);
  }

  export(): { publicKey: string; secretKey: string } {
    return {
      publicKey: Buffer.from(this.keypair.publicKey).toString('hex'),
      secretKey: Buffer.from(this.keypair.secretKey).toString('hex')
    };
  }

  signTransaction(data: Uint8Array): Uint8Array {
    return new Uint8Array(64); // Mock signature
  }

  signPersonalMessage(data: Uint8Array): Uint8Array {
    return new Uint8Array(64); // Mock signature
  }
}

// Simulated blockchain state
const mockBlockchain = {
  objects: new Map<string, any>(),
  transactions: new Map<string, any>(),
  latestTxSeq: 0
};

// Error types
class SuiError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'SuiError';
  }
}

// Transaction simulation helpers
const simulateTransaction = (tx: any) => {
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
const mockGetTransactionBlock = jest.fn(async (digest: string) => {
  const tx = mockBlockchain.transactions.get(digest);
  if (!tx) {
    throw new SuiError('Transaction not found', 'NOT_FOUND');
  }
  return tx;
});

const mockGetObject = jest.fn(async (objectId: string) => {
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

const mockExecuteTransactionBlock = jest.fn(async (tx: Transaction) => {
  try {
    return simulateTransaction(tx);
  } catch (error) {
    throw new SuiError('Transaction execution failed', 'EXECUTION_ERROR');
  }
});

function generateTransactionDigest(): string {
  return '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function mockSignAndExecuteTransaction({ 
  transaction, 
  signer, 
  options = {} 
}: { 
  transaction: Transaction; 
  signer: Keypair; 
  options?: Record<string, unknown>; 
}): Promise<SuiTransactionBlockResponse> {
  const txDigest = generateTransactionDigest();
  const effects: TransactionEffects = {
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

  const response: SuiTransactionBlockResponse = {
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
export class MockSuiClient {
  private mockBlockchain = mockBlockchain;

  constructor(options = {}) {
    // Initialize any options if needed
  }

  // Core RPC methods
  async getObject(input: { id: string, options?: { showContent?: boolean, showType?: boolean } }) {
    return mockGetObject(input.id);
  }

  async getObjectBatch(input: { ids: string[], options?: { showContent?: boolean, showType?: boolean } }) {
    return Promise.all(input.ids.map(id => mockGetObject(id)));
  }

  async getTransactionBlock(input: { digest: string, options?: { showEffects?: boolean, showInput?: boolean } }) {
    return mockGetTransactionBlock(input.digest);
  }

  async signAndExecuteTransactionBlock(input: { 
    transactionBlock: Transaction,
    signer: Keypair,
    options?: {
      showEffects?: boolean,
      showEvents?: boolean
    }
  }): Promise<SuiTransactionBlockResponse> {
    return mockSignAndExecuteTransaction({
      transaction: input.transactionBlock,
      signer: input.signer,
      options: input.options
    });
  }

  // Additional required methods
  async getCoins(input: { owner: string, coinType?: string }) {
    return { data: [] };
  }

  async getAllCoins(input: { owner: string }) {
    return { data: [] };
  }

  async getBalance(input: { owner: string, coinType?: string }) {
    return { coinType: input.coinType || '0x2::sui::SUI', totalBalance: '0' };
  }

  async getOwnedObjects(input: { owner: string, options?: { showContent?: boolean } }) {
    return { data: [] };
  }

  async queryTransactionBlocks(input: any) {
    return { data: [] };
  }

  async multiGetObjects(input: { ids: string[], options?: { showType?: boolean } }) {
    return [];
  }

  async getCheckpoint(input: { id: string }) {
    return {};
  }

  async getLatestCheckpointSequenceNumber() {
    return '0';
  }

  async getEvents(input: { digest: string }) {
    return { data: [] };
  }

  async queryEvents(input: { query: any, limit?: number }) {
    return { data: [] };
  }

  async devInspectTransactionBlock(input: any) {
    return {};
  }

  async dryRunTransactionBlock(input: any) {
    return {};
  }

  async executeTransactionBlock(input: any) {
    return mockExecuteTransactionBlock(input);
  }

  async multiGetTransactionBlocks(input: { digests: string[], options?: any }) {
    return [];
  }

  async subscribeEvent(input: { filter: any, onMessage: (event: any) => void }) {
    return () => {}; // Returns unsubscribe function
  }

  async subscribeTransaction(input: { filter: any }) {
    return { unsubscribe: () => {} };
  }

  // Network info
  getRpcApiVersion(): Promise<string> {
    return Promise.resolve('1.0.0');
  }
}

// Export the mock client instance
export const mockSuiClient = new MockSuiClient();
mockSuiClient.executeTransactionBlock = mockExecuteTransactionBlock;

// Reset functionality
export const resetMocks = () => {
  mockGetTransactionBlock.mockClear();
  mockGetObject.mockClear();
  mockExecuteTransactionBlock.mockClear();
  mockBlockchain.objects.clear();
  mockBlockchain.transactions.clear();
  mockBlockchain.latestTxSeq = 0;
};

// Helper for test setup
export const setupMockObject = (objectId: string, data: any) => {
  mockBlockchain.objects.set(objectId, data);
  return objectId;
};

export { mockSuiClient as SuiClient }; 