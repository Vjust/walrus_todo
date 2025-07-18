/**
 * TransactionBlockAdapter
 *
 * This adapter reconciles differences between different versions of Transaction
 * interfaces in the @mysten/sui and @mysten/sui libraries.
 *
 * It provides a consistent interface that both mock implementations and actual
 * code can use without worrying about version-specific differences.
 *
 * Key features:
 * - Type-safe wrapper around different Transaction implementations
 * - Proper typeguards to ensure type safety across library versions
 * - Consistent error handling with specific TransactionAdapterError class
 * - Robustness against API changes in underlying libraries
 * - Resource management with dispose() method for proper cleanup
 *
 * Usage:
 * ```typescript
 * // Create a new adapter with a new transaction
 * const adapter = new TransactionBlockAdapter();
 *
 * // Or wrap an existing transaction
 * const existingTx = new Transaction();
 * const adapter = TransactionBlockAdapter.from(existingTx);
 *
 * // Use the adapter's methods which work across library versions
 * adapter.moveCall({
 *   target: 'package::module::function',
 *   arguments: [...],
 * });
 *
 * // Don't forget to properly dispose the adapter when done
 * await adapter.dispose();
 * ```
 *
 * All methods properly validate inputs and throw typed exceptions when invalid
 * data is provided, making this adapter more robust than direct usage of the
 * Transaction classes.
 */

import { Transaction as TransactionSui } from '@mysten/sui/transactions';
// Import Transaction from our type definition to avoid direct import errors
import { Transaction } from '../transaction';
// SuiObjectRef type definition (skip import if not available)
type SuiObjectRef = {
  objectId: string;
  version: string;
  digest: string;
};
import type {
  TransactionArgument,
  TransactionObjectArgument,
} from '@mysten/sui/transactions';
import { BaseAdapter, isBaseAdapter } from './BaseAdapter';
import { BaseError } from '../errors/BaseError';
import { Logger } from '../../utils/Logger';

const logger = new Logger('TransactionBlockAdapter');

// Define a unified TransactionResult type that can handle different return types
export type TransactionResult = TransactionObjectArgument;

// Type guard to check if a transaction is from the sui.js library
export function isTransactionSui(tx: unknown): tx is TransactionSui {
  if (tx === null || typeof tx !== 'object' || tx === undefined) {
    return false;
  }

  const txObj = tx as Record<string, unknown>;
  return (
    'setSender' in txObj &&
    typeof txObj.setSender === 'function' &&
    'moveCall' in txObj &&
    typeof txObj.moveCall === 'function'
  );
}

// Type guard for checking if a value is a Transaction
export function isTransaction(tx: unknown): tx is Transaction {
  if (tx === null || typeof tx !== 'object' || tx === undefined) {
    return false;
  }

  const txObj = tx as Record<string, unknown>;
  return (
    'moveCall' in txObj &&
    typeof txObj.moveCall === 'function' &&
    !('setSender' in txObj)
  ); // Distinguishing feature from TransactionBlockSui
}

// Type guard for checking TransactionObjectArgument
export function isTransactionObjectArgument(
  arg: unknown
): arg is TransactionObjectArgument {
  if (arg === null || typeof arg !== 'object' || arg === undefined) {
    return false;
  }

  const argObj = arg as Record<string, unknown>;
  return 'kind' in argObj && typeof argObj.kind === 'string';
}

// Type guard for checking if a value is a string
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard for checking if a value is a valid TransactionArgument
 * A TransactionArgument can be a primitive type (string, number, bigint)
 * or a TransactionObjectArgument (which has a more specific structure).
 *
 * When using TransactionArgument values in contexts that expect TransactionObjectArgument,
 * you must ensure the primitive values are converted to TransactionObjectArgument first
 * (typically using the pure() method).
 *
 * @param value Value to check
 * @returns true if the value is a valid TransactionArgument
 */
export function isTransactionArgument(
  value: unknown
): value is TransactionArgument {
  // Check if it's a TransactionObjectArgument
  if (isTransactionObjectArgument(value)) {
    return true;
  }

  // Check for primitive types that are valid as TransactionArguments
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint'
  );
}

