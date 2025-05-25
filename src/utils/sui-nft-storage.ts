import { 
  SuiObjectResponse
} from './adapters/sui-client-compatibility';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { signTransactionCompatible } from './adapters/transaction-compatibility';
// bcs import removed - not used in current implementation
import { CLIError } from '../types/errors/consolidated';
import { Todo } from '../types/todo';
import { Logger } from './Logger';

const logger = new Logger('sui-nft-storage');

export interface SuiNFTStorageConfig {
  readonly address: string;
  readonly packageId: string;
  readonly collectionId?: string;
}

interface TodoNftContent {
  dataType: 'moveObject';
  type: string;
  hasPublicTransfer: boolean;
  fields: {
    id: {
      id: string;
    };
    title: string;
    description: string;
    completed: boolean;
    walrus_blob_id: string;
  };
}

/**
 * SuiNftStorage - A utility class for managing Todo NFTs on the Sui blockchain.
 *
 * This class provides methods to create, retrieve, and update Todo Non-Fungible Tokens (NFTs)
 * that are linked to data stored on the Walrus decentralized storage platform. It serves as a
 * bridge between on-chain NFT metadata and off-chain Todo data, ensuring secure and reliable
 * interactions with the Sui network. Key features include creating NFTs for Todos with associated
 * Walrus blob IDs, fetching NFT details, and updating completion status with retry mechanisms
 * to handle network issues gracefully.
 *
 * @class SuiNftStorage
 * @param {SuiClient} client - The Sui client instance for blockchain interactions.
 * @param {Ed25519Keypair} signer - The cryptographic keypair used for signing transactions.
 * @param {SuiNFTStorageConfig} config - Configuration object containing the address, package ID,
 *                                      and optional collection ID for NFT operations.
 */
export class SuiNftStorage {
  private readonly client: unknown;
  private readonly signer: Ed25519Keypair;
  private readonly config: SuiNFTStorageConfig;
  private readonly retryAttempts = 3;
  private readonly retryDelay = 1000; // ms

  constructor(
    client: unknown,
    signer: Ed25519Keypair,
    config: SuiNFTStorageConfig
  ) {
    this.client = client;
    this.signer = signer;
    this.config = config;
  }

