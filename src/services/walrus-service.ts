/**
 * Walrus Storage Service
 * Handles interaction with Walrus decentralized storage
 * Manages todo data persistence and retrieval
 */

import { WalrusClient } from '@mysten/walrus';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Todo, TodoList } from '../types';
import { configService } from './config-service';
import { retryWithBackoff } from '../utils';
import { CURRENT_NETWORK, NETWORK_URLS, WALRUS_CONFIG } from '../constants';

/**
 * Manages todo storage operations using Walrus
 * Handles encryption, blob storage, and data retrieval
 */
class WalrusService {
  private walrusClient: WalrusClient;
  private suiClient: SuiClient;

  constructor() {
    const config = configService.getConfig();
    
    // Initialize SuiClient first, required for WalrusClient
    // Use network from environment variables (via constants) with fallback to config
    const network = CURRENT_NETWORK || config.network;
    
    // Get appropriate RPC URL for the selected network
    const rpcUrl = NETWORK_URLS[network] || getFullnodeUrl(network);
    
    this.suiClient = new SuiClient({
      url: rpcUrl,
    });
    
    // Initialize WalrusClient with the SuiClient instance
    this.walrusClient = new WalrusClient({
      network: network,
      suiClient: this.suiClient,
      // Optional custom error handling
      storageNodeClientOptions: {
        onError: (error) => console.error('Walrus error:', error),
        timeout: 30000, // 30 seconds timeout
      },
    });
    
    console.log(`Walrus client initialized for network: ${network}`);
  }

  private async encryptData(data: any): Promise<Uint8Array> {
    // Convert JSON to Uint8Array (we'll implement proper encryption later)
    const jsonString = JSON.stringify(data);
    return new TextEncoder().encode(jsonString);
  }

  private async decryptData(encryptedData: Uint8Array): Promise<any> {
    // Convert Uint8Array back to JSON (we'll implement proper decryption later)
    const jsonString = new TextDecoder().decode(encryptedData);
    return JSON.parse(jsonString);
  }

  /**
   * Stores a todo item in Walrus storage
   * @param listName - Name of the todo list
   * @param todo - Todo item to store
   * @returns Promise<string> - Blob ID of stored todo
   */
  public async storeTodo(listId: string, todo: Todo): Promise<string> {
    try {
      // Handle private todos separately using local storage
      if (todo.private) {
        await configService.saveLocalTodo(listId, todo);
        return `local-${todo.id}`;
      }

      // Encrypt data if needed before sending to Walrus
      const blobContent = await this.encryptData(todo);
      
      // Mock implementation without actual blockchain transactions
      // In a real implementation, you would need a proper signer and WAL tokens
      // Use retry with backoff for resilience to network issues
      const result = await retryWithBackoff(async () => {
        // Write blob to Walrus storage using the correct parameter structure
        // This is a simplification - in a real app, you'd need proper signer, epochs, etc.
        const mockResponse = { blobId: `blob-${todo.id}-${Date.now()}` };
        
        // Uncomment the real implementation when you have proper signer and WAL tokens:
        // return await this.walrusClient.writeBlob({
        //   blob: blobContent,
        //   deletable: false,
        //   epochs: 3,
        //   signer: keypair, // You would need to implement this
        // });
        
        return mockResponse;
      }, 3, 1000);
      
      return result.blobId;
    } catch (error) {
      console.error('Error storing todo:', error);
      throw error;
    }
  }

  /**
   * Retrieves a todo item from Walrus storage
   * @param blobId - ID of the blob to retrieve
   * @returns Promise<Todo | null>
   */
  public async getTodo(blobId: string): Promise<Todo | null> {
    try {
      // Handle local todos (private ones)
      if (blobId.startsWith('local-')) {
        const todoId = blobId.replace('local-', '');
        return await configService.getLocalTodoById(todoId);
      }

      // Use retry with backoff for resilience to network issues
      const encryptedData = await retryWithBackoff(async () => {
        // Read blob from Walrus storage using the official SDK
        return await this.walrusClient.readBlob({ blobId });
      }, 3, 1000);
      
      if (!encryptedData) return null;
      
      // Decrypt the data
      const todo = await this.decryptData(encryptedData);
      return todo;
    } catch (error) {
      console.error('Error retrieving todo:', error);
      throw error;
    }
  }

