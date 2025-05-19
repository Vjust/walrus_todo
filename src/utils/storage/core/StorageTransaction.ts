/**
 * @fileoverview Storage Transaction Manager - Handles blockchain transactions for storage
 *
 * This class provides a unified interface for creating and executing storage-related
 * blockchain transactions. It abstracts away the details of transaction creation,
 * signing, and execution, providing a consistent API for various storage operations.
 */

import { SuiClient } from '@mysten/sui/client';
import { TransactionBlock } from '@mysten/sui/transactions';
import { TransactionSigner } from '../../../types/signer';
import { BlockchainError, TransactionError } from '../../../types/errors';
import { AsyncOperationHandler } from '../../walrus-error-handler';
import { createTransactionBlockAdapter } from '../../adapters/transaction-adapter';

/**
 * Transaction operation types
 */
export type TransactionOperation = 
  | 'create-storage'
  | 'extend-storage'
  | 'create-todo-nft'
  | 'update-todo-nft'
  | 'custom';

/**
 * Result of a transaction execution
 */
export interface TransactionResult {
  /** The transaction digest */
  digest: string;
  
  /** Whether the transaction was successful */
  success: boolean;
  
  /** Error message if the transaction failed */
  error?: string;
  
  /** Created object IDs, if any */
  createdObjects?: string[];
  
  /** Updated object IDs, if any */
  updatedObjects?: string[];
  
  /** The raw transaction response */
  rawResponse?: any;
}

/**
 * Options for transaction execution
 */
export interface TransactionOptions {
  /** Maximum number of retries */
  maxRetries?: number;
  
  /** Base delay between retries in milliseconds */
  baseDelay?: number;
  
  /** Whether to wait for local execution */
  waitForLocalExecution?: boolean;
  
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  
  /** Gas budget in MIST */
  gasBudget?: number;
}

/**
 * Manages blockchain transactions for storage operations.
 */
export class StorageTransaction {
  /**
   * Creates a new StorageTransaction instance.
   * 
   * @param suiClient - Client for interacting with the Sui blockchain
   * @param signer - Signer for transaction authorization
   */
  constructor(
    private suiClient: SuiClient,
    private signer: TransactionSigner
  ) {}
  
