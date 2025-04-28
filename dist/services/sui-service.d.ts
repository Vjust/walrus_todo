/**
 * Sui Blockchain Service
 * Handles interaction with Sui blockchain
 * Manages smart contract calls and transaction submission
 */
import { TodoList } from '../types';
/**
 * Manages blockchain operations for todo lists
 * Handles transaction submission and state synchronization
 */
declare class SuiService {
    private client;
    constructor();
    private getKeypair;
    /**
     * Publishes a todo list to the blockchain
     * @param listName - Name of the todo list
     * @param todoList - Todo list data to publish
     * @returns Promise<void>
     */
    publishList(listName: string, todoList: TodoList): Promise<{
        digest: string;
        effects: {
            gasUsed: {
                computationCost: string;
            };
        };
    }>;
    /**
     * Retrieves todo list state from blockchain
     * @param listName - Name of the todo list
     * @returns Promise<TodoList | null>
     */
    getListState(listName: string): Promise<TodoList | null>;
    updateListVersion(listId: string, newVersion: number): Promise<void>;
}
export declare const suiService: SuiService;
export {};