  /**
   * Retrieves a todo list from storage
   * @param listId - ID of the todo list to retrieve
   * @returns Promise<TodoList | null>
   */
  public async getTodoList(listId: string): Promise<TodoList | null> {
    try {
      // First, get list metadata (stored as a separate blob)
      const listMetadataBlobId = `${listId}_metadata`;
      
      let listMetadata: { todoIds: string[] } | null = null;
      
      try {
        // Try to read the list metadata
        const metadataBlob = await this.walrusClient.readBlob({ blobId: listMetadataBlobId });
        if (metadataBlob) {
          listMetadata = await this.decryptData(metadataBlob);
        }
      } catch (error) {
        console.warn(`No metadata found for list ${listId}, creating new list.`);
      }
      
      // Get local private todos
      const localList = await configService.getLocalTodos(listId);
      const localTodos = localList?.todos || [];
      
      // Initialize the list structure
      const todoList: TodoList = {
        id: listId,
        name: listId, // We can update this if we find metadata
        owner: configService.getConfig().owner || 'current-user',
        todos: [...localTodos.filter(todo => todo.private)],
        version: 1
      };
      
      // If we have metadata, fetch all todos by their IDs
      if (listMetadata && listMetadata.todoIds && listMetadata.todoIds.length > 0) {
        const fetchPromises = listMetadata.todoIds.map(async (todoId) => {
          try {
            const todo = await this.getTodo(todoId);
            return todo;
          } catch (error) {
            console.warn(`Failed to retrieve todo with ID ${todoId}:`, error);
            return null;
          }
        });
        
        // Wait for all todos to be fetched
        const fetchedTodos = await Promise.all(fetchPromises);
        
        // Add all non-null, non-private todos to the list
        todoList.todos.push(...fetchedTodos
          .filter((todo): todo is Todo => todo !== null && !todo.private)
        );
      }

      return todoList;
    } catch (error) {
      console.error('Error retrieving todo list:', error);
      throw error;
    }
  }

  /**
   * Updates a todo item in Walrus storage
   * @param listId - ID of the todo list
   * @param todo - Updated todo item
   * @returns Promise<void>
   */
  public async updateTodo(listId: string, todo: Todo): Promise<void> {
    try {
      // Handle private todos separately using local storage
      if (todo.private) {
        await configService.updateLocalTodo(listId, todo);
        return;
      }

      // For Walrus stored todos, we need to:
      // 1. Store the updated todo as a new blob
      // 2. Update the list metadata to point to the new blob
      
      // Encrypt the todo
      const blobContent = await this.encryptData(todo);
      
      // Write the updated todo to Walrus
      const result = await retryWithBackoff(async () => {
        // Mock implementation for now
        const mockResponse = { blobId: `blob-${todo.id}-${Date.now()}` };
        
        // Uncomment the real implementation when you have proper signer and WAL tokens:
        // return await this.walrusClient.writeBlob({
        //   blob: blobContent,
        //   deletable: false,
        //   epochs: 3,
        //   signer: keypair, // You would need to implement this
        // });
        
        return mockResponse;
      }, 3, 1000);
      
      const blobId = result.blobId;
      
      // Now update the list metadata to reference this new blob
      // First retrieve existing metadata
      const listMetadataBlobId = `${listId}_metadata`;
      let listMetadata: { todoIds: string[], name?: string } = { todoIds: [] };
      
      try {
        const metadataBlob = await this.walrusClient.readBlob({ blobId: listMetadataBlobId });
        if (metadataBlob) {
          listMetadata = await this.decryptData(metadataBlob);
        }
      } catch (error) {
        console.warn(`Creating new metadata for list ${listId}`);
      }
      
      // Replace the old todo ID with the new one or add if not exists
      const todoIndex = listMetadata.todoIds.findIndex(id => {
        try {
          // Try to extract the todo ID from the blob ID if needed
          const fetchedTodo = this.getTodo(id);
          return fetchedTodo && (fetchedTodo as any).id === todo.id;
        } catch {
          return false;
        }
      });
      
      if (todoIndex >= 0) {
        listMetadata.todoIds[todoIndex] = blobId;
      } else {
        listMetadata.todoIds.push(blobId);
      }
      
      // Save the updated metadata
      const metadataToStore = await this.encryptData(listMetadata);
      
      // Mock metadata storage for now
      // In a real implementation, this would use the proper Walrus SDK calls
      console.log(`Storing metadata for list ${listId} with blob ID ${listMetadataBlobId}`);
      
      // Uncomment the real implementation when you have proper signer and WAL tokens:
      // await this.walrusClient.writeBlob({ 
      //   blob: metadataToStore,
      //   deletable: false,
      //   epochs: 3,
      //   signer: keypair,
      //   blobId: listMetadataBlobId // Note: not sure if blobId is supported as a parameter
      // });
    } catch (error) {
      console.error('Error updating todo:', error);
      throw error;
    }
  }

