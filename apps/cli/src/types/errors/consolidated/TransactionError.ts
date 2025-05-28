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
      ...(options.context || ({} as Record<string, unknown>)),
      ...(transactionHash ? { transactionHash } : {}),
      ...(gasLimit ? { gasLimit } : {}),
      ...(gasPrice ? { gasPrice } : {}),
      ...(blockNumber ? { blockNumber } : {}),
      ...(contractAddress ? { contractAddress } : {}),
      ...(methodName ? { methodName } : {}),
    };

    // Call BaseError constructor
    super({
      message,
      code,
      context,
      recoverable: false, // Transaction failures are generally not recoverable
      shouldRetry: false, // Retrying the same transaction usually won't help
      ...restOptions,
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
    options: Omit<TransactionErrorOptions, 'gasLimit' | 'message'> = {}
  ): TransactionError {
    return new TransactionError(
      `Transaction failed: gas limit exceeded (${gasLimit})`,
      {
        ...options,
        gasLimit,
        code: 'TRANSACTION_GAS_LIMIT_EXCEEDED',
      }
    );
  }

  /**
   * Create a TransactionError for insufficient funds
   * @param options Additional options
   * @returns New TransactionError instance
   */
  static insufficientFunds(
    options: Omit<TransactionErrorOptions, 'message'> = {}
  ): TransactionError {
    return new TransactionError('Transaction failed: insufficient funds', {
      ...options,
      code: 'TRANSACTION_INSUFFICIENT_FUNDS',
    });
  }

  /**
   * Create a TransactionError for reverted transaction
   * @param reason Revert reason if available
   * @param options Additional options
   * @returns New TransactionError instance
   */
  static reverted(
    reason?: string,
    options: Omit<TransactionErrorOptions, 'message'> = {}
  ): TransactionError {
    return new TransactionError(
      reason ? `Transaction reverted: ${reason}` : 'Transaction reverted',
      {
        ...options,
        code: 'TRANSACTION_REVERTED',
      }
    );
  }

  /**
   * Override sanitizeContext to handle transaction-specific sensitive data
   * @param context Context object to sanitize
   * @returns Sanitized context or undefined
   */
  protected override sanitizeContext(
    context?: Record<string, unknown>
  ): Record<string, unknown> | undefined {
    if (!context) return undefined;

    // First apply base sanitization
    const sanitized =
      super.sanitizeContext(context) || ({} as Record<string, unknown>);

    // Additional transaction-specific sanitization
    const txSpecificKeys = [
      'transactionHash',
      'contractAddress',
      'fromAddress',
      'toAddress',
      'senderAddress',
      'receiverAddress',
      'walletAddress',
    ];

    for (const key of txSpecificKeys) {
      if (key in sanitized && typeof sanitized[key] === 'string') {
        sanitized[key] = this.redactIdentifier(sanitized[key] as string);
      }
    }

    // Check for any string that looks like an address or transaction hash
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'string') {
        // Look for Sui, Ethereum, or blockchain address patterns
        const addressRegex = /^(0x[a-fA-F0-9]{40,64})$/;
        const txHashRegex = /^(0x[a-fA-F0-9]{64,66})$/;

        if (
          addressRegex.test(value as string) ||
          txHashRegex.test(value as string)
        ) {
          sanitized[key] = this.redactIdentifier(value as string);
        }
      }
    }

    return sanitized;
  }
}
