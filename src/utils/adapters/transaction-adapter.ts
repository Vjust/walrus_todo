import { TransactionBlock } from '@mysten/sui.js/transactions';
import type { TransactionArgument, TransactionObjectArgument } from '@mysten/sui.js/transactions';
import type { SuiObjectRef } from '@mysten/sui.js/client';
import type { 
  TransactionBlockAdapter as TypedTransactionBlockAdapter,
  TransactionResult
} from '../../types/adapters/TransactionBlockAdapter';
import type { Transaction } from '../../types/transaction';

/**
 * Adapter interface to bridge different TransactionBlock implementations
 * This provides a standardized interface regardless of the underlying implementation
 * 
 * Note: This adapter is used to maintain compatibility between different versions
 * of the TransactionBlock interface in @mysten/sui.js and other libraries.
 */
export interface TransactionBlockAdapter {
  // Core methods that both interfaces must implement
  setGasBudget(budget: bigint | number): void;
  setGasPrice(price: bigint | number): void;
  moveCall(options: { 
    target: `${string}::${string}::${string}`; 
    arguments?: TransactionArgument[];
    typeArguments?: string[];
  }): TransactionObjectArgument;
  
  transferObjects(
    objects: (string | TransactionObjectArgument)[],
    address: string | TransactionObjectArgument
  ): TransactionObjectArgument;
  
  object(value: string | SuiObjectRef | { objectId: string, digest?: string, version?: string | number | bigint }): TransactionObjectArgument;
  pure(value: any, type?: string): TransactionObjectArgument;
  
  makeMoveVec(options: { 
    objects: (string | TransactionObjectArgument)[]; 
    type?: string; 
  }): TransactionObjectArgument;
  
  splitCoins(
    coin: string | TransactionObjectArgument, 
    amounts: (string | number | bigint | any | TransactionArgument)[]
  ): TransactionObjectArgument;
  
  mergeCoins(
    destination: string | TransactionObjectArgument, 
    sources: (string | TransactionObjectArgument)[]
  ): void;
  
  gas(objectId?: string): TransactionObjectArgument;
  
  publish(options: { 
    modules: string[] | number[][]; 
    dependencies: string[]; 
  }): TransactionObjectArgument;
  
  upgrade(options: { 
    modules: string[] | number[][]; 
    dependencies: string[]; 
    packageId: string; 
    ticket: string | TransactionObjectArgument; 
  }): TransactionObjectArgument;
  
  build(options?: any): Promise<Uint8Array>;
  serialize(): string;
  getDigest(): Promise<string>;
  
  // Access to the underlying transaction implementation
  getUnderlyingBlock(): TransactionBlock;
}

/**
 * Implementation of the TransactionBlockAdapter that wraps the real TransactionBlock
 * This handles any conversion needed between interfaces
 */
export class TransactionBlockAdapterImpl implements TransactionBlockAdapter {
  private transactionBlock: TransactionBlock;

  constructor(transactionBlock?: TransactionBlock) {
    if (transactionBlock) {
      this.transactionBlock = transactionBlock;
    } else {
      // Create a new TransactionBlock instance
      this.transactionBlock = new TransactionBlock();
    }
  }

  getUnderlyingBlock(): TransactionBlock {
    return this.transactionBlock;
  }

  setGasBudget(budget: bigint | number): void {
    this.transactionBlock.setGasBudget(budget);
  }

  setGasPrice(price: bigint | number): void {
    this.transactionBlock.setGasPrice(price);
  }

  moveCall(options: { 
    target: `${string}::${string}::${string}`; 
    arguments?: TransactionArgument[];
    typeArguments?: string[];
  }): TransactionObjectArgument {
    return this.transactionBlock.moveCall(options);
  }

  transferObjects(
    objects: (string | TransactionObjectArgument)[],
    address: string | TransactionObjectArgument
  ): TransactionObjectArgument {
    // Cast to proper types and handle void return type with explicit conversion
    const result = this.transactionBlock.transferObjects(
      objects as any[], 
      address as any
    );
    // Force cast to TransactionObjectArgument
    return result as unknown as TransactionObjectArgument;
  }

  object(value: string | SuiObjectRef | { objectId: string, digest?: string, version?: string | number | bigint }): TransactionObjectArgument {
    return this.transactionBlock.object(value as any);
  }

  pure(value: any, type?: string): TransactionObjectArgument {
    const result = this.transactionBlock.pure(value, type as any);
    return result as unknown as TransactionObjectArgument;
  }

  makeMoveVec(options: { 
    objects: (string | TransactionObjectArgument)[]; 
    type?: string; 
  }): TransactionObjectArgument {
    const result = this.transactionBlock.makeMoveVec(options as any);
    return result as unknown as TransactionObjectArgument;
  }

  splitCoins(
    coin: string | TransactionObjectArgument, 
    amounts: (string | number | bigint | any | TransactionArgument)[]
  ): TransactionObjectArgument {
    return this.transactionBlock.splitCoins(coin as any, amounts as any);
  }

  mergeCoins(
    destination: string | TransactionObjectArgument, 
    sources: (string | TransactionObjectArgument)[]
  ): void {
    // The return type is void, which is compatible with the interface
    this.transactionBlock.mergeCoins(destination as any, sources as any);
  }

  gas(objectId?: string): TransactionObjectArgument {
    return this.transactionBlock.gas(objectId);
  }

  publish(options: { 
    modules: string[] | number[][]; 
    dependencies: string[]; 
  }): TransactionObjectArgument {
    return this.transactionBlock.publish(options);
  }

  upgrade(options: { 
    modules: string[] | number[][]; 
    dependencies: string[]; 
    packageId: string; 
    ticket: string | TransactionObjectArgument; 
  }): TransactionObjectArgument {
    return this.transactionBlock.upgrade(options);
  }

  async build(options?: any): Promise<Uint8Array> {
    return this.transactionBlock.build(options);
  }

  serialize(): string {
    const serialized = this.transactionBlock.serialize();
    return typeof serialized === 'string' ? serialized : JSON.stringify(serialized);
  }

  async getDigest(): Promise<string> {
    const digest = await this.transactionBlock.getDigest();
    return digest.toString();
  }
}

/**
 * Factory function to create a TransactionBlockAdapter from either
 * a TransactionBlock or creating a new one if not provided
 */
export function createTransactionBlockAdapter(
  transactionBlock?: TransactionBlock
): TransactionBlockAdapter {
  return new TransactionBlockAdapterImpl(transactionBlock);
}