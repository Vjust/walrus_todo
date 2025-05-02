import { Todo, TodoList } from '../types/todo';
export declare class TodoService {
    private readonly todosDir;
    constructor();
    getAllLists(): Promise<string[]>;
    createList(name: string, owner: string): Promise<TodoList>;
    getList(listName: string): Promise<TodoList | null>;
    getTodo(todoId: string, listName?: string): Promise<Todo | null>;
    addTodo(listName: string, todo: Partial<Todo>): Promise<Todo>;
    updateTodo(listName: string, todoId: string, updates: Partial<Todo>): Promise<Todo>;
    toggleItemStatus(listName: string, itemId: string, checked: boolean): Promise<void>;
    deleteTodo(listName: string, todoId: string): Promise<void>;
    saveList(listName: string, list: TodoList): Promise<void>;
    deleteList(listName: string): Promise<void>;
}
