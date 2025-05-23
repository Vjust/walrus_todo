/**
import { Logger } from './Logger';

const logger = new Logger('environment-config');
 * Environment Configuration Manager
 * 
 * This module provides centralized management of environment variables 
 * with validation, type checking, and fallback values.
 */

import { CLIError } from '../types/errors/consolidated';

export enum Environment {
  DEVELOPMENT = 'development',
  TESTING = 'testing',
  STAGING = 'staging',
  PRODUCTION = 'production'
}

export interface EnvVariable<T> {
  value: T;
  required: boolean;
  name: string;
  source: 'environment' | 'config' | 'default';
  description?: string;
  example?: string;
  validationFn?: (value: T) => boolean;
  validationError?: string;
  sensitive?: boolean; // Flag for sensitive values like API keys
  deprecated?: boolean; // Flag for deprecated environment variables
  deprecated_message?: string; // Message to display when using deprecated variables
}

interface EnvironmentConfig {
  // Common configurations
  NODE_ENV: EnvVariable<Environment>;
  LOG_LEVEL: EnvVariable<string>;

  // Blockchain related
  NETWORK: EnvVariable<string>;
  FULLNODE_URL: EnvVariable<string>;
  TODO_PACKAGE_ID: EnvVariable<string>;
  REGISTRY_ID: EnvVariable<string>;

  // Storage related
  STORAGE_PATH: EnvVariable<string>;
  TEMPORARY_STORAGE: EnvVariable<string>;

  // AI related configurations
  XAI_API_KEY: EnvVariable<string>;
  OPENAI_API_KEY: EnvVariable<string>;
  ANTHROPIC_API_KEY: EnvVariable<string>;
  OLLAMA_API_KEY: EnvVariable<string>;
  AI_DEFAULT_PROVIDER: EnvVariable<string>;
  AI_DEFAULT_MODEL: EnvVariable<string>;
  AI_TEMPERATURE: EnvVariable<number>;
  AI_MAX_TOKENS: EnvVariable<number>;
  AI_CACHE_ENABLED: EnvVariable<boolean>;
  AI_CACHE_TTL_MS: EnvVariable<number>;

  // Credential security configurations
  CREDENTIAL_KEY_ITERATIONS: EnvVariable<number>;
  CREDENTIAL_AUTO_ROTATION_DAYS: EnvVariable<number>;
  CREDENTIAL_ROTATION_WARNING_DAYS: EnvVariable<number>;
  CREDENTIAL_MAX_FAILED_AUTH: EnvVariable<number>;

  // Advanced configurations
  WALLET_ADDRESS: EnvVariable<string>;
  ENCRYPTED_STORAGE: EnvVariable<boolean>;
  RETRY_ATTEMPTS: EnvVariable<number>;
  RETRY_DELAY_MS: EnvVariable<number>;
  TIMEOUT_MS: EnvVariable<number>;

  // Security configurations
  REQUIRE_SIGNATURE_VERIFICATION: EnvVariable<boolean>;
  ENABLE_BLOCKCHAIN_VERIFICATION: EnvVariable<boolean>;

  // Additional retry and connection configs
  MAX_RETRY_DELAY_MS: EnvVariable<number>;
  MAX_RETRY_DURATION: EnvVariable<number>;
  CONNECTION_TIMEOUT_MS: EnvVariable<number>;
  CONNECTION_KEEP_ALIVE: EnvVariable<boolean>;
  CONNECTION_MAX_IDLE_TIME_MS: EnvVariable<number>;
  CONNECTION_AUTO_RECONNECT: EnvVariable<boolean>;
  CONNECTION_MAX_RETRIES: EnvVariable<number>;
  CONNECTION_BASE_DELAY_MS: EnvVariable<number>;
  CONNECTION_MAX_DELAY_MS: EnvVariable<number>;

  // Additional environment variable for config directory
  WALRUS_TODO_CONFIG_DIR: EnvVariable<string>;
}

/**
 * Gets the current environment
 */
export function getEnvironment(): Environment {
  const env = process.env.NODE_ENV?.toLowerCase() || 'development';
  
  switch (env) {
    case 'production':
      return Environment.PRODUCTION;
    case 'staging':
      return Environment.STAGING;
    case 'test':
    case 'testing':
      return Environment.TESTING;
    case 'development':
    default:
      return Environment.DEVELOPMENT;
  }
}

/**
 * Validates that required environment variables are present
 * @throws {CLIError} If a required environment variable is missing
 */
