import { Config, Todo, TodoList } from '../types';
export declare class ConfigService {
    private configPath;
    private todosPath;
    private config;
    constructor();
    private ensureTodosDirectory;
    private getListPath;
    private loadConfig;
    getConfig(): Config;
    saveConfig(config: Partial<Config>): Promise<void>;
    private loadListData;
    saveListData(listName: string, list: TodoList): Promise<TodoList>;
    getLocalTodos(listName: string): Promise<TodoList | null>;
    getAllLists(): Promise<string[]>;
    saveLocalTodo(listName: string, todo: Todo): Promise<void>;
    updateLocalTodo(listName: string, todo: Todo): Promise<void>;
    deleteLocalTodo(listName: string, todoId: string): Promise<void>;
    deleteList(listName: string): Promise<void>;
    getLocalTodoById(todoId: string): Promise<Todo | null>;
}
export declare const configService: ConfigService;
