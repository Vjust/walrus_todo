import { TransactionBlock } from '@mysten/sui/transactions';
import type { SuiSystemStateResponse, PaginatedObjectsResponse } from '@mysten/sui/client';
// Export the BCS implementation
import { BCS, bcs } from './bcs';
export { BCS, bcs };

export type SuiObjectResponse = {
  data: {
    objectId: string;
    version: string;
    digest: string;
    type: string;
    owner: { AddressOwner: string };
    content: {
      dataType: 'moveObject';
      type: string;
      hasPublicTransfer: boolean;
      fields: Record<string, any>;
    };
  };
};

export type SuiTransactionBlockResponse = {
  digest: string;
  transaction?: {
    data: {
      transaction: {
        kind: string;
        data: any;
      };
    };
  };
};

export interface SuiClientInterface {
  connect(): Promise<void>;
  getLatestSuiSystemState(): Promise<SuiSystemStateResponse>;
  getOwnedObjects(args: { owner: string }): Promise<PaginatedObjectsResponse>;
}

export const SuiClient = jest.fn<SuiClientInterface, []>().mockImplementation(() => ({
  getLatestSuiSystemState: jest.fn().mockResolvedValue({
    epoch: '1'
  }),
  connect: jest.fn().mockImplementation(async () => {}),

  getOwnedObjects: jest.fn().mockResolvedValue({
    data: [],
    hasNextPage: false,
    nextCursor: null
  })
}));