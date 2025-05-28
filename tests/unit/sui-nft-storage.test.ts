import { describe, beforeEach, jest } from '@jest/globals';

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type {
  SuiTransactionBlockResponse,
  SuiObjectResponse,
} from '../../apps/cli/src/utils/adapters/sui-client-compatibility';
import { IntentScope, SignatureWithBytes } from '@mysten/sui/cryptography';
import { SuiNftStorage } from '../../apps/cli/src/utils/sui-nft-storage';
import { SuiClient } from '../../apps/cli/src/utils/adapters/sui-client-compatibility';
import { Transaction } from '@mysten/sui/transactions';
import {
  createMockSuiObjectResponse,
  createMockTransactionResponse,
} from '../sui-test-types';

// Mock PublicKey class for testing
class MockPublicKey {
  toRawBytes(): Uint8Array {
    return new Uint8Array(32);
  }

  flag(): number {
    return 0;
  }

  toSuiAddress(): string {
    return 'mock-address';
  }
}

// Setup Jest mocks with proper types
const mockSignAndExecuteTransactionBlock = jest.fn() as jest.MockedFunction<
  (transaction: Transaction) => Promise<SuiTransactionBlockResponse>
>;
const mockGetObject = jest.fn() as jest.MockedFunction<
  (id: string) => Promise<SuiObjectResponse>
>;
const mockGetLatestSuiSystemState = jest.fn() as jest.MockedFunction<
  () => Promise<{ epoch: string }>
>;

const mockSuiClient = {
  signAndExecuteTransactionBlock: mockSignAndExecuteTransactionBlock,
  waitForTransactionBlock: async () => null,
  getObject: mockGetObject,
  getLatestSuiSystemState: mockGetLatestSuiSystemState,
  url: 'https://mock-rpc-url.com',
} as jest.Mocked<InstanceType<typeof SuiClient>>;

describe('SuiNftStorage', () => {
  const moduleAddress = '0x123';
  let storage: SuiNftStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    const mockSigner = {
      connect: () => Promise.resolve(),
      getPublicKey: () => new MockPublicKey(),
      sign: async (_data: Uint8Array): Promise<Uint8Array> =>
        new Uint8Array(64),
      signPersonalMessage: async (
        data: Uint8Array
      ): Promise<SignatureWithBytes> => ({
        bytes: Buffer.from(data).toString('base64'),
        signature: Buffer.from(new Uint8Array(64)).toString('base64'),
      }),
      signWithIntent: async (
        data: Uint8Array,
        _intent: IntentScope
      ): Promise<SignatureWithBytes> => ({
        bytes: Buffer.from(data).toString('base64'),
        signature: Buffer.from(new Uint8Array(64)).toString('base64'),
      }),
      signTransactionBlock: async (
        _transaction: Transaction
      ): Promise<SignatureWithBytes> => ({
        bytes: 'mock-transaction-bytes',
        signature: Buffer.from(new Uint8Array(64)).toString('base64'),
      }),
      signData: async (_data: Uint8Array): Promise<Uint8Array> =>
        new Uint8Array(64),
      signTransaction: async (
        _transaction: Transaction
      ): Promise<SignatureWithBytes> => ({
        bytes: 'mock-transaction-bytes',
        signature: Buffer.from(new Uint8Array(64)).toString('base64'),
      }),
      toSuiAddress: () => 'mock-address',
      getKeyScheme: () => 'ED25519' as const,
    } as unknown as jest.Mocked<Ed25519Keypair>;
    storage = new SuiNftStorage(mockSuiClient, mockSigner, {
      address: moduleAddress,
      packageId: '0x123',
    });
  });

  // Test to verify mock functions are working
  it('should verify mock functions are available', () => {
    const mockObjectResponse = createMockSuiObjectResponse({ id: 'test-id' });
    const mockTxResponse = createMockTransactionResponse(true);

    expect(mockObjectResponse.data?.content).toBeDefined();
    expect(mockTxResponse.digest).toBe('test-digest');
    expect(storage).toBeInstanceOf(SuiNftStorage);
  });
});
