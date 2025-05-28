/**
 * Vanilla JavaScript Sui client implementation
 * For use in Node.js (CLI) environments
 */

import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { bcs } from '@mysten/sui/bcs';
import { 
  AppConfig, 
  NetworkType, 
  SuiClientOptions,
  SuiClientType,
  Todo,
  CreateTodoParams,
  UpdateTodoParams,
  TransactionResult,
  SuiClientError,
  WalletNotConnectedError,
  TransactionError,
  NetworkError,
  WalletAccount
} from './types';
import { 
  loadAppConfig, 
  getNetworkConfig, 
  getNetworkUrl,
  getCachedConfig,
  clearConfigCache,
  isConfigurationComplete
} from './config';

/**
 * Vanilla Sui client class for CLI usage
 */
export class VanillaSuiClient {
  private client: SuiClient | null = null;
  private config: AppConfig | null = null;
  private currentNetwork: NetworkType = 'testnet';

  constructor(private options?: SuiClientOptions) {}

  /**
   * Initialize the client with configuration
   */
  async initialize(networkOverride?: NetworkType): Promise<void> {
    try {
      // Load configuration
      this.config = await loadAppConfig(networkOverride);
      this.currentNetwork = this.config.network.name as NetworkType;

      // Create SuiClient instance
      const clientOptions: SuiClientOptions = {
        url: this.config.network.url,
        ...this.options,
      };

      this.client = new SuiClient(clientOptions);
      
      console.log(`[VanillaSuiClient] Initialized for ${this.currentNetwork} network`);
    } catch (error) {
      throw new NetworkError(
        `Failed to initialize Sui client: ${error instanceof Error ? error.message : 'Unknown error'}`,
        networkOverride
      );
    }
  }

  /**
   * Get the underlying SuiClient instance
   */
  getClient(): SuiClient {
    if (!this.client) {
      throw new SuiClientError('Client not initialized. Call initialize() first.');
    }
    return this.client;
  }

  /**
   * Get current configuration
   */
  getConfig(): AppConfig {
    if (!this.config) {
      throw new SuiClientError('Client not initialized. Call initialize() first.');
    }
    return this.config;
  }

  /**
   * Get current network
   */
  getCurrentNetwork(): NetworkType {
    return this.currentNetwork;
  }

  /**
   * Switch to a different network
   */
  async switchNetwork(network: NetworkType): Promise<void> {
    clearConfigCache();
    await this.initialize(network);
  }

