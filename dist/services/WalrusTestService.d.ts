import { Todo, TodoList } from '../types';
/**
 * In-memory implementation of Walrus storage service for testing
 * Does NOT make network requests or use the actual Walrus SDK
 */
export declare class WalrusTestService {
    private storage;
    private metadata;
    private todos;
    private lists;
    constructor();
    /**
     * Simulates storing a todo item
     * @param listId Name of the todo list
     * @param todo Todo item to store
     * @param skipMetadata Optional flag to skip metadata updates
     * @returns Promise<string> Blob ID of stored todo
     */
    storeTodo(listId: string, todo: Todo, skipMetadata?: boolean): Promise<string>;
    /**
     * Simulates retrieving a todo item
     * @param blobId ID of the blob to retrieve
     * @returns Promise<Todo | null>
     */
    getTodo(blobId: string): Promise<Todo | null>;
    /**
     * Simulates retrieving a todo list
     * @param listId ID of the todo list to retrieve
     * @returns Promise<TodoList | null>
     */
    getTodoList(listId: string): Promise<TodoList | null>;
    /**
     * Simulates updating a todo item
     * @param listId ID of the todo list
     * @param todo Updated todo item
     * @returns Promise<void>
     */
    updateTodo(listId: string, todo: Todo): Promise<void>;
    /**
     * Simulates deleting a todo item
     * @param listId ID of the todo list
     * @param todoId ID of the todo to delete
     * @returns Promise<void>
     */
    deleteTodo(listId: string, todoId: string): Promise<void>;
    /**
     * Simulates syncing with blockchain
     * @param listId ID of the todo list to sync
     * @param onChainList Todo list data from the blockchain
     * @returns Promise<void>
     */
    syncWithBlockchain(listId: string, onChainList: TodoList): Promise<void>;
    /**
     * Reset all storage (for test cleanup)
     */
    reset(): void;
}
