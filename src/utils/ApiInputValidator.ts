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
  static validateTodo(todo: unknown): unknown {
    // Type guard to ensure todo is an object
    if (typeof todo !== 'object' || todo === null) {
      throw new CLIError('Todo must be an object', 'INVALID_TODO');
    }
    
    const todoObj = todo as Record<string, unknown>;
    
    // Sanitize todo inputs
    const sanitizedTodo = {
      ...todoObj,
      title: CommandSanitizer.sanitizeString(String(todoObj.title || '')),
      description: todoObj.description ? CommandSanitizer.sanitizeString(String(todoObj.description)) : undefined,
      priority: todoObj.priority,
      dueDate: todoObj.dueDate ? CommandSanitizer.sanitizeDate(String(todoObj.dueDate)) : undefined,
      tags: todoObj.tags ? (Array.isArray(todoObj.tags)
        ? todoObj.tags.map((tag: unknown) => CommandSanitizer.sanitizeString(String(tag)))
        : CommandSanitizer.sanitizeTags(String(todoObj.tags)))
        : [],
      walrusBlobId: todoObj.walrusBlobId ? CommandSanitizer.sanitizeString(String(todoObj.walrusBlobId)) : undefined,
      nftObjectId: todoObj.nftObjectId ? CommandSanitizer.sanitizeString(String(todoObj.nftObjectId)) : undefined,
      imageUrl: todoObj.imageUrl ? CommandSanitizer.sanitizeUrl(String(todoObj.imageUrl)) : undefined
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
  static validateTodoList(list: unknown): unknown {
    // Type guard to ensure list is an object
    if (typeof list !== 'object' || list === null) {
      throw new CLIError('List must be an object', 'INVALID_TODO_LIST');
    }
    
    const listObj = list as Record<string, unknown>;
    
    // Sanitize list inputs
    const sanitizedList = {
      ...listObj,
      name: CommandSanitizer.sanitizeString(String(listObj.name || '')),
      owner: CommandSanitizer.sanitizeString(String(listObj.owner || '')),
      todos: Array.isArray(listObj.todos) ? listObj.todos.map((todo: unknown) => this.validateTodo(todo)) : [],
      collaborators: listObj.collaborators && Array.isArray(listObj.collaborators)
        ? listObj.collaborators.map((collab: unknown) => CommandSanitizer.sanitizeString(String(collab)))
        : undefined,
      walrusBlobId: listObj.walrusBlobId ? CommandSanitizer.sanitizeString(String(listObj.walrusBlobId)) : undefined,
      suiObjectId: listObj.suiObjectId ? CommandSanitizer.sanitizeString(String(listObj.suiObjectId)) : undefined
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
  static validateNetworkConfig(config: unknown): unknown {
    // Type guard to ensure config is an object
    if (typeof config !== 'object' || config === null) {
      throw new CLIError('Config must be an object', 'INVALID_CONFIG');
    }
    
    const configObj = config as Record<string, unknown>;
    
    // Sanitize network inputs
    const sanitizedConfig = {
      ...configObj,
      network: CommandSanitizer.sanitizeString(String(configObj.network || '')),
      walletAddress: configObj.walletAddress ? CommandSanitizer.sanitizeWalletAddress(String(configObj.walletAddress)) : undefined
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
  static validateAIConfig(config: unknown): {
    apiKey?: string;
    provider: string;
    maxConcurrentRequests?: number;
    cacheResults?: boolean;
    useBlockchainVerification?: boolean;
  } {
    // Type guard to ensure config is an object
    if (typeof config !== 'object' || config === null) {
      throw new CLIError('Config must be an object', 'INVALID_CONFIG');
    }
    
    const configObj = config as Record<string, unknown>;
    
    // Sanitize AI config inputs
    const sanitizedConfig = {
      ...configObj,
      apiKey: configObj.apiKey ? CommandSanitizer.sanitizeApiKey(String(configObj.apiKey)) : undefined,
      provider: CommandSanitizer.sanitizeString(String(configObj.provider || '')),
      maxConcurrentRequests: configObj.maxConcurrentRequests as number | undefined,
      cacheResults: configObj.cacheResults as boolean | undefined,
      useBlockchainVerification: configObj.useBlockchainVerification as boolean | undefined
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