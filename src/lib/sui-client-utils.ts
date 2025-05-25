/**
 * Utility functions and examples for Sui client usage
 * Comprehensive error handling and usage patterns for TodoNFT operations
 */

import { Logger } from '../utils/Logger';

const logger = new Logger('sui-client-utils');

import { SuiClient } from '@mysten/sui/client';
import { TransactionBlock } from '@mysten/sui/transactions';
import {
  Todo,
  CreateTodoParams,
  UpdateTodoParams,
  TransactionResult,
  NetworkType,
  ErrorContext,
} from '../types/todo';
import {
  TodoOperationError,
  TransactionError,
  SuiClientError,
  WalletNotConnectedError,
} from '../types/errors/consolidated';

// Mock implementations for basic utility functions
export function initializeSuiClient(): SuiClient {
  return new SuiClient({ url: 'https://fullnode.testnet.sui.io:443' });
}

export function getCurrentNetwork(): NetworkType {
  return 'testnet';
}

export async function getTransactionStatus(_digest: string) {
  // Mock implementation
  return { status: 'success' };
}

/**
 * Enhanced error handling with context
 */
export function handleSuiOperationError(
  error: unknown,
  context: ErrorContext
): never {
  const timestamp = Date.now();
  const errorContext = { ...context, timestamp };

  // Log error with context for debugging
  logger.error('Sui operation failed:', {
    error,
    context: errorContext,
  });

  if (error instanceof WalletNotConnectedError) {
    throw new TodoOperationError(
      'Please connect your wallet to perform this operation',
      context.operation,
      error
    );
  }

  if (error instanceof TransactionError) {
    throw new TodoOperationError(
      `Transaction failed: ${error.message}`,
      context.operation,
      error
    );
  }

  if (error instanceof SuiClientError) {
    throw new TodoOperationError(
      `Blockchain operation failed: ${error.message}`,
      context.operation,
      error
    );
  }

  if (error instanceof Error) {
    throw new TodoOperationError(
      `Unexpected error: ${error.message}`,
      context.operation,
      error
    );
  }

  throw new TodoOperationError('An unknown error occurred', context.operation);
}

/**
 * Retry mechanism for blockchain operations
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (_error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        break;
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }

  throw lastError!;
}

/**
 * Validate todo creation parameters
 */
export function validateCreateTodoParams(params: CreateTodoParams): string[] {
  const errors: string[] = [];

  if (!params.title || params.title.trim().length === 0) {
    errors.push('Title is required');
  }

  if (params.title && params.title.length > 100) {
    errors.push('Title must be 100 characters or less');
  }

  if (params.description && params.description.length > 500) {
    errors.push('Description must be 500 characters or less');
  }

  if (!params.imageUrl || params.imageUrl.trim().length === 0) {
    errors.push('Image URL is required');
  }

  try {
    new URL(params.imageUrl);
  } catch (error: unknown) {
    errors.push('Image URL must be a valid URL');
  }

  return errors;
}

/**
 * Enhanced todo creation with validation and error handling
 */
export async function createTodoSafely(
  params: CreateTodoParams,
  signAndExecuteTransaction: (txb: any) => Promise<any>,
  address: string
): Promise<TransactionResult> {
  const context: ErrorContext = {
    operation: 'create_todo',
    address,
    network: getCurrentNetwork(),
    timestamp: Date.now(),
  };

  try {
    // Validate parameters
    const validationErrors = validateCreateTodoParams(params);
    if (validationErrors.length > 0) {
      throw new TodoOperationError(
        `Validation failed: ${validationErrors.join(', ')}`,
        context.operation
      );
    }

    // Create transaction block
    const txb = new TransactionBlock();

    // Mock transaction construction
    logger.info('Creating todo with params:', params);

    // Execute transaction
    const result = await signAndExecuteTransaction(txb);

    return {
      success: true,
      digest: result.digest,
      objectId: result.objectChanges?.[0]?.objectId,
    };
  } catch (_error) {
    handleSuiOperationError(error, context);
  }
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTransactionConfirmation(
  digest: string,
  maxWaitTime: number = 30000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const status = await getTransactionStatus(digest);

      if (status.status === 'success') {
        return true;
      }

      if (status.status === 'failure') {
        throw new TransactionError('Transaction failed', digest);
      }

      // Wait 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (_error) {
      if (error instanceof TransactionError) {
        throw error;
      }

      // Continue waiting for other errors (might be temporary network issues)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw new Error(`Transaction confirmation timeout after ${maxWaitTime}ms`);
}

/**
 * Network health check
 */
export async function checkNetworkHealth(): Promise<{
  healthy: boolean;
  latency?: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const client = initializeSuiClient();

    // Try to get chain identifier as a health check
    await client.getChainIdentifier();

    const latency = Date.now() - startTime;

    return {
      healthy: true,
      latency,
    };
  } catch (_error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Export utility types for external use
export type {
  Todo,
  CreateTodoParams,
  UpdateTodoParams,
  TransactionResult,
  NetworkType,
  ErrorContext,
};
