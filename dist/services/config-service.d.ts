/**
 * Configuration Service
 * Handles local configuration and private todo storage
 * Manages user preferences and local-only todo items
 */
import { Config, Todo, TodoList } from '../types';
/**
 * Manages application configuration and local storage
 * Provides methods for handling private todos and user settings
 */
export declare class ConfigService {
    private configPath;
    private todosPath;
    private config;
    constructor();
    /**
     * Ensures the todos directory exists
     */
    private ensureTodosDirectory;
    /**
     * Gets the path for a specific todo list file
     */
    private getListPath;
    /**
     * Loads configuration from disk
     * Creates default configuration if none exists
     * @returns Config object with application settings
     */
    private loadConfig;
    getConfig(): Config;
    saveConfig(config: Partial<Config>): Promise<void>;
    private loadListData;
    saveListData(listName: string, list: TodoList): Promise<void>;
    getLocalTodos(listName: string): Promise<TodoList | null>;
    getAllLists(): Promise<string[]>;
    saveLocalTodo(listName: string, todo: Todo): Promise<void>;
    updateLocalTodo(listName: string, todo: Todo): Promise<void>;
    deleteLocalTodo(listName: string, todoId: string): Promise<void>;
    deleteList(listName: string): Promise<void>;
    getLocalTodoById(todoId: string): Promise<Todo | null>;
}
export declare const configService: ConfigService;
