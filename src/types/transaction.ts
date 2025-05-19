import { TransactionBlock } from '@mysten/sui/transactions';
import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { Signer } from '@mysten/sui/cryptography';
import type { TransactionBlockAdapter } from './adapters/TransactionBlockAdapter';

/**
 * We define Transaction to support both legacy and modern approaches.
 * This avoids errors when the type system expects transaction.blockData etc.
 */
export interface Transaction extends TransactionBlock {
  // Legacy properties for compatibility
  [key: string]: any;
}

export function asTransactionBlock(tx: any): TransactionBlock {
  return tx as unknown as TransactionBlock;
}

export function asUint8ArrayOrTransactionBlock(tx: any): Uint8Array | TransactionBlock {
  return tx as unknown as Uint8Array | TransactionBlock;
}

export function asStringUint8ArrayOrTransactionBlock(tx: any): string | Uint8Array | TransactionBlock {
  return tx as unknown as string | Uint8Array | TransactionBlock;
}

/**
 * Factory function to create a new TransactionBlock instance
 * This provides a safer alternative to direct class instantiation
 */
export function createTransaction(): TransactionBlock {
  return new TransactionBlock();
}

/**
 * Union type for both transaction types
 * Allows for flexible parameter types that accept either implementation
 */
export type TransactionType = TransactionBlock | TransactionBlockAdapter;

export type TransactionWithSigner = {
  transaction?: TransactionType;
  signer: Signer | Ed25519Keypair;
};