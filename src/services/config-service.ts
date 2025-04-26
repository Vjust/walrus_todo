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
  private localDataPath: string;
  private config: Config;

  constructor() {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    this.configPath = path.join(homeDir, CLI_CONFIG.CONFIG_FILE);
    this.localDataPath = path.join(homeDir, '.waltodo-data.json');
    this.config = this.loadConfig();
  }

  /**
   * Loads configuration from disk
   * Creates default configuration if none exists
   * @returns Config object with application settings
   */
  private loadConfig(): Config {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf-8');
        const savedConfig = JSON.parse(configData);
        
        // Always use the environment variable network if it exists
        if (process.env.NETWORK) {
          savedConfig.network = CURRENT_NETWORK;
        }
        
        return savedConfig;
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }

    // Return default config with network from environment variable
    return {
      network: CURRENT_NETWORK
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

  // Handle local-only private todos
  private async loadLocalData(): Promise<Record<string, TodoList>> {
    try {
      if (fs.existsSync(this.localDataPath)) {
        const data = await fs.promises.readFile(this.localDataPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading local data:', error);
    }
    return {};
  }

  private async saveLocalData(data: Record<string, TodoList>): Promise<void> {
    try {
      await fs.promises.writeFile(this.localDataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving local data:', error);
      throw error;
    }
  }

  public async getLocalTodos(listName: string): Promise<TodoList | null> {
    const data = await this.loadLocalData();
    return data[listName] || null;
  }

  public async saveLocalTodo(listName: string, todo: Todo): Promise<void> {
    const data = await this.loadLocalData();
    if (!data[listName]) {
      data[listName] = {
        id: listName,
        name: listName,
        owner: this.config.walletAddress || 'local',
        todos: [],
        version: 1
      };
    }
    data[listName].todos.push(todo);
    await this.saveLocalData(data);
  }

  public async updateLocalTodo(listName: string, todo: Todo): Promise<void> {
    const data = await this.loadLocalData();
    if (!data[listName]) return;
    
    const index = data[listName].todos.findIndex(t => t.id === todo.id);
    if (index !== -1) {
      data[listName].todos[index] = todo;
      await this.saveLocalData(data);
    }
  }

  public async deleteLocalTodo(listName: string, todoId: string): Promise<void> {
    const data = await this.loadLocalData();
    if (!data[listName]) return;
    
    data[listName].todos = data[listName].todos.filter(t => t.id !== todoId);
    await this.saveLocalData(data);
  }

  /**
   * Get a specific todo item by ID from local storage
   * @param todoId - ID of the todo to retrieve
   * @returns Promise<Todo | null> - The retrieved todo or null if not found
   */
  public async getLocalTodoById(todoId: string): Promise<Todo | null> {
    const data = await this.loadLocalData();
    
    // Search through all lists for the todo with matching ID
    for (const listName in data) {
      const todo = data[listName].todos.find(t => t.id === todoId);
      if (todo) return todo;
    }
    
    return null;
  }
}

// Singleton instance
export const configService = new ConfigService();