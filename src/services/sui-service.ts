/**
 * Sui Blockchain Service
 * Handles interaction with Sui blockchain
 * Manages smart contract calls and transaction submission
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import { bcs } from '@mysten/sui/bcs';
import { fromB64 } from '@mysten/sui/utils';
import { configService } from './config-service';
import { NETWORK_URLS, PACKAGE_CONFIG } from '../constants';
import { TodoList } from '../types';

/**
 * Manages blockchain operations for todo lists
 * Handles transaction submission and state synchronization
 */
class SuiService {
  private client: SuiClient;

  constructor() {
    const config = configService.getConfig();
    this.client = new SuiClient({ url: NETWORK_URLS[config.network] });
  }

  private getKeypair(): Ed25519Keypair {
    const config = configService.getConfig();
    if (!config.privateKey) {
      throw new Error('Private key not configured. Run `waltodo configure` first.');
    }
    return Ed25519Keypair.fromSecretKey(fromB64(config.privateKey));
  }

  /**
   * Publishes a todo list to the blockchain
   * @param listName - Name of the todo list
   * @param todoList - Todo list data to publish
   * @returns Promise<void>
   */
  public async publishList(listName: string, todoList: TodoList): Promise<void> {
    const tx = new Transaction();
    
    // Create new todo list on chain with references to Walrus blobs
    tx.moveCall({
      target: `${PACKAGE_CONFIG.ID}::${PACKAGE_CONFIG.MODULE}::create_list`,
      arguments: [
        bcs.string().serialize(listName),
        bcs.u64().serialize(BigInt(todoList.version)),
        bcs.vector(bcs.string()).serialize(todoList.todos.map(todo => todo.walrusBlobId || ''))
      ]
    });

    const keypair = this.getKeypair();
    await this.client.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair,
      options: {
        showEffects: true
      }
    });
  }

  /**
   * Retrieves todo list state from blockchain
   * @param listName - Name of the todo list
   * @returns Promise<TodoList | null>
   */
  public async getListState(listName: string): Promise<TodoList | null> {
    const config = configService.getConfig();
    
    try {
      // Query the blockchain for list data
      const objects = await this.client.getOwnedObjects({
        owner: config.walletAddress!,
        filter: {
          MatchAll: [
            { StructType: `${PACKAGE_CONFIG.ID}::${PACKAGE_CONFIG.MODULE}::TodoList` }
          ]
        }
      });

      // Find the specific list
      for (const obj of objects.data) {
        if (!obj.data) continue;
        
        const details = await this.client.getObject({
          id: obj.data.objectId,
          options: { showContent: true }
        });

        const content = details.data?.content;
        if (content && 'fields' in content) {
          const fields = content.fields as any;
          if (fields.name === listName) {
            return {
              id: obj.data.objectId,
              name: fields.name,
              owner: config.walletAddress!,
              todos: [], // Actual todos are stored in Walrus, these are just references
              version: parseInt(fields.version),
              collaborators: fields.collaborators || []
            };
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error getting list state:', error);
      return null;
    }
  }

  public async updateListVersion(listId: string, newVersion: number): Promise<void> {
    const tx = new Transaction();
    
    tx.moveCall({
      target: `${PACKAGE_CONFIG.ID}::${PACKAGE_CONFIG.MODULE}::update_version`,
      arguments: [
        tx.object(listId),
        bcs.u64().serialize(BigInt(newVersion))
      ]
    });

    const keypair = this.getKeypair();
    await this.client.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair,
      options: {
        showEffects: true
      }
    });
  }
}

// Singleton instance
export const suiService = new SuiService();