/**
 * The UnifiedTransactionBlock interface defines a standardized interface
 * that works with both Transaction library versions
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
  object(
    value:
      | string
      | SuiObjectRef
      | {
          objectId: string;
          digest?: string;
          version?: string | number | bigint;
        }
  ): TransactionObjectArgument;

  /**
   * Creates a reference to a pure value
   */
  pure(value: unknown, type?: string): TransactionObjectArgument;

  /**
   * Creates a vector of objects or values
   */
  makeMoveVec(params: {
    objects: (string | TransactionObjectArgument)[];
    type?: string;
  }): TransactionResult;

  /**
   * Creates multiple coins of the specified amount
   * Note: While the API allows a range of input types, internally this will always
   * convert amounts to TransactionObjectArgument before passing to the underlying implementation.
   */
  splitCoins(
    coin: string | TransactionObjectArgument,
    amounts: (string | number | bigint | TransactionObjectArgument)[]
  ): TransactionResult;

  /**
   * Merges multiple coins into one
   */
  mergeCoins(
    destination: string | TransactionObjectArgument,
    sources: (string | TransactionObjectArgument)[]
  ): void;

  // Utility methods
  setSender(sender: string): void;

  /**
   * Sets the gas owner for the transaction
   */
  setGasOwner?(owner: string): void;

  /**
   * Gas-related operations for the transaction
   */
  gas?: {
    /**
     * Sets the owner for the gas payment
     */
    setOwner(owner: string): void;
  };

  /**
   * Publishes a Move package
   */
  publish?: (...args: unknown[]) => TransactionResult;

  /**
   * Upgrades a Move package
   */
  upgrade?: (...args: unknown[]) => TransactionResult;

  // Build and serialization methods
  build(options?: Record<string, unknown>): Promise<Uint8Array>;
  serialize(): string;
  getDigest(): Promise<string>;
}

/**
 * Error class for transaction adapter operations
 */
export class TransactionAdapterError extends BaseError {
  constructor(message: string, cause?: Error) {
    super({
      message: `TransactionAdapter Error: ${message}`,
      code: 'TRANSACTION_ADAPTER_ERROR',
      cause,
    });
    this.name = 'TransactionAdapterError';
  }
}

/**
 * TransactionBlockAdapter implements the UnifiedTransactionBlock interface
 * and wraps a Transaction or TransactionBlockSui instance
 */