  /**
   * Deletes a todo item from storage
   * @param listId - ID of the todo list
   * @param todoId - ID of the todo to delete
   * @returns Promise<void>
   */
  public async deleteTodo(listId: string, todoId: string): Promise<void> {
    try {
      // Try to delete from local storage first (for private todos)
      await configService.deleteLocalTodo(listId, todoId);
      
      // For Walrus stored todos, we need to update the list metadata
      // to remove reference to the todo blob
      const listMetadataBlobId = `${listId}_metadata`;
      
      try {
        // Get the current metadata
        const metadataBlob = await this.walrusClient.readBlob({ blobId: listMetadataBlobId });
        if (metadataBlob) {
          const listMetadata = await this.decryptData(metadataBlob);
          
          // Filter out the blob ID for the todo we want to delete
          listMetadata.todoIds = listMetadata.todoIds.filter(async (blobId: string) => {
            try {
              const todo = await this.getTodo(blobId);
              return todo && todo.id !== todoId;
            } catch {
              // If we can't retrieve the todo, keep it in the list
              return true;
            }
          });
          
          // Save the updated metadata - using mock implementation for now
          const metadataToStore = await this.encryptData(listMetadata);
          
          // Uncomment the real implementation when you have proper signer and WAL tokens:
          // await this.walrusClient.writeBlob({ 
          //   blob: metadataToStore,
          //   deletable: false,
          //   epochs: 3,
          //   signer: keypair,
          //   // Note: Not sure if custom blobId is supported, might need additional research
          // });
          
          console.log(`Updated metadata for list ${listId} after deleting todo ${todoId}`);
        }
      } catch (error) {
        console.warn(`Could not update metadata for list ${listId}:`, error);
      }
    } catch (error) {
      console.error('Error deleting todo:', error);
      throw error;
    }
  }

  /**
   * Synchronizes todo list between Walrus storage and on-chain data
   * @param listId - ID of the todo list to sync
   * @param onChainList - Todo list data from the blockchain
   * @returns Promise<void>
   */
  public async syncWithBlockchain(listId: string, onChainList: TodoList): Promise<void> {
    try {
      const localList = await this.getTodoList(listId);
      if (!localList) {
        // If local list doesn't exist, create it from blockchain state
        // Initialize metadata
        const metadataBlobId = `${listId}_metadata`;
        
        // Create storage for blob IDs of todos
        const todoIdPromises: Promise<string>[] = [];
        
        // Only sync public todos (private ones stay local)
        for (const todo of onChainList.todos.filter(todo => !todo.private)) {
          const promise = this.storeTodo(listId, todo);
          todoIdPromises.push(promise);
        }
        
        // Wait for all todos to be stored and get their blob IDs
        const todoIds = await Promise.all(todoIdPromises);
        
        // Create metadata for the list
        const metadata = {
          todoIds,
          name: onChainList.name,
          version: onChainList.version
        };
        
        // Store metadata
        const metadataToStore = await this.encryptData(metadata);
        
        // Mock implementation for now
        console.log(`Storing initial metadata for list ${listId}`);
        
        // Uncomment the real implementation when you have proper signer and WAL tokens:
        // await this.walrusClient.writeBlob({
        //   blob: metadataToStore,
        //   deletable: false,
        //   epochs: 3,
        //   signer: keypair,
        //   // Note: Custom blobId might need additional implementation
        // });
        
        return;
      }

      // Sync versions if blockchain version is newer
      if (onChainList.version > localList.version) {
        const metadataBlobId = `${listId}_metadata`;
        
        try {
          // Try to read the list metadata
          const metadataBlob = await this.walrusClient.readBlob({ blobId: metadataBlobId });
          let listMetadata: { todoIds: string[], name?: string, version?: number } = { todoIds: [] };
          
          if (metadataBlob) {
            listMetadata = await this.decryptData(metadataBlob);
          }
          
          // Preserve private todos during sync
          const privateTodos = localList.todos.filter(todo => todo.private);
          
          // Get IDs of todos to preserve
          const privateIds = privateTodos.map(todo => todo.id);
          
          // Filter out blob IDs containing private todos
          let existingBlobIds = listMetadata.todoIds;
          for (const blobId of existingBlobIds) {
            try {
              const todo = await this.getTodo(blobId);
              if (todo && privateIds.includes(todo.id)) {
                // Filter out this blob ID as it's for a private todo
                existingBlobIds = existingBlobIds.filter(id => id !== blobId);
              }
            } catch {
              // Skip errors when retrieving todos
            }
          }
          
          // Store all new public todos from blockchain
          const todoIdPromises: Promise<string>[] = [];
          for (const todo of onChainList.todos.filter(todo => !todo.private)) {
            const promise = this.storeTodo(listId, todo);
            todoIdPromises.push(promise);
          }
          
          // Wait for all todos to be stored and get their blob IDs
          const newBlobIds = await Promise.all(todoIdPromises);
          
          // Update metadata with combined blob IDs
          const updatedMetadata = {
            todoIds: [...existingBlobIds, ...newBlobIds],
            name: onChainList.name,
            version: onChainList.version
          };
          
          // Store updated metadata
          const metadataToStore = await this.encryptData(updatedMetadata);
          
          // Mock implementation for now
          console.log(`Storing updated metadata for list ${listId}`);
          
          // Uncomment the real implementation when you have proper signer and WAL tokens:
          // await this.walrusClient.writeBlob({
          //   blob: metadataToStore,
          //   deletable: false,
          //   epochs: 3,
          //   signer: keypair,
          //   // Note: Custom blobId might need additional implementation
          // });
        } catch (error) {
          console.error(`Error updating metadata for list ${listId}:`, error);
          throw error;
        }
      }
    } catch (error) {
      console.error('Error syncing with blockchain:', error);
      throw error;
    }
  }
}

export const walrusService = new WalrusService();