  private async checkConnectionHealth(): Promise<boolean> {
    try {
      // Try to get system state with compatibility handling
      const systemState = await (this.client as any)?.getLatestSuiSystemState?.() || await (this.client as any)?.getSystemState?.();
      if (!systemState || !(systemState as any)?.epoch) {
        logger.warn('Invalid system state response:', systemState);
        return false;
      }
      return true;
    } catch (error) {
      logger.warn('Failed to check network health:', error);
      return false;
    }
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    validateResponse: (response: T) => boolean,
    errorMessage: string
  ): Promise<T> {
    let lastError: Error | null = null;
    const isHealthy = await this.checkConnectionHealth();
    if (!isHealthy) {
      throw new CLIError(
        'Failed to check network health. Please verify your Sui RPC endpoint configuration.',
        'SUI_NETWORK_ERROR'
      );
    }

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await operation();
        if (!validateResponse(response)) {
          throw new Error('Invalid response from network');
        }
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          logger.warn(
            `Retry attempt ${attempt} failed. Retrying in ${delay}ms...`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    throw new CLIError(
      `${errorMessage}: ${lastError?.message || 'Unknown error'}`,
      'SUI_NETWORK_ERROR'
    );
  }

  async createTodoNft(todo: Todo, walrusBlobId: string): Promise<string> {
    if (!todo.title) {
      throw new CLIError('Todo title is required', 'INVALID_TODO');
    }

    if (!walrusBlobId) {
      throw new CLIError(
        'A valid Walrus blob ID must be provided',
        'INVALID_BLOB_ID'
      );
    }

    if (todo.title.length > 100) {
      throw new CLIError(
        'Todo title must be less than 100 characters',
        'INVALID_TITLE'
      );
    }

    logger.info('Preparing Todo NFT creation...');
    logger.info('Title:', todo.title);
    logger.info('Walrus Blob ID:', walrusBlobId);

    try {
      // Create a transaction block instance
      const tx = new Transaction();
      tx.moveCall({
        target: `${this.config.packageId}::todo_nft::create_todo_nft`,
        arguments: [
          tx.pure(todo.title, 'string'),
          tx.pure(todo.description || '', 'string'),
          tx.pure(walrusBlobId, 'string'),
          tx.pure(false),
          tx.object(this.config.collectionId || ''),
        ],
      });

      return await this.executeWithRetry(
        async () => {
          try {
            // Build and serialize transaction in a way that's compatible with different API versions
            const serializedTx = await tx.build({ client: this.client });

            // Sign the transaction block with compatibility handling
            const signature = await signTransactionCompatible(this.signer, serializedTx);

            // Get transaction bytes for execution
            const txBytes = await tx.serialize();

            const response = await (this.client as any).executeTransactionBlock({
              transactionBlock: txBytes,
              signature: signature.signature,
              requestType: 'WaitForLocalExecution',
              options: {
                showEffects: true,
                showEvents: true,
              },
            });

            if (
              !response.effects?.status?.status ||
              response.effects.status.status !== 'success'
            ) {
              throw new Error(
                response.effects?.status?.error || 'Unknown error'
              );
            }

            if (!response.effects.created?.length) {
              throw new Error('NFT creation failed: no NFT was created');
            }

            return response.digest;
          } catch (error) {
            throw new CLIError(
              `Failed to execute transaction: ${error instanceof Error ? error.message : String(error)}`,
              'TRANSACTION_EXECUTION_ERROR'
            );
          }
        },
        response => Boolean(response && response.length > 0),
        'Failed to create Todo NFT'
      );
    } catch (error) {
      throw new CLIError(
        `Failed to create Todo NFT: ${error instanceof Error ? error.message : String(error)}`,
        'SUI_CREATION_FAILED'
      );
    }
  }

  async getTodoNft(nftId: string): Promise<{
    objectId: string;
    title: string;
    description: string;
    completed: boolean;
    walrusBlobId: string;
  }> {
    if (!nftId) {
      throw new CLIError('NFT object ID is required', 'INVALID_NFT_ID');
    }

    const objectId = await this.normalizeObjectId(nftId);
    logger.info('Retrieving Todo NFT with object ID:', objectId);
    logger.info('Retrieving NFT object data...');

    return await this.executeWithRetry(
      async () => {
        const response = (await (this.client as any).getObject({
          id: objectId,
          options: {
            showDisplay: true,
            showContent: true,
            showType: true,
          },
        })) as SuiObjectResponse;

        if (!response.data) {
          throw new CLIError(
            `Todo NFT not found: ${objectId}. The NFT may have been deleted.`,
            'SUI_OBJECT_NOT_FOUND'
          );
        }

        const content = response.data.content as TodoNftContent;
        if (!content || !content.fields || content.dataType !== 'moveObject') {
          throw new CLIError('Invalid NFT data format', 'SUI_INVALID_DATA');
        }

        const fields = content.fields;
        return {
          objectId,
          title: fields.title || '',
          description: fields.description || '',
          completed: fields.completed || false,
          walrusBlobId: fields.walrus_blob_id || '',
        };
      },
      response => Boolean(response && response.objectId),
      'Failed to fetch Todo NFT'
    );
  }

  async updateTodoNftCompletionStatus(nftId: string): Promise<string> {
    if (!nftId) {
      throw new CLIError('NFT object ID is required', 'INVALID_NFT_ID');
    }

    // Create a transaction block instance
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::todo_nft::update_completion_status`,
      arguments: [tx.object(nftId), tx.pure(true, 'bool')],
    });

    return await this.executeWithRetry(
      async () => {
        try {
          // Build and serialize transaction in a way that's compatible with different API versions
          const serializedTx = await tx.build({ client: this.client });

          // Sign the transaction block with compatibility handling
          const signature = await signTransactionCompatible(this.signer, serializedTx);

          // Get transaction bytes for execution
          const txBytes = await tx.serialize();

          const response = await (this.client as any).executeTransactionBlock({
            transactionBlock: txBytes,
            signature: signature.signature,
            requestType: 'WaitForLocalExecution',
            options: {
              showEffects: true,
            },
          });

          if (
            !response.effects?.status?.status ||
            response.effects.status.status !== 'success'
          ) {
            throw new Error(response.effects?.status?.error || 'Unknown error');
          }

          return response.digest;
        } catch (error) {
          throw new CLIError(
            `Failed to execute transaction: ${error instanceof Error ? error.message : String(error)}`,
            'TRANSACTION_EXECUTION_ERROR'
          );
        }
      },
      response => Boolean(response && response.length > 0),
      'Failed to update Todo NFT completion status'
    );
  }

  private async normalizeObjectId(idOrDigest: string): Promise<string> {
    if (idOrDigest.length === 44) {
      logger.info(
        'Object ID',
        idOrDigest,
        'appears to be a transaction digest, not an object ID'
      );
      logger.info(
        'Attempting to get the actual object ID from the transaction effects...'
      );

      const tx = await (this.client as any).getTransactionBlock({
        digest: idOrDigest,
        options: {
          showEffects: true,
        },
      });

      if (!tx.effects?.created?.length) {
        throw new CLIError(
          'No NFT was created in this transaction',
          'SUI_INVALID_TRANSACTION'
        );
      }

      const nftObject = tx.effects.created.find((obj: unknown) => {
        return (
          obj &&
          typeof obj === 'object' &&
          'reference' in obj &&
          obj.reference &&
          typeof obj.reference === 'object' &&
          'objectId' in obj.reference &&
          typeof obj.reference.objectId === 'string'
        );
      });

      if (
        !nftObject ||
        !('reference' in nftObject) ||
        !nftObject.reference ||
        !('objectId' in nftObject.reference)
      ) {
        throw new CLIError(
          'Could not find created NFT in transaction',
          'SUI_INVALID_TRANSACTION'
        );
      }

      const objectId = nftObject.reference.objectId;
      logger.info('Found TodoNFT object:', objectId);
      return objectId;
    }

    return idOrDigest;
  }
}
