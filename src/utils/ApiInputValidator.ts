import { CLIError } from '../types/error';
import { SchemaValidator } from './SchemaValidator';
import { CommandSanitizer } from './CommandSanitizer';

/**
 * API Input validation utilities
 * Provides methods to validate and sanitize inputs for API endpoints and services
 */
export class ApiInputValidator {
  /**
   * Validates and sanitizes a todo object
   * @param todo Todo object to validate
   * @returns Sanitized todo object
   * @throws {CLIError} if validation fails
   */
  static validateTodo(todo: any): any {
    // Sanitize todo inputs
    const sanitizedTodo = {
      ...todo,
      title: CommandSanitizer.sanitizeString(todo.title),
      description: todo.description ? CommandSanitizer.sanitizeString(todo.description) : undefined,
      priority: todo.priority,
      dueDate: todo.dueDate ? CommandSanitizer.sanitizeDate(todo.dueDate) : undefined,
      tags: todo.tags ? (Array.isArray(todo.tags)
        ? todo.tags.map(CommandSanitizer.sanitizeString)
        : CommandSanitizer.sanitizeTags(todo.tags))
        : [],
      walrusBlobId: todo.walrusBlobId ? CommandSanitizer.sanitizeString(todo.walrusBlobId) : undefined,
      nftObjectId: todo.nftObjectId ? CommandSanitizer.sanitizeString(todo.nftObjectId) : undefined,
      imageUrl: todo.imageUrl ? CommandSanitizer.sanitizeUrl(todo.imageUrl) : undefined
    };

    // Define a schema that conforms to Schema interface
    const todoSchema = {
      properties: {
        id: { type: 'string' as const, required: true },
        title: {
          type: 'string' as const,
          required: true,
          minLength: 1,
          maxLength: 100,
          errorMessage: 'Todo title must be between 1 and 100 characters',
          errorCode: 'INVALID_TODO_TITLE'
        },
        description: { type: 'string' as const },
        completed: { type: 'boolean' as const },
        priority: {
          type: 'string' as const,
          enum: ['high', 'medium', 'low'],
          errorMessage: 'Priority must be high, medium, or low',
          errorCode: 'INVALID_PRIORITY'
        },
        dueDate: {
          type: 'string' as const,
          format: 'date',
          errorMessage: 'Due date must be in the format YYYY-MM-DD',
          errorCode: 'INVALID_DUE_DATE'
        },
        tags: {
          type: 'array' as const,
          items: { type: 'string' as const }
        },
        createdAt: { type: 'string' as const },
        updatedAt: { type: 'string' as const },
        private: { type: 'boolean' as const },
        storageLocation: {
          type: 'string' as const,
          enum: ['local', 'blockchain', 'both'],
          errorMessage: 'Storage location must be local, blockchain, or both',
          errorCode: 'INVALID_STORAGE_LOCATION'
        },
        walrusBlobId: { type: 'string' as const }
      },
      required: ['id', 'title'],
      additionalProperties: false
    };

    // Validate against schema
    try {
      SchemaValidator.validate(sanitizedTodo, todoSchema);
    } catch (error) {
      throw new CLIError(
        `Invalid todo object: ${error instanceof Error ? error.message : String(error)}`,
        'INVALID_TODO'
      );
    }

    return sanitizedTodo;
  }

  /**
   * Validates and sanitizes a todo list object
   * @param list TodoList object to validate
   * @returns Sanitized todo list object
   * @throws {CLIError} if validation fails
   */
  static validateTodoList(list: any): any {
    // Sanitize list inputs
    const sanitizedList = {
      ...list,
      name: CommandSanitizer.sanitizeString(list.name),
      owner: CommandSanitizer.sanitizeString(list.owner),
      todos: Array.isArray(list.todos) ? list.todos.map(this.validateTodo) : [],
      collaborators: list.collaborators
        ? list.collaborators.map(CommandSanitizer.sanitizeString)
        : undefined,
      walrusBlobId: list.walrusBlobId ? CommandSanitizer.sanitizeString(list.walrusBlobId) : undefined,
      suiObjectId: list.suiObjectId ? CommandSanitizer.sanitizeString(list.suiObjectId) : undefined
    };

    // Define a schema that conforms to Schema interface
    const todoListSchema = {
      properties: {
        name: {
          type: 'string' as const,
          required: true,
          pattern: /^[a-zA-Z0-9_-]+$/,
          errorMessage: 'List name can only contain letters, numbers, underscores, and hyphens',
          errorCode: 'INVALID_LIST_NAME'
        },
        owner: { type: 'string' as const, required: true },
        todos: {
          type: 'array' as const,
          items: { type: 'object' as const } // This would reference the Todo schema in a full implementation
        },
        createdAt: { type: 'string' as const },
        updatedAt: { type: 'string' as const },
        collaborators: {
          type: 'array' as const,
          items: { type: 'string' as const }
        },
        walrusBlobId: { type: 'string' as const },
        suiObjectId: { type: 'string' as const }
      },
      required: ['name', 'owner'],
      additionalProperties: false
    };

    // Validate against schema
    try {
      SchemaValidator.validate(sanitizedList, todoListSchema);
    } catch (error) {
      throw new CLIError(
        `Invalid todo list: ${error instanceof Error ? error.message : String(error)}`,
        'INVALID_TODO_LIST'
      );
    }

    return sanitizedList;
  }