export function validateRequiredEnvVars(config: EnvironmentConfig): void {
  const missingVars: string[] = [];
  const invalidVars: string[] = [];

  for (const [key, value] of Object.entries(config)) {
    // Check if required variables are present
    if (value.required && (value.value === undefined || value.value === null || value.value === '')) {
      missingVars.push(key);
    }

    // Add type validation for critical environment variables
    if (value.value !== undefined && value.value !== null && value.value !== '') {
      const expectedType = typeof value.value;

      // Validate that boolean values are actually booleans
      // Fix for boolean/never type issue - we don't need to check includes() on a known boolean
      if (expectedType === 'boolean') {
        // Boolean values are already validated by their type
        // No further validation needed here
      }

      // Validate that numeric values are actually numbers
      if (expectedType === 'number' && isNaN(Number(value.value))) {
        invalidVars.push(`${key} (expected number)`);
      }
    }
  }

  // Throw error for missing variables
  if (missingVars.length > 0) {
    throw new CLIError(
      `Missing required environment variables: ${missingVars.join(', ')}`,
      'MISSING_ENV_VARS'
    );
  }

  // Throw error for invalid variable types
  if (invalidVars.length > 0) {
    throw new CLIError(
      `Invalid environment variable types: ${invalidVars.join(', ')}`,
      'INVALID_ENV_VAR_TYPES'
    );
  }
}

/**
 * Gets a boolean value from an environment variable
 */
function getBooleanValue(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  
  return ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
}

/**
 * Gets a number value from an environment variable
 */
