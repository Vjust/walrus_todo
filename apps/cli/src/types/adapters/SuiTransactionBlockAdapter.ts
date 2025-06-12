import { Transaction } from '@mysten/sui/transactions';
import { SignerAdapter } from './SignerAdapter';
import type { SuiClient } from '../../utils/adapters/sui-client-compatibility';
import { Logger } from '../../utils/Logger';
import { TransactionType } from '../transaction';

// Type alias for compatibility - TransactionBlock is now just Transaction
type TransactionBlock = Transaction;

const logger = new Logger('SuiTransactionBlockAdapter');

/**
 * TransactionInput - Generic input for a transaction
 * This type is intentionally left open to accommodate different version requirements
 */
export interface TransactionInput {
  target: string;
  arguments: unknown[];
  typeArguments?: string[];
}

/**
 * TransactionOptions - Options for executing a transaction
 */
export interface TransactionOptions {
  showEffects?: boolean;
  showEvents?: boolean;
  showObjectChanges?: boolean;
  showInput?: boolean;
}

/**
 * TransactionResponse - Response from a transaction execution
 */
export interface TransactionResponse {
  digest: string;
  effects?: {
    status: {
      status: string;
    };
    events?: unknown[];
    objectChanges?: unknown[];
  };
  events?: unknown[];
  objectChanges?: unknown[];
}

/**
 * SuiTransactionBlockAdapter - Interface for creating and executing Sui transactions
 *
 * This adapter provides a simpler interface for working with Sui transactions,
 * abstracting away some of the complexity and providing reliable error handling.
 */
export interface SuiTransactionBlockAdapter {
  /**
   * Create a new transaction
   */
  createTransaction(): Transaction;

  /**
   * Execute a transaction
   */
  executeTransaction(
    transaction: Transaction,
    options?: TransactionOptions
  ): Promise<TransactionResponse>;

  /**
   * Execute a move call
   */
  executeMoveCall(
    target: string,
    args: unknown[],
    typeArgs?: string[],
    options?: TransactionOptions
  ): Promise<TransactionResponse>;

  /**
   * Inspect a transaction without executing it
   */
  dryRunTransaction(transaction: Transaction): Promise<unknown>;

  /**
   * Get the Sui client
   */
  getClient(): InstanceType<typeof SuiClient>;

  // Backward compatibility methods (deprecated)
  /**
   * @deprecated Use createTransaction() instead
   */
  createTransactionBlock(): TransactionBlock;

  /**
   * @deprecated Use executeTransaction() instead
   */
  executeTransactionBlock(
    transactionBlock: TransactionBlock,
    options?: TransactionOptions
  ): Promise<TransactionResponse>;

  /**
   * @deprecated Use dryRunTransaction() instead
   */
  dryRunTransactionBlock(transactionBlock: TransactionBlock): Promise<unknown>;
}

/**
 * DefaultSuiTransactionBlockAdapter - Default implementation of SuiTransactionBlockAdapter
 */
export class DefaultSuiTransactionBlockAdapter
  implements SuiTransactionBlockAdapter
{
  private signer: SignerAdapter;
  private client: InstanceType<typeof SuiClient>;

  constructor(signer: SignerAdapter) {
    this?.signer = signer;
    this?.client = signer.getClient();
  }

  /**
   * Create a new transaction
   */
  createTransaction(): Transaction {
    return new Transaction();
  }

  /**
   * Execute a transaction
   */
  async executeTransaction(
    transaction: Transaction,
    _options: TransactionOptions = {}
  ): Promise<TransactionResponse> {
    try {
      // Pass only valid transaction options
      const result = await this?.signer?.signAndExecuteTransaction(
        transaction as TransactionType
      );

      return result as unknown as TransactionResponse;
    } catch (_error) {
      logger.error('Transaction execution failed:', _error);
      throw new Error(
        `Transaction execution failed: ${_error instanceof Error ? _error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Execute a move call
   */
  async executeMoveCall(
    target: string,
    args: unknown[],
    typeArgs: string[] = [],
    options: TransactionOptions = {}
  ): Promise<TransactionResponse> {
    const tx = new Transaction();

    // Create the move call with proper type handling
    tx.moveCall({
      target: target as `${string}::${string}::${string}`,
      arguments: args as unknown[],
      typeArguments: typeArgs,
    });

    // Execute the transaction
    return this.executeTransaction(tx, options);
  }

  /**
   * Inspect a transaction without executing it
   */
  async dryRunTransaction(transaction: Transaction): Promise<unknown> {
    try {
      const result = await this?.client?.devInspectTransactionBlock({
        transactionBlock: transaction as TransactionType,
        sender: this?.signer?.toSuiAddress(),
      });

      return result;
    } catch (_error) {
      logger.error('Transaction inspection failed:', _error);
      throw new Error(
        `Transaction inspection failed: ${_error instanceof Error ? _error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get the Sui client
   */
  getClient(): InstanceType<typeof SuiClient> {
    return this.client;
  }

  // Backward compatibility methods (deprecated)
  /**
   * @deprecated Use createTransaction() instead
   */
  createTransactionBlock(): TransactionBlock {
    return this.createTransaction();
  }

  /**
   * @deprecated Use executeTransaction() instead
   */
  async executeTransactionBlock(
    transactionBlock: TransactionBlock,
    options: TransactionOptions = {}
  ): Promise<TransactionResponse> {
    return this.executeTransaction(transactionBlock, options);
  }

  /**
   * @deprecated Use dryRunTransaction() instead
   */
  async dryRunTransactionBlock(
    transactionBlock: TransactionBlock
  ): Promise<unknown> {
    return this.dryRunTransaction(transactionBlock as any);
  }
}
