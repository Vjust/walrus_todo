"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalrusTestService = void 0;
/**
 * In-memory implementation of Walrus storage service for testing
 * Does NOT make network requests or use the actual Walrus SDK
 */
class WalrusTestService {
    constructor() {
        // In-memory storage structure
        this.storage = new Map();
        this.metadata = new Map();
        this.todos = new Map();
        this.lists = new Map();
        // No real initialization needed - everything stays in memory
    }
    /**
     * Simulates storing a todo item
     * @param listId Name of the todo list
     * @param todo Todo item to store
     * @param skipMetadata Optional flag to skip metadata updates
     * @returns Promise<string> Blob ID of stored todo
     */
    async storeTodo(listId, todo, skipMetadata // new optional flag
    ) {
        var _a;
        // Generate a deterministic but unique blob ID
        const blobId = `blob-${todo.id}-${Date.now()}`;
        // Store the todo in our in-memory map
        this.todos.set(todo.id, { ...todo });
        // Simulate encryption and storage
        const jsonString = JSON.stringify(todo);
        const encryptedData = new TextEncoder().encode(jsonString);
        this.storage.set(blobId, encryptedData);
        // Update metadata for the list if not skipped
        if (!skipMetadata) {
            if (!this.metadata.has(listId)) {
                this.metadata.set(listId, { todoIds: [] });
            }
            (_a = this.metadata.get(listId)) === null || _a === void 0 ? void 0 : _a.todoIds.push(blobId);
        }
        return blobId;
    }
    /**
     * Simulates retrieving a todo item
     * @param blobId ID of the blob to retrieve
     * @returns Promise<Todo | null>
     */
    async getTodo(blobId) {
        // Handle test for local todos
        if (blobId.startsWith('local-')) {
            const todoId = blobId.replace('local-', '');
            const todo = this.todos.get(todoId);
            return todo || null;
        }
        // Get encrypted data from storage
        const encryptedData = this.storage.get(blobId);
        if (!encryptedData)
            return null;
        // Simulate decryption
        const jsonString = new TextDecoder().decode(encryptedData);
        const todo = JSON.parse(jsonString);
        return todo;
    }
    /**
     * Simulates retrieving a todo list
     * @param listId ID of the todo list to retrieve
     * @returns Promise<TodoList | null>
     */
    async getTodoList(listId) {
        // Check if we have this list in our memory
        if (this.lists.has(listId)) {
            return this.lists.get(listId) || null;
        }
        // Try to build the list from metadata and todos
        const listMetadata = this.metadata.get(listId);
        if (!listMetadata)
            return null;
        const todos = [];
        // Collect all todos from the blob IDs in metadata
        for (const blobId of listMetadata.todoIds) {
            const todo = await this.getTodo(blobId);
            if (todo)
                todos.push(todo);
        }
        // Create a new TodoList
        const todoList = {
            id: listId,
            name: listMetadata.name || `List ${listId}`,
            owner: "testOwner", // added owner to satisfy the required property
            todos,
            version: listMetadata.version || 1
        };
        // Cache for future use
        this.lists.set(listId, todoList);
        return todoList;
    }
    /**
     * Simulates updating a todo item
     * @param listId ID of the todo list
     * @param todo Updated todo item
     * @returns Promise<void>
     */
    async updateTodo(listId, todo) {
        // Remove old references to this todo first
        const listMetadata = this.metadata.get(listId);
        if (listMetadata) {
            const newBlobIds = [];
            for (const id of listMetadata.todoIds) {
                const existingTodo = await this.getTodo(id);
                if (!existingTodo || existingTodo.id !== todo.id) {
                    newBlobIds.push(id);
                }
            }
            listMetadata.todoIds = newBlobIds;
        }
        // Store updated todo, skipping metadata insertion here
        const blobId = await this.storeTodo(listId, todo, true);
        // Append the new blob reference once
        if (listMetadata) {
            listMetadata.todoIds.push(blobId);
        }
        // Update cache
        if (this.lists.has(listId)) {
            const list = this.lists.get(listId);
            const index = list.todos.findIndex(t => t.id === todo.id);
            if (index >= 0) {
                list.todos[index] = { ...todo };
            }
            else {
                list.todos.push({ ...todo });
            }
            // remove or comment out list.updatedAt if it exists
        }
    }
    /**
     * Simulates deleting a todo item
     * @param listId ID of the todo list
     * @param todoId ID of the todo to delete
     * @returns Promise<void>
     */
    async deleteTodo(listId, todoId) {
        // Remove todo from in-memory store
        this.todos.delete(todoId);
        // Update metadata to remove references to this todo
        const listMetadata = this.metadata.get(listId);
        if (listMetadata) {
            // Filter out blob IDs for this todo
            listMetadata.todoIds = listMetadata.todoIds.filter(async (blobId) => {
                const todo = await this.getTodo(blobId);
                return todo && todo.id !== todoId;
            });
        }
        // Update cache
        if (this.lists.has(listId)) {
            const list = this.lists.get(listId);
            list.todos = list.todos.filter(t => t.id !== todoId);
        }
    }
    /**
     * Simulates syncing with blockchain
     * @param listId ID of the todo list to sync
     * @param onChainList Todo list data from the blockchain
     * @returns Promise<void>
     */
    async syncWithBlockchain(listId, onChainList) {
        // Store the full list
        this.lists.set(listId, { ...onChainList });
        // Update metadata
        if (!this.metadata.has(listId)) {
            this.metadata.set(listId, {
                todoIds: [],
                name: onChainList.name,
                version: onChainList.version
            });
        }
        else {
            const metadata = this.metadata.get(listId);
            metadata.name = onChainList.name;
            metadata.version = onChainList.version;
        }
        // Store all todos individually
        for (const todo of onChainList.todos) {
            if (!todo.private) {
                await this.storeTodo(listId, todo);
            }
        }
    }
    /**
     * Reset all storage (for test cleanup)
     */
    reset() {
        this.storage.clear();
        this.metadata.clear();
        this.todos.clear();
        this.lists.clear();
    }
}
exports.WalrusTestService = WalrusTestService;
