import { 
  SuiObjectResponse,
  SuiTransactionBlockResponse,
  SuiClientType
} from './adapters/sui-client-compatibility';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { signTransactionCompatible, executeTransactionCompatible } from './adapters/transaction-compatibility';
import { bcs } from '@mysten/sui/bcs';
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
  private readonly client: SuiClientType;
  private readonly signer: Ed25519Keypair;
  private readonly config: SuiNFTStorageConfig;
  private readonly retryAttempts = 3;
  private readonly retryDelay = 1000; // ms

  constructor(
    client: SuiClientType,
    signer: Ed25519Keypair,
    config: SuiNFTStorageConfig
  ) {
    this.client = client;
    this.signer = signer;
    this.config = config;
  }

  private async checkConnectionHealth(): Promise<boolean> {
    try {
      // Try to get system state with proper typing
      const getLatestSuiSystemState = (this.client as any).getLatestSuiSystemState;
      const getSystemState = (this.client as any).getSystemState;
      
      let systemState: any;
      if (typeof getLatestSuiSystemState === 'function') {
        systemState = await getLatestSuiSystemState();
      } else if (typeof getSystemState === 'function') {
        systemState = await getSystemState();
      } else {
        logger.warn('No system state method available');
        return false;
      }
      
      if (!systemState || !systemState.epoch) {
        logger.warn('Invalid system state response:', systemState);
        return false;
      }
      return true;
    } catch (error) {
      logger.warn('Failed to check network health:', { error: error as any });
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
    logger.info('Title:', { title: todo.title });
    logger.info('Walrus Blob ID:', { walrusBlobId });

    try {
      // Create a transaction block instance
      const tx = new Transaction();
      tx.moveCall({
        target: `${this.config.packageId}::todo_nft::create_todo_nft`,
        arguments: [
          tx.pure(bcs.string().serialize(todo.title).toBytes()),
          tx.pure(bcs.string().serialize(todo.description || '').toBytes()),
          tx.pure(bcs.string().serialize(walrusBlobId).toBytes()),
          tx.pure(bcs.bool().serialize(false).toBytes()),
          tx.object(this.config.collectionId || ''),
        ],
      });

      return await this.executeWithRetry(
        async () => {
          try {
            // Build and serialize transaction in a way that's compatible with different API versions
            const serializedTx = await tx.build({ client: this.client });

            // Sign the transaction block with compatibility handling
            const signature = await signTransactionCompatible(this.signer as any, serializedTx);

            // Execute the transaction with compatibility handling
            const response = await executeTransactionCompatible(this.client as any, {
              transactionBlock: serializedTx,
              signature: signature.signature,
              requestType: 'WaitForLocalExecution',
              options: {
                showEffects: true,
                showEvents: true,
              },
            }) as SuiTransactionBlockResponse;

            if (
              !response.effects?.status?.status ||
              response.effects.status.status !== 'success'
            ) {
              throw new Error(
                (response.effects?.status as { error?: string })?.error || 'Unknown error'
              );
            }

            if (!response.effects.created?.length) {
              throw new Error('NFT creation failed: no NFT was created');
            }

            return response.digest || '';
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
    logger.info('Retrieving Todo NFT with object ID:', { objectId });
    logger.info('Retrieving NFT object data...');

    return await this.executeWithRetry(
      async () => {
        const clientWithGetObject = this.client as unknown as { 
          getObject: (args: { id: string; options: { showDisplay: boolean; showContent: boolean; showType: boolean } }) => Promise<SuiObjectResponse> 
        };
        if (typeof clientWithGetObject.getObject !== 'function') {
          throw new Error('getObject method not available on client');
        }
        
        const response = await clientWithGetObject.getObject({
          id: objectId,
          options: {
            showDisplay: true,
            showContent: true,
            showType: true,
          },
        });

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
      arguments: [
        tx.object(nftId), 
        tx.pure(bcs.bool().serialize(true).toBytes())
      ],
    });

    return await this.executeWithRetry(
      async () => {
        try {
          // Build and serialize transaction in a way that's compatible with different API versions
          const serializedTx = await tx.build({ client: this.client });

          // Sign the transaction block with compatibility handling
          const signature = await signTransactionCompatible(this.signer as any, serializedTx);

          // Execute the transaction with compatibility handling
          const response = await executeTransactionCompatible(this.client as any, {
            transactionBlock: serializedTx,
            signature: signature.signature,
            requestType: 'WaitForLocalExecution',
            options: {
              showEffects: true,
            },
          }) as SuiTransactionBlockResponse;

          if (
            !response.effects?.status?.status ||
            response.effects.status.status !== 'success'
          ) {
            throw new Error((response.effects?.status as { error?: string })?.error || 'Unknown error');
          }

          return response.digest || '';
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
        `Object ID ${idOrDigest} appears to be a transaction digest, not an object ID`
      );
      logger.info(
        'Attempting to get the actual object ID from the transaction effects...'
      );

      const getTransactionBlock = (this.client as any).getTransactionBlock;
      if (typeof getTransactionBlock !== 'function') {
        throw new CLIError('getTransactionBlock method not available on client', 'SUI_CLIENT_ERROR');
      }
      
      const tx = await getTransactionBlock({
        digest: idOrDigest,
        options: {
          showEffects: true,
        },
      }) as Record<string, any>;

      const effects = tx.effects as { created?: Array<Record<string, unknown>> };
      if (!effects?.created?.length) {
        throw new CLIError(
          'No NFT was created in this transaction',
          'SUI_INVALID_TRANSACTION'
        );
      }

      const nftObject = effects.created.find((obj: Record<string, unknown>) => {
        return (
          obj &&
          'reference' in obj &&
          obj.reference &&
          typeof obj.reference === 'object' &&
          obj.reference !== null &&
          'objectId' in obj.reference &&
          typeof (obj.reference as Record<string, unknown>).objectId === 'string'
        );
      });

      if (
        !nftObject ||
        !('reference' in nftObject) ||
        !nftObject.reference ||
        typeof nftObject.reference !== 'object' ||
        nftObject.reference === null ||
        !('objectId' in (nftObject.reference as Record<string, unknown>))
      ) {
        throw new CLIError(
          'Could not find created NFT in transaction',
          'SUI_INVALID_TRANSACTION'
        );
      }

      const objectId = (nftObject.reference as Record<string, unknown>).objectId as string;
      logger.info('Found TodoNFT object:', { objectId });
      return objectId;
    }

    return idOrDigest;
  }
}
