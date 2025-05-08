/**
 * TransactionBlockAdapter
 * 
 * This adapter reconciles differences between different versions of TransactionBlock
 * interfaces in the @mysten/sui.js and @mysten/sui libraries.
 * 
 * It provides a consistent interface that both mock implementations and actual
 * code can use without worrying about version-specific differences.
 */

import { TransactionBlock as TransactionBlockSui } from '@mysten/sui.js/transactions';
// Import Transaction from our type definition to avoid direct import errors
import { Transaction } from '../transaction';
import type { SuiObjectRef } from '@mysten/sui.js/client';
import type { TransactionArgument, TransactionObjectArgument } from '@mysten/sui.js/transactions';

// Define a unified TransactionResult type that can handle different return types
export type TransactionResult = TransactionObjectArgument;

/**
 * The UnifiedTransactionBlock interface defines a standardized interface
 * that works with both library versions
 */
export interface UnifiedTransactionBlock {
  // Core methods
  setGasBudget(budget: bigint | number): void;
  setGasPrice(price: bigint | number): void;
  moveCall(params: {
    target: `${string}::${string}::${string}`;
    arguments?: TransactionArgument[];
    typeArguments?: string[];
  }): TransactionResult;

  transferObjects(
    objects: (string | TransactionObjectArgument)[],
    address: string | TransactionObjectArgument
  ): TransactionResult;

  /**
   * Creates a reference to a transaction object
   */
  object(value: string | SuiObjectRef | { objectId: string; digest?: string; version?: string | number | bigint }): TransactionObjectArgument;

  /**
   * Creates a reference to a pure value
   */
  pure(value: any, type?: string): TransactionObjectArgument;

  /**
   * Creates a vector of objects or values
   */
  makeMoveVec(params: {
    objects: (string | TransactionObjectArgument)[];
    type?: string;
  }): TransactionResult;

  /**
   * Creates multiple coins of the specified amount
   */
  splitCoins(
    coin: string | TransactionObjectArgument,
    amounts: (string | number | bigint | TransactionArgument)[]
  ): TransactionResult;

  /**
   * Merges multiple coins into one
   */
  mergeCoins(
    destination: string | TransactionObjectArgument,
    sources: (string | TransactionObjectArgument)[]
  ): void;

  // Utility methods
  setGasBudget(budget: bigint | number): void;
  setGasPrice(price: bigint | number): void;
  setSender(sender: string): void;
  
  // Added to match utils/adapters/transaction-adapter.ts
  build(options?: any): Promise<Uint8Array>;
  serialize(): string;
  getDigest(): Promise<string>;
  getTransactionBlock(): Transaction | TransactionBlockSui;
}

/**
 * TransactionBlockAdapter implements the UnifiedTransactionBlock interface
 * and wraps a Transaction or TransactionBlockSui instance
 */
export class TransactionBlockAdapter implements UnifiedTransactionBlock {
  private transactionBlock: Transaction | TransactionBlockSui;

  constructor(transactionBlock?: Transaction | TransactionBlockSui) {
    // Use type guard to handle instantiation properly
    if (transactionBlock) {
      this.transactionBlock = transactionBlock;
    } else {
      // Create a new instance using the TransactionBlockSui constructor
      this.transactionBlock = new TransactionBlockSui();
    }
  }

  /**
   * Gets the underlying transaction block implementation
   */
  getTransactionBlock(): Transaction | TransactionBlockSui {
    return this.transactionBlock;
  }

  /**
   * Executes a Move call
   */
  moveCall(params: {
    target: `${string}::${string}::${string}`;
    arguments?: TransactionArgument[];
    typeArguments?: string[];
  }): TransactionResult {
    return this.transactionBlock.moveCall(params);
  }

  /**
   * Transfers objects to an address
   */
  transferObjects(
    objects: (string | TransactionObjectArgument)[],
    address: string | TransactionObjectArgument
  ): TransactionResult {
    const result = this.transactionBlock.transferObjects(objects as any, address as any);
    return result as unknown as TransactionResult;
  }

  /**
   * Creates a reference to a transaction object
   */
  object(value: string | SuiObjectRef | { objectId: string; digest?: string; version?: string | number | bigint }): TransactionObjectArgument {
    return this.transactionBlock.object(value as any);
  }

  /**
   * Creates a reference to a pure value
   */
  pure(value: any, type?: string): TransactionObjectArgument {
    const result = this.transactionBlock.pure(value, type as any);
    return result as unknown as TransactionObjectArgument;
  }

  /**
   * Creates a vector of objects or values
   */
  makeMoveVec(params: {
    objects: (string | TransactionObjectArgument)[];
    type?: string;
  }): TransactionResult {
    const result = this.transactionBlock.makeMoveVec(params as any);
    return result as unknown as TransactionResult;
  }

  /**
   * Creates multiple coins of the specified amount
   */
  splitCoins(
    coin: string | TransactionObjectArgument,
    amounts: (string | number | bigint | TransactionArgument)[]
  ): TransactionResult {
    return this.transactionBlock.splitCoins(coin as any, amounts as any);
  }

  /**
   * Merges multiple coins into one
   */
  mergeCoins(
    destination: string | TransactionObjectArgument,
    sources: (string | TransactionObjectArgument)[]
  ): void {
    this.transactionBlock.mergeCoins(destination as any, sources as any);
  }

  /**
   * Sets the gas budget for the transaction
   */
  setGasBudget(budget: bigint | number): void {
    this.transactionBlock.setGasBudget(budget);
  }

  /**
   * Sets the gas price for the transaction
   */
  setGasPrice(price: bigint | number): void {
    this.transactionBlock.setGasPrice(price);
  }

  /**
   * Sets the sender for the transaction
   */
  setSender(sender: string): void {
    if ('setSender' in this.transactionBlock) {
      (this.transactionBlock as TransactionBlockSui).setSender(sender);
    } else {
      console.warn('setSender not available on this transaction implementation');
    }
  }
  
  /**
   * Builds the transaction
   */
  async build(options?: any): Promise<Uint8Array> {
    return this.transactionBlock.build(options);
  }
  
  /**
   * Serializes the transaction
   */
  serialize(): string {
    const serialized = this.transactionBlock.serialize();
    return typeof serialized === 'string' ? serialized : JSON.stringify(serialized);
  }
  
  /**
   * Gets the transaction digest
   */
  async getDigest(): Promise<string> {
    const result = await this.transactionBlock.getDigest();
    // Handle both Promise<string> and string returns
    return typeof result === 'string' ? result : await result;
  }

  /**
   * Creates a new TransactionBlockAdapter from an existing TransactionBlock
   */
  static from(transactionBlock: TransactionBlockSui | Transaction): TransactionBlockAdapter {
    return new TransactionBlockAdapter(transactionBlock);
  }
}