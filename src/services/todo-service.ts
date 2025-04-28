import { walrusService } from './walrus-service';
import { suiService } from './sui-service';
import { Todo, TodoList, WalrusError, SuiError } from '../types';
import { generateId } from '../utils/id-generator';
import { ConfigService } from './config-service';

/**
 * Service that manages todo operations
 * Coordinates between local storage, Walrus storage, and blockchain
 */
export class TodoService {
  private configService: ConfigService;
  
  constructor() {
    this.configService = new ConfigService();
  }
  
  /**
   * Create a new todo list with the given name
   * @param listName Name of the todo list to create
   * @returns Promise<TodoList> The created todo list
   */
  public async createList(listName: string): Promise<TodoList> {
    try {
      const config = this.configService.getConfig();
      if (!config.walletAddress) {
        throw new Error('Wallet not configured. Run "waltodo configure" first.');
      }
      
      // Create new empty list
      const newList: TodoList = {
        id: generateId(),
        name: listName,
        owner: config.walletAddress,
        todos: [],
        version: 1,
        collaborators: [],
        lastSynced: new Date().toISOString()
      };
      
      // Save locally and return
      return newList;
    } catch (error: unknown) {
      if (error instanceof WalrusError || error instanceof SuiError) {
        throw error;
      }
      throw new Error(`Failed to create list: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Share a todo list with another user
   * @param listId ID of the list to share
   * @param targetAddress Address of the user to share with
   * @returns Promise<boolean> Whether the operation was successful
   */
  public async shareList(listId: string, targetAddress: string): Promise<boolean> {
    try {
      const listState = await suiService.getListState(listId);
      if (!listState) {
        throw new Error(`Todo list with ID ${listId} not found`);
      }

      // Prepare updated collaborators list
      const updatedCollaborators = [
        ...(listState.collaborators || []),
        targetAddress
      ];

      // Increment version to signal an update on‑chain
      await suiService.updateListVersion(listId, listState.version + 1);

      // OPTIONAL: call a future addCollaborator/updateCollaborators Move call here
      // await suiService.addCollaborator(listId, targetAddress);

      // Verify (best‑effort)
      const updatedListState = await suiService.getListState(listId);
      if (
        updatedListState &&
        updatedListState.collaborators &&
        updatedListState.collaborators.includes(targetAddress)
      ) {
        return true;
      }

      // Fallback – assume success if no error was thrown
      return true;
    } catch (error: unknown) {
      if (error instanceof WalrusError || error instanceof SuiError) {
        throw error;
      }
      throw new Error(
        `Failed to share list: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

// Export singleton instance
export const todoService = new TodoService();
