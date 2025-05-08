import type { TransactionBlock as RealTransactionBlock, TransactionArgument, TransactionObjectArgument } from '@mysten/sui.js/transactions';
import type { SuiObjectRef } from '@mysten/sui.js/client';
import { TransactionBlockAdapter } from '../../../utils/adapters/transaction-adapter';

// Define TypeTagSerializer locally to avoid import issues
type TypeTagSerializer = any;

// Transaction result interface
interface TransactionResult {
  kind: 'Result';
  index: number;
  digest?: string;
  value?: any;
}

// Simplified transaction input type for compatibility
type TransactionObjectInput = string | SuiObjectRef | { objectId: string, digest?: string, version?: string | number | bigint };

// Define more accurate transaction interfaces
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

interface SplitCoinsTransaction {
  kind: 'SplitCoins';
  coin: TransactionArgument;
  amounts: TransactionArgument[];
}

interface MergeCoinsTransaction {
  kind: 'MergeCoins';
  destination: TransactionArgument;
  sources: TransactionArgument[];
}

interface PublishTransaction {
  kind: 'Publish';
  modules: Uint8Array[];
  dependencies: string[];
}

interface UpgradeTransaction {
  kind: 'Upgrade';
  modules: Uint8Array[];
  dependencies: string[];
  packageId: string;
  ticket: TransactionArgument;
}

type Transaction = 
  | MoveCallTransaction 
  | TransferObjectsTransaction 
  | SplitCoinsTransaction 
  | MergeCoinsTransaction
  | PublishTransaction
  | UpgradeTransaction;

// Simplified input type definitions
type TransactionInput = {
  kind: 'Input';
  index: number;
  value?: any;
  type?: 'object' | 'pure';
} | {
  kind: 'GasCoin';
  index?: number;
};

type BlockDataInputs = TransactionInput[];

type BlockDataTransactions = {
  typeArguments: string[];
  kind: string;
  arguments: TransactionArgument[];
  target?: `${string}::${string}::${string}`;
}[];

// Standard result type creator
const createTransactionResult = (index: number): TransactionResult => ({
  kind: 'Result',
  index: index
});

// SerializedBcs type
interface SerializedBcs<T, E> {
  readonly bytes: Uint8Array;
  readonly type: T;
  readonly extraType: E;
}

// Implement TransactionBlock as a class implementing the adapter interface
// This allows us to have a clean implementation that works with our adapter pattern
export class TransactionBlock implements TransactionBlockAdapter {
  private transactions: Transaction[] = [];
  private inputs: TransactionArgument[] = [];
  private sharedObjectRefs: Set<string> = new Set();
  
  public blockData = {
    version: 1 as const, // Using 'as const' to ensure it's typed as literal 1
    inputs: [] as TransactionInput[],
    transactions: [] as BlockDataTransactions,
    gasConfig: {} as {
      budget?: bigint;
      price?: bigint;
      payment?: {
        digest: string;
        objectId: string;
        version: string | number | bigint;
      }[];
    }
  };

  constructor() {
    this.transactions = [];
    this.blockData.transactions = [];
  }

  // Implementation of the adapter interface
  getUnderlyingBlock(): RealTransactionBlock {
    return this as unknown as RealTransactionBlock;
  }

  setGasBudget(budget: bigint | number): void {
    this.blockData.gasConfig.budget = BigInt(budget);
  }

  setGasPrice(price: bigint | number): void {
    this.blockData.gasConfig.price = BigInt(price);
  }

  // Helper method to add a transaction to our internal representation
  private add(transaction: Transaction): TransactionResult {
    this.transactions.push(transaction);
    if (transaction.kind === 'MoveCall') {
      this.blockData.transactions.push({
        kind: 'MoveCall',
        target: transaction.target,
        arguments: transaction.arguments,
        typeArguments: transaction.typeArguments
      });
    } else if (transaction.kind === 'TransferObjects') {
      this.blockData.transactions.push({
        kind: 'TransferObjects',
        arguments: [...transaction.objects, transaction.address],
        typeArguments: []
      });
    } else if (transaction.kind === 'SplitCoins') {
      this.blockData.transactions.push({
        kind: 'SplitCoins',
        arguments: [transaction.coin, ...transaction.amounts],
        typeArguments: []
      });
    } else if (transaction.kind === 'MergeCoins') {
      this.blockData.transactions.push({
        kind: 'MergeCoins',
        arguments: [transaction.destination, ...transaction.sources],
        typeArguments: []
      });
    } else if (transaction.kind === 'Publish') {
      this.blockData.transactions.push({
        kind: 'Publish',
        arguments: [],
        typeArguments: []
      });
    } else if (transaction.kind === 'Upgrade') {
      this.blockData.transactions.push({
        kind: 'Upgrade',
        arguments: [transaction.ticket],
        typeArguments: []
      });
    }
    
    return createTransactionResult(this.transactions.length - 1);
  }

