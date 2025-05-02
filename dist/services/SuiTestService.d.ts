import { Config } from '../types';
type TodoItem = {
    id: string;
    text: string;
    completed: boolean;
    updatedAt: number;
};
export interface ISuiService {
    getWalletAddress(): Promise<string>;
    createTodoList(): Promise<string>;
    addTodo(listId: string, text: string): Promise<string>;
    getTodos(listId: string): Promise<TodoItem[]>;
    updateTodo(listId: string, itemId: string, changes: Partial<Omit<TodoItem, "id">>): Promise<void>;
    deleteTodoList(listId: string): Promise<void>;
}
/**
 * Interface for account information returned by the service
 */
export interface AccountInfo {
    address: string;
    balance: string;
    objects?: Array<{
        objectId: string;
        type: string;
    }>;
}
/**
 * A deterministic, in‑memory implementation of the Sui service
 * for unit / integration tests.  Does *not* touch the network.
 */
export declare class SuiTestService implements ISuiService {
    private walletAddress;
    private lists;
    private client;
    private config;
    /**
     * Create a new SuiTestService instance.
     *  • `config`  – full Config object
     *  • `string`  – wallet address, defaults network to 'testnet'
     *  • omitted   – uses default dummy config (network 'testnet')
     */
    constructor(config?: Config | string);
    getWalletAddress(): Promise<string>;
    createTodoList(): Promise<string>;
    addTodo(listId: string, text: string): Promise<string>;
    getTodos(listId: string): Promise<TodoItem[]>;
    updateTodo(listId: string, itemId: string, changes: Partial<Omit<TodoItem, "id">>): Promise<void>;
    deleteTodoList(listId: string): Promise<void>;
    /**
     * Gets account information including balance and owned objects
     * @returns Promise<AccountInfo> Account information object
     */
    getAccountInfo(): Promise<AccountInfo>;
    private assertList;
    private generateId;
}
export {};
