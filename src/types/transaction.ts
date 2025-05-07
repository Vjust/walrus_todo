import type { TransactionBlock } from '@mysten/sui.js/transactions';
import type { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import type { Signer } from '@mysten/sui.js/cryptography';

export type TransactionWithSigner = {
  transaction?: TransactionBlock;
  signer: Signer | Ed25519Keypair;
};