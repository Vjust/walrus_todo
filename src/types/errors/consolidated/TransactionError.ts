/**
 * @file Transaction error class for blockchain transaction failures
 * Handles errors related to blockchain transactions, smart contract interactions, and gas issues.
 */

import { BaseError, BaseErrorOptions } from './BaseError';

/**
 * Options for TransactionError construction
 */
export interface TransactionErrorOptions extends BaseErrorOptions {
  /** Transaction hash if available */
  transactionHash?: string;
  
  /** Gas limit issue */
  gasLimit?: number;
  
  /** Gas price issue */
  gasPrice?: number;
  
  /** Block number where the transaction failed */
  blockNumber?: number;
  
  /** Contract address if this was a contract interaction */
  contractAddress?: string;
  
  /** Method or function that was called */
  methodName?: string;
}

/**
 * Error thrown for blockchain transaction failures
 */
export class TransactionError extends BaseError {
  /** Transaction hash if available */
  public readonly transactionHash?: string;
  
  /** Gas limit issue */
  public readonly gasLimit?: number;
  
  /** Gas price issue */
  public readonly gasPrice?: number;
  
  /** Block number where the transaction failed */
  public readonly blockNumber?: number;
  
  /** Contract address if this was a contract interaction */
  public readonly contractAddress?: string;
  
  /** Method or function that was called */
  public readonly methodName?: string;
  
  /**
   * Create a new TransactionError
   * @param message Error message
   * @param options Options for the error
   */
  constructor(message: string, options: Partial<TransactionErrorOptions> = {}) {
    const {
      transactionHash,
      gasLimit,
      gasPrice,
      blockNumber,
      contractAddress,
      methodName,
      code = 'TRANSACTION_ERROR',
      ...restOptions
    } = options;
    
    // Build context with transaction details
    const context = {
      ...(options.context || {}),
      ...(transactionHash ? { transactionHash } : {}),
      ...(gasLimit ? { gasLimit } : {}),
      ...(gasPrice ? { gasPrice } : {}),
      ...(blockNumber ? { blockNumber } : {}),
      ...(contractAddress ? { contractAddress } : {}),
      ...(methodName ? { methodName } : {})
    };
    
    // Call BaseError constructor
    super({
      message,
      code,
      context,
      recoverable: false,  // Transaction failures are generally not recoverable
      shouldRetry: false,  // Retrying the same transaction usually won't help
      ...restOptions
    });
    
    // Store properties
    this.transactionHash = transactionHash;
    this.gasLimit = gasLimit;
    this.gasPrice = gasPrice;
    this.blockNumber = blockNumber;
    this.contractAddress = contractAddress;
    this.methodName = methodName;
  }
  
  /**
   * Create a TransactionError for gas limit exceeded
   * @param gasLimit Gas limit that was exceeded
   * @param options Additional options
   * @returns New TransactionError instance
   */
  static gasLimitExceeded(
    gasLimit: number,
    options: Omit<TransactionErrorOptions, 'gasLimit'> = {}
  ): TransactionError {
    return new TransactionError(
      `Transaction failed: gas limit exceeded (${gasLimit})`,
      {
        ...options,
        gasLimit,
        code: 'TRANSACTION_GAS_LIMIT_EXCEEDED'
      }
    );
  }
  
  /**
   * Create a TransactionError for insufficient funds
   * @param options Additional options
   * @returns New TransactionError instance
   */
  static insufficientFunds(
    options: TransactionErrorOptions = {}
  ): TransactionError {
    return new TransactionError(
      'Transaction failed: insufficient funds',
      {
        ...options,
        code: 'TRANSACTION_INSUFFICIENT_FUNDS'
      }
    );
  }
  
  /**
   * Create a TransactionError for reverted transaction
   * @param reason Revert reason if available
   * @param options Additional options
   * @returns New TransactionError instance
   */
  static reverted(
    reason?: string,
    options: TransactionErrorOptions = {}
  ): TransactionError {
    return new TransactionError(
      reason ? `Transaction reverted: ${reason}` : 'Transaction reverted',
      {
        ...options,
        code: 'TRANSACTION_REVERTED'
      }
    );
  }
}