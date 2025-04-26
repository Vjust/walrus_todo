"use strict";
/**
 * Walrus Storage Service
 * Handles interaction with Walrus decentralized storage
 * Manages todo data persistence and retrieval
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.walrusService = void 0;
const walrus_1 = require("@mysten/walrus");
const client_1 = require("@mysten/sui/client");
const config_service_1 = require("./config-service");
const utils_1 = require("../utils");
/**
 * Manages todo storage operations using Walrus
 * Handles encryption, blob storage, and data retrieval
 */
class WalrusService {
    constructor() {
        const config = config_service_1.configService.getConfig();
        // Initialize SuiClient first, required for WalrusClient
        this.suiClient = new client_1.SuiClient({
            url: (0, client_1.getFullnodeUrl)(config.network || 'testnet'),
        });
        // Initialize WalrusClient with the SuiClient instance
        this.walrusClient = new walrus_1.WalrusClient({
            network: config.network || 'testnet',
            suiClient: this.suiClient,
            // Optional custom error handling
            storageNodeClientOptions: {
                onError: (error) => console.error('Walrus error:', error),
                timeout: 30000, // 30 seconds timeout
            },
        });
    }
    async encryptData(data) {
        // Convert JSON to Uint8Array (we'll implement proper encryption later)
        const jsonString = JSON.stringify(data);
        return new TextEncoder().encode(jsonString);
    }
    async decryptData(encryptedData) {
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
    async storeTodo(listId, todo) {
        try {
            // Handle private todos separately using local storage
            if (todo.private) {
                await config_service_1.configService.saveLocalTodo(listId, todo);
                return `local-${todo.id}`;
            }
            // Encrypt data if needed before sending to Walrus
            const dataToStore = await this.encryptData(todo);
            // Use retry with backoff for resilience to network issues
            const blobId = await (0, utils_1.retryWithBackoff)(async () => {
                // Write blob to Walrus storage
                return await this.walrusClient.writeBlob({ data: dataToStore });
            }, 3, 1000);
            return blobId;
        }
        catch (error) {
            console.error('Error storing todo:', error);
            throw error;
        }
    }
    /**
     * Retrieves a todo item from Walrus storage
     * @param blobId - ID of the blob to retrieve
     * @returns Promise<Todo | null>
     */
    async getTodo(blobId) {
        try {
            // Handle local todos (private ones)
            if (blobId.startsWith('local-')) {
                const todoId = blobId.replace('local-', '');
                return await config_service_1.configService.getLocalTodoById(todoId);
            }
            // Use retry with backoff for resilience to network issues
            const encryptedData = await (0, utils_1.retryWithBackoff)(async () => {
                // Read blob from Walrus storage using the official SDK
                return await this.walrusClient.readBlob({ blobId });
            }, 3, 1000);
            if (!encryptedData)
                return null;
            // Decrypt the data
            const todo = await this.decryptData(encryptedData);
            return todo;
        }
        catch (error) {
            console.error('Error retrieving todo:', error);
            throw error;
        }
    }
    /**
     * Retrieves a todo list from storage
     * @param listId - ID of the todo list to retrieve
     * @returns Promise<TodoList | null>
     */
    async getTodoList(listId) {
        try {
            // First, get list metadata (stored as a separate blob)
            const listMetadataBlobId = `${listId}_metadata`;
            let listMetadata = null;
            try {
                // Try to read the list metadata
                const metadataBlob = await this.walrusClient.readBlob({ blobId: listMetadataBlobId });
                if (metadataBlob) {
                    listMetadata = await this.decryptData(metadataBlob);
                }
            }
            catch (error) {
                console.warn(`No metadata found for list ${listId}, creating new list.`);
            }
            // Get local private todos
            const localList = await config_service_1.configService.getLocalTodos(listId);
            const localTodos = localList?.todos || [];
            // Initialize the list structure
            const todoList = {
                id: listId,
                name: listId, // We can update this if we find metadata
                owner: config_service_1.configService.getConfig().owner || 'current-user',
                todos: [...localTodos.filter(todo => todo.private)],
                version: 1
            };
            // If we have metadata, fetch all todos by their IDs
            if (listMetadata && listMetadata.todoIds && listMetadata.todoIds.length > 0) {
                const fetchPromises = listMetadata.todoIds.map(async (todoId) => {
                    try {
                        const todo = await this.getTodo(todoId);
                        return todo;
                    }
                    catch (error) {
                        console.warn(`Failed to retrieve todo with ID ${todoId}:`, error);
                        return null;
                    }
                });
                // Wait for all todos to be fetched
                const fetchedTodos = await Promise.all(fetchPromises);
                // Add all non-null, non-private todos to the list
                todoList.todos.push(...fetchedTodos
                    .filter((todo) => todo !== null && !todo.private));
            }
            return todoList;
        }
        catch (error) {
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
    async updateTodo(listId, todo) {
        try {
            // Handle private todos separately using local storage
            if (todo.private) {
                await config_service_1.configService.updateLocalTodo(listId, todo);
                return;
            }
            // For Walrus stored todos, we need to:
            // 1. Store the updated todo as a new blob
            // 2. Update the list metadata to point to the new blob
            // Encrypt the todo
            const dataToStore = await this.encryptData(todo);
            // Write the updated todo to Walrus
            const blobId = await (0, utils_1.retryWithBackoff)(async () => {
                return await this.walrusClient.writeBlob({ data: dataToStore });
            }, 3, 1000);
            // Now update the list metadata to reference this new blob
            // First retrieve existing metadata
            const listMetadataBlobId = `${listId}_metadata`;
            let listMetadata = { todoIds: [] };
            try {
                const metadataBlob = await this.walrusClient.readBlob({ blobId: listMetadataBlobId });
                if (metadataBlob) {
                    listMetadata = await this.decryptData(metadataBlob);
                }
            }
            catch (error) {
                console.warn(`Creating new metadata for list ${listId}`);
            }
            // Replace the old todo ID with the new one or add if not exists
            const todoIndex = listMetadata.todoIds.findIndex(id => {
                try {
                    // Try to extract the todo ID from the blob ID if needed
                    const fetchedTodo = this.getTodo(id);
                    return fetchedTodo && fetchedTodo.id === todo.id;
                }
                catch {
                    return false;
                }
            });
            if (todoIndex >= 0) {
                listMetadata.todoIds[todoIndex] = blobId;
            }
            else {
                listMetadata.todoIds.push(blobId);
            }
            // Save the updated metadata
            const metadataToStore = await this.encryptData(listMetadata);
            await this.walrusClient.writeBlob({
                data: metadataToStore,
                blobId: listMetadataBlobId
            });
        }
        catch (error) {
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
    async deleteTodo(listId, todoId) {
        try {
            // Try to delete from local storage first (for private todos)
            await config_service_1.configService.deleteLocalTodo(listId, todoId);
            // For Walrus stored todos, we need to update the list metadata
            // to remove reference to the todo blob
            const listMetadataBlobId = `${listId}_metadata`;
            try {
                // Get the current metadata
                const metadataBlob = await this.walrusClient.readBlob({ blobId: listMetadataBlobId });
                if (metadataBlob) {
                    const listMetadata = await this.decryptData(metadataBlob);
                    // Filter out the blob ID for the todo we want to delete
                    listMetadata.todoIds = listMetadata.todoIds.filter(async (blobId) => {
                        try {
                            const todo = await this.getTodo(blobId);
                            return todo && todo.id !== todoId;
                        }
                        catch {
                            // If we can't retrieve the todo, keep it in the list
                            return true;
                        }
                    });
                    // Save the updated metadata
                    const metadataToStore = await this.encryptData(listMetadata);
                    await this.walrusClient.writeBlob({
                        data: metadataToStore,
                        blobId: listMetadataBlobId
                    });
                }
            }
            catch (error) {
                console.warn(`Could not update metadata for list ${listId}:`, error);
            }
        }
        catch (error) {
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
    async syncWithBlockchain(listId, onChainList) {
        try {
            const localList = await this.getTodoList(listId);
            if (!localList) {
                // If local list doesn't exist, create it from blockchain state
                // Initialize metadata
                const metadataBlobId = `${listId}_metadata`;
                // Create storage for blob IDs of todos
                const todoIdPromises = [];
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
                await this.walrusClient.writeBlob({
                    data: metadataToStore,
                    blobId: metadataBlobId
                });
                return;
            }
            // Sync versions if blockchain version is newer
            if (onChainList.version > localList.version) {
                const metadataBlobId = `${listId}_metadata`;
                try {
                    // Try to read the list metadata
                    const metadataBlob = await this.walrusClient.readBlob({ blobId: metadataBlobId });
                    let listMetadata = { todoIds: [] };
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
                        }
                        catch {
                            // Skip errors when retrieving todos
                        }
                    }
                    // Store all new public todos from blockchain
                    const todoIdPromises = [];
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
                    await this.walrusClient.writeBlob({
                        data: metadataToStore,
                        blobId: metadataBlobId
                    });
                }
                catch (error) {
                    console.error(`Error updating metadata for list ${listId}:`, error);
                    throw error;
                }
            }
        }
        catch (error) {
            console.error('Error syncing with blockchain:', error);
            throw error;
        }
    }
}
exports.walrusService = new WalrusService();
