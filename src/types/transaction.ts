import type { Transaction as SuiTransaction } from '@mysten/sui/transactions';
import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { Signer } from '@mysten/sui/cryptography';
import type { TransactionBlockAdapter } from './adapters/TransactionBlockAdapter';

/**
 * Re-export Transaction from Sui SDK for compatibility
 */
export type Transaction = SuiTransaction;

/**
 * Legacy TransactionBlock interface for backward compatibility
 * This avoids errors when the type system expects transaction.blockData etc.
 * @deprecated Use Transaction from @mysten/sui/transactions instead
 */
export interface TransactionBlock extends SuiTransaction {
  blockData?: unknown;
  transactions?: unknown[];
  inputs?: unknown[];
  sender?: string;
}

/**
 * Discriminated union types for different transaction implementations
 */
export type TransactionVariant = 
  | { kind: 'sui'; transaction: SuiTransaction }
  | { kind: 'adapter'; transaction: TransactionBlockAdapter };

/**
 * Enhanced transaction type that combines Transaction and TransactionBlockAdapter
 */
export type TransactionType = SuiTransaction | TransactionBlockAdapter;

/**
 * Utility functions for transaction handling
 */
export function isTransactionBlock(obj: unknown): obj is TransactionBlock {
  return (
    obj &&
    typeof obj === 'object' &&
    ('blockData' in obj || 'transactions' in obj)
  );
}

export function isSuiTransaction(obj: unknown): obj is SuiTransaction {
  return obj && typeof obj === 'object' && obj !== null && 'serialize' in obj && typeof (obj as Record<string, unknown>).serialize === 'function';
}

/**
 * Type guard for TransactionVariant discriminated union
 */
export function isTransactionVariant(obj: unknown): obj is TransactionVariant {
  return (
    obj &&
    typeof obj === 'object' &&
    obj !== null &&
    'kind' in obj &&
    'transaction' in obj &&
    ['sui', 'adapter'].includes((obj as Record<string, unknown>).kind as string)
  );
}

/**
 * Type narrowing functions for TransactionVariant
 */
export function isSuiVariant(variant: TransactionVariant): variant is { kind: 'sui'; transaction: SuiTransaction } {
  return variant.kind === 'sui';
}

export function isAdapterVariant(variant: TransactionVariant): variant is { kind: 'adapter'; transaction: TransactionBlockAdapter } {
  return variant.kind === 'adapter';
}

/**
 * @deprecated Legacy TransactionBlock support removed
 */
export function isLegacyVariant(_variant: unknown): _variant is never {
  return false;
}

/**
 * Type predicate for union type narrowing
 */
export function isTransactionType(obj: unknown): obj is TransactionType {
  return isSuiTransaction(obj) || (obj && typeof obj === 'object' && obj !== null && 'getUnderlyingImplementation' in obj);
}

/**
 * Convert various transaction formats to a standard Transaction
 */
export function asTransaction(
  input: SuiTransaction | TransactionBlockAdapter
): SuiTransaction {
  if (isSuiTransaction(input)) {
    return input;
  }

  // For adapter types, extract the underlying implementation
  if ('getUnderlyingImplementation' in input && typeof input.getUnderlyingImplementation === 'function') {
    const underlying = input.getUnderlyingImplementation();
    if (isSuiTransaction(underlying)) {
      return underlying;
    }
  }

  throw new Error('Unable to convert input to Transaction');
}

/**
 * Convert Uint8Array data to appropriate transaction format
 */
export function asUint8ArrayOrTransactionBlock(
  data: Uint8Array | string | SuiTransaction
): Uint8Array | SuiTransaction {
  if (data instanceof Uint8Array) {
    return data;
  }

  if (typeof data === 'string') {
    return new TextEncoder().encode(data);
  }

  return data;
}

/**
 * Convert string or Uint8Array data to string representation
 */
export function asStringUint8ArrayOrTransactionBlock(
  data: string | Uint8Array | SuiTransaction
): string {
  if (typeof data === 'string') {
    return data;
  }

  if (data instanceof Uint8Array) {
    return new TextDecoder().decode(data);
  }

  // For Transaction objects, return a string representation
  return JSON.stringify(data);
}

/**
 * Factory functions for creating discriminated union variants
 */
export function createSuiVariant(transaction: SuiTransaction): TransactionVariant {
  return { kind: 'sui', transaction };
}

export function createAdapterVariant(transaction: TransactionBlockAdapter): TransactionVariant {
  return { kind: 'adapter', transaction };
}

/**
 * @deprecated Legacy TransactionBlock support removed
 */
export function createLegacyVariant(_transaction: unknown): never {
  throw new Error('Legacy TransactionBlock support has been removed');
}

/**
 * Safe transaction variant extraction with type narrowing
 */
export function extractTransaction(variant: TransactionVariant): SuiTransaction | TransactionBlockAdapter {
  switch (variant.kind) {
    case 'sui':
      return variant.transaction;
    case 'adapter':
      return variant.transaction;
    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = variant;
      throw new Error(`Unknown transaction variant: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/**
 * Safe transaction processing with pattern matching
 */
export function processTransactionVariant<T>(
  variant: TransactionVariant,
  handlers: {
    sui: (tx: SuiTransaction) => T;
    adapter: (tx: TransactionBlockAdapter) => T;
  }
): T {
  switch (variant.kind) {
    case 'sui':
      return handlers.sui(variant.transaction);
    case 'adapter':
      return handlers.adapter(variant.transaction);
    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = variant;
      throw new Error(`Unknown transaction variant: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/**
 * Transaction execution context
 */
export interface TransactionContext {
  signer: Signer | Ed25519Keypair;
  gasPrice?: bigint;
  gasBudget?: bigint;
  sender?: string;
}
