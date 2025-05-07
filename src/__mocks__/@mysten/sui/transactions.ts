import { 
  type TransactionBlock as RealTransactionBlock, 
  type TransactionArgument, 
  type TransactionResult, 
  type TransactionObjectInput, 
  type BuildOptions 
} from '@mysten/sui.js/transactions';
import type { SuiObjectRef } from '@mysten/sui.js/client';

// Define TypeTagSerializer locally to avoid import issues
type TypeTagSerializer = any;

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

// Improved input type definitions
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
  kind: string;
  arguments: TransactionArgument[];
  target?: `${string}::${string}::${string}`;
}[];

// Standard result type
const createTransactionResult = (index: number): TransactionResult => ({
  kind: 'Result',
  index: index,
  type: undefined, // Optional in the interface
  digest: undefined, // Optional in the interface
  value: undefined // Optional in the interface
});

export class TransactionBlock implements RealTransactionBlock {
  private transactions: Transaction[] = [];
  private inputs: TransactionArgument[] = [];
  private sharedObjectRefs: Set<string> = new Set();
  
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
    objects: TransactionArgument[],
    address: TransactionArgument
  ): TransactionResult {
    return this.add({
      kind: 'TransferObjects',
      objects,
      address
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

  pure(value: any, type?: TypeTagSerializer): TransactionArgument {
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

  async build(options?: BuildOptions): Promise<Uint8Array> {
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

  makeMoveVec(objects?: (TransactionObjectInput | TransactionArgument)[], type?: TypeTagSerializer): TransactionArgument {
    const input = {
      kind: 'Input' as const,
      type: 'pure' as const,
      value: objects || [],
      index: this.inputs.length
    };
    this.inputs.push(input);
    this.blockData.inputs.push(input);
    return input;
  }

  splitCoins(coin: TransactionArgument, amounts: TransactionArgument[]): TransactionResult {
    return this.add({
      kind: 'SplitCoins',
      coin,
      amounts
    });
  }

  mergeCoins(destination: TransactionArgument, sources: TransactionArgument[]): TransactionResult {
    return this.add({
      kind: 'MergeCoins',
      destination,
      sources
    });
  }

  gas(objectId?: string): TransactionArgument {
    const input = { 
      kind: 'GasCoin' as const
    };
    this.blockData.inputs.push(input);
    return input;
  }
  
  publish(modules: Uint8Array[], dependencies: string[]): TransactionResult {
    return this.add({
      kind: 'Publish',
      modules,
      dependencies
    });
  }
  
  upgrade(modules: Uint8Array[], dependencies: string[], packageId: string, ticket: TransactionArgument): TransactionResult {
    return this.add({
      kind: 'Upgrade',
      modules,
      dependencies,
      packageId,
      ticket
    });
  }
}