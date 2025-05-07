import { SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { bcs } from '@mysten/sui.js/bcs';
import { CLIError } from '../types/error';
import { Todo } from '../types/todo';

export interface SuiNFTStorageConfig {
  readonly address: string;
  readonly packageId: string;
  readonly collectionId?: string;
}

interface TodoNftContent {
  type: string;
  dataType: 'moveObject';
  hasPublicTransfer: boolean;
  fields: Record<string, any>;
}

export class SuiNftStorage {
  private readonly client: SuiClient;
  private readonly signer: Ed25519Keypair;
  private readonly config: SuiNFTStorageConfig;
  private readonly retryAttempts = 3;
  private readonly retryDelay = 1000; // ms

  constructor(
    client: SuiClient,
    signer: Ed25519Keypair,
    config: SuiNFTStorageConfig
  ) {
    this.client = client;
    this.signer = signer;
    this.config = config;
  }

  private async checkConnectionHealth(): Promise<boolean> {
    try {
      const systemState = await this.client.getLatestSuiSystemState();
      if (!systemState || !systemState.epoch) {
        console.warn('Invalid system state response:', systemState);
        return false;
      }
      return true;
    } catch (error) {
      console.warn('Failed to check network health:', error);
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
      throw new CLIError('Failed to check network health. Please verify your Sui RPC endpoint configuration.', 'SUI_NETWORK_ERROR');
    }

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await operation();
        if (!validateResponse(response)) {
          throw new Error('Invalid response from network');
        }
        return response;
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
          continue;
        }
      }
    }

    throw new CLIError(
      `${errorMessage}: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`,
      'SUI_NETWORK_ERROR'
    );
  }

  async createTodoNft(todo: Todo, walrusBlobId: string): Promise<string> {
    if (!todo.title) {
      throw new CLIError('Todo title is required', 'INVALID_TODO');
    }

    if (!walrusBlobId) {
      throw new CLIError('A valid Walrus blob ID must be provided', 'INVALID_BLOB_ID');
    }

    if (todo.title.length > 100) {
      throw new CLIError('Todo title must be less than 100 characters', 'INVALID_TITLE');
    }

    console.log('Preparing Todo NFT creation...');
    console.log('Title:', todo.title);
    console.log('Walrus Blob ID:', walrusBlobId);

    try {
      const tx = new TransactionBlock();
      const moveCall = tx.moveCall({
        target: `${this.config.packageId}::todo_nft::create_todo_nft`,
        arguments: [
          tx.pure(bcs.string().serialize(todo.title)),
          tx.pure(bcs.string().serialize(todo.description || '')),
          tx.pure(bcs.string().serialize(walrusBlobId)),
          tx.pure(bcs.bool().serialize(false)),
          tx.object(this.config.collectionId || ''),
        ],
      });

      return await this.executeWithRetry(
        async () => {
          const response = await this.client.signAndExecuteTransactionBlock(
            transaction: tx,
            signer: this.signer,
            requestType: 'WaitForLocalExecution',
            options: {
              showEffects: true,
            },
          });

          if (!response.effects?.status?.status || response.effects.status.status !== 'success') {
            throw new Error(response.effects?.status?.error || 'Unknown error');
          }

          if (!response.effects.created?.length) {
            throw new Error('NFT creation failed: no NFT was created');
          }

          return response.digest;
        },
        (response) => Boolean(response && response.length > 0),
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
    console.log('Retrieving Todo NFT with object ID:', objectId);
    console.log('Retrieving NFT object data...');

    return await this.executeWithRetry(
      async () => {
        const response = await this.client.getObject({
          id: objectId,
          options: {
            showContent: true,
          },
        });

        if (!response.data) {
          throw new CLIError(`Todo NFT not found: ${objectId}. The NFT may have been deleted.`, 'SUI_OBJECT_NOT_FOUND');
        }

        const content = response.data.content as TodoNftContent;
        if (!content || !content.fields) {
          throw new CLIError('Invalid NFT data format', 'SUI_INVALID_DATA');
        }

        const fields = content.fields;
        return {
          objectId,
          title: fields.title || '',
          description: fields.description || '',
          completed: fields.completed || false,
          walrusBlobId: fields.walrus_blob_id || fields.walrusBlobId || '',
        };
      },
      (response) => Boolean(response && response.objectId),
      'Failed to fetch Todo NFT'
    );
  }

  async updateTodoNftCompletionStatus(nftId: string): Promise<string> {
    if (!nftId) {
      throw new CLIError('NFT object ID is required', 'INVALID_NFT_ID');
    }

    const tx = new TransactionBlock();
    const moveCall = tx.moveCall({
      target: `${this.config.packageId}::todo_nft::update_completion_status`,
      arguments: [
        tx.object(nftId),
        tx.pure(bcs.bool().serialize(true)),
      ],
    });

    return await this.executeWithRetry(
      async () => {
        const response = await this.client.signAndExecuteTransactionBlock(
          transaction: tx,
          signer: this.signer,
          requestType: 'WaitForLocalExecution',
          options: {
            showEffects: true,
          },
        });

        if (!response.effects?.status?.status || response.effects.status.status !== 'success') {
          throw new Error(response.effects?.status?.error || 'Unknown error');
        }

        return response.digest;
      },
      (response) => Boolean(response && response.length > 0),
      'Failed to update Todo NFT completion status'
    );
  }

  private async normalizeObjectId(idOrDigest: string): Promise<string> {
    // Check if input looks like a transaction digest rather than an object ID
    if (idOrDigest.length === 44) {
      console.log('Object ID', idOrDigest, 'appears to be a transaction digest, not an object ID');
      console.log('Attempting to get the actual object ID from the transaction effects...');

      // Get transaction details to find the created NFT
      const tx = await this.client.getTransactionBlock({
        digest: idOrDigest,
        options: {
          showEffects: true,
        },
      });

      if (!tx.effects?.created?.length) {
        throw new CLIError('No NFT was created in this transaction', 'SUI_INVALID_TRANSACTION');
      }

      // Find the first created object
      const nftObject = tx.effects.created.find(obj => {
        return obj && typeof obj === 'object' && 'reference' in obj && obj.reference && typeof obj.reference === 'object' && 'objectId' in obj.reference && typeof obj.reference.objectId === 'string';
      });

      if (!nftObject || !('reference' in nftObject) || !nftObject.reference || !('objectId' in nftObject.reference)) {
        throw new CLIError('Could not find created NFT in transaction', 'SUI_INVALID_TRANSACTION');
      }

      const objectId = nftObject.reference.objectId;
      console.log('Found TodoNFT object:', objectId);
      return objectId;
    }

    return idOrDigest;
  }
}