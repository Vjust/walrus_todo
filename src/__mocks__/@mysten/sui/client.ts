import type { SuiClient, PaginatedObjectsResponse, GetOwnedObjectsParams, SuiTransactionBlockResponse, TransactionEffects, SuiObjectResponse, GetObjectParams } from '@mysten/sui/client';

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

// Export SuiClient as a constructor function for compatibility with `new SuiClient()`
export class SuiClient {
  constructor(_config?: { url?: string }) {
    // Mock constructor
  }

  async getObject(_input: GetObjectParams): Promise<SuiObjectResponse> {
    return {
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
    };
  }

  async getOwnedObjects(_input: GetOwnedObjectsParams): Promise<PaginatedObjectsResponse> {
    return {
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
    };
  }

  async executeTransactionBlock(): Promise<SuiTransactionBlockResponse> {
    return response;
  }

  async getTransactionBlock(): Promise<SuiTransactionBlockResponse> {
    return response;
  }

  async waitForTransaction(_params: { digest: string; timeout?: number; options?: any }): Promise<SuiTransactionBlockResponse> {
    return response;
  }

  // Mock the signAndExecuteTransaction method for compatibility
  async signAndExecuteTransaction(): Promise<SuiTransactionBlockResponse> {
    return response;
  }

  async getLatestSuiSystemState(): Promise<any> {
    return { epoch: '123' };
  }

  async getSystemState(): Promise<any> {
    return { epoch: '123' };
  }
}

// Also export functions that might be imported from @mysten/sui/client
export function getFullnodeUrl(network: string): string {
  return `https://mock-${network}-rpc.url.com`;
}

// Export TypeScript types that are commonly imported
export type { SuiTransactionBlockResponse, SuiObjectResponse, PaginatedObjectsResponse };

// Also export a default for compatibility
export default SuiClient;