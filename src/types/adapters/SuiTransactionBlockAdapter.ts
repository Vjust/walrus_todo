import { Transaction } from '@mysten/sui/transactions';
import { SignerAdapter } from './SignerAdapter';
import { SuiClient } from '../../utils/adapters/sui-client-compatibility';
import { Logger } from '../../utils/Logger';
import { TransactionType } from '../transaction';

// Type alias for compatibility
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
 * SuiTransactionBlockAdapter - Interface for creating and executing Sui transaction blocks
 *
 * This adapter provides a simpler interface for working with Sui transaction blocks,
 * abstracting away some of the complexity and providing reliable error handling.
 */
export interface SuiTransactionBlockAdapter {
  /**
   * Create a new transaction block
   */
  createTransactionBlock(): TransactionBlock;

  /**
   * Execute a transaction block
   */
  executeTransactionBlock(
    transactionBlock: TransactionBlock,
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
   * Inspect a transaction block without executing it
   */
  dryRunTransactionBlock(transactionBlock: TransactionBlock): Promise<unknown>;

  /**
   * Get the Sui client
   */
  getClient(): SuiClient;
}

/**
 * DefaultSuiTransactionBlockAdapter - Default implementation of SuiTransactionBlockAdapter
 */
export class DefaultSuiTransactionBlockAdapter
  implements SuiTransactionBlockAdapter
{
  private signer: SignerAdapter;
  private client: SuiClient;

  constructor(signer: SignerAdapter) {
    this.signer = signer;
    this.client = signer.getClient();
  }

  /**
   * Create a new transaction block
   */
  createTransactionBlock(): TransactionBlock {
    return new Transaction();
  }

  /**
   * Execute a transaction block
   */
  async executeTransactionBlock(
    transactionBlock: TransactionBlock,
    _options: TransactionOptions = {}
  ): Promise<TransactionResponse> {
    try {
      // Pass only valid transaction options
      // Cast the transaction directly to handle it correctly
      const result = await this.signer.signAndExecuteTransaction(
        transactionBlock as TransactionType
      );

      return result as TransactionResponse;
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
    return this.executeTransactionBlock(tx, options);
  }

  /**
   * Inspect a transaction block without executing it
   */
  async dryRunTransactionBlock(
    transactionBlock: TransactionBlock
  ): Promise<unknown> {
    try {
      const result = await this.client.devInspectTransactionBlock({
        transactionBlock: transactionBlock as TransactionType,
        sender: this.signer.toSuiAddress(),
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
  getClient(): SuiClient {
    return this.client;
  }
}
