import fs from 'fs';
import path from 'path';
import { Config, Todo, TodoList } from '../types';
import { CLI_CONFIG } from '../constants';
import { CLIError } from '../types/error';

export class ConfigService {
  private configPath: string;
  private todosPath: string;
  private config: Config;

  constructor() {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    this.configPath = path.join(homeDir, CLI_CONFIG.CONFIG_FILE);
    this.todosPath = path.resolve(process.cwd(), 'Todos');
    this.config = this.loadConfig();
    this.ensureTodosDirectory();
  }

  private ensureTodosDirectory(): void {
    try {
      if (!fs.existsSync(this.todosPath)) {
        fs.mkdirSync(this.todosPath, { recursive: true });
      }
    } catch (error) {
      throw new CLIError(
        `Failed to create Todos directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DIRECTORY_CREATE_FAILED'
      );
    }
  }

  private getListPath(listName: string): string {
    return path.join(this.todosPath, `${listName}.json`);
  }

  private loadConfig(): Config {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      throw new CLIError(
        `Failed to load config: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CONFIG_LOAD_FAILED'
      );
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
      throw new CLIError(
        `Failed to save config: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CONFIG_SAVE_FAILED'
      );
    }
  }

  private async loadListData(listName: string): Promise<TodoList | null> {
    const listPath = this.getListPath(listName);
    try {
      if (fs.existsSync(listPath)) {
        const data = await fs.promises.readFile(listPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      throw new CLIError(
        `Failed to load list "${listName}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LIST_LOAD_FAILED'
      );
    }
    return null;
  }

  public async saveListData(listName: string, list: TodoList): Promise<TodoList> {
    const listPath = this.getListPath(listName);
    try {
      await fs.promises.writeFile(listPath, JSON.stringify(list, null, 2));
      return list;
    } catch (error) {
      throw new CLIError(
        `Failed to save list "${listName}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LIST_SAVE_FAILED'
      );
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
      throw new CLIError(
        `Failed to read todo lists: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LIST_READ_FAILED'
      );
    }
  }

  public async saveLocalTodo(listName: string, todo: Todo): Promise<void> {
    let list = await this.loadListData(listName);
    if (!list) {
      list = {
        id: listName,
        name: listName,
        owner: 'local',
        todos: [],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    list.todos.push(todo);
    await this.saveListData(listName, list);
  }

  public async updateLocalTodo(listName: string, todo: Todo): Promise<void> {
    const list = await this.loadListData(listName);
    if (!list) {
      throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
    }
    
    const index = list.todos.findIndex(t => t.id === todo.id);
    if (index === -1) {
      throw new CLIError(`Todo "${todo.id}" not found in list "${listName}"`, 'TODO_NOT_FOUND');
    }

    list.todos[index] = todo;
    list.updatedAt = new Date().toISOString();
    await this.saveListData(listName, list);
  }

  public async deleteLocalTodo(listName: string, todoId: string): Promise<void> {
    const list = await this.loadListData(listName);
    if (!list) {
      throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
    }

    const todoIndex = list.todos.findIndex(t => t.id === todoId);
    if (todoIndex === -1) {
      throw new CLIError(`Todo "${todoId}" not found in list "${listName}"`, 'TODO_NOT_FOUND');
    }
    
    list.todos = list.todos.filter(t => t.id !== todoId);
    list.updatedAt = new Date().toISOString();
    await this.saveListData(listName, list);
  }

  public async deleteList(listName: string): Promise<void> {
    const listPath = this.getListPath(listName);
    try {
      if (fs.existsSync(listPath)) {
        await fs.promises.unlink(listPath);
      }
    } catch (error) {
      throw new CLIError(
        `Failed to delete list "${listName}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LIST_DELETE_FAILED'
      );
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

export const configService = new ConfigService();
