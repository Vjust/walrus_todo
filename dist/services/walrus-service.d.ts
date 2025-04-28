/**
 * Walrus Storage Service
 * Handles interaction with Walrus decentralized storage
 * Manages todo data persistence and retrieval
 */
import { Todo, TodoList } from '../types';
/**
 * Manages todo storage operations using Walrus
 * Handles encryption, blob storage, and data retrieval
 */
declare class WalrusService {
    private walrusClient;
    private suiClient;
    private initialized;
    constructor();
    private encryptData;
    private decryptData;
    /**
     * Stores a todo item in Walrus storage
     * @param listId - Name of the todo list
     * @param todo - Todo item to store
     * @returns Promise<string> - Blob ID of stored todo
     */
    storeTodo(listId: string, todo: Todo): Promise<string>;
    /**
     * Retrieves a todo item from Walrus storage
     * @param blobId - ID of the blob to retrieve
     * @returns Promise<Todo | null>
     */
    getTodo(blobId: string): Promise<Todo | null>;
    /**
     * Retrieves a todo list from storage
     * @param listId - ID of the todo list to retrieve
     * @returns Promise<TodoList | null>
     */
    getTodoList(listId: string): Promise<TodoList | null>;
    /**
     * Updates a todo item in Walrus storage
     * @param listId - ID of the todo list
     * @param todo - Updated todo item
     * @returns Promise<void>
     */
    updateTodo(listId: string, todo: Todo): Promise<void>;
    /**
     * Deletes a todo item from storage
     * @param listId - ID of the todo list
     * @param todoId - ID of the todo to delete
     * @returns Promise<void>
     */
    deleteTodo(listId: string, todoId: string): Promise<void>;
    /**
     * Synchronizes todo list between Walrus storage and on-chain data
     * @param listId - ID of the todo list to sync
     * @param onChainList - Todo list data from the blockchain
     * @returns Promise<void>
     */
    syncWithBlockchain(listId: string, onChainList: TodoList): Promise<void>;
}
export declare const walrusService: WalrusService;
export {};
