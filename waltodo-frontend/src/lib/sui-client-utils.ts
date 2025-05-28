/**
 * Utility functions and examples for Sui client usage
 * Comprehensive error handling and usage patterns for TodoNFT operations
 */

import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

// Types for frontend usage
export interface Todo {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
  imageUrl?: string;
  metadata?: string;
  isPrivate?: boolean;
}

export interface CreateTodoParams {
  title: string;
  description: string;
  imageUrl?: string;
  metadata?: string;
  isPrivate?: boolean;
}

export interface UpdateTodoParams {
  id: string;
  title?: string;
  description?: string;
  completed?: boolean;
  imageUrl?: string;
  metadata?: string;
}

export interface TransactionResult {
  success: boolean;
  digest?: string;
  objectId?: string;
  error?: string;
}

export type NetworkType = 'testnet' | 'devnet' | 'mainnet' | 'localnet';

export interface ErrorContext {
  operation: string;
  network?: NetworkType;
  timestamp?: number;
}

// Mock implementations for basic utility functions
export function initializeSuiClient(): SuiClient {
  return new SuiClient({ url: 'https://fullnode.testnet.sui.io:443' });
}

export function getCurrentNetwork(): NetworkType {
  return 'testnet';
}

export async function getTransactionStatus(digest: string) {
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
  console.error('Sui operation failed:', {
    error,
    context: errorContext,
  });

  if (error instanceof Error) {
    throw new Error(`${context.operation} failed: ${error.message}`);
  }

  throw new Error(`${context.operation} failed: Unknown error occurred`);
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
    } catch (error) {
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

  // Note: imageUrl is optional in this frontend version

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
    network: getCurrentNetwork(),
    timestamp: Date.now(),
  };

  try {
    // Validate parameters
    const validationErrors = validateCreateTodoParams(params);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    // Create transaction block
    const txb = new Transaction();

    // Mock transaction construction
    console.log('Creating todo with params:', params);

    // Execute transaction
    const result = await signAndExecuteTransaction(txb);

    return {
      success: true,
      digest: result.digest,
      objectId: result.objectChanges?.[0]?.objectId,
    };
  } catch (error) {
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
        throw new Error('Transaction failed');
      }

      // Wait 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Transaction failed')
      ) {
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
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Re-export types are already exported above as interfaces
