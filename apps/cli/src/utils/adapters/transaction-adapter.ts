/**
 * Transaction Adapter Implementation
 *
 * This module provides a concrete implementation of the TransactionBlockAdapter
 * interface for the @mysten/sui library. It handles the complexities of
 * working with Sui's transactions in a type-safe manner.
 *
 * Key features:
 * - Strong type-checking with custom type guards
 * - Consistent error handling with specific error types
 * - Protection against API changes in underlying libraries
 * - Proper input validation before operations
 * - Resource management with proper cleanup
 *
 * Usage:
 * ```typescript
 * // Create a new adapter with a new transaction
 * const adapter = createTransactionBlockAdapter();
 *
 * // Or wrap an existing transaction
 * const existingTx = new Transaction();
 * const adapter = createTransactionBlockAdapter(existingTx);
 *
 * // Use the adapter's methods
 * adapter.moveCall({
 *   target: 'package::module::function',
 *   arguments: [...],
 * });
 *
 * // Don't forget to properly dispose when done
 * await adapter.dispose();
 * ```
 */

import { Transaction } from '@mysten/sui/transactions';
import type {
  TransactionArgument,
  TransactionObjectArgument,
} from '@mysten/sui/transactions';

import {
  isString,
  isTransactionObjectArgument,
  TransactionAdapterError,
  isTransactionArgument,
} from '../../types/adapters/TransactionBlockAdapter';
import { BaseAdapter, isBaseAdapter } from '../../types/adapters/BaseAdapter';

/**
 * Adapter interface to bridge different Transaction implementations
 * This provides a standardized interface regardless of the underlying implementation
 *
 * Note: This adapter is used to maintain compatibility between different versions
 * of the Transaction interface in @mysten/sui and other libraries.
 */
export interface TransactionBlockAdapter extends BaseAdapter<Transaction> {
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

  object(
    value:
      | string
      | {
          objectId: string;
          digest?: string;
          version?: string | number | bigint;
        }
  ): TransactionObjectArgument;
  pure(value: unknown, type?: string): TransactionObjectArgument;

  makeMoveVec(options: {
    objects: (string | TransactionObjectArgument)[];
    type?: string;
  }): TransactionObjectArgument;

  splitCoins(
    coin: string | TransactionObjectArgument,
    amounts: (string | number | bigint | TransactionArgument)[]
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

  build(options?: Record<string, unknown>): Promise<Uint8Array>;
  serialize(): string;
  getDigest(): Promise<string>;
}

/**
 * Type guard to check if a value is a valid Transaction
 */
function isTransaction(value: unknown): value is Transaction {
  return (
    value !== null &&
    typeof value === 'object' &&
    value !== undefined &&
    'moveCall' in value &&
    typeof (value as Record<string, unknown>).moveCall === 'function' &&
    'setGasBudget' in value &&
    typeof (value as Record<string, unknown>).setGasBudget === 'function'
  );
}

/**
 * Implementation of the TransactionBlockAdapter that wraps the real TransactionBlock
 * This handles any conversion needed between interfaces
 */
export class TransactionBlockAdapterImpl implements TransactionBlockAdapter {
  private transactionBlock: Transaction;
  private _isDisposed = false;

  /**
   * Creates a new TransactionBlockAdapterImpl instance
   * @param transactionBlock Optional existing Transaction to adapt
   * @throws TransactionAdapterError if the provided Transaction is invalid
   */
  constructor(transactionBlock?: unknown) {
    if (transactionBlock === undefined) {
      // Create a new Transaction instance
      this?.transactionBlock = new Transaction();
      return;
    }

    // Validate the transaction
    if (transactionBlock === null) {
      throw new TransactionAdapterError('Null Transaction provided to adapter');
    }

    if (!isTransaction(transactionBlock)) {
      throw new TransactionAdapterError(
        `Invalid Transaction provided to adapter: ${typeof transactionBlock}. ` +
          'Expected a valid Transaction instance.'
      );
    }

    // We've verified the type, so we can safely assign it
    this?.transactionBlock = transactionBlock;
  }

