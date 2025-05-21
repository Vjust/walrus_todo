
// Create local type definitions to avoid compatibility issues
type SuiTransactionBlockResponse = any;
type SuiObjectResponse = any;
type PaginatedObjectsResponse = any;
type SuiObjectDataOptions = any;
type GetObjsOwnedByAddressResponse = any;
type SuiObjectResponseQuery = any;
type ExecuteTransactionBlockParams = any;
type SuiAddress = string;

export class SuiClient {
  async getObject({ id: _id, options: _options }: { id: string, options?: SuiObjectDataOptions }): Promise<SuiObjectResponse> {
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

  async getObjectsOwnedByAddress(
    _address: string,
    _query?: SuiObjectResponseQuery
  ): Promise<GetObjsOwnedByAddressResponse> {
    return {
      data: [],
      hasNextPage: false,
      nextCursor: null
    };
  }

  async getOwnedObjects({
    owner: _owner,
    filter: _filter,
    options: _options
  }: {
    owner: string;
    filter?: { StructType: string };
    options?: { showContent?: boolean };
  }): Promise<PaginatedObjectsResponse> {
    return {
      data: [],
      hasNextPage: false,
      nextCursor: null
    };
  }

  async executeTransactionBlock(_params: ExecuteTransactionBlockParams): Promise<SuiTransactionBlockResponse> {
    return {
      digest: 'transaction-digest',
      transaction: {
        data: {
          gasData: {
            payment: [],
            owner: '0x123',
            price: '1',
            budget: '1000'
          },
          messageVersion: 'v1',
          transaction: {
            kind: 'ProgrammableTransaction',
            inputs: [],
            transactions: []
          },
          sender: '0x123'
        },
        txSignatures: []
      },
      effects: {
        messageVersion: 'v1',
        status: { status: 'success' },
        executedEpoch: '0',
        gasUsed: {
          computationCost: '0',
          storageCost: '0',
          storageRebate: '0',
          nonRefundableStorageFee: '0'
        },
        modifiedAtVersions: [],
        sharedObjects: [],
        transactionDigest: 'transaction-digest',
        created: [{
          owner: { AddressOwner: 'mock-owner-address' },
          reference: {
            objectId: 'mock-created-object-id',
            digest: 'mock-created-digest',
            version: '1'
          }
        }],
        mutated: [],
        deleted: [],
        unwrapped: [],
        wrapped: [],
        gasObject: { 
          owner: { AddressOwner: 'mock-owner-address' },
          reference: {
            objectId: 'mock-gas-object-id',
            digest: 'mock-gas-digest',
            version: '1'
          }
        },
        events: [],
        dependencies: []
      },
      confirmedLocalExecution: true,
      checkpoint: '123',
      timestampMs: '123456789'
    };
  }

  async getLatestSuiSystemState(): Promise<{ epoch: string }> {
    return { epoch: '123' };
  }
  
  async getSystemState(): Promise<{ epoch: string }> {
    return { epoch: '123' };
  }
  
  async getTransactionBlock({
    digest: _digest,
    options: _options
  }: {
    digest: string;
    options?: { showEffects?: boolean; showEvents?: boolean }
  }): Promise<SuiTransactionBlockResponse> {
    return {
      digest: _digest,
      effects: {
        messageVersion: 'v1',
        status: { status: 'success' },
        executedEpoch: '0',
        gasUsed: {
          computationCost: '0',
          storageCost: '0',
          storageRebate: '0',
          nonRefundableStorageFee: '0'
        },
        modifiedAtVersions: [],
        sharedObjects: [],
        transactionDigest: _digest,
        created: [{
          owner: { AddressOwner: 'mock-owner-address' },
          reference: {
            objectId: 'mock-created-object-id',
            digest: 'mock-created-digest',
            version: '1'
          }
        }],
        mutated: [],
        deleted: [],
        unwrapped: [],
        wrapped: [],
        gasObject: { 
          owner: { AddressOwner: 'mock-owner-address' },
          reference: {
            objectId: 'mock-gas-object-id',
            digest: 'mock-gas-digest',
            version: '1'
          }
        },
        events: [],
        dependencies: []
      },
      transaction: {
        data: {
          gasData: {
            payment: [],
            owner: '0x123',
            price: '1',
            budget: '1000'
          },
          messageVersion: 'v1',
          transaction: {
            kind: 'ProgrammableTransaction',
            inputs: [],
            transactions: []
          },
          sender: '0x123'
        },
        txSignatures: []
      },
      confirmedLocalExecution: true,
      checkpoint: '123',
      timestampMs: '123456789'
    };
  }

  async getBalance({
    owner: _owner,
    coinType: _coinType
  }: {
    owner: SuiAddress;
    coinType: string;
  }): Promise<{
    coinType: string;
    coinObjectCount: number;
    totalBalance: string;
    lockedBalance: { number: string };
  }> {
    return {
      coinType: _coinType,
      coinObjectCount: 1,
      totalBalance: '1000',
      lockedBalance: { number: '0' }
    };
  }
}