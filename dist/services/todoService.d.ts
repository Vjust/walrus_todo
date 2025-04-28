import { TodoList } from '../types/todo';
/**
 * Simple local‑file Todo service.
 *  - Each list is stored as ./Todos/<list>.json
 *  - No blockchain / Walrus logic here (keeps TypeScript happy)
 */
export declare class TodoService {
    private readonly todosDir;
    constructor();
    getAllLists(): Promise<string[]>;
    getList(listName: string): Promise<TodoList | null>;
    toggleItemStatus(listName: string, itemId: string, checked: boolean): Promise<void>;
    saveList(listName: string, list: TodoList): Promise<void>;
    deleteList(listName: string): Promise<void>;
}
