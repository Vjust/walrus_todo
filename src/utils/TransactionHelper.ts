import { Signer } from '@mysten/sui/cryptography';
import { Logger } from './Logger';
import {
  ValidationError,
  BlockchainError
} from '../types/errors';

export interface RetryConfig {
  attempts: number;
  baseDelay: number;
  maxDelay: number;
  exponential: boolean;
}

export interface TransactionConfig {
  signer?: Signer;
  retry?: Partial<RetryConfig>;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  attempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  exponential: true
};

export class TransactionHelper {
  private readonly logger: Logger;
  private readonly config: RetryConfig;

  constructor(
    private readonly signer?: Signer,
    config?: Partial<RetryConfig>
  ) {
    this.logger = Logger.getInstance();
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * Execute operation with retries and exponential backoff
   */
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: {
      name: string;
      requireSigner?: boolean;
      customSigner?: Signer;
      customRetry?: Partial<RetryConfig>;
    }
  ): Promise<T> {
    const {
      name,
      requireSigner = false,
      customSigner,
      customRetry
    } = options;

    // Validate signer if required
    if (requireSigner) {
      const signer = customSigner || this.signer;
      if (!signer) {
        throw new ValidationError(
          'Signer required for operation',
          { field: 'signer', value: 'missing' }
        );
      }
    }

    // Apply custom retry config if provided
    const retryConfig = customRetry ?
      { ...this.config, ...customRetry } :
      this.config;

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= retryConfig.attempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < retryConfig.attempts) {
          // Calculate delay with exponential backoff
          const delay = retryConfig.exponential ?
            Math.min(
              retryConfig.baseDelay * Math.pow(2, attempt - 1),
              retryConfig.maxDelay
            ) :
            retryConfig.baseDelay;

          this.logger.warn(
            `Retry attempt ${attempt} for ${name}`,
            {
              attempt,
              delay,
              error: lastError.message,
              maxAttempts: retryConfig.attempts
            }
          );

          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new BlockchainError(
      `Operation '${name}' failed after ${retryConfig.attempts} attempts`,
      {
        operation: name,
        recoverable: false,
        cause: lastError || new Error('Unknown error')
      }
    );
  }

  /**
   * Check if operation should be retried based on error
   */
  public shouldRetry(error: Error): boolean {
    // Retry on network errors
    if (
      error.message.includes('network') ||
      error.message.includes('timeout') ||
      error.message.includes('connection')
    ) {
      return true;
    }

    // Don't retry on validation errors
    if (error instanceof ValidationError) {
      return false;
    }

    // Check if error indicates operation is recoverable
    if (error instanceof BlockchainError) {
      return error.shouldRetry;
    }

    // Default to retry for unknown errors
    return true;
  }

  /**
   * Get delay for next retry attempt
   */
  public getRetryDelay(attempt: number): number {
    if (!this.config.exponential) {
      return this.config.baseDelay;
    }

    return Math.min(
      this.config.baseDelay * Math.pow(2, attempt - 1),
      this.config.maxDelay
    );
  }

  /**
   * Validate transaction requirements
   */
  public validateTransaction(
    options: {
      name: string;
      signer?: Signer;
      requireSigner?: boolean;
    }
  ): void {
    const { name, signer, requireSigner = true } = options;

    if (requireSigner && !signer && !this.signer) {
      throw new ValidationError(
        'Signer required for transaction',
        {
          field: 'signer',
          value: 'missing'
        }
      );
    }
  }

  /**
   * Create a new instance with custom config
   */
  public withConfig(config: Partial<TransactionConfig>): TransactionHelper {
    return new TransactionHelper(
      config.signer || this.signer,
      config.retry
    );
  }
}