  /**
   * Creates a transaction block for allocating new storage.
   * 
   * @param size - Requested storage size in bytes
   * @param epochs - Duration in epochs for the storage allocation
   * @returns A transaction block for storage allocation
   * @throws {BlockchainError} if transaction creation fails
   */
  public async createStorageAllocationTransaction(
    size: number,
    epochs: number
  ): Promise<TransactionBlock> {
    try {
      const tx = new TransactionBlock();
      
      tx.moveCall({
        target: '0x2::storage::create_storage',
        arguments: [
          tx.pure(size),
          tx.pure(epochs),
          tx.object('0x6') // Use explicit gas object reference
        ]
      });
      
      return tx;
    } catch (error) {
      throw new BlockchainError(
        `Failed to create storage allocation transaction: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'create storage transaction',
          recoverable: false,
          cause: error instanceof Error ? error : undefined
        }
      );
    }
  }
  
  /**
   * Creates a transaction block for extending existing storage.
   * 
   * @param storageId - ID of the storage object to extend
   * @param additionalSize - Additional storage size in bytes
   * @param additionalEpochs - Additional duration in epochs
   * @returns A transaction block for storage extension
   * @throws {BlockchainError} if transaction creation fails
   */
  public async createStorageExtensionTransaction(
    storageId: string,
    additionalSize: number,
    additionalEpochs: number
  ): Promise<TransactionBlock> {
    try {
      const tx = new TransactionBlock();
      
      tx.moveCall({
        target: '0x2::storage::extend_storage',
        arguments: [
          tx.object(storageId),
          tx.pure(additionalSize),
          tx.pure(additionalEpochs)
        ]
      });
      
      return tx;
    } catch (error) {
      throw new BlockchainError(
        `Failed to create storage extension transaction: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'extend storage transaction',
          recoverable: false,
          cause: error instanceof Error ? error : undefined
        }
      );
    }
  }
  
  /**
   * Executes a transaction block.
   * 
   * @param transaction - The transaction block to execute
   * @param operationType - Type of operation being performed
   * @param options - Options for transaction execution
   * @returns Result of the transaction execution
   * @throws {TransactionError} if transaction execution fails
   */
  public async executeTransaction(
    transaction: TransactionBlock,
    operationType: TransactionOperation,
    options: TransactionOptions = {}
  ): Promise<TransactionResult> {
    const {
      maxRetries = 3,
      baseDelay = 2000,
      waitForLocalExecution = true,
      signal,
      gasBudget
    } = options;
    
    try {
      return await AsyncOperationHandler.execute(
        async () => {
          try {
            // Use adapter for transaction compatibility
            const txAdapter = createTransactionBlockAdapter(transaction);
            
            // Build and serialize transaction for execution
            const serializedTx = await txAdapter.build({ client: this.suiClient });
            
            // Sign the transaction
            const signature = await this.signer.signTransaction(serializedTx);
            
            // Get transaction bytes for execution
            const txBytes = await txAdapter.serialize();
            
            // Set gas budget if provided
            const transactionBlockParams: any = {
              transactionBlock: txBytes,
              signature: signature.signature,
              requestType: waitForLocalExecution ? 'WaitForLocalExecution' : 'WaitForEffectsCert',
              options: {
                showEffects: true,
                showEvents: true
              }
            };
            
            if (gasBudget) {
              transactionBlockParams.options.showInput = true;
              // Apply gas budget if API version supports it
              if ('gasConfig' in txAdapter && typeof (txAdapter as any).gasConfig === 'function') {
                (txAdapter as any).gasConfig({ budget: gasBudget });
              }
            }
            
            // Execute the transaction
            const response = await this.suiClient.executeTransactionBlock(transactionBlockParams);
            
            // Check for successful execution
            if (!response.effects?.status?.status || response.effects.status.status !== 'success') {
              return {
                digest: response.digest,
                success: false,
                error: response.effects?.status?.error || 'Unknown error',
                rawResponse: response
              };
            }
            
            // Extract created objects if any
            const createdObjects = response.effects.created?.map(obj => obj.reference?.objectId) || [];
            
            // Extract updated objects if any
            const updatedObjects = response.effects.mutated?.map(obj => obj.reference?.objectId) || [];
            
            return {
              digest: response.digest,
              success: true,
              createdObjects: createdObjects.filter(id => id) as string[],
              updatedObjects: updatedObjects.filter(id => id) as string[],
              rawResponse: response
            };
          } catch (error) {
            throw new TransactionError(
              `Failed to execute ${operationType} transaction: ${error instanceof Error ? error.message : String(error)}`,
              {
                operation: `execute ${operationType}`,
                recoverable: this.isTransientError(error),
                cause: error instanceof Error ? error : undefined
              }
            );
          }
        },
        {
          operation: `${operationType} transaction`,
          maxRetries,
          baseDelay,
          signal
        }
      ).then(result => {
        if (!result.success) {
          throw result.error;
        }
        return result.data;
      });
    } catch (error) {
      if (error instanceof TransactionError) {
        throw error;
      }
      
      throw new TransactionError(
        `Failed to execute ${operationType} transaction: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: `execute ${operationType}`,
          recoverable: false,
          cause: error instanceof Error ? error : undefined
        }
      );
    }
  }
  
  /**
   * Determines if an error is likely transient and should be retried.
   * 
   * @param error - The error to check
   * @returns Whether the error is likely transient
   */
  private isTransientError(error: any): boolean {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    // Common transient errors to retry
    const transientPatterns = [
      'timeout',
      'connection',
      'network',
      'temporarily',
      'unavailable',
      'overloaded',
      'too many requests',
      'rate limit',
      'try again',
      'busy'
    ];
    
    return transientPatterns.some(pattern => 
      errorMsg.toLowerCase().includes(pattern.toLowerCase())
    );
  }
}