import { describe, beforeEach, jest } from '@jest/globals';
import { SuiClient } from '../utils/adapters/sui-client-adapter';
import { TransactionBlock } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type {
  SuiTransactionBlockResponse,
  SuiObjectResponse,
} from '@mysten/sui/client';
import { IntentScope } from '@mysten/sui/cryptography';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { SuiNftStorage } from '../utils/sui-nft-storage';
// CLIError imported but not used
// Todo imported but not used
import { createMockSystemStateResponse } from './sui-test-types';
// MockPublicKey is automatically available via jest.mock

// Setup Jest mocks with proper types
const mockSignAndExecuteTransactionBlock = jest.fn() as jest.MockedFunction<
  (transaction: TransactionBlock) => Promise<SuiTransactionBlockResponse>
>;
const mockGetObject = jest.fn() as jest.MockedFunction<
  (id: string) => Promise<SuiObjectResponse>
>;
const mockGetLatestSuiSystemState = jest
  .fn()
  .mockResolvedValue(createMockSystemStateResponse());

// Create a properly typed mock SuiClient (for future use)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _mockSuiClient: jest.MockedObject<SuiClient> = {
  signAndExecuteTransactionBlock: mockSignAndExecuteTransactionBlock,
  waitForTransactionBlock: jest.fn().mockResolvedValue(null),
  getObject: mockGetObject,
  getLatestSuiSystemState: mockGetLatestSuiSystemState,
  url: 'https://mock-rpc-url.com',
  // Add other required methods with empty implementations
  // to satisfy the SuiClient interface
  getTransactionBlock: jest.fn(),
  executeTransactionBlock: jest.fn(),
  getDynamicFields: jest.fn(),
  getCheckpoint: jest.fn(),
  getEvents: jest.fn(),
  getTransactionBlocks: jest.fn(),
  getCoins: jest.fn(),
  getAllCoins: jest.fn(),
  getBalance: jest.fn(),
  getStakes: jest.fn(),
  getReferenceGasPrice: jest.fn(),
  getAllBalances: jest.fn(),
  getOwnedObjects: jest.fn(),
  getTotalTransactionBlocks: jest.fn(),
  subscribeTransaction: jest.fn(),
  subscribeEvent: jest.fn(),
  devInspectTransactionBlock: jest.fn(),
  multiGetObjects: jest.fn(),
  multiGetTransactionBlocks: jest.fn(),
} as unknown as jest.MockedObject<SuiClient>;

describe('SuiNftStorage', () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _moduleAddress = '0x123';
  // let storage: SuiNftStorage; // Commented out - will be used when tests are implemented

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a proper mock implementation for Ed25519Keypair
    const mockSigner = {
      connect: () => Promise.resolve(),
      getPublicKey: () => ({
        toSuiAddress: () => 'mock-address',
        toBase64: () => 'mock-public-key-base64',
        toBytes: () => new Uint8Array(32).fill(1),
        toString: () => 'mock-public-key-string',
        equals: () => true,
      }),
      sign: (_data: Uint8Array) => Promise.resolve(new Uint8Array(64)),
      signPersonalMessage: (_data: Uint8Array) =>
        Promise.resolve({
          bytes: Buffer.from(_data).toString('base64'),
          signature: Buffer.from(new Uint8Array(64)).toString('base64'),
        }),
      signWithIntent: (_data: Uint8Array, _intent: IntentScope) =>
        Promise.resolve({
          bytes: Buffer.from(_data).toString('base64'),
          signature: Buffer.from(new Uint8Array(64)).toString('base64'),
        }),
      signTransactionBlock: (_transaction: TransactionBlock) =>
        Promise.resolve({
          bytes: 'mock-transaction-bytes',
          signature: Buffer.from(new Uint8Array(64)).toString('base64'),
        }),
      signTransaction: (_transaction: TransactionBlock) =>
        Promise.resolve({
          bytes: 'mock-transaction-bytes',
          signature: Buffer.from(new Uint8Array(64)).toString('base64'),
        }),
      toSuiAddress: () => 'mock-address',
      getKeyScheme: () => 'ED25519' as const,
      export: () => ({
        publicKey: new Uint8Array(32).fill(1),
        secretKey: new Uint8Array(64).fill(1),
      }),
      signData: (_data: Uint8Array) => new Uint8Array(64),
      getKeyPair: () => ({
        publicKey: new Uint8Array(32).fill(1),
        secretKey: new Uint8Array(64).fill(1),
      }),
      deriveKeypair: () => mockSigner,
    } as unknown as Ed25519Keypair;
    // storage = new SuiNftStorage(mockSuiClient, mockSigner, { address: moduleAddress, packageId: '0x123' }); // Will be used when tests are implemented
  });

  // Your existing test cases remain the same
  // ...
});