export class TransactionBlockAdapter
  implements UnifiedTransactionBlock, BaseAdapter<Transaction | TransactionSui>
{
  private transactionBlock: Transaction | TransactionSui;
  private _isDisposed = false;

  /**
   * Gas-related operations for the transaction
   */
  public gas?: {
    /**
     * Sets the owner for the gas payment
     */
    setOwner(owner: string): void;
  };

  /**
   * Publishes a Move package
   */
  public publish?: (...args: unknown[]) => TransactionResult;

  /**
   * Upgrades a Move package
   */
  public upgrade?: (...args: unknown[]) => TransactionResult;

  /**
   * Creates a new TransactionBlockAdapter
   * @param transactionBlock Optional existing transaction block to adapt
   * @throws TransactionAdapterError if the provided transaction block is invalid
   */
  constructor(transactionBlock?: Transaction | TransactionSui | unknown) {
    // Use type guard to handle instantiation properly
    if (transactionBlock !== undefined) {
      if (isTransactionSui(transactionBlock)) {
        this.transactionBlock = transactionBlock;
      } else if (isTransaction(transactionBlock)) {
        this.transactionBlock = transactionBlock;
      } else {
        throw new TransactionAdapterError(
          `Invalid transaction type provided to adapter: ${
            transactionBlock === null ? 'null' : typeof transactionBlock
          }`
        );
      }
    } else {
      // Create a new instance using the TransactionSui constructor
      this.transactionBlock = new TransactionSui();
    }

    // Initialize optional properties if they exist on the underlying implementation
    if ('gas' in this.transactionBlock && this.transactionBlock.gas) {
      this.gas = {
        setOwner: (owner: string) => {
          if (
            this.transactionBlock.gas &&
            'setOwner' in this.transactionBlock.gas
          ) {
            // Validate gas object has setOwner method before calling
            const gasObj = this.transactionBlock.gas as Record<string, unknown>;
            if ('setOwner' in gasObj && typeof gasObj.setOwner === 'function') {
              (gasObj as { setOwner: (owner: string) => void }).setOwner(owner);
            } else {
              throw new TransactionAdapterError(
                'gas.setOwner method not available'
              );
            }
          } else {
            throw new TransactionAdapterError(
              'gas.setOwner method not available on this transaction implementation'
            );
          }
        },
      };
    }

    if (
      'publish' in this.transactionBlock &&
      typeof this.transactionBlock.publish === 'function'
    ) {
      this.publish = (...args: unknown[]) => {
        if (
          'publish' in this.transactionBlock &&
          typeof this.transactionBlock.publish === 'function'
        ) {
          // Convert args to array and pass as arguments
          return this.transactionBlock.publish.call(
            this.transactionBlock,
            ...args
          );
        }
        throw new TransactionAdapterError(
          'publish method not available on this transaction implementation'
        );
      };
    }

    if (
      'upgrade' in this.transactionBlock &&
      typeof this.transactionBlock.upgrade === 'function'
    ) {
      this.upgrade = (...args: unknown[]) => {
        if (
          'upgrade' in this.transactionBlock &&
          typeof this.transactionBlock.upgrade === 'function'
        ) {
          // Convert args to array and pass as arguments
          return this.transactionBlock.upgrade.call(
            this.transactionBlock,
            ...args
          );
        }
        throw new TransactionAdapterError(
          'upgrade method not available on this transaction implementation'
        );
      };
    }
  }

  /**
   * Gets the underlying transaction block implementation
   * @throws TransactionAdapterError if the adapter has been disposed
   */
  getUnderlyingImplementation(): Transaction | TransactionSui {
    this.checkDisposed();
    return this.transactionBlock;
  }

  /**
   * Alias for getUnderlyingImplementation to maintain backward compatibility
   * @deprecated Use getUnderlyingImplementation() instead
   */
  getTransactionBlock(): Transaction | TransactionSui {
    return this.getUnderlyingImplementation();
  }

  /**
   * Checks if the adapter has been disposed
   * @returns true if the adapter has been disposed
   */
  isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Disposes the adapter, releasing any resources
   * This method is idempotent and can be called multiple times
   */
  async dispose(): Promise<void> {
    if (this._isDisposed) return;

    try {
      // Perform any cleanup needed for the transaction
      // Currently, there's no specific cleanup needed for Transaction instances,
      // but this provides an extension point for future requirements

      this._isDisposed = true;
    } catch (_error) {
      throw new TransactionAdapterError(
        `Failed to dispose TransactionBlockAdapter: ${_error instanceof Error ? _error.message : `${_error}`}`,
        _error instanceof Error ? _error : undefined
      );
    }
  }

  /**
   * Utility method to check if the adapter is disposed and throw if it is
   * @throws TransactionAdapterError if the adapter has been disposed
   */
  private checkDisposed(): void {
    if (this._isDisposed) {
      throw new TransactionAdapterError(
        'Cannot perform operations on a disposed adapter'
      );
    }
  }

  /**
   * Executes a Move call
   * @throws TransactionAdapterError if the adapter has been disposed or the call fails
   */
  moveCall(params: {
    target: `${string}::${string}::${string}`;
    arguments?: TransactionArgument[];
    typeArguments?: string[];
  }): TransactionResult {
    try {
      this.checkDisposed();
      // Both implementations have compatible moveCall interfaces
      return this.transactionBlock.moveCall(params);
    } catch (_error) {
      if (_error instanceof TransactionAdapterError) {
        throw _error;
      }
      throw new TransactionAdapterError(
        `Error in moveCall: ${_error instanceof Error ? _error.message : `${_error}`}`,
        _error instanceof Error ? _error : undefined
      );
    }
  }

  /**
   * Transfers objects to an address
   * @throws TransactionAdapterError if the adapter has been disposed or the transfer fails
   */
  transferObjects(
    objects: (string | TransactionObjectArgument)[],
    address: string | TransactionObjectArgument
  ): TransactionResult {
    try {
      this.checkDisposed();
      // Process objects to handle string values
      const processedObjects = objects.map(obj => {
        if (isString(obj)) {
          return this.transactionBlock.object(obj);
        }
        return obj;
      });

      // Process address if it's a string
      const processedAddress = isString(address)
        ? this.transactionBlock.object(address)
        : address;

      // Handle potential interface differences between versions
      return this.transactionBlock.transferObjects(
        processedObjects,
        processedAddress
      );
    } catch (_error) {
      if (_error instanceof TransactionAdapterError) {
        throw _error;
      }
      throw new TransactionAdapterError(
        `Error in transferObjects: ${_error instanceof Error ? _error.message : `${_error}`}`,
        _error instanceof Error ? _error : undefined
      );
    }
  }

  /**
   * Creates a reference to a transaction object
   * @throws TransactionAdapterError if the adapter has been disposed or the operation fails
   */
  object(
    value:
      | string
      | SuiObjectRef
      | {
          objectId: string;
          digest?: string;
          version?: string | number | bigint;
        }
  ): TransactionObjectArgument {
    try {
      this.checkDisposed();
      // Both implementations have compatible object methods
      return this.transactionBlock.object(value);
    } catch (_error) {
      throw new TransactionAdapterError(
        `Error in object conversion: ${_error instanceof Error ? _error.message : `${_error}`}`,
        _error instanceof Error ? _error : undefined
      );
    }
  }

  /**
   * Creates a reference to a pure value
   * @throws TransactionAdapterError if the adapter has been disposed or the operation fails
   */
  pure(value: unknown, type?: string): TransactionObjectArgument {
    try {
      this.checkDisposed();
      // Apply type assertion to ensure compatibility with TransactionObjectArgument
      return this.transactionBlock.pure(
        value,
        type
      ) as TransactionObjectArgument;
    } catch (_error) {
      throw new TransactionAdapterError(
        `Error in pure value conversion: ${_error instanceof Error ? _error.message : `${_error}`}`,
        _error instanceof Error ? _error : undefined
      );
    }
  }

  /**
   * Creates a vector of objects or values
   * @param params Configuration object for the Move vector
   * @returns TransactionResult representing the vector
   * @throws TransactionAdapterError if the adapter has been disposed, any object is invalid, or if the operation fails
   */
  makeMoveVec(params: {
    objects: (string | TransactionObjectArgument)[];
    type?: string;
  }): TransactionResult {
    try {
      this.checkDisposed();
      // Process objects to ensure they're all TransactionObjectArguments
      const processedObjects: TransactionObjectArgument[] = [];

      for (const obj of params.objects) {
        if (isString(obj)) {
          processedObjects.push(this.transactionBlock.object(obj));
        } else if (isTransactionObjectArgument(obj)) {
          processedObjects.push(obj);
        } else {
          throw new TransactionAdapterError(
            `Invalid object in makeMoveVec: ${JSON.stringify(obj)}`
          );
        }
      }

      // Both implementations should have compatible makeMoveVec methods
      return this.transactionBlock.makeMoveVec({
        objects: processedObjects,
        type: params.type,
      });
    } catch (_error) {
      if (_error instanceof TransactionAdapterError) {
        throw _error;
      }
      throw new TransactionAdapterError(
        `Error in makeMoveVec: ${_error instanceof Error ? _error.message : `${_error}`}`,
        _error instanceof Error ? _error : undefined
      );
    }
  }

  /**
   * Creates multiple coins of the specified amount
   * @param coin The coin to split (string object ID or TransactionObjectArgument)
   * @param amounts Array of amounts to split the coin into
   * @returns TransactionResult representing the split coins
   * @throws TransactionAdapterError if the adapter has been disposed, the coin is invalid, or if the operation fails
   */
  splitCoins(
    coin: string | TransactionObjectArgument,
    amounts: (string | number | bigint | TransactionArgument)[]
  ): TransactionResult {
    try {
      this.checkDisposed();
      // Convert string coin to object reference if needed
      let processedCoin: TransactionObjectArgument;

      if (isString(coin)) {
        processedCoin = this.transactionBlock.object(coin);
      } else if (isTransactionObjectArgument(coin)) {
        processedCoin = coin;
      } else {
        throw new TransactionAdapterError(
          `Invalid coin argument: ${JSON.stringify(coin)}`
        );
      }

      // Process amounts to ensure they're all TransactionObjectArguments
      // The splitCoins method expects TransactionObjectArgument[] rather than TransactionArgument[]
      const processedAmounts: TransactionObjectArgument[] = [];

      for (const amount of amounts) {
        if (
          typeof amount === 'string' ||
          typeof amount === 'number' ||
          typeof amount === 'bigint'
        ) {
          // Convert primitive types to TransactionObjectArguments using pure()
          processedAmounts.push(this.pure(amount));
        } else if (isTransactionObjectArgument(amount)) {
          // Already a TransactionObjectArgument
          processedAmounts.push(amount);
        } else if (amount && typeof amount === 'object') {
          // Handle other TransactionArgument types
          processedAmounts.push(this.pure(amount) as TransactionObjectArgument);
        } else {
          throw new TransactionAdapterError(
            `Invalid amount in splitCoins: ${JSON.stringify(amount)}`
          );
        }
      }

      return this.transactionBlock.splitCoins(processedCoin, processedAmounts);
    } catch (_error) {
      if (_error instanceof TransactionAdapterError) {
        throw _error;
      }
      throw new TransactionAdapterError(
        `Error in splitCoins: ${_error instanceof Error ? _error.message : `${_error}`}`,
        _error instanceof Error ? _error : undefined
      );
    }
  }

  /**
   * Merges multiple coins into one
   * @param destination The destination coin (string object ID or TransactionObjectArgument)
   * @param sources Array of source coins to merge
   * @throws TransactionAdapterError if the adapter has been disposed, any coin is invalid, or if the operation fails
   */
  mergeCoins(
    destination: string | TransactionObjectArgument,
    sources: (string | TransactionObjectArgument)[]
  ): void {
    try {
      this.checkDisposed();
      // Convert string destination to object reference if needed
      let processedDestination: TransactionObjectArgument;

      if (isString(destination)) {
        processedDestination = this.transactionBlock.object(destination);
      } else if (isTransactionObjectArgument(destination)) {
        processedDestination = destination;
      } else {
        throw new TransactionAdapterError(
          `Invalid destination coin: ${JSON.stringify(destination)}`
        );
      }

      // Process sources to ensure they're all TransactionObjectArguments
      const processedSources: TransactionObjectArgument[] = [];

      for (const source of sources) {
        if (isString(source)) {
          processedSources.push(this.transactionBlock.object(source));
        } else if (isTransactionObjectArgument(source)) {
          processedSources.push(source);
        } else {
          throw new TransactionAdapterError(
            `Invalid source coin: ${JSON.stringify(source)}`
          );
        }
      }

      this.transactionBlock.mergeCoins(processedDestination, processedSources);
    } catch (_error) {
      if (_error instanceof TransactionAdapterError) {
        throw _error;
      }
      throw new TransactionAdapterError(
        `Error in mergeCoins: ${_error instanceof Error ? _error.message : `${_error}`}`,
        _error instanceof Error ? _error : undefined
      );
    }
  }

  /**
   * Sets the gas budget for the transaction
   * @throws TransactionAdapterError if the adapter has been disposed or the operation fails
   */
  setGasBudget(budget: bigint | number): void {
    try {
      this.checkDisposed();
      this.transactionBlock.setGasBudget(budget);
    } catch (_error) {
      throw new TransactionAdapterError(
        `Error setting gas budget: ${_error instanceof Error ? _error.message : `${_error}`}`,
        _error instanceof Error ? _error : undefined
      );
    }
  }

  /**
   * Sets the gas price for the transaction
   * @throws TransactionAdapterError if the adapter has been disposed or the operation fails
   */
  setGasPrice(price: bigint | number): void {
    try {
      this.checkDisposed();
      this.transactionBlock.setGasPrice(price);
    } catch (_error) {
      throw new TransactionAdapterError(
        `Error setting gas price: ${_error instanceof Error ? _error.message : `${_error}`}`,
        _error instanceof Error ? _error : undefined
      );
    }
  }

  /**
   * Sets the sender for the transaction
   * @throws TransactionAdapterError if the adapter has been disposed or the operation fails
   */
  setSender(sender: string): void {
    try {
      this.checkDisposed();
      // Use type guard to handle version differences
      if (isTransactionSui(this.transactionBlock)) {
        this.transactionBlock.setSender(sender);
      } else {
        logger.warn(
          'setSender not available on this transaction implementation'
        );
      }
    } catch (_error) {
      throw new TransactionAdapterError(
        `Error setting sender: ${_error instanceof Error ? _error.message : `${_error}`}`,
        _error instanceof Error ? _error : undefined
      );
    }
  }

  /**
   * Sets the gas owner for the transaction
   * @throws TransactionAdapterError if the adapter has been disposed or the operation fails
   */
  setGasOwner(owner: string): void {
    try {
      this.checkDisposed();

      // Check if the method exists on the underlying implementation
      if (
        'setGasOwner' in this.transactionBlock &&
        typeof this.transactionBlock.setGasOwner === 'function'
      ) {
        this.transactionBlock.setGasOwner(owner);
      } else if (this.gas && this.gas.setOwner) {
        // Try using gas.setOwner as a fallback
        this.gas.setOwner(owner);
      } else {
        logger.warn(
          'setGasOwner not available on this transaction implementation'
        );
      }
    } catch (_error) {
      throw new TransactionAdapterError(
        `Error setting gas owner: ${_error instanceof Error ? _error.message : `${_error}`}`,
        _error instanceof Error ? _error : undefined
      );
    }
  }

  /**
   * Builds the transaction
   * @throws TransactionAdapterError if the adapter has been disposed or the operation fails
   */
  async build(options?: Record<string, unknown>): Promise<Uint8Array> {
    try {
      this.checkDisposed();
      return await this.transactionBlock.build(options);
    } catch (_error) {
      throw new TransactionAdapterError(
        `Error building transaction: ${_error instanceof Error ? _error.message : `${_error}`}`,
        _error instanceof Error ? _error : undefined
      );
    }
  }

  /**
   * Serializes the transaction
   * @throws TransactionAdapterError if the adapter has been disposed or the operation fails
   */
  serialize(): string {
    try {
      this.checkDisposed();
      const serialized = this.transactionBlock.serialize();

      if (serialized === null || serialized === undefined) {
        throw new TransactionAdapterError(
          'Serialization returned null or undefined'
        );
      }

      if (typeof serialized === 'string') {
        return serialized;
      }

      if (typeof serialized === 'object') {
        try {
          return JSON.stringify(serialized);
        } catch (jsonError) {
          throw new TransactionAdapterError(
            `Failed to stringify serialized object: ${jsonError instanceof Error ? jsonError.message : `${jsonError}`}`,
            jsonError instanceof Error ? jsonError : undefined
          );
        }
      }

      // Handle any other type by converting to string
      return String(serialized);
    } catch (_error) {
      if (_error instanceof TransactionAdapterError) {
        throw _error;
      }
      throw new TransactionAdapterError(
        `Error serializing transaction: ${_error instanceof Error ? _error.message : String(_error)}`,
        _error instanceof Error ? _error : undefined
      );
    }
  }

  /**
   * Gets the transaction digest
   * @throws TransactionAdapterError if the adapter has been disposed or the operation fails
   */
  async getDigest(): Promise<string> {
    try {
      this.checkDisposed();
      const result = await this.transactionBlock.getDigest();

      if (result === null || result === undefined) {
        throw new TransactionAdapterError(
          'Transaction digest returned null or undefined'
        );
      }

      // Handle different return types
      if (typeof result === 'string') {
        return result;
      }

      // Check if the result is Promise-like
      // Use any casting to avoid typescript errors with 'then' property
      if (
        result &&
        typeof result === 'object' &&
        'then' in (result as { then?: unknown }) &&
        typeof (result as { then?: unknown }).then === 'function'
      ) {
        try {
          const resolvedResult = await result;
          if (typeof resolvedResult === 'string') {
            return resolvedResult;
          }
          return String(resolvedResult);
        } catch (promiseError) {
          throw new TransactionAdapterError(
            `Failed to resolve digest promise: ${promiseError instanceof Error ? promiseError.message : String(promiseError)}`,
            promiseError instanceof Error ? promiseError : undefined
          );
        }
      }

      // Last resort: convert to string
      return String(result);
    } catch (_error) {
      if (_error instanceof TransactionAdapterError) {
        throw _error;
      }
      throw new TransactionAdapterError(
        `Error getting transaction digest: ${_error instanceof Error ? _error.message : String(_error)}`,
        _error instanceof Error ? _error : undefined
      );
    }
  }

  /**
   * Creates a new TransactionBlockAdapter from an existing Transaction
   * @param transactionBlock The transaction to adapt
   * @returns A new TransactionBlockAdapter wrapping the provided transaction
   * @throws TransactionAdapterError if the provided transaction is invalid
   */
  static from(transactionBlock: unknown): TransactionBlockAdapter {
    if (transactionBlock === undefined || transactionBlock === null) {
      throw new TransactionAdapterError(
        'Null or undefined transaction provided to adapter.from()'
      );
    }

    // Check for valid transaction types
    if (
      !isTransactionSui(transactionBlock) &&
      !isTransaction(transactionBlock)
    ) {
      throw new TransactionAdapterError(
        `Invalid transaction type provided to adapter.from(): ${typeof transactionBlock}. ` +
          `The object must implement either the Transaction or TransactionSui interface.`
      );
    }

    return new TransactionBlockAdapter(transactionBlock);
  }

  /**
   * Type guard to check if an object is a TransactionBlockAdapter
   * @param obj Object to check
   * @returns true if the object is a TransactionBlockAdapter
   */
  static isTransactionBlockAdapter(
    obj: unknown
  ): obj is TransactionBlockAdapter {
    return isBaseAdapter(obj) && obj instanceof TransactionBlockAdapter;
  }
}
