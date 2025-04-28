/**
 * Configuration Service
 * Handles local configuration and private todo storage
 * Manages user preferences and local-only todo items
 */

import fs from 'fs';
import path from 'path';
import { Config, Todo, TodoList } from '../types';
import { CLI_CONFIG, CURRENT_NETWORK } from '../constants';

/**
 * Manages application configuration and local storage
 * Provides methods for handling private todos and user settings
 */
export class ConfigService {
  private configPath: string;
  private todosPath: string;
  private config: Config;

  constructor() {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    this.configPath = path.join(homeDir, CLI_CONFIG.CONFIG_FILE);
    
    // Always use absolute path from current directory for Todos folder
    this.todosPath = path.resolve(process.cwd(), 'Todos');
    
    this.config = this.loadConfig();
    this.ensureTodosDirectory();
  }

  /**
   * Ensures the todos directory exists
   */
  private ensureTodosDirectory(): void {
    try {
      if (!fs.existsSync(this.todosPath)) {
        fs.mkdirSync(this.todosPath, { recursive: true });
        console.log(`Created Todos directory at: ${this.todosPath}`);
      }
    } catch (error) {
      console.error('Error creating Todos directory:', error);
      throw error;
    }
  }

  /**
   * Gets the path for a specific todo list file
   */
  private getListPath(listName: string): string {
    return path.join(this.todosPath, `${listName}.json`);
  }

  /**
   * Loads configuration from disk
   * Creates default configuration if none exists
   * @returns Config object with application settings
   */
  private loadConfig(): Config {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }

    return {
      network: 'testnet',
      walletAddress: '',
      encryptedStorage: false
    };
  }

  public getConfig(): Config {
    return this.config;
  }

  public async saveConfig(config: Partial<Config>): Promise<void> {
    this.config = { ...this.config, ...config };
    try {
      await fs.promises.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Error saving config:', error);
      throw error;
    }
  }

  // Handle local todos in todos directory
  private async loadListData(listName: string): Promise<TodoList | null> {
    const listPath = this.getListPath(listName);
    try {
      if (fs.existsSync(listPath)) {
        const data = await fs.promises.readFile(listPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error(`Error loading todo list ${listName}:`, error);
    }
    return null;
  }

  public async saveListData(listName: string, list: TodoList): Promise<void> {
    const listPath = this.getListPath(listName);
    try {
      await fs.promises.writeFile(listPath, JSON.stringify(list, null, 2));
    } catch (error) {
      console.error(`Error saving todo list ${listName}:`, error);
      throw error;
    }
  }

  public async getLocalTodos(listName: string): Promise<TodoList | null> {
    return this.loadListData(listName);
  }

  public async getAllLists(): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(this.todosPath);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
    } catch (error) {
      console.error('Error reading todo lists:', error);
      return [];
    }
  }

  public async saveLocalTodo(listName: string, todo: Todo): Promise<void> {
    let list = await this.loadListData(listName);
    if (!list) {
      list = {
        id: listName,
        name: listName,
        owner: this.config.walletAddress || 'local',
        todos: [],
        version: 1
      };
    }
    list.todos.push(todo);
    await this.saveListData(listName, list);
  }

  public async updateLocalTodo(listName: string, todo: Todo): Promise<void> {
    const list = await this.loadListData(listName);
    if (!list) return;
    
    const index = list.todos.findIndex(t => t.id === todo.id);
    if (index !== -1) {
      list.todos[index] = todo;
      await this.saveListData(listName, list);
    }
  }

  public async deleteLocalTodo(listName: string, todoId: string): Promise<void> {
    const list = await this.loadListData(listName);
    if (!list) return;
    
    list.todos = list.todos.filter(t => t.id !== todoId);
    await this.saveListData(listName, list);
  }

  public async deleteList(listName: string): Promise<void> {
    const listPath = this.getListPath(listName);
    try {
      if (fs.existsSync(listPath)) {
        await fs.promises.unlink(listPath);
      }
    } catch (error) {
      console.error(`Error deleting list ${listName}:`, error);
      throw error;
    }
  }

  public async getLocalTodoById(todoId: string): Promise<Todo | null> {
    const lists = await this.getAllLists();
    for (const listName of lists) {
      const list = await this.loadListData(listName);
      if (list) {
        const todo = list.todos.find(t => t.id === todoId);
        if (todo) return todo;
      }
    }
    return null;
  }
}

// Singleton instance
export const configService = new ConfigService();