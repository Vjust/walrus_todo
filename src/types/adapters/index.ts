/**
 * Adapter Pattern Index
 * 
 * This file exports all the adapters used to reconcile interface differences
 * between different versions of the libraries.
 */

export * from './TransactionBlockAdapter';
export * from './SignerAdapter';
export * from './WalrusClientAdapter';

// Export unified types for convenience
export type { 
  UnifiedSigner 
} from './SignerAdapter';
export type { 
  UnifiedTransactionBlock,
  TransactionResult
} from './TransactionBlockAdapter';
export type {
  NormalizedBlobObject,
  NormalizedWriteBlobResponse,
  UnifiedWalrusClient
} from './WalrusClientAdapter';