import type { SuiClient, PaginatedObjectsResponse, GetOwnedObjectsParams, SuiTransactionBlockResponse, ExecuteTransactionBlockParams, TransactionEffects, SuiObjectResponse, GasCostSummary, GetObjectParams } from '@mysten/sui.js/client';
import { mock } from 'jest-mock-extended';
import { TransactionBlock } from '@mysten/sui.js/transactions';

const ownedRef = {
  owner: { AddressOwner: 'mock-address' },
  reference: {
    objectId: 'mock-object-id',
    digest: 'mock-digest',
    version: '1'
  }
};

const effects: TransactionEffects = {
  messageVersion: 'v1',
  status: { status: 'success' },
  executedEpoch: '0',
  transactionDigest: 'mock-digest',
  created: [ownedRef],
  gasObject: ownedRef,
  gasUsed: {
    computationCost: '1000',
    storageCost: '1000',
    storageRebate: '0',
    nonRefundableStorageFee: '10'
  },
  dependencies: [],
  sharedObjects: [],
  mutated: [],
  deleted: [],
  unwrapped: [],
  wrapped: [],
  eventsDigest: null
};

const response: SuiTransactionBlockResponse = {
  digest: 'mock-digest',
  effects,
  confirmedLocalExecution: true,
  timestampMs: null,
  checkpoint: null,
  events: [],
  objectChanges: [],
  balanceChanges: []
};

const mockSuiClient = mock<SuiClient>({
  getObject: jest.fn().mockImplementation(async (input: GetObjectParams): Promise<SuiObjectResponse> => ({
    data: {
      objectId: 'mock-object-id',
      version: '1',
      digest: 'mock-digest',
      type: 'mock-type',
      owner: { AddressOwner: 'mock-owner-address' },
      previousTransaction: 'mock-previous-transaction',
      storageRebate: '1000',
      content: {
        dataType: 'moveObject',
        type: 'mock-type',
        hasPublicTransfer: true,
        fields: {}
      }
    }
  })),

  getOwnedObjects: jest.fn().mockImplementation(async (input: GetOwnedObjectsParams): Promise<PaginatedObjectsResponse> => ({
    data: [{
      data: {
        objectId: 'mock-object-id',
        digest: 'mock-digest',
        version: '1',
        content: {
          dataType: 'moveObject',
          type: 'mock-type',
          hasPublicTransfer: true,
          fields: {}
        }
      }
    }],
    hasNextPage: false,
    nextCursor: null
  })),

  executeTransactionBlock: jest.fn().mockImplementation(async (): Promise<SuiTransactionBlockResponse> => response),

  getTransactionBlock: jest.fn().mockImplementation(async (): Promise<SuiTransactionBlockResponse> => response),

  signAndExecuteTransactionBlock: jest.fn().mockImplementation(async (): Promise<SuiTransactionBlockResponse> => response)
});

type MockedSuiClient = typeof mockSuiClient;
export default mockSuiClient as MockedSuiClient;