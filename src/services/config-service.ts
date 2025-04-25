import fs from 'fs';
import path from 'path';
import { Config, Todo, TodoList } from '../types';

export class ConfigService {
  private configPath: string;
  private localDataPath: string;
  private config: Config;

  constructor() {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    this.configPath = path.join(homeDir, '.waltodo.json');
    this.localDataPath = path.join(homeDir, '.waltodo-data.json');
    this.config = this.loadConfig();
  }

  private loadConfig(): Config {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf-8');
        return JSON.parse(configData);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }

    return {
      network: 'devnet'
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
}

export const configService = new ConfigService();