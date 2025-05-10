import fs from 'fs';
import path from 'path';
import { Config, Todo, TodoList } from '../types';
import { CLI_CONFIG, STORAGE_CONFIG } from '../constants';
import { CLIError } from '../types/error';
import { envConfig, getEnv } from '../utils/environment-config';
import { loadConfigFile, saveConfigToFile } from '../utils/config-loader';

/**
 * ConfigService - A service class for managing application configuration and local Todo data storage.
 *
 * This class handles the loading and saving of configuration settings for the Todo application,
 * such as network preferences and wallet information. Additionally, it manages the local storage
 * of Todo lists and items in the file system, providing methods to create, retrieve, update, and
 * delete Todo data. It ensures that the necessary directories are created and handles errors
 * gracefully, making it a central component for configuration and data persistence in the CLI tool.
 *
 * @class ConfigService
 */
export class ConfigService {
  private configPath: string;
  private todosPath: string;
  private config: Config;

  constructor() {
    // Look for config file in current directory first, then in home directory
    const currentDirConfig = path.join(process.cwd(), CLI_CONFIG.CONFIG_FILE);
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const homeDirConfig = path.join(homeDir, CLI_CONFIG.CONFIG_FILE);

    // Use current directory config if it exists, otherwise use home directory
    this.configPath = fs.existsSync(currentDirConfig) ? currentDirConfig : homeDirConfig;

    // Get storage path from environment configuration or use default
    this.todosPath = path.resolve(process.cwd(), getEnv('STORAGE_PATH') || 'Todos');

    // Load initial configuration
    this.config = this.loadConfig();

    // Update environment configuration with loaded values
    this.updateEnvironmentConfig();

    // Ensure the todos directory exists
    this.ensureTodosDirectory();
  }

  private updateEnvironmentConfig(): void {
    // Update environment configuration with values from config file
    envConfig.updateConfig('NETWORK', this.config.network, 'config');
    envConfig.updateConfig('WALLET_ADDRESS', this.config.walletAddress, 'config');
    envConfig.updateConfig('ENCRYPTED_STORAGE', this.config.encryptedStorage, 'config');

    // If we have custom package ID from deployment or directly in config, use it
    if (this.config.packageId) {
      envConfig.updateConfig('TODO_PACKAGE_ID', this.config.packageId, 'config');
    } else if (this.config.lastDeployment?.packageId) {
      envConfig.updateConfig('TODO_PACKAGE_ID', this.config.lastDeployment.packageId, 'config');
    }

    // If we have registry ID, use it
    if (this.config.registryId) {
      envConfig.updateConfig('REGISTRY_ID', this.config.registryId, 'config');
    }
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
    return path.join(this.todosPath, `${listName}${STORAGE_CONFIG.FILE_EXT}`);
  }

  private loadConfig(): Config {
    try {
      if (fs.existsSync(this.configPath)) {
        // Use our config loader utility
        const loadedConfig = loadConfigFile(this.configPath);

        return {
          network: loadedConfig.network || getEnv('NETWORK') || 'testnet',
          walletAddress: loadedConfig.walletAddress || getEnv('WALLET_ADDRESS') || '',
          encryptedStorage: loadedConfig.encryptedStorage || getEnv('ENCRYPTED_STORAGE') || false,
          lastDeployment: loadedConfig.lastDeployment || undefined,
          packageId: loadedConfig.packageId || getEnv('TODO_PACKAGE_ID') || undefined,
          registryId: loadedConfig.registryId || getEnv('REGISTRY_ID') || undefined
        };
      }
    } catch (error) {
      throw new CLIError(
        `Failed to load config: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CONFIG_LOAD_FAILED'
      );
    }

    // Default configuration from environment or hardcoded values
    return {
      network: getEnv('NETWORK') || 'testnet',
      walletAddress: getEnv('WALLET_ADDRESS') || '',
      encryptedStorage: getEnv('ENCRYPTED_STORAGE') || false,
      packageId: getEnv('TODO_PACKAGE_ID') || undefined,
      registryId: getEnv('REGISTRY_ID') || undefined
    };
  }

  public getConfig(): Config {
    return this.config;
  }

  public async saveConfig(config: Partial<Config>): Promise<void> {
    this.config = { ...this.config, ...config };

    try {
      // Use our config saver utility
      saveConfigToFile(this.config, this.configPath);

      // Update environment configuration with new values
      this.updateEnvironmentConfig();
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
        .filter(file => file.endsWith(STORAGE_CONFIG.FILE_EXT))
        .map(file => file.replace(STORAGE_CONFIG.FILE_EXT, ''));
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

  /**
   * Updates environment configuration from CLI configuration
   */
  public updateFromEnvironment(): void {
    // Load environment configuration
    const envNetwork = getEnv('NETWORK');
    const envWalletAddress = getEnv('WALLET_ADDRESS');
    const envEncryptedStorage = getEnv('ENCRYPTED_STORAGE');
    const envPackageId = getEnv('TODO_PACKAGE_ID');
    const envRegistryId = getEnv('REGISTRY_ID');

    // Update local config if environment values are set
    let configChanged = false;

    if (envNetwork && this.config.network !== envNetwork) {
      this.config.network = envNetwork;
      configChanged = true;
    }

    if (envWalletAddress && this.config.walletAddress !== envWalletAddress) {
      this.config.walletAddress = envWalletAddress;
      configChanged = true;
    }

    if (envEncryptedStorage !== undefined && this.config.encryptedStorage !== envEncryptedStorage) {
      this.config.encryptedStorage = envEncryptedStorage;
      configChanged = true;
    }

    if (envPackageId && this.config.packageId !== envPackageId) {
      this.config.packageId = envPackageId;
      configChanged = true;
    }

    if (envRegistryId && this.config.registryId !== envRegistryId) {
      this.config.registryId = envRegistryId;
      configChanged = true;
    }

    // Save changes if needed
    if (configChanged) {
      saveConfigToFile(this.config, this.configPath);
    }
  }
}

export const configService = new ConfigService();
