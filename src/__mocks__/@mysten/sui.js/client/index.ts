import { type SuiObjectResponse, type SuiTransactionBlockResponse, type TransactionEffects } from '@mysten/sui.js/client';
import { type TransactionBlock } from '@mysten/sui.js/transactions';

// This interface matches the sui.js definition with an additional coinObjectId property
// needed for our tests
interface CoinBalance {
  coinType: string;
  totalBalance: bigint;
  coinObjectCount: number;
  lockedBalance: { number: bigint };
  // Note: coinObjectId is not part of the original CoinBalance interface in sui.js
  // but we need it in our tests, so we'll use type assertions to handle this
}

export interface SuiSystemStateResponse {
  epoch: string;
}

export interface PaginatedObjectsResponse {
  data: SuiObjectResponse[];
  hasNextPage: boolean;
  nextCursor: string | null;
}

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

export const SuiClient = jest.fn().mockImplementation(() => ({
  instanceId: 'mock-instance',
  address: 'mock-address',

  getLatestSuiSystemState: jest.fn().mockImplementation(async (): Promise<SuiSystemStateResponse> => ({
    epoch: '1'
  })),

  getBalance: jest.fn().mockImplementation(async (): Promise<CoinBalance> => ({
    coinType: 'WAL',
    totalBalance: BigInt(1000),
    coinObjectCount: 1,
    lockedBalance: { number: BigInt(0) }
    // coinObjectId property removed to match the actual CoinBalance interface
  } as unknown as CoinBalance & { coinObjectId: string })),

  getOwnedObjects: jest.fn().mockImplementation(async (): Promise<PaginatedObjectsResponse> => ({
    data: [{
      data: {
        objectId: 'mock-object-id',
        version: '1',
        digest: 'mock-digest',
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

  connect: jest.fn().mockImplementation(async () => {}),

  signAndExecuteTransactionBlock: jest.fn().mockImplementation(async (): Promise<SuiTransactionBlockResponse> => response),

  getTransactionBlock: jest.fn().mockImplementation(async (): Promise<SuiTransactionBlockResponse> => response),

  executeTransactionBlock: jest.fn().mockImplementation(async (): Promise<SuiTransactionBlockResponse> => response)
}));