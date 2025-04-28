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
 * A deterministic, in‑memory implementation of the Sui service
 * for unit / integration tests.  Does *not* touch the network.
 */
export declare class SuiTestService implements ISuiService {
    private walletAddress;
    private lists;
    constructor(walletAddress?: string);
    getWalletAddress(): Promise<string>;
    createTodoList(): Promise<string>;
    addTodo(listId: string, text: string): Promise<string>;
    getTodos(listId: string): Promise<TodoItem[]>;
    updateTodo(listId: string, itemId: string, changes: Partial<Omit<TodoItem, "id">>): Promise<void>;
    deleteTodoList(listId: string): Promise<void>;
    private assertList;
    private generateId;
}
export {};
