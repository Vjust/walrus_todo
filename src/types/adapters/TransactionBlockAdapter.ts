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
import { TransactionBlock as TransactionBlockCore } from '@mysten/sui/transactions';
import { SerializedBcs } from '@mysten/sui.js/bcs';

// Define a unified TransactionArgument type that works with both implementations
export type UnifiedTransactionArgument = 
  | { index: number; kind: "Input"; value?: any; type?: "object" | string; }
  | { index: number; kind: "Input"; type: "pure"; value?: any; }
  | { kind: "GasCoin"; }
  | { index: number; kind: "Result"; }
  | { index: number; resultIndex: number; kind: "NestedResult"; };

// Define a unified TransactionObjectArgument type
export type UnifiedTransactionObjectArgument = 
  | { index: number; kind: "Input"; value?: any; type?: "object"; }
  | { index: number; kind: "Input"; type: "pure"; value?: any; }
  | { kind: "GasCoin"; }
  | { index: number; kind: "Result"; }
  | { index: number; resultIndex: number; kind: "NestedResult"; }
  | string;

// Define a unified TransactionResult type
export type UnifiedTransactionResult = 
  | { index: number; kind: "Result"; }
  | UnifiedTransactionArgument[];

/**
 * The UnifiedTransactionBlock interface defines a standardized interface
 * that works with both library versions
 */
export interface UnifiedTransactionBlock {
  // Core properties
  blockData: {
    version: 1;
    inputs: any[];
    transactions: any[];
    gasConfig: {
      budget?: bigint;
      price?: bigint;
      payment?: {
        digest: string;
        objectId: string;
        version: string | number | bigint;
      }[];
    }
  };

  // Core transaction methods
  moveCall(params: {
    target: `${string}::${string}::${string}`;
    arguments?: UnifiedTransactionArgument[];
    typeArguments?: string[];
  }): UnifiedTransactionResult;

  transferObjects(
    objects: UnifiedTransactionObjectArgument[],
    address: string | UnifiedTransactionObjectArgument
  ): UnifiedTransactionResult;

  /**
   * Creates a reference to a transaction object
   */
  object(value: string | UnifiedTransactionObjectArgument): UnifiedTransactionObjectArgument;

  /**
   * Creates a reference to a pure value
   */
  pure(value: any, type?: string): UnifiedTransactionArgument;

  /**
   * Creates a vector of objects or values
   */
  makeMoveVec(params: {
    objects: (string | UnifiedTransactionObjectArgument)[];
    type?: string;
  }): UnifiedTransactionResult;

  /**
   * Creates multiple coins of the specified amount
   */
  splitCoins(
    coin: string | UnifiedTransactionObjectArgument,
    amounts: (string | number | bigint | UnifiedTransactionArgument)[]
  ): UnifiedTransactionResult;

  /**
   * Merges multiple coins into one
   */
  mergeCoins(
    destination: string | UnifiedTransactionObjectArgument,
    sources: (string | UnifiedTransactionObjectArgument)[]
  ): void;

  // Utility methods
  setGasBudget(budget: bigint | number): void;
  setGasPrice(price: bigint | number): void;
  setSender(sender: string): void;
  setExpiration(expiration: number): void;
}

/**
 * TransactionBlockAdapter implements the UnifiedTransactionBlock interface
 * and wraps either a TransactionBlockSui or TransactionBlockCore instance
 */
export class TransactionBlockAdapter implements UnifiedTransactionBlock {
  private suiTransactionBlock: TransactionBlockSui | TransactionBlockCore;

  constructor(transactionBlock?: TransactionBlockSui | TransactionBlockCore) {
    this.suiTransactionBlock = transactionBlock || new TransactionBlockSui();
  }

  /**
   * Gets the underlying transaction block implementation
   */
  public getTransactionBlock(): TransactionBlockSui | TransactionBlockCore {
    return this.suiTransactionBlock;
  }

  get blockData() {
    return this.suiTransactionBlock.blockData;
  }

  /**
   * Executes a Move call
   */
  moveCall(params: {
    target: `${string}::${string}::${string}`;
    arguments?: UnifiedTransactionArgument[];
    typeArguments?: string[];
  }): UnifiedTransactionResult {
    return this.suiTransactionBlock.moveCall(params);
  }

  /**
   * Transfers objects to an address
   */
  transferObjects(
    objects: UnifiedTransactionObjectArgument[],
    address: string | UnifiedTransactionObjectArgument
  ): UnifiedTransactionResult {
    return this.suiTransactionBlock.transferObjects(objects, address);
  }

  /**
   * Creates a reference to a transaction object
   */
  object(value: string | UnifiedTransactionObjectArgument): UnifiedTransactionObjectArgument {
    return this.suiTransactionBlock.object(value);
  }

  /**
   * Creates a reference to a pure value
   */
  pure(value: any, type?: string): UnifiedTransactionArgument {
    return this.suiTransactionBlock.pure(value, type);
  }

  /**
   * Creates a vector of objects or values
   */
  makeMoveVec(params: {
    objects: (string | UnifiedTransactionObjectArgument)[];
    type?: string;
  }): UnifiedTransactionResult {
    return this.suiTransactionBlock.makeMoveVec(params);
  }

  /**
   * Creates multiple coins of the specified amount
   */
  splitCoins(
    coin: string | UnifiedTransactionObjectArgument,
    amounts: (string | number | bigint | UnifiedTransactionArgument)[]
  ): UnifiedTransactionResult {
    return this.suiTransactionBlock.splitCoins(coin, amounts);
  }

  /**
   * Merges multiple coins into one
   */
  mergeCoins(
    destination: string | UnifiedTransactionObjectArgument,
    sources: (string | UnifiedTransactionObjectArgument)[]
  ): void {
    this.suiTransactionBlock.mergeCoins(destination, sources);
  }

  /**
   * Sets the gas budget for the transaction
   */
  setGasBudget(budget: bigint | number): void {
    this.suiTransactionBlock.setGasBudget(budget);
  }

  /**
   * Sets the gas price for the transaction
   */
  setGasPrice(price: bigint | number): void {
    this.suiTransactionBlock.setGasPrice(price);
  }

  /**
   * Sets the sender for the transaction
   */
  setSender(sender: string): void {
    this.suiTransactionBlock.setSender(sender);
  }

  /**
   * Sets the expiration for the transaction
   */
  setExpiration(expiration: number): void {
    this.suiTransactionBlock.setExpiration(expiration);
  }

  /**
   * Creates a new TransactionBlockAdapter from an existing TransactionBlock
   */
  static from(transactionBlock: TransactionBlockSui | TransactionBlockCore): TransactionBlockAdapter {
    return new TransactionBlockAdapter(transactionBlock);
  }
}