import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SuiClient } from '@mysten/sui/client';
import { TransactionBlock } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { SuiTransactionBlockResponse, SuiObjectResponse } from '@mysten/sui/client';
import { IntentScope, SignatureWithBytes } from '@mysten/sui/cryptography';
import { SuiNftStorage } from '../utils/sui-nft-storage';
import { CLIError } from '../types/error';
import { Todo } from '../types/todo';
import { createMockSuiObjectResponse, createMockTransactionResponse, createMockSystemStateResponse } from './sui-test-types';
import { MockPublicKey } from '../__mocks__/@mysten/sui/cryptography/index';

// Setup Jest mocks with proper types
const mockSignAndExecuteTransactionBlock = jest.fn() as jest.MockedFunction<(transaction: TransactionBlock) => Promise<SuiTransactionBlockResponse>>;
const mockGetObject = jest.fn() as jest.MockedFunction<(id: string) => Promise<SuiObjectResponse>>;
const mockGetLatestSuiSystemState = jest.fn().mockResolvedValue(createMockSystemStateResponse());

// Create a properly typed mock SuiClient
const mockSuiClient: jest.MockedObject<SuiClient> = {
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
  multiGetTransactionBlocks: jest.fn()
} as unknown as jest.MockedObject<SuiClient>;

describe('SuiNftStorage', () => {
  const moduleAddress = '0x123';
  let storage: SuiNftStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a proper mock implementation for Ed25519Keypair
    const mockSigner = {
      connect: () => Promise.resolve(),
      getPublicKey: () => new MockPublicKey(),
      sign: (data: Uint8Array) => Promise.resolve(new Uint8Array(64)),
      signPersonalMessage: (data: Uint8Array) => Promise.resolve({
        bytes: Buffer.from(data).toString('base64'),
        signature: Buffer.from(new Uint8Array(64)).toString('base64')
      }),
      signWithIntent: (data: Uint8Array, intent: IntentScope) => Promise.resolve({
        bytes: Buffer.from(data).toString('base64'),
        signature: Buffer.from(new Uint8Array(64)).toString('base64')
      }),
      signTransactionBlock: (transaction: TransactionBlock) => Promise.resolve({
        bytes: 'mock-transaction-bytes',
        signature: Buffer.from(new Uint8Array(64)).toString('base64')
      }),
      signTransaction: (transaction: TransactionBlock) => Promise.resolve({
        bytes: 'mock-transaction-bytes',
        signature: Buffer.from(new Uint8Array(64)).toString('base64')
      }),
      toSuiAddress: () => 'mock-address',
      getKeyScheme: () => 'ED25519' as const,
      export: () => ({ 
        publicKey: new Uint8Array(32).fill(1), 
        secretKey: new Uint8Array(64).fill(1) 
      }),
      signData: (data: Uint8Array) => new Uint8Array(64),
      getKeyPair: () => ({
        publicKey: new Uint8Array(32).fill(1),
        secretKey: new Uint8Array(64).fill(1)
      }),
      deriveKeypair: () => mockSigner
    } as unknown as Ed25519Keypair;
    storage = new SuiNftStorage(mockSuiClient, mockSigner, { address: moduleAddress, packageId: '0x123' });
  });

  // Your existing test cases remain the same
  // ...

});