import { TransactionBlock } from '@mysten/sui.js/transactions';
import type { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import type { Signer } from '@mysten/sui.js/cryptography';
import type { TransactionBlockAdapter } from './adapters/TransactionBlockAdapter';

/**
 * Alias for TransactionBlock from '@mysten/sui.js/transactions'
 * This maintains backward compatibility while avoiding extension issues
 */
export type Transaction = TransactionBlock;

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