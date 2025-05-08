import type { TransactionBlock as RealTransactionBlock, TransactionArgument, TransactionObjectArgument } from '@mysten/sui.js/transactions';
import type { SuiObjectRef } from '@mysten/sui.js/client';

/**
 * Adapter interface to bridge different TransactionBlock implementations
 * This provides a standardized interface regardless of the underlying implementation
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
  ): TransactionObjectArgument;
  
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
  
  // Access to the underlying transaction block implementation
  getUnderlyingBlock(): RealTransactionBlock;
}

/**
 * Implementation of the TransactionBlockAdapter that wraps the real TransactionBlock
 * This handles any conversion needed between interfaces
 */
export class TransactionBlockAdapterImpl implements TransactionBlockAdapter {
  private transactionBlock: RealTransactionBlock;

  constructor(transactionBlock?: RealTransactionBlock) {
    this.transactionBlock = transactionBlock || new RealTransactionBlock();
  }

  getUnderlyingBlock(): RealTransactionBlock {
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
    return this.transactionBlock.transferObjects(objects, address);
  }

  object(value: string | SuiObjectRef | { objectId: string, digest?: string, version?: string | number | bigint }): TransactionObjectArgument {
    return this.transactionBlock.object(value);
  }

  pure(value: any, type?: string): TransactionObjectArgument {
    return this.transactionBlock.pure(value, type);
  }

  makeMoveVec(options: { 
    objects: (string | TransactionObjectArgument)[]; 
    type?: string; 
  }): TransactionObjectArgument {
    return this.transactionBlock.makeMoveVec(options);
  }

  splitCoins(
    coin: string | TransactionObjectArgument, 
    amounts: (string | number | bigint | any | TransactionArgument)[]
  ): TransactionObjectArgument {
    return this.transactionBlock.splitCoins(coin, amounts);
  }

  mergeCoins(
    destination: string | TransactionObjectArgument, 
    sources: (string | TransactionObjectArgument)[]
  ): TransactionObjectArgument {
    return this.transactionBlock.mergeCoins(destination, sources);
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
    return this.transactionBlock.serialize();
  }

  async getDigest(): Promise<string> {
    return this.transactionBlock.getDigest();
  }
}

/**
 * Factory function to create a TransactionBlockAdapter from either
 * a TransactionBlock or creating a new one if not provided
 */
export function createTransactionBlockAdapter(
  transactionBlock?: RealTransactionBlock
): TransactionBlockAdapter {
  return new TransactionBlockAdapterImpl(transactionBlock);
}