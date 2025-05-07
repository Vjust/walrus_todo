import type { TransactionBlock } from '@mysten/sui.js/transactions';

export interface Signer {
  signData(data: Uint8Array): Promise<string>;
  toSuiAddress(): string;
  signTransaction(transaction: TransactionBlock): Promise<string>;
}