/**
 * Environment Configuration Manager
 *
 * This module provides centralized management of environment variables
 * with validation, type checking, and fallback values.
 */
export declare enum Environment {
  DEVELOPMENT = 'development',
  TESTING = 'testing',
  STAGING = 'staging',
  PRODUCTION = 'production',
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
  sensitive?: boolean;
  deprecated?: boolean;
  deprecated_message?: string;
}
interface EnvironmentConfig {
  NODE_ENV: EnvVariable<Environment>;
  LOG_LEVEL: EnvVariable<string>;
  NETWORK: EnvVariable<string>;
  FULLNODE_URL: EnvVariable<string>;
  TODO_PACKAGE_ID: EnvVariable<string>;
  REGISTRY_ID: EnvVariable<string>;
  STORAGE_PATH: EnvVariable<string>;
  TEMPORARY_STORAGE: EnvVariable<string>;
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
  CREDENTIAL_KEY_ITERATIONS: EnvVariable<number>;
  CREDENTIAL_AUTO_ROTATION_DAYS: EnvVariable<number>;
  CREDENTIAL_ROTATION_WARNING_DAYS: EnvVariable<number>;
  CREDENTIAL_MAX_FAILED_AUTH: EnvVariable<number>;
  WALLET_ADDRESS: EnvVariable<string>;
  ENCRYPTED_STORAGE: EnvVariable<boolean>;
  RETRY_ATTEMPTS: EnvVariable<number>;
  RETRY_DELAY_MS: EnvVariable<number>;
  TIMEOUT_MS: EnvVariable<number>;
  REQUIRE_SIGNATURE_VERIFICATION: EnvVariable<boolean>;
  ENABLE_BLOCKCHAIN_VERIFICATION: EnvVariable<boolean>;
  MAX_RETRY_DELAY_MS: EnvVariable<number>;
  MAX_RETRY_DURATION: EnvVariable<number>;
  CONNECTION_TIMEOUT_MS: EnvVariable<number>;
  CONNECTION_KEEP_ALIVE: EnvVariable<boolean>;
  CONNECTION_MAX_IDLE_TIME_MS: EnvVariable<number>;
  CONNECTION_AUTO_RECONNECT: EnvVariable<boolean>;
  CONNECTION_MAX_RETRIES: EnvVariable<number>;
  CONNECTION_BASE_DELAY_MS: EnvVariable<number>;
  CONNECTION_MAX_DELAY_MS: EnvVariable<number>;
  WALRUS_TODO_CONFIG_DIR: EnvVariable<string>;
}
/**
 * Gets the current environment
 */
export declare function getEnvironment(): Environment;
/**
 * Validates that required environment variables are present
 * @throws {CLIError} If a required environment variable is missing
 */
export declare function validateRequiredEnvVars(
  config: EnvironmentConfig
): void;
export declare class EnvironmentConfigManager {
  private static instance;
  private config;
  private extensionVars;
  private variableWarnings;
  private constructor();
  /**
   * Get the singleton instance of the environment config manager
   */
  static getInstance(): EnvironmentConfigManager;
  /**
   * Get the environment configuration
   */
  getConfig(): EnvironmentConfig;
  /**
   * Get all environment variables including extensions
   */
  getAllVariables(): Record<string, EnvVariable<any>>;
  /**
   * Get collected warnings about environment variables
   */
  getWarnings(): string[];
  /**
   * Update a configuration value
   */
  updateConfig<K extends keyof EnvironmentConfig>(
    key: K,
    value: EnvironmentConfig[K]['value'],
    source?: 'environment' | 'config' | 'default'
  ): void;
  /**
   * Get a specific configuration value
   */
  get<K extends keyof EnvironmentConfig>(key: K): EnvironmentConfig[K]['value'];
  /**
   * Get a custom extension configuration value
   */
  getExtension<T>(key: string, defaultValue?: T): T | undefined;
  /**
   * Check if a configuration exists
   */
  has<K extends keyof EnvironmentConfig>(key: K): boolean;
  /**
   * Check if an extension configuration exists
   */
  hasExtension(key: string): boolean;
  /**
   * Set required configuration fields
   */
  setRequired(keys: Array<keyof EnvironmentConfig | string>): void;
  /**
   * Register an extension environment variable
   */
  registerExtension<T>(
    key: string,
    defaultValue: T,
    options?: {
      required?: boolean;
      description?: string;
      example?: string;
      validationFn?: (value: T) => boolean;
      validationError?: string;
      sensitive?: boolean;
      deprecated?: boolean;
      deprecated_message?: string;
    }
  ): void;
  /**
   * Validate that all required configuration values exist and pass custom validation
   * @throws {CLIError} If validation fails
   */
  validate(): void;
  /**
   * Load configuration from environment variables
   */
  loadFromEnvironment(): void;
  /**
   * Load configuration from a JSON object (e.g., from a config file)
   */
  loadFromObject(obj: Record<string, string | number | boolean>): void;
  /**
   * Get environment-specific configuration
   */
  getEnvSpecificConfig(): Partial<EnvironmentConfig>;
  /**
   * Get all environment variables in a serializable format
   */
  toJSON(): Record<string, string | number | boolean>;
  /**
   * Get metadata about environment variables (source, required status)
   */
  getMetadata(): Record<
    string,
    {
      required: boolean;
      source: string;
      sensitive?: boolean;
      deprecated?: boolean;
    }
  >;
  /**
   * Check environment consistency
   * Looks for inconsistencies like environment-specific configurations
   * that are overridden by other sources
   */
  checkEnvironmentConsistency(): string[];
}
export declare const envConfig: EnvironmentConfigManager;
export declare const getEnv: <K extends keyof EnvironmentConfig>(
  key: K
) => EnvironmentConfig[K]['value'];
export declare const hasEnv: <K extends keyof EnvironmentConfig>(
  key: K
) => boolean;
export declare const requireEnv: <K extends keyof EnvironmentConfig>(
  key: K
) => EnvironmentConfig[K]['value'];
/**
 * Register an extension environment variable
 */
export declare const registerEnvExtension: <T>(
  key: string,
  defaultValue: T,
  options?: {
    required?: boolean;
    description?: string;
    example?: string;
    validationFn?: (value: T) => boolean;
    validationError?: string;
    sensitive?: boolean;
    deprecated?: boolean;
    deprecated_message?: string;
  }
) => T;
/**
 * Initialize the environment configuration
 */
export declare const initializeConfig: () => EnvironmentConfigManager;
export {};
//# sourceMappingURL=environment-config.d.ts.map
