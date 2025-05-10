import { CLIError } from '../types/error';

/**
 * Schema property type definitions
 */
type SchemaPropertyType = 
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'null'
  | 'any';

/**
 * Schema property definition
 */
interface SchemaProperty {
  type: SchemaPropertyType | SchemaPropertyType[];
  required?: boolean;
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  enum?: any[];
  items?: SchemaProperty | Schema;
  properties?: { [key: string]: SchemaProperty };
  additionalProperties?: boolean;
  format?: string;
  validate?: (value: any) => boolean;
  errorMessage?: string;
  errorCode?: string;
}

/**
 * Schema definition
 */
interface Schema {
  properties: { [key: string]: SchemaProperty };
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * JSON Schema validation class
 */
export class SchemaValidator {
  /**
   * Validate an object against a schema
   * @param data The object to validate
   * @param schema The schema to validate against
   * @throws {CLIError} if validation fails
   */
  static validate(data: any, schema: Schema): void {
    // Check required properties
    if (schema.required) {
      for (const requiredProp of schema.required) {
        if (data[requiredProp] === undefined) {
          throw new CLIError(
            `Missing required property: ${requiredProp}`,
            'SCHEMA_VALIDATION_ERROR'
          );
        }
      }
    }
    
    // Check if additional properties are allowed
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(data)) {
        if (!schema.properties[key]) {
          throw new CLIError(
            `Unknown property: ${key}`,
            'SCHEMA_VALIDATION_ERROR'
          );
        }
      }
    }
    
