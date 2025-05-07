import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import type { SuiTransactionBlockResponse, SuiObjectResponse } from '@mysten/sui.js/client';
import { IntentScope, SignatureWithBytes } from '@mysten/sui.js/cryptography';
import { SuiNftStorage } from '../utils/sui-nft-storage';
import { CLIError } from '../types/error';
import { Todo } from '../types/todo';
import { createMockSuiObjectResponse, createMockTransactionResponse } from './sui-test-types';

// Setup Jest mocks with proper types
const mockSignAndExecuteTransactionBlock = jest.fn() as jest.MockedFunction<(transaction: TransactionBlock) => Promise<SuiTransactionBlockResponse>>;
const mockGetObject = jest.fn() as jest.MockedFunction<(id: string) => Promise<SuiObjectResponse>>;
const mockGetLatestSuiSystemState = jest.fn() as jest.MockedFunction<() => Promise<{ epoch: string }>>;

const mockSuiClient = {
  signAndExecuteTransactionBlock: mockSignAndExecuteTransactionBlock,
  waitForTransactionBlock: async () => null,
  getObject: mockGetObject,
  getLatestSuiSystemState: mockGetLatestSuiSystemState,
  url: 'https://mock-rpc-url.com'
} as jest.Mocked<SuiClient>;

describe('SuiNftStorage', () => {
  const moduleAddress = '0x123';
  let storage: SuiNftStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    const mockSigner = {
      connect: () => Promise.resolve(),
      getPublicKey: () => new MockPublicKey(),
      sign: async (data: Uint8Array): Promise<Uint8Array> => new Uint8Array(64),
      signPersonalMessage: async (data: Uint8Array): Promise<SignatureWithBytes> => ({
        bytes: Buffer.from(data).toString('base64'),
        signature: Buffer.from(new Uint8Array(64)).toString('base64')
      }),
      signWithIntent: async (data: Uint8Array, intent: IntentScope): Promise<SignatureWithBytes> => ({
        bytes: Buffer.from(data).toString('base64'),
        signature: Buffer.from(new Uint8Array(64)).toString('base64')
      }),
      signTransactionBlock: async (transaction: TransactionBlock): Promise<SignatureWithBytes> => ({
        bytes: 'mock-transaction-bytes',
        signature: Buffer.from(new Uint8Array(64)).toString('base64')
      }),
      signData: async (data: Uint8Array): Promise<Uint8Array> => new Uint8Array(64),
      signTransaction: async (transaction: TransactionBlock): Promise<SignatureWithBytes> => ({
        bytes: 'mock-transaction-bytes',
        signature: Buffer.from(new Uint8Array(64)).toString('base64')
      }),
      toSuiAddress: () => 'mock-address',
      getKeyScheme: () => 'ED25519' as const
    } as jest.Mocked<Ed25519Keypair>;
    storage = new SuiNftStorage(mockSuiClient, mockSigner, { address: moduleAddress, packageId: '0x123' });
  });

  // Your existing test cases remain the same
  // ...

});