function getNumberValue(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

export class EnvironmentConfigManager {
  private static instance: EnvironmentConfigManager;
  private config: EnvironmentConfig;
  private extensionVars: Record<string, EnvVariable<unknown>> = {};
  private variableWarnings: string[] = [];
  
  private constructor() {
    // Initialize configuration with default values
    this.config = {
      // Common configurations
      NODE_ENV: {
        name: 'NODE_ENV',
        value: getEnvironment(),
        required: false,
        source: process.env.NODE_ENV ? 'environment' : 'default',
        description: 'Application environment (development, testing, staging, production)',
        example: 'development'
      },

      LOG_LEVEL: {
        name: 'LOG_LEVEL',
        value: process.env.LOG_LEVEL || 'info',
        required: false,
        source: process.env.LOG_LEVEL ? 'environment' : 'default',
        description: 'Logging level (error, warn, info, debug, trace)',
        example: 'info',
        validationFn: (val) => ['error', 'warn', 'info', 'debug', 'trace'].includes(val.toString()),
        validationError: 'LOG_LEVEL must be one of: error, warn, info, debug, trace'
      },

      // Blockchain related
      NETWORK: {
        name: 'NETWORK',
        value: process.env.NETWORK || 'testnet',
        required: false,
        source: process.env.NETWORK ? 'environment' : 'default',
        description: 'Blockchain network (mainnet, testnet, devnet, local)',
        example: 'testnet',
        validationFn: (val) => ['mainnet', 'testnet', 'devnet', 'local', 'localnet'].includes(val.toString()),
        validationError: 'NETWORK must be one of: mainnet, testnet, devnet, local, localnet'
      },

      FULLNODE_URL: {
        name: 'FULLNODE_URL',
        value: process.env.FULLNODE_URL || '',
        required: false,
        source: process.env.FULLNODE_URL ? 'environment' : 'default',
        description: 'Custom full node URL for the blockchain network',
        example: 'https://fullnode.testnet.sui.io:443'
      },

      TODO_PACKAGE_ID: {
        name: 'TODO_PACKAGE_ID',
        value: process.env.TODO_PACKAGE_ID || '',
        required: false,
        source: process.env.TODO_PACKAGE_ID ? 'environment' : 'default',
        description: 'Package ID for the deployed Todo smart contract',
        example: '0x25a04efc88188231b2f9eb35310a5025c293c4211d2482fd24fe2c8e2dbc9f74'
      },

      REGISTRY_ID: {
        name: 'REGISTRY_ID',
        value: process.env.REGISTRY_ID || '',
        required: false,
        source: process.env.REGISTRY_ID ? 'environment' : 'default',
        description: 'Registry ID for the AI verification registry',
        example: '0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'
      },

      // Storage related
      STORAGE_PATH: {
        name: 'STORAGE_PATH',
        value: process.env.STORAGE_PATH || 'Todos',
        required: false,
        source: process.env.STORAGE_PATH ? 'environment' : 'default',
        description: 'Local path for storing todo data',
        example: 'Todos'
      },

      TEMPORARY_STORAGE: {
        name: 'TEMPORARY_STORAGE',
        value: process.env.TEMPORARY_STORAGE || '/tmp/waltodo',
        required: false,
        source: process.env.TEMPORARY_STORAGE ? 'environment' : 'default',
        description: 'Temporary storage location for in-progress operations',
        example: '/tmp/waltodo'
      },

      // AI related configurations
      XAI_API_KEY: {
        name: 'XAI_API_KEY',
        value: process.env.XAI_API_KEY || '',
        required: false,
        source: process.env.XAI_API_KEY ? 'environment' : 'default',
        description: 'API key for XAI (Grok) services',
        example: 'xai_api_key_12345',
        sensitive: true
      },

      OPENAI_API_KEY: {
        name: 'OPENAI_API_KEY',
        value: process.env.OPENAI_API_KEY || '',
        required: false,
        source: process.env.OPENAI_API_KEY ? 'environment' : 'default',
        description: 'API key for OpenAI services',
        example: 'sk-openai123456789',
        sensitive: true
      },

      ANTHROPIC_API_KEY: {
        name: 'ANTHROPIC_API_KEY',
        value: process.env.ANTHROPIC_API_KEY || '',
        required: false,
        source: process.env.ANTHROPIC_API_KEY ? 'environment' : 'default',
        description: 'API key for Anthropic (Claude) services',
        example: 'sk-ant-api123456789',
        sensitive: true
      },

      OLLAMA_API_KEY: {
        name: 'OLLAMA_API_KEY',
        value: process.env.OLLAMA_API_KEY || '',
        required: false,
        source: process.env.OLLAMA_API_KEY ? 'environment' : 'default',
        description: 'API key for Ollama services',
        example: 'ollama_api_key_12345',
        sensitive: true
      },

      AI_DEFAULT_PROVIDER: {
        name: 'AI_DEFAULT_PROVIDER',
        value: process.env.AI_DEFAULT_PROVIDER || 'xai',
        required: false,
        source: process.env.AI_DEFAULT_PROVIDER ? 'environment' : 'default',
        description: 'Default AI provider for operations (xai, openai, anthropic)',
        example: 'xai',
        validationFn: (val) => ['xai', 'openai', 'anthropic', 'ollama'].includes(val.toString()),
        validationError: 'AI_DEFAULT_PROVIDER must be one of: xai, openai, anthropic, ollama'
      },

      AI_DEFAULT_MODEL: {
        name: 'AI_DEFAULT_MODEL',
        value: process.env.AI_DEFAULT_MODEL || 'grok-beta',
        required: false,
        source: process.env.AI_DEFAULT_MODEL ? 'environment' : 'default',
        description: 'Default AI model to use for AI operations',
        example: 'grok-beta'
      },

      AI_TEMPERATURE: {
        name: 'AI_TEMPERATURE',
        value: getNumberValue(process.env.AI_TEMPERATURE, 0.7),
        required: false,
        source: process.env.AI_TEMPERATURE ? 'environment' : 'default',
        description: 'Temperature parameter for AI model output randomness (0.0-1.0)',
        example: '0.7',
        validationFn: (val) => Number(val) >= 0 && Number(val) <= 1,
        validationError: 'AI_TEMPERATURE must be between 0.0 and 1.0'
      },

      AI_MAX_TOKENS: {
        name: 'AI_MAX_TOKENS',
        value: getNumberValue(process.env.AI_MAX_TOKENS, 2000),
        required: false,
        source: process.env.AI_MAX_TOKENS ? 'environment' : 'default',
        description: 'Maximum tokens to generate in AI responses',
        example: '2000',
        validationFn: (val) => Number(val) > 0,
        validationError: 'AI_MAX_TOKENS must be a positive number'
      },

      AI_CACHE_ENABLED: {
        name: 'AI_CACHE_ENABLED',
        value: getBooleanValue(process.env.AI_CACHE_ENABLED, true),
        required: false,
        source: process.env.AI_CACHE_ENABLED ? 'environment' : 'default',
        description: 'Enable caching of AI responses to reduce API calls',
        example: 'true'
      },

      AI_CACHE_TTL_MS: {
        name: 'AI_CACHE_TTL_MS',
        value: getNumberValue(process.env.AI_CACHE_TTL_MS, 15 * 60 * 1000),
        required: false,
        source: process.env.AI_CACHE_TTL_MS ? 'environment' : 'default',
        description: 'Time-to-live for cached AI responses in milliseconds',
        example: '900000', // 15 minutes
        validationFn: (val) => Number(val) > 0,
        validationError: 'AI_CACHE_TTL_MS must be a positive number'
      },

      // Credential security
      CREDENTIAL_KEY_ITERATIONS: {
        name: 'CREDENTIAL_KEY_ITERATIONS',
        value: getNumberValue(process.env.CREDENTIAL_KEY_ITERATIONS, 100000),
        required: false,
        source: process.env.CREDENTIAL_KEY_ITERATIONS ? 'environment' : 'default',
        description: 'Number of iterations for PBKDF2 key derivation',
        example: '100000',
        validationFn: (val) => Number(val) >= 10000,
        validationError: 'CREDENTIAL_KEY_ITERATIONS must be at least 10000'
      },

      CREDENTIAL_AUTO_ROTATION_DAYS: {
        name: 'CREDENTIAL_AUTO_ROTATION_DAYS',
        value: getNumberValue(process.env.CREDENTIAL_AUTO_ROTATION_DAYS, 90),
        required: false,
        source: process.env.CREDENTIAL_AUTO_ROTATION_DAYS ? 'environment' : 'default',
        description: 'Days before credentials are auto-rotated',
        example: '90',
        validationFn: (val) => Number(val) > 0,
        validationError: 'CREDENTIAL_AUTO_ROTATION_DAYS must be a positive number'
      },

      CREDENTIAL_ROTATION_WARNING_DAYS: {
        name: 'CREDENTIAL_ROTATION_WARNING_DAYS',
        value: getNumberValue(process.env.CREDENTIAL_ROTATION_WARNING_DAYS, 75),
        required: false,
        source: process.env.CREDENTIAL_ROTATION_WARNING_DAYS ? 'environment' : 'default',
        description: 'Days before showing credential rotation warnings',
        example: '75',
        validationFn: (val) => Number(val) > 0,
        validationError: 'CREDENTIAL_ROTATION_WARNING_DAYS must be a positive number'
      },

      CREDENTIAL_MAX_FAILED_AUTH: {
        name: 'CREDENTIAL_MAX_FAILED_AUTH',
        value: getNumberValue(process.env.CREDENTIAL_MAX_FAILED_AUTH, 5),
        required: false,
        source: process.env.CREDENTIAL_MAX_FAILED_AUTH ? 'environment' : 'default',
        description: 'Maximum failed authentication attempts before temporary lockout',
        example: '5',
        validationFn: (val) => Number(val) > 0,
        validationError: 'CREDENTIAL_MAX_FAILED_AUTH must be a positive number'
      },

      // Advanced configurations
      WALLET_ADDRESS: {
        name: 'WALLET_ADDRESS',
        value: process.env.WALLET_ADDRESS || '',
        required: false,
        source: process.env.WALLET_ADDRESS ? 'environment' : 'default',
        description: 'Default wallet address for blockchain operations',
        example: '0x1234567890abcdef1234567890abcdef'
      },

      ENCRYPTED_STORAGE: {
        name: 'ENCRYPTED_STORAGE',
        value: getBooleanValue(process.env.ENCRYPTED_STORAGE, false),
        required: false,
        source: process.env.ENCRYPTED_STORAGE ? 'environment' : 'default',
        description: 'Enable encryption for local storage',
        example: 'false'
      },

      RETRY_ATTEMPTS: {
        name: 'RETRY_ATTEMPTS',
        value: getNumberValue(process.env.RETRY_ATTEMPTS, 3),
        required: false,
        source: process.env.RETRY_ATTEMPTS ? 'environment' : 'default',
        description: 'Number of retry attempts for failed operations',
        example: '3',
        validationFn: (val) => Number(val) >= 0,
        validationError: 'RETRY_ATTEMPTS must be a non-negative number'
      },

      RETRY_DELAY_MS: {
        name: 'RETRY_DELAY_MS',
        value: getNumberValue(process.env.RETRY_DELAY_MS, 1000),
        required: false,
        source: process.env.RETRY_DELAY_MS ? 'environment' : 'default',
        description: 'Delay between retry attempts in milliseconds',
        example: '1000',
        validationFn: (val) => Number(val) > 0,
        validationError: 'RETRY_DELAY_MS must be a positive number'
      },

      TIMEOUT_MS: {
        name: 'TIMEOUT_MS',
        value: getNumberValue(process.env.TIMEOUT_MS, 30000),
        required: false,
        source: process.env.TIMEOUT_MS ? 'environment' : 'default',
        description: 'Timeout for network operations in milliseconds',
        example: '30000',
        validationFn: (val) => Number(val) > 0,
        validationError: 'TIMEOUT_MS must be a positive number'
      },

      // Security configurations
      REQUIRE_SIGNATURE_VERIFICATION: {
        name: 'REQUIRE_SIGNATURE_VERIFICATION',
        value: getBooleanValue(process.env.REQUIRE_SIGNATURE_VERIFICATION, false),
        required: false,
        source: process.env.REQUIRE_SIGNATURE_VERIFICATION ? 'environment' : 'default',
        description: 'Require cryptographic signature verification for operations',
        example: 'false'
      },

      ENABLE_BLOCKCHAIN_VERIFICATION: {
        name: 'ENABLE_BLOCKCHAIN_VERIFICATION',
        value: getBooleanValue(process.env.ENABLE_BLOCKCHAIN_VERIFICATION, false),
        required: false,
        source: process.env.ENABLE_BLOCKCHAIN_VERIFICATION ? 'environment' : 'default',
        description: 'Enable blockchain verification for AI operations',
        example: 'false'
      },

      // Additional retry and connection configurations
      MAX_RETRY_DELAY_MS: {
        name: 'MAX_RETRY_DELAY_MS',
        value: getNumberValue(process.env.MAX_RETRY_DELAY_MS, 60000),
        required: false,
        source: process.env.MAX_RETRY_DELAY_MS ? 'environment' : 'default',
        description: 'Maximum delay between retries in milliseconds',
        example: '60000',
        validationFn: (val) => Number(val) > 0,
        validationError: 'MAX_RETRY_DELAY_MS must be a positive number'
      },

      MAX_RETRY_DURATION: {
        name: 'MAX_RETRY_DURATION',
        value: getNumberValue(process.env.MAX_RETRY_DURATION, 300000),
        required: false,
        source: process.env.MAX_RETRY_DURATION ? 'environment' : 'default',
        description: 'Maximum duration for retry attempts in milliseconds',
        example: '300000',
        validationFn: (val) => Number(val) > 0,
        validationError: 'MAX_RETRY_DURATION must be a positive number'
      },

      CONNECTION_TIMEOUT_MS: {
        name: 'CONNECTION_TIMEOUT_MS',
        value: getNumberValue(process.env.CONNECTION_TIMEOUT_MS, 30000),
        required: false,
        source: process.env.CONNECTION_TIMEOUT_MS ? 'environment' : 'default',
        description: 'Timeout for connection operations in milliseconds',
        example: '30000',
        validationFn: (val) => Number(val) > 0,
        validationError: 'CONNECTION_TIMEOUT_MS must be a positive number'
      },

      CONNECTION_KEEP_ALIVE: {
        name: 'CONNECTION_KEEP_ALIVE',
        value: getBooleanValue(process.env.CONNECTION_KEEP_ALIVE, false),
        required: false,
        source: process.env.CONNECTION_KEEP_ALIVE ? 'environment' : 'default',
        description: 'Enable keep-alive for connections',
        example: 'false'
      },

      CONNECTION_MAX_IDLE_TIME_MS: {
        name: 'CONNECTION_MAX_IDLE_TIME_MS',
        value: getNumberValue(process.env.CONNECTION_MAX_IDLE_TIME_MS, 60000),
        required: false,
        source: process.env.CONNECTION_MAX_IDLE_TIME_MS ? 'environment' : 'default',
        description: 'Maximum idle time for connections in milliseconds',
        example: '60000',
        validationFn: (val) => Number(val) > 0,
        validationError: 'CONNECTION_MAX_IDLE_TIME_MS must be a positive number'
      },

      CONNECTION_AUTO_RECONNECT: {
        name: 'CONNECTION_AUTO_RECONNECT',
        value: getBooleanValue(process.env.CONNECTION_AUTO_RECONNECT, true),
        required: false,
        source: process.env.CONNECTION_AUTO_RECONNECT ? 'environment' : 'default',
        description: 'Enable automatic reconnection',
        example: 'true'
      },

      CONNECTION_MAX_RETRIES: {
        name: 'CONNECTION_MAX_RETRIES',
        value: getNumberValue(process.env.CONNECTION_MAX_RETRIES, 3),
        required: false,
        source: process.env.CONNECTION_MAX_RETRIES ? 'environment' : 'default',
        description: 'Maximum connection retry attempts',
        example: '3',
        validationFn: (val) => Number(val) >= 0,
        validationError: 'CONNECTION_MAX_RETRIES must be a non-negative number'
      },

      CONNECTION_BASE_DELAY_MS: {
        name: 'CONNECTION_BASE_DELAY_MS',
        value: getNumberValue(process.env.CONNECTION_BASE_DELAY_MS, 1000),
        required: false,
        source: process.env.CONNECTION_BASE_DELAY_MS ? 'environment' : 'default',
        description: 'Base delay for connection retries in milliseconds',
        example: '1000',
        validationFn: (val) => Number(val) > 0,
        validationError: 'CONNECTION_BASE_DELAY_MS must be a positive number'
      },

      CONNECTION_MAX_DELAY_MS: {
        name: 'CONNECTION_MAX_DELAY_MS',
        value: getNumberValue(process.env.CONNECTION_MAX_DELAY_MS, 10000),
        required: false,
        source: process.env.CONNECTION_MAX_DELAY_MS ? 'environment' : 'default',
        description: 'Maximum delay for connection retries in milliseconds',
        example: '10000',
        validationFn: (val) => Number(val) > 0,
        validationError: 'CONNECTION_MAX_DELAY_MS must be a positive number'
      },

      WALRUS_TODO_CONFIG_DIR: {
        name: 'WALRUS_TODO_CONFIG_DIR',
        value: process.env.WALRUS_TODO_CONFIG_DIR || '',
        required: false,
        source: process.env.WALRUS_TODO_CONFIG_DIR ? 'environment' : 'default',
        description: 'Custom configuration directory for Walrus Todo',
        example: '/path/to/config'
      }
    };
  }
  
  /**
   * Get the singleton instance of the environment config manager
   */
  public static getInstance(): EnvironmentConfigManager {
    if (!EnvironmentConfigManager.instance) {
      EnvironmentConfigManager.instance = new EnvironmentConfigManager();
    }
    
    return EnvironmentConfigManager.instance;
  }
  
  /**
   * Get the environment configuration
   */
  public getConfig(): EnvironmentConfig {
    return this.config;
  }
  
  /**
   * Get all environment variables including extensions
   */
  public getAllVariables(): Record<string, EnvVariable<unknown>> {
    return {
      ...this.config,
      ...this.extensionVars
    };
  }

  /**
   * Get collected warnings about environment variables
   */
  public getWarnings(): string[] {
    return this.variableWarnings;
  }
  
  /**
   * Update a configuration value
   */
  public updateConfig<K extends keyof EnvironmentConfig>(
    key: K, 
    value: EnvironmentConfig[K]['value'],
    source: 'environment' | 'config' | 'default' = 'config'
  ): void {
    this.config[key] = {
      ...this.config[key],
      value,
      source
    };
  }
  
  /**
   * Get a specific configuration value
   */
  public get<K extends keyof EnvironmentConfig>(key: K): EnvironmentConfig[K]['value'] {
    return this.config[key].value;
  }

  /**
   * Get a custom extension configuration value
   */
  public getExtension<T>(key: string, defaultValue?: T): T | undefined {
    if (key in this.extensionVars) {
      return this.extensionVars[key].value as T;
    }
    return defaultValue;
  }
  
  /**
   * Check if a configuration exists
   */
  public has<K extends keyof EnvironmentConfig>(key: K): boolean {
    return this.config[key] !== undefined &&
           this.config[key].value !== undefined &&
           this.config[key].value !== null &&
           this.config[key].value !== '';
  }

  /**
   * Check if an extension configuration exists
   */
  public hasExtension(key: string): boolean {
    return this.extensionVars[key] !== undefined &&
           this.extensionVars[key].value !== undefined &&
           this.extensionVars[key].value !== null &&
           this.extensionVars[key].value !== '';
  }
  
  /**
   * Set required configuration fields
   */
  public setRequired(keys: Array<keyof EnvironmentConfig | string>): void {
    for (const key of keys) {
      if (key in this.config) {
        // Standard config key
        const configKey = key as keyof EnvironmentConfig;
        // Use type assertion to bypass TypeScript issues with never type
        (this.config[configKey] as EnvVariable<unknown>).required = true;
      } else if (key in this.extensionVars) {
        // Extension variable
        // Use type assertion to bypass TypeScript issues with never type
        (this.extensionVars[key] as EnvVariable<unknown>).required = true;
      }
    }
  }

  /**
   * Register an extension environment variable
   */
  public registerExtension<T>(
    key: string,
    defaultValue: T,
    options: {
      required?: boolean;
      description?: string;
      example?: string;
      validationFn?: (value: T) => boolean;
      validationError?: string;
      sensitive?: boolean;
      deprecated?: boolean;
      deprecated_message?: string;
    } = {}
  ): void {
    // Check for conflicts with core variables
    if (key in this.config) {
      this.variableWarnings.push(
        `Extension variable ${key} conflicts with a core environment variable`
      );
      return;
    }

    // Check if already registered
    if (key in this.extensionVars) {
      this.variableWarnings.push(
        `Extension variable ${key} is already registered`
      );
      return;
    }

    // Get the environment value if it exists
    let value: unknown = process.env[key] !== undefined ? process.env[key] : defaultValue;
    const source: 'environment' | 'default' = process.env[key] !== undefined ? 'environment' : 'default';

    // Convert to the right type based on the defaultValue
    if (typeof defaultValue === 'boolean') {
      value = getBooleanValue(process.env[key], defaultValue as boolean);
    } else if (typeof defaultValue === 'number') {
      value = getNumberValue(process.env[key], defaultValue as number);
    }

    // Register the extension variable
    this.extensionVars[key] = {
      name: key,
      value,
      required: options.required || false,
      source,
      description: options.description,
      example: options.example,
      validationFn: options.validationFn,
      validationError: options.validationError,
      sensitive: options.sensitive,
      deprecated: options.deprecated,
      deprecated_message: options.deprecated_message
    };
  }
  
  /**
   * Validate that all required configuration values exist and pass custom validation
   * @throws {CLIError} If validation fails
   */
  public validate(): void {
    // First validate core required variables
    validateRequiredEnvVars(this.config);

    // Then validate extension variables
    const missingExtVars: string[] = [];
    const invalidExtVars: string[] = [];

    for (const [key, config] of Object.entries(this.extensionVars)) {
      // Check if required variables are present
      if (config.required && (config.value === undefined || config.value === null || config.value === '')) {
        missingExtVars.push(key);
      }

      // Check against custom validation function
      if (config.validationFn && config.value !== undefined && config.value !== null && config.value !== '') {
        try {
          if (!config.validationFn(config.value)) {
            invalidExtVars.push(config.validationError || `${key} has an invalid value: ${config.value}`);
          }
        } catch (_error) {
          invalidExtVars.push(`${key} validation failed: ${_error instanceof Error ? _error.message : String(_error)}`);
        }
      }
    }

    // Handle missing extension variables
    if (missingExtVars.length > 0) {
      throw new CLIError(
        `Missing required extension environment variables: ${missingExtVars.join(', ')}`,
        'MISSING_EXT_ENV_VARS'
      );
    }

    // Handle invalid extension variables
    if (invalidExtVars.length > 0) {
      throw new CLIError(
        `Invalid extension environment variables: ${invalidExtVars.join(', ')}`,
        'INVALID_EXT_ENV_VARS'
      );
    }

    // Then validate using custom validation functions for core variables
    const invalidVars: string[] = [];
    const deprecatedVars: string[] = [];

    for (const [key, config] of Object.entries(this.config)) {
      // Check for value validation
      if (config.validationFn && config.value !== undefined && config.value !== null && config.value !== '') {
        try {
          if (!config.validationFn(config.value)) {
            invalidVars.push(config.validationError || `${key} has an invalid value: ${config.value}`);
          }
        } catch (_error) {
          invalidVars.push(`${key} validation failed: ${_error instanceof Error ? _error.message : String(_error)}`);
        }
      }

      // Check for deprecated variables
      if (config.deprecated && config.value !== undefined && config.value !== null && config.value !== '') {
        deprecatedVars.push(
          `${key} is deprecated${config.deprecated_message ? ': ' + config.deprecated_message : ''}`
        );
      }
    }

    // Check for deprecated extension variables
    for (const [key, config] of Object.entries(this.extensionVars)) {
      if (config.deprecated && config.value !== undefined && config.value !== null && config.value !== '') {
        deprecatedVars.push(
          `${key} is deprecated${config.deprecated_message ? ': ' + config.deprecated_message : ''}`
        );
      }
    }

    // Add any deprecation warnings
    if (deprecatedVars.length > 0) {
      this.variableWarnings.push(...deprecatedVars);
    }

    if (invalidVars.length > 0) {
      throw new CLIError(
        `Environment validation failed:\n${invalidVars.join('\n')}`,
        'ENV_VALIDATION_FAILED'
      );
    }
  }
  
  /**
   * Load configuration from environment variables
   */
  public loadFromEnvironment(): void {
    // Reload all environment variables
    for (const [key, config] of Object.entries(this.config)) {
      const envKey = key as keyof EnvironmentConfig;
      const envValue = process.env[key];
      
      if (envValue !== undefined) {
        let typedValue: unknown = envValue;
        
        // Convert the string value to the appropriate type based on the default value
        if (typeof config.value === 'boolean') {
          typedValue = getBooleanValue(envValue, config.value);
        } else if (typeof config.value === 'number') {
          typedValue = getNumberValue(envValue, config.value);
        }
        
        this.updateConfig(envKey, typedValue, 'environment');
      }
    }

    // Reload all extension variables
    for (const [key, config] of Object.entries(this.extensionVars)) {
      const envValue = process.env[key];
      
      if (envValue !== undefined) {
        let typedValue: unknown = envValue;
        
        // Convert the string value to the appropriate type based on the default value
        if (typeof config.value === 'boolean') {
          typedValue = getBooleanValue(envValue, config.value as boolean);
        } else if (typeof config.value === 'number') {
          typedValue = getNumberValue(envValue, config.value as number);
        }
        
        this.extensionVars[key] = {
          ...this.extensionVars[key],
          value: typedValue,
          source: 'environment'
        };
      }
    }
  }
  
  /**
   * Load configuration from a JSON object (e.g., from a config file)
   */
  public loadFromObject(obj: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(obj)) {
      // Check if it's a core config key
      if (key in this.config) {
        const configKey = key as keyof EnvironmentConfig;
        this.updateConfig(configKey, value, 'config');
      } 
      // Check if it's an extension variable
      else if (key in this.extensionVars) {
        this.extensionVars[key] = {
          ...this.extensionVars[key],
          value,
          source: 'config'
        };
      }
    }
  }
  
  /**
   * Get environment-specific configuration
   */
  public getEnvSpecificConfig(): Partial<EnvironmentConfig> {
    const env = this.get('NODE_ENV');
    const envSpecificConfig: Partial<EnvironmentConfig> = {};
    
    // Apply environment-specific overrides
    switch (env) {
      case Environment.PRODUCTION:
        // In production, stricter security measures
        this.updateConfig('REQUIRE_SIGNATURE_VERIFICATION', true, 'config');
        this.updateConfig('ENABLE_BLOCKCHAIN_VERIFICATION', true, 'config');
        this.updateConfig('LOG_LEVEL', 'info', 'config');
        break;
        
      case Environment.STAGING:
        // Staging often mirrors production but with slightly looser settings
        this.updateConfig('REQUIRE_SIGNATURE_VERIFICATION', true, 'config');
        this.updateConfig('LOG_LEVEL', 'info', 'config');
        break;
        
      case Environment.TESTING:
        // Testing environment - more verbose logging, less security
        this.updateConfig('LOG_LEVEL', 'debug', 'config');
        this.updateConfig('ENABLE_BLOCKCHAIN_VERIFICATION', false, 'config');
        break;
        
      case Environment.DEVELOPMENT:
      default:
        // Development environment - maximum debugging
        this.updateConfig('LOG_LEVEL', 'debug', 'config');
        this.updateConfig('ENABLE_BLOCKCHAIN_VERIFICATION', false, 'config');
        break;
    }
    
    return envSpecificConfig;
  }
  
  /**
   * Get all environment variables in a serializable format
   */
  public toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    
    // Add core variables
    for (const [key, config] of Object.entries(this.config)) {
      result[key] = config.value;
    }
    
    // Add extension variables
    for (const [key, config] of Object.entries(this.extensionVars)) {
      result[key] = config.value;
    }
    
    return result;
  }
  
  /**
   * Get metadata about environment variables (source, required status)
   */
  public getMetadata(): Record<string, { required: boolean; source: string; sensitive?: boolean; deprecated?: boolean }> {
    const result: Record<string, { required: boolean; source: string; sensitive?: boolean; deprecated?: boolean }> = {};
    
    // Add core variables
    for (const [key, config] of Object.entries(this.config)) {
      result[key] = {
        required: config.required,
        source: config.source,
        sensitive: config.sensitive,
        deprecated: config.deprecated
      };
    }
    
    // Add extension variables
    for (const [key, config] of Object.entries(this.extensionVars)) {
      result[key] = {
        required: config.required,
        source: config.source,
        sensitive: config.sensitive,
        deprecated: config.deprecated
      };
    }
    
    return result;
  }

  /**
   * Check environment consistency
   * Looks for inconsistencies like environment-specific configurations
   * that are overridden by other sources
   */
  public checkEnvironmentConsistency(): string[] {
    const inconsistencies: string[] = [];
    const env = this.get('NODE_ENV');
    
    // Environment-specific checks
    if (env === Environment.PRODUCTION) {
      // In production, verify security settings
      if (this.get('REQUIRE_SIGNATURE_VERIFICATION') === false) {
        const source = this.config.REQUIRE_SIGNATURE_VERIFICATION.source;
        inconsistencies.push(
          `REQUIRE_SIGNATURE_VERIFICATION should be true in production but is set to false from ${source}`
        );
      }
      
      if (this.get('ENABLE_BLOCKCHAIN_VERIFICATION') === false) {
        const source = this.config.ENABLE_BLOCKCHAIN_VERIFICATION.source;
        inconsistencies.push(
          `ENABLE_BLOCKCHAIN_VERIFICATION should be true in production but is set to false from ${source}`
        );
      }
    }
    
    // Check for sensitive values that might be exposed
    for (const [key, config] of Object.entries(this.getAllVariables())) {
      if (config.sensitive && config.value && config.source === 'config') {
        inconsistencies.push(
          `Sensitive value ${key} is stored in config file and should be moved to environment variables`
        );
      }
    }
    
    return inconsistencies;
  }
}

