import { SuiObjectResponse, SuiTransactionBlockResponse, CoinBalance, SuiSystemStateResponse, PaginatedObjectsResponse, TransactionBlock } from '@mysten/sui.js/client';

export { CoinBalance, SuiSystemStateResponse, PaginatedObjectsResponse };

export interface CoinBalance {
  coinType: string;
  totalBalance: bigint;
  coinObjectCount: number;
  lockedBalance: { number: bigint };
}

export interface SuiSystemStateResponse {
  epoch: string;
}

export interface PaginatedObjectsResponse {
  data: SuiObjectResponse[];
  hasNextPage: boolean;
  nextCursor: string | null;
}

export interface SuiClientInterface {
  readonly address: string;
  readonly instanceId: string;
  connect(): Promise<void>;
  getLatestSuiSystemState(): Promise<SuiSystemStateResponse>;
  getBalance(address: string, coinType?: string): Promise<CoinBalance>;
  getOwnedObjects(args: { owner: string }): Promise<PaginatedObjectsResponse>;
  signAndExecuteTransactionBlock(transaction: TransactionBlock, options?: { requestType?: 'WaitForLocalExecution', options?: { showEffects?: boolean } }): Promise<SuiTransactionBlockResponse>;
  getTransactionBlock(digest: string): Promise<SuiTransactionBlockResponse>;
  executeTransactionBlock(txb: TransactionBlock): Promise<SuiTransactionBlockResponse>;
}

export const SuiClient = jest.fn<SuiClientInterface, []>().mockImplementation(() => ({
  instanceId: 'mock-instance',
  address: 'mock-address',
  getLatestSuiSystemState: jest.fn().mockImplementation(async (): Promise<SuiSystemStateResponse> => ({
    epoch: '1'
  })),

  getBalance: jest.fn().mockImplementation(async (address: string, coinType?: string): Promise<CoinBalance> => ({
    coinType: 'WAL',
    totalBalance: BigInt(1000),
    coinObjectCount: 1,
    lockedBalance: { number: BigInt(0) }
  })),

  getOwnedObjects: jest.fn().mockImplementation(async (args: { owner: string }): Promise<PaginatedObjectsResponse> => ({
    data: [],
    hasNextPage: false,
    nextCursor: null
  })),

  connect: jest.fn().mockImplementation(async () => {}),

  signAndExecuteTransactionBlock: jest.fn().mockImplementation(async (transaction: TransactionBlock): Promise<SuiTransactionBlockResponse> => ({
    digest: 'mock-digest',
    effects: {
      status: { status: 'success' },
      created: [{ reference: { objectId: 'mock-object-id' } }]
    }
  })),

  getTransactionBlock: jest.fn().mockImplementation(async (digest: string): Promise<SuiTransactionBlockResponse> => ({
    digest: 'mock-digest',
    effects: {
      status: { status: 'success' },
      created: [{ reference: { objectId: 'mock-object-id' } }]
    }
  })),

  executeTransactionBlock: jest.fn().mockImplementation(async (transaction: TransactionBlock): Promise<SuiTransactionBlockResponse> => ({
    digest: 'mock-digest',
    effects: {
      status: { status: 'success' },
      created: [{ reference: { objectId: 'mock-object-id' } }]
    }
  }))
}));