  /**
   * Validates and sanitizes a network configuration object
   * @param config Network configuration object
   * @returns Sanitized configuration object
   * @throws {CLIError} if validation fails
   */
  static validateNetworkConfig(config: any): any {
    // Sanitize network inputs
    const sanitizedConfig = {
      ...config,
      network: CommandSanitizer.sanitizeString(config.network),
      walletAddress: config.walletAddress ? CommandSanitizer.sanitizeWalletAddress(config.walletAddress) : undefined
    };

    // Define a schema that conforms to Schema interface
    const networkConfigSchema = {
      properties: {
        network: {
          type: 'string' as const,
          enum: ['mainnet', 'testnet', 'devnet', 'local'],
          errorMessage: 'Network must be mainnet, testnet, devnet, or local',
          errorCode: 'INVALID_NETWORK'
        },
        walletAddress: {
          type: 'string' as const,
          format: 'wallet-address',
          errorMessage: 'Invalid wallet address format',
          errorCode: 'INVALID_WALLET_ADDRESS'
        },
        encryptedStorage: {
          type: 'boolean' as const
        }
      },
      additionalProperties: false
    };

    // Validate against schema
    try {
      SchemaValidator.validate(sanitizedConfig, networkConfigSchema);
    } catch (error) {
      throw new CLIError(
        `Invalid network configuration: ${error instanceof Error ? error.message : String(error)}`,
        'INVALID_NETWORK_CONFIG'
      );
    }

    return sanitizedConfig;
  }

  /**
   * Validates and sanitizes an AI configuration object
   * @param config AI configuration object
   * @returns Sanitized AI configuration object
   * @throws {CLIError} if validation fails
   */
  static validateAIConfig(config: any): any {
    // Sanitize AI config inputs
    const sanitizedConfig = {
      ...config,
      apiKey: config.apiKey ? CommandSanitizer.sanitizeApiKey(config.apiKey) : undefined,
      provider: CommandSanitizer.sanitizeString(config.provider),
      maxConcurrentRequests: config.maxConcurrentRequests
    };

    // Define a schema that conforms to Schema interface
    const aiConfigSchema = {
      properties: {
        apiKey: {
          type: 'string' as const,
          minLength: 16,
          errorMessage: 'API key must be at least 16 characters',
          errorCode: 'INVALID_API_KEY'
        },
        provider: {
          type: 'string' as const,
          enum: ['xai', 'openai', 'anthropic'],
          errorMessage: 'Provider must be xai, openai, or anthropic',
          errorCode: 'INVALID_PROVIDER'
        },
        maxConcurrentRequests: {
          type: 'number' as const,
          minimum: 1,
          maximum: 50,
          errorMessage: 'Max concurrent requests must be between 1 and 50',
          errorCode: 'INVALID_CONCURRENT_REQUESTS'
        },
        cacheResults: {
          type: 'boolean' as const
        },
        useBlockchainVerification: {
          type: 'boolean' as const
        }
      },
      additionalProperties: false
    };

    // Validate against schema
    try {
      SchemaValidator.validate(sanitizedConfig, aiConfigSchema);
    } catch (error) {
      throw new CLIError(
        `Invalid AI configuration: ${error instanceof Error ? error.message : String(error)}`,
        'INVALID_AI_CONFIG'
      );
    }

    return sanitizedConfig;
  }

  /**
   * Validates and sanitizes a transaction ID
   * @param txId Transaction ID to validate
   * @returns Sanitized transaction ID
   * @throws {CLIError} if validation fails
   */
  static validateTransactionId(txId: string): string {
    const sanitized = CommandSanitizer.sanitizeTransactionId(txId);
    
    if (!sanitized) {
      throw new CLIError(
        'Invalid transaction ID format',
        'INVALID_TRANSACTION_ID'
      );
    }
    
    return sanitized;
  }

  /**
   * Validates and sanitizes a wallet address
   * @param address Wallet address to validate
   * @returns Sanitized wallet address
   * @throws {CLIError} if validation fails
   */
  static validateWalletAddress(address: string): string {
    const sanitized = CommandSanitizer.sanitizeWalletAddress(address);
    
    if (!sanitized) {
      throw new CLIError(
        'Invalid wallet address format',
        'INVALID_WALLET_ADDRESS'
      );
    }
    
    return sanitized;
  }

  /**
   * Validates and sanitizes an image path
   * @param path Image path to validate
   * @returns Sanitized image path
   * @throws {CLIError} if validation fails
   */
  static validateImagePath(path: string): string {
    const sanitized = CommandSanitizer.sanitizePath(path);
    
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(sanitized);
    if (!isImage) {
      throw new CLIError(
        'Invalid image file format. Supported formats: jpg, jpeg, png, gif, webp, svg',
        'INVALID_IMAGE_FORMAT'
      );
    }
    
    return sanitized;
  }

  /**
   * Validates and sanitizes a URL
   * @param url URL to validate
   * @returns Sanitized URL
   * @throws {CLIError} if validation fails
   */
  static validateUrl(url: string): string {
    const sanitized = CommandSanitizer.sanitizeUrl(url);
    
    if (!sanitized) {
      throw new CLIError(
        'Invalid URL format',
        'INVALID_URL'
      );
    }
    
    return sanitized;
  }

  /**
   * Validates and sanitizes an API key
   * @param apiKey API key to validate
   * @returns Sanitized API key
   * @throws {CLIError} if validation fails
   */
  static validateApiKey(apiKey: string): string {
    const sanitized = CommandSanitizer.sanitizeApiKey(apiKey);
    
    if (!sanitized || sanitized.length < 16) {
      throw new CLIError(
        'Invalid API key format. API key must be at least 16 characters long',
        'INVALID_API_KEY'
      );
    }
    
    return sanitized;
  }
}