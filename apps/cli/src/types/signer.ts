import { Signer } from '@mysten/sui/cryptography';
import { SuiClient } from '../utils/adapters/sui-client-compatibility';

export type TransactionSigner = Signer & {
  client?: SuiClient;
};