    // Validate properties
    for (const [key, propertySchema] of Object.entries(schema.properties)) {
      if (data[key] !== undefined) {
        this.validateProperty(data[key], propertySchema, key);
      } else if (propertySchema.required) {
        throw new CLIError(
          `Missing required property: ${key}`, 
          propertySchema.errorCode || 'SCHEMA_VALIDATION_ERROR'
        );
      }
    }
  }
  
  /**
   * Validate a property against a schema
   * @param value The property value to validate
   * @param schema The property schema to validate against
   * @param path The property path (for error messages)
   * @throws {CLIError} if validation fails
   */
  private static validateProperty(value: any, schema: SchemaProperty, path: string): void {
    // Check type
    if (schema.type) {
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      if (!this.checkType(value, types)) {
        throw new CLIError(
          schema.errorMessage || `Invalid type for ${path}: expected ${types.join(' or ')}`,
          schema.errorCode || 'SCHEMA_TYPE_ERROR'
        );
      }
    }
    
    // String validations
    if (value !== null && (schema.type === 'string' || (Array.isArray(schema.type) && schema.type.includes('string')))) {
      if (typeof value === 'string') {
        // Check pattern
        if (schema.pattern && !schema.pattern.test(value)) {
          throw new CLIError(
            schema.errorMessage || `Invalid format for ${path}`,
            schema.errorCode || 'SCHEMA_PATTERN_ERROR'
          );
        }
        
        // Check length
        if (schema.minLength !== undefined && value.length < schema.minLength) {
          throw new CLIError(
            schema.errorMessage || `${path} must be at least ${schema.minLength} characters long`,
            schema.errorCode || 'SCHEMA_MIN_LENGTH_ERROR'
          );
        }
        
        if (schema.maxLength !== undefined && value.length > schema.maxLength) {
          throw new CLIError(
            schema.errorMessage || `${path} must be at most ${schema.maxLength} characters long`,
            schema.errorCode || 'SCHEMA_MAX_LENGTH_ERROR'
          );
        }
        
        // Check format
        if (schema.format) {
          if (!this.checkFormat(value, schema.format)) {
            throw new CLIError(
              schema.errorMessage || `Invalid format for ${path}`,
              schema.errorCode || 'SCHEMA_FORMAT_ERROR'
            );
          }
        }
      }
    }
    
    // Number validations
    if (schema.type === 'number' || (Array.isArray(schema.type) && schema.type.includes('number'))) {
      if (typeof value === 'number') {
        // Check range
        if (schema.minimum !== undefined && value < schema.minimum) {
          throw new CLIError(
            schema.errorMessage || `${path} must be at least ${schema.minimum}`,
            schema.errorCode || 'SCHEMA_MINIMUM_ERROR'
          );
        }
        
        if (schema.maximum !== undefined && value > schema.maximum) {
          throw new CLIError(
            schema.errorMessage || `${path} must be at most ${schema.maximum}`,
            schema.errorCode || 'SCHEMA_MAXIMUM_ERROR'
          );
        }
      }
    }
    
    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      throw new CLIError(
        schema.errorMessage || `Invalid value for ${path}: must be one of ${schema.enum.join(', ')}`,
        schema.errorCode || 'SCHEMA_ENUM_ERROR'
      );
    }
    
    // Array validation
    if (schema.type === 'array' || (Array.isArray(schema.type) && schema.type.includes('array'))) {
      if (Array.isArray(value)) {
        // Check items
        if (schema.items) {
          for (let i = 0; i < value.length; i++) {
            if ('properties' in schema.items) {
              // Array of objects
              this.validate(value[i], schema.items as Schema);
            } else {
              // Array of simple types
              this.validateProperty(value[i], schema.items as SchemaProperty, `${path}[${i}]`);
            }
          }
        }
      }
    }
    
    // Object validation
    if (schema.type === 'object' || (Array.isArray(schema.type) && schema.type.includes('object'))) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Check properties
        if (schema.properties) {
          for (const [propKey, propSchema] of Object.entries(schema.properties)) {
            if (value[propKey] !== undefined) {
              this.validateProperty(value[propKey], propSchema, `${path}.${propKey}`);
            } else if (propSchema.required) {
              throw new CLIError(
                `Missing required property: ${path}.${propKey}`,
                propSchema.errorCode || 'SCHEMA_REQUIRED_ERROR'
              );
            }
          }
        }
        
        // Check additional properties
        if (schema.additionalProperties === false) {
          for (const key of Object.keys(value)) {
            if (!schema.properties || !schema.properties[key]) {
              throw new CLIError(
                `Unknown property: ${path}.${key}`,
                'SCHEMA_ADDITIONAL_PROPERTIES_ERROR'
              );
            }
          }
        }
      }
    }
    
    // Custom validation
    if (schema.validate && !schema.validate(value)) {
      throw new CLIError(
        schema.errorMessage || `Invalid value for ${path}`,
        schema.errorCode || 'SCHEMA_VALIDATION_ERROR'
      );
    }
  }
  
  /**
   * Check if a value is of the expected type
   * @param value The value to check
   * @param types Array of expected types
   * @returns true if the value is of one of the expected types
   */
  private static checkType(value: any, types: SchemaPropertyType[]): boolean {
    for (const type of types) {
      switch (type) {
        case 'string':
          if (typeof value === 'string') return true;
          break;
        case 'number':
          if (typeof value === 'number') return true;
          break;
        case 'boolean':
          if (typeof value === 'boolean') return true;
          break;
        case 'object':
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) return true;
          break;
        case 'array':
          if (Array.isArray(value)) return true;
          break;
        case 'null':
          if (value === null) return true;
          break;
        case 'any':
          return true;
      }
    }
    return false;
  }
  
  /**
   * Check if a string matches a format
   * @param value The string to check
   * @param format The format to check against
   * @returns true if the string matches the format
   */
  private static checkFormat(value: string, format: string): boolean {
    switch (format) {
      case 'date':
        return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
      case 'date-time':
        return !isNaN(Date.parse(value));
      case 'email':
        return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value);
      case 'uri':
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      case 'wallet-address':
        return /^0x[a-fA-F0-9]{40,}$/.test(value);
      case 'uuid':
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
      case 'filename':
        return /^[a-zA-Z0-9_.-]+$/.test(value);
      case 'filepath':
        // Basic path validation that rejects traversal sequences
        return !/(\.\.|\/\/)/.test(value);
      case 'alpha':
        return /^[a-zA-Z]+$/.test(value);
      case 'alphanumeric':
        return /^[a-zA-Z0-9]+$/.test(value);
      case 'alphanumeric-extended':
        return /^[a-zA-Z0-9_-]+$/.test(value);
      case 'hex':
        return /^[0-9a-fA-F]+$/.test(value);
      case 'color-hex':
        return /^#[0-9a-fA-F]{3,8}$/.test(value);
      case 'ip-address':
        // Simple IPv4 validation
        return /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(value);
      case 'domain':
        return /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/.test(value);
      default:
        return true;
    }
  }
}