  /**
   * Gets the underlying transaction implementation
   * @throws TransactionAdapterError if the adapter has been disposed
   */
  getUnderlyingImplementation(): Transaction {
    this.checkDisposed();
    return this.transactionBlock;
  }

  /**
   * Alias for getUnderlyingImplementation to maintain backward compatibility
   * @deprecated Use getUnderlyingImplementation() instead
   */
  getUnderlyingBlock(): Transaction {
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

      this?._isDisposed = true;
    } catch (error) {
      throw new TransactionAdapterError(
        `Failed to dispose TransactionBlockAdapter: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
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

  setGasBudget(budget: bigint | number): void {
    try {
      this.checkDisposed();
      this?.transactionBlock?.setGasBudget(budget);
    } catch (error) {
      if (error instanceof TransactionAdapterError) {
        throw error;
      }
      throw new TransactionAdapterError(
        `Error setting gas budget: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  setGasPrice(price: bigint | number): void {
    try {
      this.checkDisposed();
      this?.transactionBlock?.setGasPrice(price);
    } catch (error) {
      if (error instanceof TransactionAdapterError) {
        throw error;
      }
      throw new TransactionAdapterError(
        `Error setting gas price: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  moveCall(options: {
    target: `${string}::${string}::${string}`;
    arguments?: TransactionArgument[];
    typeArguments?: string[];
  }): TransactionObjectArgument {
    try {
      this.checkDisposed();
      return this?.transactionBlock?.moveCall(options);
    } catch (error) {
      if (error instanceof TransactionAdapterError) {
        throw error;
      }
      throw new TransactionAdapterError(
        `Error in moveCall: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Transfers objects to an address
   * @param objects Array of objects to transfer (string object IDs or TransactionObjectArguments)
   * @param address The recipient address (string address or TransactionObjectArgument)
   * @returns TransactionObjectArgument representing the transfer operation
   * @throws TransactionAdapterError if the adapter has been disposed, any argument is invalid, or if the operation fails
   */
  transferObjects(
    objects: (string | TransactionObjectArgument)[],
    address: string | TransactionObjectArgument
  ): TransactionObjectArgument {
    try {
      this.checkDisposed();
      // Validate inputs
      if (!Array.isArray(objects)) {
        throw new TransactionAdapterError(
          `Invalid objects argument: expected array, got ${typeof objects}`
        );
      }

      if (objects?.length === 0) {
        throw new TransactionAdapterError('No objects provided for transfer');
      }

      if (address === undefined || address === null) {
        throw new TransactionAdapterError('No address provided for transfer');
      }

      // Process objects to TransactionObjectArguments
      const processedObjects: TransactionObjectArgument[] = [];

      for (const obj of objects) {
        if (isString(obj)) {
          processedObjects.push(this?.transactionBlock?.object(obj));
        } else if (isTransactionObjectArgument(obj)) {
          processedObjects.push(obj);
        } else {
          throw new TransactionAdapterError(
            `Invalid object argument: ${JSON.stringify(obj)}`
          );
        }
      }

      // Process address
      let processedAddress: TransactionObjectArgument;

      if (isString(address)) {
        processedAddress = this?.transactionBlock?.object(address);
      } else if (isTransactionObjectArgument(address)) {
        processedAddress = address;
      } else {
        throw new TransactionAdapterError(
          `Invalid address argument: ${JSON.stringify(address)}`
        );
      }

      // Perform the transfer and return the result
      return this?.transactionBlock?.transferObjects(
        processedObjects,
        processedAddress
      );
    } catch (error) {
      if (error instanceof TransactionAdapterError) {
        throw error;
      }
      throw new TransactionAdapterError(
        `Error in transferObjects: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  object(
    value:
      | string
      | {
          objectId: string;
          digest?: string;
          version?: string | number | bigint;
        }
  ): TransactionObjectArgument {
    try {
      this.checkDisposed();
      // Apply a type assertion to ensure compatibility with TransactionObjectArgument
      return this?.transactionBlock?.object(value) as TransactionObjectArgument;
    } catch (error) {
      throw new TransactionAdapterError(
        `Error in object conversion: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  pure(value: unknown, type?: string): TransactionObjectArgument {
    try {
      this.checkDisposed();
      // Apply a type assertion to ensure compatibility with TransactionObjectArgument
      return this?.transactionBlock?.pure(
        value,
        type
      ) as TransactionObjectArgument;
    } catch (error) {
      throw new TransactionAdapterError(
        `Error in pure value conversion: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Creates a vector of objects or values
   * @param options Configuration object for the Move vector
   * @returns TransactionObjectArgument representing the vector
   * @throws TransactionAdapterError if the adapter has been disposed, any object is invalid, or if the operation fails
   */
  makeMoveVec(options: {
    objects: (string | TransactionObjectArgument)[];
    type?: string;
  }): TransactionObjectArgument {
    try {
      this.checkDisposed();
      // Validate the input options
      if (!options || !options.objects) {
        throw new TransactionAdapterError(
          'Missing required objects array in makeMoveVec options'
        );
      }

      if (!Array.isArray(options.objects)) {
        throw new TransactionAdapterError(
          `Invalid objects property: expected array, got ${typeof options.objects}`
        );
      }

      if (options.type !== undefined && typeof options.type !== 'string') {
        throw new TransactionAdapterError(
          `Invalid type property: expected string, got ${typeof options.type}`
        );
      }

      // Process objects to ensure they're all TransactionObjectArguments
      const processedObjects: TransactionObjectArgument[] = [];

      for (const obj of options.objects) {
        if (isString(obj)) {
          processedObjects.push(this?.transactionBlock?.object(obj));
        } else if (isTransactionObjectArgument(obj)) {
          processedObjects.push(obj);
        } else {
          throw new TransactionAdapterError(
            `Invalid object in makeMoveVec: ${JSON.stringify(obj)}`
          );
        }
      }

      return this?.transactionBlock?.makeMoveVec({
        objects: processedObjects,
        type: options.type,
      });
    } catch (error) {
      if (error instanceof TransactionAdapterError) {
        throw error;
      }
      throw new TransactionAdapterError(
        `Error in makeMoveVec: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Creates multiple coins of the specified amount
   * @param coin The coin to split (string object ID or TransactionObjectArgument)
   * @param amounts Array of amounts to split the coin into
   * @returns TransactionObjectArgument representing the split coins
   * @throws TransactionAdapterError if the adapter has been disposed, the coin is invalid, or if the operation fails
   */
  splitCoins(
    coin: string | TransactionObjectArgument,
    amounts: (string | number | bigint | TransactionObjectArgument)[]
  ): TransactionObjectArgument {
    try {
      this.checkDisposed();
      // Process the coin input
      let processedCoin: TransactionObjectArgument;

      if (isString(coin)) {
        processedCoin = this?.transactionBlock?.object(coin);
      } else if (isTransactionObjectArgument(coin)) {
        processedCoin = coin;
      } else {
        throw new TransactionAdapterError(
          `Invalid coin argument: ${JSON.stringify(coin)}`
        );
      }

      // Process amounts to ensure they're all compatible TransactionObjectArguments
      const processedAmounts: TransactionObjectArgument[] = [];

      for (const amount of amounts) {
        if (
          typeof amount === 'string' ||
          typeof amount === 'number' ||
          typeof amount === 'bigint'
        ) {
          // Convert primitive types to pure values (which are TransactionObjectArguments)
          processedAmounts.push(
            this?.transactionBlock?.pure(amount) as TransactionObjectArgument
          );
        } else if (isTransactionObjectArgument(amount)) {
          // Already a TransactionObjectArgument
          processedAmounts.push(amount);
        } else if (isTransactionArgument(amount)) {
          // Handle TransactionArgument that is not a TransactionObjectArgument
          // We need to explicitly convert it to a TransactionObjectArgument since they're not compatible
          // This ensures that we're always passing TransactionObjectArgument to splitCoins
          processedAmounts.push(
            this?.transactionBlock?.pure(amount) as TransactionObjectArgument
          );
        } else {
          throw new TransactionAdapterError(
            `Invalid amount in splitCoins: ${JSON.stringify(amount)}`
          );
        }
      }

      return this?.transactionBlock?.splitCoins(processedCoin, processedAmounts);
    } catch (error) {
      if (error instanceof TransactionAdapterError) {
        throw error;
      }
      throw new TransactionAdapterError(
        `Error in splitCoins: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
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
      // Process the destination input
      let processedDestination: TransactionObjectArgument;

      if (isString(destination)) {
        processedDestination = this?.transactionBlock?.object(destination);
      } else if (isTransactionObjectArgument(destination)) {
        processedDestination = destination;
      } else {
        throw new TransactionAdapterError(
          `Invalid destination argument: ${JSON.stringify(destination)}`
        );
      }

      // Process sources to ensure they're all TransactionObjectArguments
      const processedSources: TransactionObjectArgument[] = [];

      for (const source of sources) {
        if (isString(source)) {
          processedSources.push(this?.transactionBlock?.object(source));
        } else if (isTransactionObjectArgument(source)) {
          processedSources.push(source);
        } else {
          throw new TransactionAdapterError(
            `Invalid source in mergeCoins: ${JSON.stringify(source)}`
          );
        }
      }

      this?.transactionBlock?.mergeCoins(processedDestination, processedSources);
    } catch (error) {
      if (error instanceof TransactionAdapterError) {
        throw error;
      }
      throw new TransactionAdapterError(
        `Error in mergeCoins: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  gas(objectId?: string): TransactionObjectArgument {
    try {
      this.checkDisposed();
      return this?.transactionBlock?.gas(objectId);
    } catch (error) {
      throw new TransactionAdapterError(
        `Error getting gas object: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  publish(options: {
    modules: string[] | number[][];
    dependencies: string[];
  }): TransactionObjectArgument {
    try {
      this.checkDisposed();
      return this?.transactionBlock?.publish(options);
    } catch (error) {
      throw new TransactionAdapterError(
        `Error in publish: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Upgrades a package with new modules
   * @param options Configuration for the package upgrade
   * @returns TransactionObjectArgument representing the upgrade operation
   * @throws TransactionAdapterError if the adapter has been disposed, any argument is invalid, or if the operation fails
   */
  upgrade(options: {
    modules: string[] | number[][];
    dependencies: string[];
    packageId: string;
    ticket: string | TransactionObjectArgument;
  }): TransactionObjectArgument {
    try {
      this.checkDisposed();
      // Validate inputs
      if (!Array.isArray(options.modules)) {
        throw new TransactionAdapterError(
          `Invalid modules argument: expected array, got ${typeof options.modules}`
        );
      }

      if (!Array.isArray(options.dependencies)) {
        throw new TransactionAdapterError(
          `Invalid dependencies argument: expected array, got ${typeof options.dependencies}`
        );
      }

      if (typeof options.packageId !== 'string') {
        throw new TransactionAdapterError(
          `Invalid packageId: expected string, got ${typeof options.packageId}`
        );
      }

      // Process the ticket input
      let processedTicket: TransactionObjectArgument;

      if (isString(options.ticket)) {
        processedTicket = this?.transactionBlock?.object(options.ticket);
      } else if (isTransactionObjectArgument(options.ticket)) {
        processedTicket = options.ticket;
      } else {
        throw new TransactionAdapterError(
          `Invalid ticket argument: ${JSON.stringify(options.ticket)}`
        );
      }

      // Call the upgrade method with properly processed arguments
      return this?.transactionBlock?.upgrade({
        modules: options.modules,
        dependencies: options.dependencies,
        packageId: options.packageId,
        ticket: processedTicket,
      });
    } catch (error) {
      if (error instanceof TransactionAdapterError) {
        throw error;
      }
      throw new TransactionAdapterError(
        `Error in upgrade: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async build(options?: Record<string, unknown>): Promise<Uint8Array> {
    try {
      this.checkDisposed();
      return await this?.transactionBlock?.build(options);
    } catch (error) {
      throw new TransactionAdapterError(
        `Error building transaction: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  serialize(): string {
    try {
      this.checkDisposed();
      const serialized = this?.transactionBlock?.serialize();
      if (typeof serialized === 'string') {
        return serialized;
      } else if (serialized === null || serialized === undefined) {
        throw new TransactionAdapterError(
          'Serialization returned null or undefined'
        );
      } else if (typeof serialized === 'object') {
        return JSON.stringify(serialized);
      } else {
        // Add type guard before potential toString conversion that's done by String()
        if (
          serialized !== null &&
          serialized !== undefined &&
          typeof serialized === 'object' &&
          'toString' in serialized &&
          typeof (serialized as Record<string, unknown>).toString === 'function'
        ) {
          return (serialized as { toString(): string }).toString();
        }
        return String(serialized);
      }
    } catch (error) {
      if (error instanceof TransactionAdapterError) {
        throw error;
      }
      throw new TransactionAdapterError(
        `Error serializing transaction: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets the transaction digest
   * @returns Promise resolving to a string containing the transaction digest
   * @throws TransactionAdapterError if the adapter has been disposed, the digest cannot be retrieved, or is invalid
   */
  async getDigest(): Promise<string> {
    try {
      this.checkDisposed();
      const digest = await this?.transactionBlock?.getDigest();

      if (digest === null || digest === undefined) {
        throw new TransactionAdapterError(
          'Transaction digest returned null or undefined'
        );
      }

      // Handle different return types
      if (typeof digest === 'string') {
        return digest;
      }

      if (
        digest &&
        typeof digest === 'object' &&
        'then' in digest &&
        typeof (digest as { then: unknown }).then === 'function'
      ) {
        // Check for Promise-like object
        try {
          const resolvedDigest = await digest;
          if (typeof resolvedDigest === 'string') {
            return resolvedDigest;
          }
          if (resolvedDigest === null || resolvedDigest === undefined) {
            throw new TransactionAdapterError(
              'Resolved digest promise returned null or undefined'
            );
          }
          // Type guard before using toString
          if (
            resolvedDigest !== null &&
            resolvedDigest !== undefined &&
            typeof resolvedDigest === 'object' &&
            'toString' in resolvedDigest &&
            typeof (resolvedDigest as Record<string, unknown>).toString ===
              'function'
          ) {
            return (resolvedDigest as { toString(): string }).toString();
          }
          return String(resolvedDigest);
        } catch (promiseError) {
          throw new TransactionAdapterError(
            `Failed to resolve digest promise: ${promiseError instanceof Error ? promiseError.message : String(promiseError)}`,
            promiseError instanceof Error ? promiseError : undefined
          );
        }
      }

      // Try object with toString() method - with improved type guard
      if (
        digest !== null &&
        digest !== undefined &&
        typeof digest === 'object' &&
        'toString' in digest &&
        typeof (digest as Record<string, unknown>).toString === 'function'
      ) {
        const stringValue = (digest as { toString(): string }).toString();
        if (typeof stringValue === 'string') {
          return stringValue;
        }
      }

      // Last resort: convert anything else to a string
      return String(digest);
    } catch (error) {
      if (error instanceof TransactionAdapterError) {
        throw error;
      }
      throw new TransactionAdapterError(
        `Error getting transaction digest: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Type guard to check if an object is a TransactionBlockAdapterImpl
   * @param obj Object to check
   * @returns true if the object is a TransactionBlockAdapterImpl
   */
  static isTransactionBlockAdapter(
    obj: unknown
  ): obj is TransactionBlockAdapterImpl {
    return isBaseAdapter(obj) && obj instanceof TransactionBlockAdapterImpl;
  }
}

/**
 * Factory function to create a TransactionBlockAdapter from either
 * a Transaction or creating a new one if not provided
 *
 * @param transactionBlock Optional transaction to wrap
 * @returns A new TransactionBlockAdapter instance
 * @throws TransactionAdapterError if the provided transaction is invalid
 */
export function createTransactionBlockAdapter(
  transactionBlock?: unknown
): TransactionBlockAdapter {
  // If nothing is provided, create a new instance
  if (transactionBlock === undefined) {
    return new TransactionBlockAdapterImpl();
  }

  // Validate input if provided
  if (!isTransaction(transactionBlock)) {
    throw new TransactionAdapterError(
      `Invalid transaction provided to adapter factory: ${typeof transactionBlock}. ` +
        'Expected a valid Transaction instance.'
    );
  }

  // Now we can safely create adapter since we've verified the type
  return new TransactionBlockAdapterImpl(transactionBlock);
}
