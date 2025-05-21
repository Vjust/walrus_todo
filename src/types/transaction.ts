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
 */
export interface TransactionBlock extends SuiTransaction {
  blockData?: any;
  transactions?: any[];
  inputs?: any[];
  sender?: string;
}

/**
 * Enhanced transaction type that combines Transaction and TransactionBlockAdapter
 */
export type TransactionType = SuiTransaction | TransactionBlockAdapter;

/**
 * Utility functions for transaction handling
 */
export function isTransactionBlock(obj: any): obj is TransactionBlock {
  return obj && typeof obj === 'object' && ('blockData' in obj || 'transactions' in obj);
}

export function isSuiTransaction(obj: any): obj is SuiTransaction {
  return obj && typeof obj === 'object' && typeof obj.serialize === 'function';
}

/**
 * Convert various transaction formats to a standard Transaction
 */
export function asTransaction(input: SuiTransaction | TransactionBlock | TransactionBlockAdapter): SuiTransaction {
  if (isSuiTransaction(input)) {
    return input;
  }
  
  // For legacy TransactionBlock, create a new Transaction
  // This is a simplified conversion - in practice you'd need proper serialization
  throw new Error('Legacy TransactionBlock conversion not implemented');
}

/**
 * Convert Uint8Array data to appropriate transaction format
 */
export function asUint8ArrayOrTransactionBlock(data: Uint8Array | string | SuiTransaction): Uint8Array | SuiTransaction {
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
export function asStringUint8ArrayOrTransactionBlock(data: string | Uint8Array | SuiTransaction): string {
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
 * Transaction execution context
 */
export interface TransactionContext {
  signer: Signer | Ed25519Keypair;
  gasPrice?: bigint;
  gasBudget?: bigint;
  sender?: string;
}