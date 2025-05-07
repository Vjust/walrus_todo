import { type SuiObjectResponse, type SuiTransactionBlockResponse, type TransactionEffects } from '@mysten/sui.js/client';
import { type TransactionBlock } from '@mysten/sui.js/transactions';

interface CoinBalance {
  coinType: string;
  totalBalance: bigint;
  coinObjectCount: number;
  lockedBalance: { number: bigint };
  coinObjectId: string;
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
    lockedBalance: { number: BigInt(0) },
    coinObjectId: 'mock-coin-object-id'
  })),

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