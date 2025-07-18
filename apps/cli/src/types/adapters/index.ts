/**
 * Adapter Pattern Index
 *
 * This file exports all the adapters used to reconcile interface differences
 * between different versions of the libraries.
 */

export * from './TransactionBlockAdapter';
export * from './SignerAdapter';
export * from './WalrusClientAdapter';
export * from './AIModelAdapter';
export * from './AIVerifierAdapter';

// Re-export implementations from utils/adapters
// This ensures that importing from types/adapters will also give access
// to the implementation classes
export {
  SignerAdapterImpl,
  createSignerAdapter,
} from '../../utils/adapters/signer-adapter';

// Export unified types for convenience
export type { UnifiedSigner } from './SignerAdapter';
export type {
  UnifiedTransactionBlock,
  TransactionResult,
} from './TransactionBlockAdapter';
export type {
  NormalizedBlobObject,
  NormalizedWriteBlobResponse,
  UnifiedWalrusClient,
} from './WalrusClientAdapter';
export type {
  AIModelAdapter,
  AIProvider,
  AIModelOptions,
  AICompletionParams,
  AIResponse,
  AIRequestMetadata,
} from './AIModelAdapter';
