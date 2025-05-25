/**
 * @file Blockchain error class for blockchain-related failures
 * Handles errors related to blockchain interactions, transactions, and smart contracts.
 */

import { BaseError, BaseErrorOptions } from './BaseError';

/**
 * Options for BlockchainError construction
 */
export interface BlockchainErrorOptions extends BaseErrorOptions {
  /** Blockchain operation being performed */
  operation?: string;

  /** Transaction ID if applicable */
  transactionId?: string;

  /** Object ID if applicable */
  objectId?: string;

  /** Chain ID or network name */
  chain?: string;

  /** Address involved in the operation */
  address?: string;

  /** Gas used or gas limit */
  gas?: number;
}

/**
 * Error thrown for blockchain-related failures
 */
export class BlockchainError extends BaseError {
  /** Blockchain operation being performed */
  public readonly operation?: string;

  /** Transaction ID if applicable */
  public readonly transactionId?: string;

  /** Object ID if applicable */
  public readonly objectId?: string;

  /** Chain ID or network name */
  public readonly chain?: string;

  /**
   * Create a new BlockchainError
   * @param message Error message
   * @param options Options for the error
   */
  constructor(message: string, options: Partial<BlockchainErrorOptions> = {}) {
    const {
      operation = 'unknown',
      transactionId,
      objectId,
      chain,
      address,
      gas,
      recoverable = false, // Blockchain errors are generally not recoverable by default
      ...restOptions
    } = options;

    // Build context with blockchain details
    const context = {
      ...(options.context || {}),
      ...(operation ? { operation } : {}),
      ...(chain ? { chain } : {}),
      ...(gas !== undefined ? { gas } : {}),
      // Don't include sensitive blockchain data in context
    };

    // Generate code based on operation
    const code = `BLOCKCHAIN_${operation.toUpperCase()}_ERROR`;

    // Generate public message
    const publicMessage = `A blockchain operation failed`;

    // Call BaseError constructor
    super({
      message,
      code,
      context,
      recoverable,
      shouldRetry: recoverable && operation !== 'sign', // Don't retry signing operations
      publicMessage,
      ...restOptions,
    });

    // Store operation
    this.operation = operation;

    // Store sensitive properties privately with non-enumerable descriptors
    Object.defineProperties(this, {
      transactionId: {
        value: transactionId,
        enumerable: false,
        writable: false,
        configurable: false,
      },
      objectId: {
        value: objectId,
        enumerable: false,
        writable: false,
        configurable: false,
      },
      chain: {
        value: chain,
        enumerable: false,
        writable: false,
        configurable: false,
      },
    });

    // Store address privately
    if (address) {
      Object.defineProperty(this, 'address', {
        value: address,
        enumerable: false,
        writable: false,
        configurable: false,
      });
    }
  }

  /**
   * Create a BlockchainError for transaction failure
   * @param transactionId Transaction ID
   * @param reason Failure reason
   * @param options Additional options
   * @returns New BlockchainError instance
   */
  static transactionFailed(
    transactionId: string,
    reason: string,
    options: Omit<
      BlockchainErrorOptions,
      'transactionId' | 'operation' | 'message'
    > = {}
  ): BlockchainError {
    return new BlockchainError(`Transaction failed: ${reason}`, {
      ...options,
      transactionId,
      operation: 'execute',
      recoverable: false,
    });
  }

  /**
   * Create a BlockchainError for insufficient funds
   * @param address Wallet address
   * @param options Additional options
   * @returns New BlockchainError instance
   */
  static insufficientFunds(
    address: string,
    options: Omit<
      BlockchainErrorOptions,
      'address' | 'operation' | 'message'
    > = {}
  ): BlockchainError {
    return new BlockchainError(
      `Insufficient funds for wallet: ${address.substring(0, 8)}...`,
      {
        ...options,
        address,
        operation: 'fund',
        recoverable: false,
        publicMessage:
          'Insufficient funds to complete the blockchain operation',
      }
    );
  }

  /**
   * Create a BlockchainError for wallet connection
   * @param reason Connection failure reason
   * @param options Additional options
   * @returns New BlockchainError instance
   */
  static walletConnectionFailed(
    reason: string,
    options: Omit<BlockchainErrorOptions, 'operation' | 'message'> = {}
  ): BlockchainError {
    return new BlockchainError(`Wallet connection failed: ${reason}`, {
      ...options,
      operation: 'connect',
      recoverable: true,
      publicMessage: 'Failed to connect to wallet',
    });
  }
}