  /**
   * Create a keypair from private key
   */
  createKeypairFromPrivateKey(privateKey: string): Ed25519Keypair {
    try {
      return Ed25519Keypair.fromSecretKey(privateKey);
    } catch (error) {
      throw new SuiClientError(
        `Failed to create keypair: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get account information from address
   */
  async getAccount(address: string): Promise<WalletAccount> {
    const client = this.getClient();
    
    try {
      // Get objects owned by the address to verify it exists
      await client.getOwnedObjects({
        owner: address,
        limit: 1,
      });

      return {
        address,
        chains: [`sui:${this.currentNetwork}`],
      };
    } catch (error) {
      throw new SuiClientError(
        `Failed to get account information: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Execute a transaction with a keypair
   */
  async executeTransaction(
    transaction: Transaction, 
    keypair: Ed25519Keypair
  ): Promise<TransactionResult> {
    const client = this.getClient();
    
    try {
      const result = await client.signAndExecuteTransaction({
        transaction,
        signer: keypair,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
          showBalanceChanges: true,
        },
      });

      if (result.effects?.status?.status !== 'success') {
        throw new TransactionError(
          `Transaction failed: ${result.effects?.status?.error || 'Unknown error'}`,
          result.digest
        );
      }

      return {
        digest: result.digest,
        effects: result.effects,
        events: result.events,
        objectChanges: result.objectChanges,
        balanceChanges: result.balanceChanges,
      };
    } catch (error) {
      if (error instanceof TransactionError) {
        throw error;
      }
      throw new TransactionError(
        `Failed to execute transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create a TodoNFT transaction
   */
  createTodoNFTTransaction(params: CreateTodoParams, senderAddress: string): Transaction {
    const config = this.getConfig();
    const packageId = config.contracts.todoNft.packageId;
    const moduleName = config.contracts.todoNft.moduleName;

    const tx = new Transaction();
    tx.setSender(senderAddress);

    tx.moveCall({
      target: `${packageId}::${moduleName}::create_todo`,
      arguments: [
        tx.pure(bcs.string().serialize(params.title)),
        tx.pure(bcs.string().serialize(params.description)),
        tx.pure(bcs.string().serialize(params.imageUrl)),
        tx.pure(bcs.string().serialize(params.metadata || '')),
        tx.pure(bcs.bool().serialize(params.isPrivate || false)),
      ],
    });

    return tx;
  }

  /**
   * Update a TodoNFT transaction
   */
  updateTodoNFTTransaction(params: UpdateTodoParams, senderAddress: string): Transaction {
    const config = this.getConfig();
    const packageId = config.contracts.todoNft.packageId;
    const moduleName = config.contracts.todoNft.moduleName;

    const tx = new Transaction();
    tx.setSender(senderAddress);

    tx.moveCall({
      target: `${packageId}::${moduleName}::update_todo`,
      arguments: [
        tx.object(params.objectId),
        tx.pure(bcs.string().serialize(params.title || '')),
        tx.pure(bcs.string().serialize(params.description || '')),
        tx.pure(bcs.string().serialize(params.imageUrl || '')),
        tx.pure(bcs.string().serialize(params.metadata || '')),
      ],
    });

    return tx;
  }

  /**
   * Complete a TodoNFT transaction
   */
  completeTodoNFTTransaction(objectId: string, senderAddress: string): Transaction {
    const config = this.getConfig();
    const packageId = config.contracts.todoNft.packageId;
    const moduleName = config.contracts.todoNft.moduleName;

    const tx = new Transaction();
    tx.setSender(senderAddress);

    tx.moveCall({
      target: `${packageId}::${moduleName}::complete_todo`,
      arguments: [tx.object(objectId)],
    });

    return tx;
  }

  /**
   * Delete a TodoNFT transaction
   */
  deleteTodoNFTTransaction(objectId: string, senderAddress: string): Transaction {
    const config = this.getConfig();
    const packageId = config.contracts.todoNft.packageId;
    const moduleName = config.contracts.todoNft.moduleName;

    const tx = new Transaction();
    tx.setSender(senderAddress);

    tx.moveCall({
      target: `${packageId}::${moduleName}::delete_todo`,
      arguments: [tx.object(objectId)],
    });

    return tx;
  }

  /**
   * Get TodoNFTs owned by an address
   */
  async getTodosFromBlockchain(ownerAddress: string): Promise<Todo[]> {
    const client = this.getClient();
    const config = this.getConfig();

    try {
      const response = await client.getOwnedObjects({
        owner: ownerAddress,
        filter: {
          StructType: `${config.contracts.todoNft.packageId}::${config.contracts.todoNft.moduleName}::${config.contracts.todoNft.structName}`,
        },
        options: {
          showContent: true,
          showOwner: true,
          showType: true,
        },
      });

      const todos: Todo[] = [];
      
      for (const item of response.data) {
        const todo = this.transformSuiObjectToTodo(item);
        if (todo) {
          todos.push(todo);
        }
      }

      return todos;
    } catch (error) {
      throw new SuiClientError(
        `Failed to fetch todos from blockchain: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get a specific TodoNFT by object ID
   */
  async getTodoByObjectId(objectId: string): Promise<Todo | null> {
    const client = this.getClient();
    
    try {
      const response = await client.getObject({
        id: objectId,
        options: {
          showContent: true,
          showOwner: true,
          showType: true,
        },
      });

      return this.transformSuiObjectToTodo(response);
    } catch (error) {
      throw new SuiClientError(
        `Failed to fetch todo by object ID: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(digest: string) {
    const client = this.getClient();
    
    try {
      const response = await client.getTransactionBlock({
        digest,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
        },
      });

      return {
        status: response.effects?.status?.status || 'unknown',
        digest: response.digest,
        timestamp: response.timestampMs,
        objectChanges: response.objectChanges,
        events: response.events,
      };
    } catch (error) {
      throw new SuiClientError(
        `Failed to get transaction status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Transform Sui object data to Todo interface
   */
  private transformSuiObjectToTodo(suiObject: any): Todo | null {
    if (
      !suiObject.data?.content ||
      suiObject.data.content.dataType !== 'moveObject'
    ) {
      return null;
    }

    const moveObject = suiObject.data.content;
    const fields = moveObject.fields;

    if (!fields) {
      return null;
    }

    try {
      return {
        id: suiObject.data.objectId,
        objectId: suiObject.data.objectId,
        title: fields.title || 'Untitled',
        description: fields.description || '',
        completed: fields.completed === true,
        priority: 'medium', // Default priority
        tags: [],
        blockchainStored: true,
        imageUrl: fields.image_url,
        createdAt: fields.created_at ? parseInt(fields.created_at) : Date.now(),
        completedAt: fields.completed_at ? parseInt(fields.completed_at) : undefined,
        owner: fields.owner,
        metadata: fields.metadata || '',
        isPrivate: fields.is_private === true,
      };
    } catch (error) {
      console.error('[VanillaSuiClient] Error transforming Sui object to Todo:', error);
      return null;
    }
  }
}

/**
 * Create a vanilla Sui client instance
 */
export function createVanillaSuiClient(options?: SuiClientOptions): VanillaSuiClient {
  return new VanillaSuiClient(options);
}

/**
 * Utility functions for direct usage
 */
export const suiUtils = {
  /**
   * Get network URL for a specific network
   */
  getNetworkUrl,

  /**
   * Get network configuration
   */
  getNetworkConfig,

  /**
   * Load app configuration
   */
  loadAppConfig,

  /**
   * Check if configuration is complete
   */
  isConfigurationComplete,

  /**
   * Clear configuration cache
   */
  clearConfigCache,
};

// Re-export types and utilities
export * from './types';
export { 
  loadAppConfig,
  getNetworkConfig,
  getNetworkUrl,
  getCachedConfig,
  clearConfigCache,
  isConfigurationComplete
} from './config';