import { jest } from '@jest/globals';


import { TransactionBlock } from '@mysten/sui.js/transactions';
import type { SuiTransactionBlockResponse, SuiObjectResponse } from '@mysten/sui.js/client';

export class SuiClient {
  protected rpcUrl: string;

  constructor(rpcUrl: string = 'http://127.0.0.1:5001') {
    this.rpcUrl = rpcUrl;
  }

  async connect(): Promise<void> {
    return Promise.resolve();
  }

  getLatestSuiSystemState = () => Promise.resolve({
    epoch: '0',
  });

  getBalance = () => Promise.resolve({
    coinType: 'WAL',
    totalBalance: '1000',
  });

  getOwnedObjects = () => Promise.resolve({
    data: [] as SuiObjectResponse[],
  });

  getObject = () => Promise.resolve({
    data: null,
  });

  signAndExecuteTransactionBlock = (input: { transaction: TransactionBlock, requestType?: 'WaitForLocalExecution', options?: { showEffects?: boolean } }) => Promise.resolve({
    effects: {
      status: { status: 'success' },
      created: [{ reference: { objectId: 'new-object-id' } }],
    },
    digest: 'tx-digest',
  });
}