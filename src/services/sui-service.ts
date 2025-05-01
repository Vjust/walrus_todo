/**
 * Sui Blockchain Service
 * Handles interaction with Sui blockchain
 * Manages smart contract calls and transaction submission
 */

import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import { bcs } from '@mysten/sui/bcs';
import { execSync } from 'child_process';
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

  /**
   * Publishes a todo list to the blockchain
   * @param listName - Name of the todo list
   * @param todoList - Todo list data to publish
   * @returns Promise<void>
   */
  public async publishList(listName: string, todoList: TodoList): Promise<{
    digest: string;
    effects: {
      gasUsed: {
        computationCost: string;
      };
    };
  }> {
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

    // Use sui CLI to sign and execute transaction
    const txBytes = tx.serialize();
    const result = JSON.parse(execSync(`sui client sign-and-execute --json --gas-budget 10000000 ${txBytes}`).toString());

    if (!result.effects?.gasUsed?.computationCost) {
      throw new Error('Failed to get transaction effects');
    }

    return {
      digest: result.digest,
      effects: {
        gasUsed: {
          computationCost: result.effects.gasUsed.computationCost.toString()
        }
      }
    };
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

    // Use sui CLI to sign and execute transaction
    const txBytes = tx.serialize();
    await execSync(`sui client sign-and-execute --gas-budget 10000000 ${txBytes}`);
  }
}

// Singleton instance
export const suiService = new SuiService();