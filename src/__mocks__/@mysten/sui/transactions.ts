import type { Transaction as RealTransaction, TransactionArgument, TransactionObjectArgument } from '@mysten/sui/transactions';
import type { SuiObjectRef } from '@mysten/sui/client';
import type { TransactionBlockAdapter } from '../../../utils/adapters/transaction-adapter';

// Define TypeTagSerializer locally to avoid import issues
type TypeTagSerializer = any;

// Transaction result interface that matches the TransactionObjectArgument
interface TransactionResult extends TransactionObjectArgument {
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

// Renamed to avoid conflict with Transaction class below
type TransactionOperation = 
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

// Implement Transaction as a class directly (not as an adapter)
export class Transaction {
  private transactions: TransactionOperation[] = [];
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

  // No adapter pattern needed anymore

  setGasBudget(budget: bigint | number): void {
    this.blockData.gasConfig.budget = BigInt(budget);
  }

  setGasPrice(price: bigint | number): void {
    this.blockData.gasConfig.price = BigInt(price);
  }

  // Helper method to add a transaction to our internal representation
  private add(transaction: TransactionOperation): TransactionResult {
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

  moveCall(options: { 
    target: `${string}::${string}::${string}`; 
    arguments?: TransactionArgument[];
    typeArguments?: string[];
  }): TransactionObjectArgument {
    return this.add({
      kind: 'MoveCall',
      target: options.target,
      arguments: options.arguments || [],
      typeArguments: options.typeArguments || []
    });
  }

  transferObjects(
    objects: (string | TransactionObjectArgument)[],
    address: string | TransactionObjectArgument
  ): TransactionObjectArgument {
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

  object(value: string | SuiObjectRef | { objectId: string, digest?: string, version?: string | number | bigint }): TransactionObjectArgument {
    const input = { 
      kind: 'Input' as const,
      type: 'object' as const,
      index: this.inputs.length,
      value
    } as TransactionObjectArgument;
    this.inputs.push(input);
    this.blockData.inputs.push(input as TransactionInput);
    return input;
  }

  pure(value: any, type?: string): TransactionObjectArgument {
    const input = { 
      kind: 'Input' as const,
      type: 'pure' as const,
      index: this.inputs.length,
      value 
    } as TransactionObjectArgument;
    this.inputs.push(input);
    this.blockData.inputs.push(input as TransactionInput);
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

  makeMoveVec(options: { 
    objects: (string | TransactionObjectArgument)[]; 
    type?: string; 
  }): TransactionObjectArgument {
    const objectsArray = options.objects.map(obj => 
      typeof obj === 'string' ? this.object(obj) : obj
    );
    
    const input = {
      kind: 'Input' as const,
      type: 'pure' as const,
      value: objectsArray,
      index: this.inputs.length
    } as TransactionObjectArgument;
    
    this.inputs.push(input);
    this.blockData.inputs.push(input as TransactionInput);
    return input;
  }

  splitCoins(
    coin: string | TransactionObjectArgument, 
    amounts: (string | number | bigint | any | TransactionArgument)[]
  ): TransactionObjectArgument {
    const coinArg = typeof coin === 'string' ? this.object(coin) : coin;
    const amountArgs = amounts.map(amt => {
      if (typeof amt === 'string' || typeof amt === 'number' || typeof amt === 'bigint') {
        return this.pure(amt);
      }
      if (amt && typeof amt === 'object' && 'bytes' in amt && amt.bytes instanceof Uint8Array) {
        // Handle SerializedBcs type
        return this.pure(amt.bytes);
      }
      return amt as TransactionArgument;
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
  ): TransactionObjectArgument {
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
    } as TransactionObjectArgument;
    this.blockData.inputs.push(gasInput as TransactionInput);
    return gasInput;
  }
  
  publish(options: { 
    modules: string[] | number[][]; 
    dependencies: string[]; 
  }): TransactionObjectArgument {
    // Convert any string modules to Uint8Array
    const moduleArrays = (options.modules as any[]).map(mod => {
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
      dependencies: options.dependencies
    });
  }
  
  upgrade(options: { 
    modules: string[] | number[][]; 
    dependencies: string[]; 
    packageId: string; 
    ticket: string | TransactionObjectArgument;
  }): TransactionObjectArgument {
    // Convert any string modules to Uint8Array
    const moduleArrays = (options.modules as any[]).map(mod => {
      if (typeof mod === 'string') {
        return new TextEncoder().encode(mod);
      }
      return new Uint8Array(mod);
    });
    
    const ticketArg = typeof options.ticket === 'string' ? this.object(options.ticket) : options.ticket;
    
    return this.add({
      kind: 'Upgrade',
      modules: moduleArrays,
      dependencies: options.dependencies,
      packageId: options.packageId,
      ticket: ticketArg
    });
  }
}