  moveCall({ target, arguments: args = [], typeArguments = [] }: { 
    target: `${string}::${string}::${string}`; 
    arguments?: TransactionArgument[];
    typeArguments?: string[];
  }): TransactionResult {
    return this.add({
      kind: 'MoveCall',
      target,
      arguments: args || [],
      typeArguments: typeArguments || []
    });
  }

  transferObjects(
    objects: (string | TransactionObjectArgument)[],
    address: string | TransactionObjectArgument
  ): TransactionResult {
    const objectArgs = objects.map(obj => 
      typeof obj === 'string' ? this.object(obj) : obj
    );
    const addressArg = typeof address === 'string' ? this.object(address) : address;
    
    return this.add({
      kind: 'TransferObjects',
      objects: objectArgs,
      address: addressArg
    });
  }

  object(value: string | SuiObjectRef | TransactionObjectInput): TransactionArgument {
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

  pure(value: any, type?: string): TransactionArgument {
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
    // Sender is not stored in blockData anymore in newer versions
  }

  setSenderIfNotSet(sender: string): void {
    // Not needed in newer versions
  }

  async build(options?: any): Promise<Uint8Array> {
    // Return a mock serialized transaction
    return new Uint8Array([1, 2, 3, 4]);
  }

  deserialize(bytes: Uint8Array): void {
    // Mock implementation - no actual deserialization needed
  }

  serialize(): string {
    // Mock serialization - return empty base64 string
    return 'AAAA';
  }

  async getDigest(): Promise<string> {
    // Mock digest - return fixed string
    return '0x1234567890abcdef';
  }

  makeMoveVec({ objects, type }: { objects: (string | TransactionObjectArgument)[]; type?: string; }): TransactionResult {
    const input = {
      kind: 'Input' as const,
      type: 'pure' as const,
      value: objects || [],
      index: this.inputs.length
    };
    this.inputs.push(input);
    this.blockData.inputs.push(input);
    return createTransactionResult(this.inputs.length - 1);
  }

  splitCoins(
    coin: string | TransactionObjectArgument, 
    amounts: (string | number | bigint | SerializedBcs<any, any> | TransactionArgument)[]
  ): TransactionResult {
    const coinArg = typeof coin === 'string' ? this.object(coin) : coin;
    const amountArgs = amounts.map(amt => {
      if (typeof amt === 'string' || typeof amt === 'number' || typeof amt === 'bigint') {
        return this.pure(amt);
      }
      return amt;
    });
    
    return this.add({
      kind: 'SplitCoins',
      coin: coinArg,
      amounts: amountArgs
    });
  }

  mergeCoins(
    destination: string | TransactionObjectArgument, 
    sources: (string | TransactionObjectArgument)[]
  ): TransactionResult {
    const destArg = typeof destination === 'string' ? this.object(destination) : destination;
    const sourceArgs = sources.map(src => 
      typeof src === 'string' ? this.object(src) : src
    );
    
    return this.add({
      kind: 'MergeCoins',
      destination: destArg,
      sources: sourceArgs
    });
  }

  gas(objectId?: string): TransactionObjectArgument {
    const gasInput = { 
      kind: 'GasCoin' as const,
      index: this.inputs.length
    };
    this.blockData.inputs.push(gasInput);
    return gasInput as TransactionObjectArgument;
  }
  
  publish({ modules, dependencies }: { modules: string[] | number[][]; dependencies: string[]; }): TransactionResult {
    // Convert any string modules to Uint8Array
    const moduleArrays = (modules as any[]).map(mod => {
      if (typeof mod === 'string') {
        // Convert string to Uint8Array
        return new TextEncoder().encode(mod);
      }
      // Already in array format - ensure it's a Uint8Array
      return new Uint8Array(mod);
    });
    
    return this.add({
      kind: 'Publish',
      modules: moduleArrays,
      dependencies
    });
  }
  
  upgrade({ modules, dependencies, packageId, ticket }: { 
    modules: string[] | number[][]; 
    dependencies: string[]; 
    packageId: string; 
    ticket: string | TransactionObjectArgument;
  }): TransactionResult {
    // Convert any string modules to Uint8Array
    const moduleArrays = (modules as any[]).map(mod => {
      if (typeof mod === 'string') {
        return new TextEncoder().encode(mod);
      }
      return new Uint8Array(mod);
    });
    
    const ticketArg = typeof ticket === 'string' ? this.object(ticket) : ticket;
    
    return this.add({
      kind: 'Upgrade',
      modules: moduleArrays,
      dependencies,
      packageId,
      ticket: ticketArg
    });
  }
}