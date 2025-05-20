import fs from 'fs';
import { promises as fsPromises } from 'fs';
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
  /** Path to the configuration file */
  private configPath: string;
  
  /** Path to the directory where Todo lists are stored */
  private todosPath: string;
  
  /** The loaded configuration object */
  private config: Config;

  /**
   * Creates a new ConfigService instance.
   * Initializes the configuration paths, loads the configuration,
   * updates environment settings, and ensures the todos directory exists.
   */
  constructor() {
    // Check for config directory from environment variable
    const configDir = getEnv('WALRUS_TODO_CONFIG_DIR');
    
    if (configDir) {
      // If environment variable is set, use it directly
      this.configPath = path.join(configDir, CLI_CONFIG.CONFIG_FILE);
    } else {
      // Otherwise look for config file in current directory first, then in home directory
      const currentDirConfig = path.join(process.cwd(), CLI_CONFIG.CONFIG_FILE);
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      const homeDirConfig = path.join(homeDir, CLI_CONFIG.CONFIG_FILE);

      // Use current directory config if it exists, otherwise use home directory
      this.configPath = fs.existsSync(currentDirConfig) ? currentDirConfig : homeDirConfig;
    }

    // Get storage path from environment configuration or use default
    this.todosPath = path.resolve(process.cwd(), getEnv('STORAGE_PATH') || 'Todos');

    // Load initial configuration
    this.config = this.loadConfig();

    // Update environment configuration with loaded values
    this.updateEnvironmentConfig();

    // Ensure the todos directory exists - calling async function from constructor
    // We need to handle this properly
    this.ensureTodosDirectory().catch(error => {
      console.error(`Error creating todos directory: ${error.message}`);
      // Not throwing here as constructor can't be async
    });
  }

  /**
   * Updates the environment configuration with values from the loaded config.
   * This ensures that environment variables reflect the current configuration
   * settings, which might come from the config file or environment variables.
   * 
   * @private
   * @returns {void}
   */
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

  /**
   * Ensures that the todos directory exists.
   * Creates the directory if it doesn't exist.
   * 
   * @private
   * @throws {CLIError} If the directory cannot be created
   * @returns {void}
   */
  private async ensureTodosDirectory(): Promise<void> {
    try {
      // Use fsPromises instead of fs synchronous methods
      try {
        await fsPromises.access(this.todosPath);
      } catch {
        // If directory doesn't exist, create it
        await fsPromises.mkdir(this.todosPath, { recursive: true });
      }
    } catch (error) {
      throw new CLIError(
        `Failed to create Todos directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DIRECTORY_CREATE_FAILED'
      );
    }
  }

  /**
   * Constructs the full path to a Todo list file.
   * 
   * @private
   * @param {string} listName - The name of the Todo list
   * @returns {string} The full path to the Todo list file
   */
  private getListPath(listName: string): string {
    return path.join(this.todosPath, `${listName}${STORAGE_CONFIG.FILE_EXT}`);
  }

  /**
   * Loads the configuration from the config file.
   * Falls back to environment variables and defaults if the file doesn't exist
   * or if specific values are missing.
   * 
   * @private
   * @throws {CLIError} If the configuration file exists but cannot be loaded
   * @returns {Config} The loaded configuration object
   */
  private loadConfig(): Config {
    try {
      // Check if config file exists using fs.existsSync since this is sync
      // We can't use async fsPromises.access here since loadConfig is synchronous
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

  /**
   * Returns the current configuration.
   * 
   * @public
   * @returns {Config} The current configuration object
   */
  public getConfig(): Config {
    return this.config;
  }
  
  /**
   * Returns the path to the todos directory.
   * 
   * @public
   * @returns {string} The path to the todos directory
   */
  public getTodosDirectory(): string {
    return this.todosPath;
  }
  
  /**
   * Returns the path to the configuration file.
   * 
   * @public
   * @returns {string} The path to the configuration file
   */
  public getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Updates and saves the configuration.
   * Merges the provided partial configuration with the existing configuration
   * and saves it to the config file.
   * 
   * @public
   * @param {Partial<Config>} config - The partial configuration to merge with the existing configuration
   * @throws {CLIError} If the configuration cannot be saved
   * @returns {Promise<void>}
   */
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
  
  /**
   * Merges and saves the configuration to the appropriate config path.
   * Uses WALRUS_TODO_CONFIG_DIR environment variable to determine config path if set,
   * otherwise follows the default path resolution rules.
   * 
   * @public
   * @param {Partial<Config>} config - The partial configuration to merge with the existing configuration
   * @throws {CLIError} If the configuration cannot be saved
   * @returns {Promise<void>}
   */
  public async mergeAndSaveConfig(config: Partial<Config>): Promise<void> {
    // Get the configured directory path from environment
    const configDir = getEnv('WALRUS_TODO_CONFIG_DIR');
    
    // Determine the target path for saving
    let targetConfigPath = this.configPath;
    
    if (configDir) {
      // Ensure the directory exists
      try {
        try {
          await fsPromises.access(configDir);
        } catch {
          await fsPromises.mkdir(configDir, { recursive: true });
        }
        targetConfigPath = path.join(configDir, CLI_CONFIG.CONFIG_FILE);
        
        // IMPORTANT: Update the configPath for future saves
        this.configPath = targetConfigPath;
      } catch (error) {
        throw new CLIError(
          `Failed to create config directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'CONFIG_DIR_CREATE_FAILED'
        );
      }
    }
    
    // Merge the config
    this.config = { ...this.config, ...config };
    
    try {
      // Save to the determined path
      saveConfigToFile(this.config, targetConfigPath);
      
      // Update environment configuration with new values
      this.updateEnvironmentConfig();
    } catch (error) {
      throw new CLIError(
        `Failed to save config: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CONFIG_SAVE_FAILED'
      );
    }
  }

  /**
   * Loads the data for a specific Todo list.
   * 
   * @private
   * @param {string} listName - The name of the Todo list to load
   * @throws {CLIError} If the list exists but cannot be loaded
   * @returns {Promise<TodoList | null>} The Todo list data, or null if the list doesn't exist
   */
  private async loadListData(listName: string): Promise<TodoList | null> {
    const listPath = this.getListPath(listName);
    try {
      if (fs.existsSync(listPath)) {
        const data = await fsPromises.readFile(listPath, 'utf-8');
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

  /**
   * Saves a Todo list to the file system.
   * 
   * @public
   * @param {string} listName - The name of the Todo list to save
   * @param {TodoList} list - The Todo list data to save
   * @throws {CLIError} If the list cannot be saved
   * @returns {Promise<TodoList>} The saved Todo list
   */
  public async saveListData(listName: string, list: TodoList): Promise<TodoList> {
    const listPath = this.getListPath(listName);
    try {
      await fsPromises.writeFile(listPath, JSON.stringify(list, null, 2));
      return list;
    } catch (error) {
      throw new CLIError(
        `Failed to save list "${listName}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LIST_SAVE_FAILED'
      );
    }
  }

  /**
   * Retrieves a Todo list from local storage.
   * 
   * @public
   * @param {string} listName - The name of the Todo list to retrieve
   * @returns {Promise<TodoList | null>} The Todo list, or null if it doesn't exist
   */
  public async getLocalTodos(listName: string): Promise<TodoList | null> {
    return this.loadListData(listName);
  }

  /**
   * Gets the names of all Todo lists in local storage.
   * 
   * @public
   * @throws {CLIError} If the Todo lists directory cannot be read
   * @returns {Promise<string[]>} An array of Todo list names
   */
  public async getAllLists(): Promise<string[]> {
    try {
      const files = await fsPromises.readdir(this.todosPath);
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

  /**
   * Saves a new Todo to a list.
   * Creates the list if it doesn't exist.
   * 
   * @public
   * @param {string} listName - The name of the Todo list
   * @param {Todo} todo - The Todo to save
   * @returns {Promise<void>}
   */
  public async saveLocalTodo(listName: string, todo: Todo): Promise<void> {
    let list = await this.loadListData(listName);
    if (!list) {
      // Create a new list if it doesn't exist
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

  /**
   * Updates an existing Todo in a list.
   * 
   * @public
   * @param {string} listName - The name of the Todo list
   * @param {Todo} todo - The updated Todo
   * @throws {CLIError} If the list or Todo doesn't exist
   * @returns {Promise<void>}
   */
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

  /**
   * Deletes a Todo from a list.
   * 
   * @public
   * @param {string} listName - The name of the Todo list
   * @param {string} todoId - The ID of the Todo to delete
   * @throws {CLIError} If the list or Todo doesn't exist
   * @returns {Promise<void>}
   */
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

  /**
   * Deletes an entire Todo list.
   * 
   * @public
   * @param {string} listName - The name of the Todo list to delete
   * @throws {CLIError} If the list exists but cannot be deleted
   * @returns {Promise<void>}
   */
  public async deleteList(listName: string): Promise<void> {
    const listPath = this.getListPath(listName);
    try {
      try {
        await fsPromises.access(listPath);
        await fsPromises.unlink(listPath);
      } catch (error) {
        // If file doesn't exist, that's fine - nothing to delete
        if (error && 'code' in error && error.code !== 'ENOENT') {
          throw error;
        }
      }
    } catch (error) {
      throw new CLIError(
        `Failed to delete list "${listName}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LIST_DELETE_FAILED'
      );
    }
  }

  /**
   * Finds a Todo by its ID across all lists.
   * 
   * @public
   * @param {string} todoId - The ID of the Todo to find
   * @returns {Promise<Todo | null>} The found Todo, or null if it doesn't exist
   */
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
   * Updates local configuration based on environment variables.
   * If environment variables have changed since the config was loaded,
   * this method updates the config and saves it to the config file.
   * 
   * @public
   * @returns {void}
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

    // Check each environment variable and update config if different
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

/**
 * Singleton instance of the ConfigService.
 * This exported constant provides global access to a shared ConfigService instance.
 */
export const configService = new ConfigService();