// Export pre-defined schemas
export const Schemas = {
  Todo: {
    properties: {
      id: { type: 'string', required: true },
      title: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 100,
        errorMessage: 'Todo title must be between 1 and 100 characters',
        errorCode: 'INVALID_TODO_TITLE'
      },
      description: { type: 'string' },
      completed: { type: 'boolean' },
      priority: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        errorMessage: 'Priority must be high, medium, or low',
        errorCode: 'INVALID_PRIORITY'
      },
      dueDate: {
        type: 'string',
        format: 'date',
        errorMessage: 'Due date must be in the format YYYY-MM-DD',
        errorCode: 'INVALID_DUE_DATE'
      },
      tags: {
        type: 'array',
        items: { type: 'string' }
      },
      createdAt: { type: 'string' },
      updatedAt: { type: 'string' },
      private: { type: 'boolean' },
      storageLocation: {
        type: 'string',
        enum: ['local', 'blockchain', 'both'],
        errorMessage: 'Storage location must be local, blockchain, or both',
        errorCode: 'INVALID_STORAGE_LOCATION'
      },
      walrusBlobId: { type: 'string' }
    },
    required: ['id', 'title'],
    additionalProperties: false
  },

  TodoList: {
    properties: {
      name: {
        type: 'string',
        required: true,
        pattern: /^[a-zA-Z0-9_-]+$/,
        errorMessage: 'List name can only contain letters, numbers, underscores, and hyphens',
        errorCode: 'INVALID_LIST_NAME'
      },
      owner: { type: 'string', required: true },
      todos: {
        type: 'array',
        items: { type: 'object' } // This would reference the Todo schema in a full implementation
      },
      createdAt: { type: 'string' },
      updatedAt: { type: 'string' }
    },
    required: ['name', 'owner'],
    additionalProperties: false
  },

  NetworkConfig: {
    properties: {
      network: {
        type: 'string',
        enum: ['mainnet', 'testnet', 'devnet', 'local'],
        errorMessage: 'Network must be mainnet, testnet, devnet, or local',
        errorCode: 'INVALID_NETWORK'
      },
      walletAddress: {
        type: 'string',
        format: 'wallet-address',
        errorMessage: 'Invalid wallet address format',
        errorCode: 'INVALID_WALLET_ADDRESS'
      },
      encryptedStorage: { type: 'boolean' }
    },
    additionalProperties: false
  },

  AIConfiguration: {
    properties: {
      apiKey: {
        type: 'string',
        minLength: 16,
        errorMessage: 'API key must be at least 16 characters',
        errorCode: 'INVALID_API_KEY'
      },
      provider: {
        type: 'string',
        enum: ['xai', 'openai', 'anthropic'],
        errorMessage: 'Provider must be xai, openai, or anthropic',
        errorCode: 'INVALID_AI_PROVIDER'
      },
      maxConcurrentRequests: {
        type: 'number',
        minimum: 1,
        maximum: 50,
        errorMessage: 'Max concurrent requests must be between 1 and 50',
        errorCode: 'INVALID_CONCURRENT_REQUESTS'
      },
      cacheResults: { type: 'boolean' },
      useBlockchainVerification: { type: 'boolean' }
    },
    additionalProperties: false
  },

  // Command Schemas
  AddCommand: {
    properties: {
      task: {
        type: ['string', 'array'],
        items: { type: 'string', minLength: 1 },
        errorMessage: 'Task must be a non-empty string or array of strings',
        errorCode: 'INVALID_TASK'
      },
      priority: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        errorMessage: 'Priority must be high, medium, or low',
        errorCode: 'INVALID_PRIORITY'
      },
      due: {
        type: 'string',
        format: 'date',
        errorMessage: 'Due date must be in the format YYYY-MM-DD',
        errorCode: 'INVALID_DUE_DATE'
      },
      tags: {
        type: 'string',
        errorMessage: 'Tags must be a comma-separated string',
        errorCode: 'INVALID_TAGS'
      },
      private: { type: 'boolean' },
      list: {
        type: 'string',
        format: 'alphanumeric-extended',
        errorMessage: 'List name can only contain letters, numbers, underscores, and hyphens',
        errorCode: 'INVALID_LIST_NAME'
      },
      storage: {
        type: 'string',
        enum: ['local', 'blockchain', 'both'],
        errorMessage: 'Storage location must be local, blockchain, or both',
        errorCode: 'INVALID_STORAGE_LOCATION'
      },
      ai: { type: 'boolean' },
      apiKey: {
        type: 'string',
        minLength: 16,
        errorMessage: 'API key must be at least 16 characters',
        errorCode: 'INVALID_API_KEY'
      }
    }
  },

  CompleteCommand: {
    properties: {
      id: {
        type: 'string',
        required: true,
        errorMessage: 'Todo ID is required',
        errorCode: 'MISSING_TODO_ID'
      },
      list: {
        type: 'string',
        format: 'alphanumeric-extended',
        errorMessage: 'List name can only contain letters, numbers, underscores, and hyphens',
        errorCode: 'INVALID_LIST_NAME'
      },
      sync: { type: 'boolean' }
    },
    required: ['id']
  },

  ListCommand: {
    properties: {
      list: {
        type: 'string',
        format: 'alphanumeric-extended',
        errorMessage: 'List name can only contain letters, numbers, underscores, and hyphens',
        errorCode: 'INVALID_LIST_NAME'
      },
      format: {
        type: 'string',
        enum: ['table', 'json', 'compact'],
        errorMessage: 'Format must be table, json, or compact',
        errorCode: 'INVALID_FORMAT'
      },
      filter: { type: 'string' },
      sort: {
        type: 'string',
        enum: ['priority', 'due', 'created', 'updated'],
        errorMessage: 'Sort must be priority, due, created, or updated',
        errorCode: 'INVALID_SORT'
      },
      completed: { type: 'boolean' },
      all: { type: 'boolean' }
    }
  },

  DeleteCommand: {
    properties: {
      id: {
        type: 'string',
        required: true,
        errorMessage: 'Todo ID is required',
        errorCode: 'MISSING_TODO_ID'
      },
      list: {
        type: 'string',
        format: 'alphanumeric-extended',
        errorMessage: 'List name can only contain letters, numbers, underscores, and hyphens',
        errorCode: 'INVALID_LIST_NAME'
      },
      force: { type: 'boolean' },
      sync: { type: 'boolean' }
    },
    required: ['id']
  },

  UpdateCommand: {
    properties: {
      id: {
        type: 'string',
        required: true,
        errorMessage: 'Todo ID is required',
        errorCode: 'MISSING_TODO_ID'
      },
      list: {
        type: 'string',
        format: 'alphanumeric-extended',
        errorMessage: 'List name can only contain letters, numbers, underscores, and hyphens',
        errorCode: 'INVALID_LIST_NAME'
      },
      title: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        errorMessage: 'Todo title must be between 1 and 100 characters',
        errorCode: 'INVALID_TODO_TITLE'
      },
      priority: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        errorMessage: 'Priority must be high, medium, or low',
        errorCode: 'INVALID_PRIORITY'
      },
      due: {
        type: 'string',
        format: 'date',
        errorMessage: 'Due date must be in the format YYYY-MM-DD',
        errorCode: 'INVALID_DUE_DATE'
      },
      tags: {
        type: 'string',
        errorMessage: 'Tags must be a comma-separated string',
        errorCode: 'INVALID_TAGS'
      },
      private: { type: 'boolean' },
      sync: { type: 'boolean' }
    },
    required: ['id']
  },

  AICommand: {
    properties: {
      apiKey: {
        type: 'string',
        minLength: 16,
        errorMessage: 'API key must be at least 16 characters',
        errorCode: 'INVALID_API_KEY'
      },
      operation: {
        type: 'string',
        enum: [
          'summarize', 'categorize', 'prioritize', 'suggest', 'analyze',
          'group', 'schedule', 'detect_dependencies', 'estimate_effort'
        ],
        required: true,
        errorMessage: 'Operation must be a valid AI operation',
        errorCode: 'INVALID_OPERATION'
      },
      format: {
        type: 'string',
        enum: ['table', 'json'],
        errorMessage: 'Format must be table or json',
        errorCode: 'INVALID_FORMAT'
      },
      verify: { type: 'boolean' },
      provider: {
        type: 'string',
        enum: ['xai', 'openai', 'anthropic'],
        errorMessage: 'Provider must be xai, openai, or anthropic',
        errorCode: 'INVALID_PROVIDER'
      },
      model: { type: 'string' },
      privacy: {
        type: 'string',
        enum: ['public', 'hash_only', 'private'],
        errorMessage: 'Privacy must be public, hash_only, or private',
        errorCode: 'INVALID_PRIVACY'
      },
      noCache: { type: 'boolean' },
      clearCache: { type: 'boolean' },
      temperature: {
        type: 'number',
        minimum: 0,
        maximum: 100,
        errorMessage: 'Temperature must be between 0 and 100',
        errorCode: 'INVALID_TEMPERATURE'
      },
      enhanced: { type: 'boolean' },
      registryAddress: {
        type: 'string',
        format: 'wallet-address',
        errorMessage: 'Registry address must be a valid wallet address',
        errorCode: 'INVALID_REGISTRY_ADDRESS'
      },
      packageId: { type: 'string' },
      exportProof: { type: 'boolean' },
      verifyPermissions: { type: 'boolean' }
    },
    required: ['operation']
  },

  ImageUploadCommand: {
    properties: {
      path: {
        type: 'string',
        required: true,
        errorMessage: 'Image path is required',
        errorCode: 'MISSING_IMAGE_PATH'
      },
      title: { type: 'string' },
      description: { type: 'string' },
      tags: { type: 'string' },
      todo: { type: 'string' },
      list: {
        type: 'string',
        format: 'alphanumeric-extended',
        errorMessage: 'List name can only contain letters, numbers, underscores, and hyphens',
        errorCode: 'INVALID_LIST_NAME'
      }
    },
    required: ['path']
  },

  CreateNFTCommand: {
    properties: {
      todoId: {
        type: 'string',
        errorMessage: 'Todo ID is required',
        errorCode: 'MISSING_TODO_ID'
      },
      list: {
        type: 'string',
        format: 'alphanumeric-extended',
        errorMessage: 'List name can only contain letters, numbers, underscores, and hyphens',
        errorCode: 'INVALID_LIST_NAME'
      },
      image: { type: 'string' },
      name: { type: 'string' },
      network: {
        type: 'string',
        enum: ['mainnet', 'testnet', 'devnet', 'local'],
        errorMessage: 'Network must be mainnet, testnet, devnet, or local',
        errorCode: 'INVALID_NETWORK'
      },
      address: {
        type: 'string',
        format: 'wallet-address',
        errorMessage: 'Address must be a valid wallet address',
        errorCode: 'INVALID_ADDRESS'
      }
    }
  },

  ConfigureCommand: {
    properties: {
      network: {
        type: 'string',
        enum: ['mainnet', 'testnet', 'devnet', 'local'],
        errorMessage: 'Network must be mainnet, testnet, devnet, or local',
        errorCode: 'INVALID_NETWORK'
      },
      wallet: {
        type: 'string',
        format: 'wallet-address',
        errorMessage: 'Wallet address must be a valid address',
        errorCode: 'INVALID_WALLET_ADDRESS'
      },
      apiKey: {
        type: 'string',
        minLength: 16,
        errorMessage: 'API key must be at least 16 characters',
        errorCode: 'INVALID_API_KEY'
      },
      provider: {
        type: 'string',
        enum: ['xai', 'openai', 'anthropic'],
        errorMessage: 'Provider must be xai, openai, or anthropic',
        errorCode: 'INVALID_PROVIDER'
      },
      storageMode: {
        type: 'string',
        enum: ['local', 'blockchain', 'both'],
        errorMessage: 'Storage mode must be local, blockchain, or both',
        errorCode: 'INVALID_STORAGE_MODE'
      },
      encrypt: { type: 'boolean' },
      reset: { type: 'boolean' }
    }
  }
};