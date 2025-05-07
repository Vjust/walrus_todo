import { Signer } from '@mysten/sui.js/cryptography';
import { SuiClient } from '@mysten/sui.js/client';

export type TransactionSigner = Signer & {
  client?: SuiClient;
};