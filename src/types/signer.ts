import { Signer } from '@mysten/sui/cryptography';
import { SuiClient } from '@mysten/sui/client';

export type TransactionSigner = Signer & {
  client?: SuiClient;
};