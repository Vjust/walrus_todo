// @ts-ignore
import { type TransactionBlock as RealTransactionBlock, type TransactionArgument, type TransactionResult, type TransactionObjectInput } from '@mysten/sui.js/transactions';
// Define TypeTagSerializer locally to avoid import issues
type TypeTagSerializer = any;
import type { SuiObjectRef } from '@mysten/sui.js/client';

interface MoveCallTransaction {
  kind: 'MoveCall';
  target: `${string}::${string}::${string}`;
  arguments: TransactionArgument[];
  typeArguments: string[];
}

interface TransferObjectsTransaction {
  kind: 'TransferObjects';
  objects: TransactionArgument[];
  address: TransactionArgument;
}

type Transaction = MoveCallTransaction | TransferObjectsTransaction;

type TransactionInput = {
  kind: 'Input';
  index: number;
  value: any;
  type: 'object' | 'pure';
} | {
  kind: 'GasCoin';
};

type BlockDataInputs = TransactionInput[];

type BlockDataTransactions = {
  typeArguments: string[];
  kind: 'MoveCall';
  arguments: TransactionArgument[];
  target: `${string}::${string}::${string}`;
}[];

export class TransactionBlock implements RealTransactionBlock {
  private transactions: Transaction[] = [];
  private inputs: TransactionArgument[] = [];
  private sharedObjectRefs: Set<string> = new Set();
  // @ts-ignore - Interface compatibility issue
  public blockData: {
    version: 1;
    inputs: BlockDataInputs;
    transactions: BlockDataTransactions;
    gasConfig: {
      budget?: bigint;
      price?: bigint;
      payment?: {
        digest: string;
        objectId: string;
        version: string | number | bigint;
      }[];
    };
  } = {
    version: 1,
    inputs: [],
    transactions: [],
    gasConfig: {}
  };

  constructor() {
    this.transactions = [];
    this.blockData.transactions = [];
  }

  setGasBudget(budget: bigint | number): void {
    this.blockData.gasConfig.budget = BigInt(budget);
  }

  setGasPrice(price: bigint | number): void {
    this.blockData.gasConfig.price = BigInt(price);
  }

  // @ts-ignore - Interface compatibility issue
  private add(transaction: Transaction): TransactionResult {
    this.transactions.push(transaction);
    if (transaction.kind === 'MoveCall') {
      this.blockData.transactions.push({
        kind: 'MoveCall',
        target: transaction.target,
        arguments: transaction.arguments,
        typeArguments: transaction.typeArguments
      });
    }
    // @ts-ignore - Type compatibility
    return {
      index: this.transactions.length - 1,
      kind: 'Result'
    };
  }

  // @ts-ignore - Interface compatibility issue
  moveCall({ target, arguments: args = [], typeArguments = [] }: { 
    target: `${string}::${string}::${string}`; 
    arguments?: TransactionArgument[];
    typeArguments?: string[];
  }): TransactionResult {
    return this.add({
      kind: 'MoveCall',
      target,
      arguments: args,
      typeArguments
    });
  }

  // @ts-ignore - Interface compatibility issue
  transferObjects(
    objects: TransactionArgument[],
    address: TransactionArgument
  ): TransactionResult {
    return this.add({
      kind: 'TransferObjects',
      objects,
      address
    });
  }

  object(value: string | SuiObjectRef): { index: number; kind: 'Input'; type: 'object'; value: any } {
    const input = { 
      kind: 'Input' as const,
      type: 'object' as const,
      index: this.inputs.length,
      value
    };
    this.inputs.push(input);
    this.blockData.inputs.push(input);
    return input;
  }

  pure(value: any, type?: string): { index: number; kind: 'Input'; type: 'pure'; value: any } {
    const input = { 
      kind: 'Input' as const,
      type: 'pure' as const,
      index: this.inputs.length,
      value 
    };
    this.inputs.push(input);
    this.blockData.inputs.push(input);
    return input;
  }

  setSender(sender: string): void {
    // Sender is not stored in blockData anymore
  }

  setSenderIfNotSet(sender: string): void {
    // Sender is not stored in blockData anymore
  }

  // @ts-ignore - Build options compatibility
  async build(options?: any): Promise<Uint8Array> {
    // Return a mock serialized transaction
    return new Uint8Array([1, 2, 3, 4]);
  }

  deserialize(bytes: Uint8Array): void {
    // Mock implementation - no actual deserialization needed
  }

  serialize(): Uint8Array {
    // Mock serialization - return empty bytes
    return new Uint8Array();
  }

  async getDigest(): Promise<string> {
    // Mock digest - return fixed string
    return '0x1234567890abcdef';
  }

  makeMoveVec(objects?: TransactionObjectInput[], type?: TypeTagSerializer): TransactionArgument {
    return {
      kind: 'Input',
      type: 'pure',
      value: objects || [],
      index: this.inputs.length
    };
  }

  // @ts-ignore - Interface compatibility issue
  splitCoins(coin: TransactionArgument, amounts: TransactionArgument[]): TransactionResult {
    // @ts-ignore - Type compatibility
    return {
      index: this.transactions.length,
      kind: 'Result'
    };
  }

  // @ts-ignore - Interface compatibility issue
  mergeCoins(destination: TransactionArgument, sources: TransactionArgument[]): TransactionResult {
    // @ts-ignore - Type compatibility
    return {
      index: this.transactions.length,
      kind: 'Result'
    };
  }

  // @ts-ignore - Interface compatibility issue
  gas(objectId?: string): TransactionArgument {
    // @ts-ignore - Type compatibility
    return { 
      kind: 'GasCoin'
    };
  }
  
  // @ts-ignore - Interface compatibility issue
  publish(modules: Uint8Array[], dependencies: string[]): TransactionResult {
    // @ts-ignore - Type compatibility
    return {
      index: this.transactions.length,
      kind: 'Result'
    };
  }
  
  // @ts-ignore - Interface compatibility issue
  upgrade(modules: Uint8Array[], dependencies: string[], packageId: string, ticket: TransactionArgument): TransactionResult {
    // @ts-ignore - Type compatibility
    return {
      index: this.transactions.length,
      kind: 'Result'
    };
  }
}