// Export singleton instance
export const envConfig = EnvironmentConfigManager.getInstance();

// Export utility functions
export const getEnv = <K extends keyof EnvironmentConfig>(key: K): EnvironmentConfig[K]['value'] => {
  return envConfig.get(key);
};

export const hasEnv = <K extends keyof EnvironmentConfig>(key: K): boolean => {
  return envConfig.has(key);
};

export const requireEnv = <K extends keyof EnvironmentConfig>(key: K): EnvironmentConfig[K]['value'] => {
  if (!envConfig.has(key)) {
    throw new CLIError(`Required environment variable ${key} is missing`, 'MISSING_ENV_VAR');
  }
  return envConfig.get(key);
};

/**
 * Register an extension environment variable
 */
export const registerEnvExtension = <T>(
  key: string,
  defaultValue: T,
  options: {
    required?: boolean;
    description?: string;
    example?: string;
    validationFn?: (value: T) => boolean;
    validationError?: string;
    sensitive?: boolean;
    deprecated?: boolean;
    deprecated_message?: string;
  } = {}
): T => {
  envConfig.registerExtension(key, defaultValue, options);
  return envConfig.getExtension<T>(key, defaultValue);
};

/**
 * Initialize the environment configuration
 */
export const initializeConfig = (): EnvironmentConfigManager => {
  // Load from environment first
  envConfig.loadFromEnvironment();
  
  // Apply environment-specific configurations
  envConfig.getEnvSpecificConfig();
  
  // Check for environment consistency issues
  const inconsistencies = envConfig.checkEnvironmentConsistency();
  if (inconsistencies.length > 0) {
    logger.warn('Environment configuration inconsistencies detected:');
    inconsistencies.forEach(issue => logger.warn(`- ${issue}`));
  }

  // Check for deprecated variables
  const warnings = envConfig.getWarnings();
  if (warnings.length > 0) {
    logger.warn('Environment configuration warnings:');
    warnings.forEach(warning => logger.warn(`- ${warning}`));
  }
  
  return envConfig;
};