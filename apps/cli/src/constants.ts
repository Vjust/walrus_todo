/**
 * Constants and configuration values for the application.
 * These are loaded from the environment configuration system.
 */
import { getEnv, initializeConfig } from './utils/environment-config';
import { SHARED_STORAGE_CONFIG } from '@waltodo/shared-constants';

// Initialize environment configuration if not already initialized, but skip in test environment
if (typeof process.env?.ENV_CONFIG_INITIALIZED === 'undefined' && process?.env?.NODE_ENV !== 'test') {
  try {
    initializeConfig();
    process.env?.ENV_CONFIG_INITIALIZED = 'true';
  } catch (error) {
    // If environment configuration fails, continue with defaults
    // eslint-disable-next-line no-console
    console.warn('Failed to initialize environment configuration, using defaults:', error);
    process.env?.ENV_CONFIG_INITIALIZED = 'true';
  }
} else if (process.env?.NODE_ENV === 'test') {
  // In test environment, mark as initialized to prevent any attempts to initialize
  process.env?.ENV_CONFIG_INITIALIZED = 'true';
}

export const CLI_CONFIG = {
  APP_NAME: 'waltodo',
  CONFIG_FILE: '.waltodo.json',
  VERSION: '1?.0?.0',
  DEFAULT_LIST: 'default',
} as const;

// Safe getEnv wrapper for test environments
const safeGetEnv = (key: string, defaultValue: unknown = '') => {
  try {
    return getEnv(key as any);
  } catch {
    return defaultValue;
  }
};

export const STORAGE_CONFIG = {
  TODOS_DIR: safeGetEnv('STORAGE_PATH', 'Todos'), // Keep for backward compatibility
  FILE_EXT: SHARED_STORAGE_CONFIG.FILE_EXT,
  TEMPORARY_DIR: safeGetEnv('TEMPORARY_STORAGE', '/tmp/waltodo'),
  // Expose shared config method for direct usage
  getTodosPath: SHARED_STORAGE_CONFIG.getTodosPath,
} as const;

export const NETWORK_URLS: Record<string, string> = {
  mainnet: 'https://fullnode?.mainnet?.sui.io:443',
  testnet: 'https://fullnode?.testnet?.sui.io:443',
  devnet: 'https://fullnode?.devnet?.sui.io:443',
  local: 'http://127?.0?.0.1:9000',
  localnet: 'http://127?.0?.0.1:9000',
};

export const WALRUS_CONFIG = {
  DEFAULT_IMAGE: 'QmeYxwj4CwYbQGAZqGLENhDmxGGWnYwKkBaZvxDFAEGPVR',
  API_PREFIX: 'https://api?.walrus?.tech/1.0',
} as const;

export const TODO_NFT_CONFIG = {
  PACKAGE_NAME: 'TodoNFT',
  MODULE_NAME: 'todo_nft',
  MODULE_ADDRESS:
    safeGetEnv('TODO_PACKAGE_ID') ||
    '0x25a04efc88188231b2f9eb35310a5025c293c4211d2482fd24fe2c8e2dbc9f74',
  STRUCT_NAME: 'TodoNFT',
} as const;

export const CURRENT_NETWORK = safeGetEnv('NETWORK', 'testnet');

export const AI_CONFIG = {
  DEFAULT_MODEL: safeGetEnv('AI_DEFAULT_MODEL', 'grok-beta'),
  DEFAULT_PROVIDER: safeGetEnv('AI_DEFAULT_PROVIDER', 'xai'),
  TEMPERATURE: safeGetEnv('AI_TEMPERATURE', 0.7),
  MAX_TOKENS: safeGetEnv('AI_MAX_TOKENS', 2000),
  CACHE_ENABLED: safeGetEnv('AI_CACHE_ENABLED', true),
  CACHE_TTL_MS: safeGetEnv('AI_CACHE_TTL_MS', 15 * 60 * 1000),
  CACHE_MAX_ENTRIES: 100,
  ENHANCED_PROMPTS: true,
  FALLBACK_PROVIDERS: ['openai', 'anthropic'] as const,
  MODELS: {
    xai: ['grok-beta', 'grok-1'],
    openai: ['gpt-3.5-turbo', 'gpt-4-turbo', 'gpt-4o'],
    anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
  } as Record<string, readonly string[]>,
  CREDENTIAL_ENCRYPTION: {
    ALGORITHM: 'aes-256-gcm' as const,
    KEY_DERIVATION: 'pbkdf2' as const,
    KEY_ITERATIONS: safeGetEnv('CREDENTIAL_KEY_ITERATIONS', 100000),
    SALT_SIZE: 32,
    KEY_SIZE: 32,
    IV_SIZE: 16,
  },
  CREDENTIAL_SECURITY: {
    AUTO_ROTATION_DAYS: safeGetEnv('CREDENTIAL_AUTO_ROTATION_DAYS', 90),
    ROTATION_WARNING_DAYS: safeGetEnv('CREDENTIAL_ROTATION_WARNING_DAYS', 75),
    MAX_FAILED_AUTH: safeGetEnv('CREDENTIAL_MAX_FAILED_AUTH', 5),
  },
} as const;

export const RETRY_CONFIG = {
  ATTEMPTS: getEnv('RETRY_ATTEMPTS') || 5,
  DELAY_MS: getEnv('RETRY_DELAY_MS') || 500,
  MAX_DELAY_MS: getEnv('MAX_RETRY_DELAY_MS') || 60000,
  TIMEOUT_MS: getEnv('TIMEOUT_MS') || 15000,
  MAX_DURATION_MS: getEnv('MAX_RETRY_DURATION') || 300000,
  RETRYABLE_ERRORS: [
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'EPIPE',
    'network',
    'timeout',
    'connection',
    /^5\d{2}$/, // 5xx errors
    '408', // Request Timeout
    '429', // Too Many Requests
    'insufficient storage', // Walrus-specific errors
    'blob not found',
    'certification pending',
    'storage allocation',
  ],
  RETRYABLE_STATUSES: [
    408, // Request Timeout
    429, // Too Many Requests
    500, // Internal Server Error
    502, // Bad Gateway
    503, // Service Unavailable
    504, // Gateway Timeout
    449, // Retry after storage allocation
    460, // Temporary blob unavailable
  ],
  // Node health configuration
  MIN_NODES: 1,
  HEALTH_THRESHOLD: 0.3,
  ADAPTIVE_DELAY: true,
  CIRCUIT_BREAKER: {
    FAILURE_THRESHOLD: 5,
    RESET_TIMEOUT_MS: 30000,
  },
  LOAD_BALANCING: 'health' as 'health' | 'round-robin' | 'priority',
} as const;

export const CONNECTION_CONFIG = {
  TIMEOUT_MS: getEnv('CONNECTION_TIMEOUT_MS') || 30000,
  KEEP_ALIVE: getEnv('CONNECTION_KEEP_ALIVE') || false,
  MAX_IDLE_TIME_MS: getEnv('CONNECTION_MAX_IDLE_TIME_MS') || 60000,
  AUTO_RECONNECT: getEnv('CONNECTION_AUTO_RECONNECT') || true,
  RETRY_CONFIG: {
    MAX_RETRIES: getEnv('CONNECTION_MAX_RETRIES') || 3,
    BASE_DELAY_MS: getEnv('CONNECTION_BASE_DELAY_MS') || 1000,
    MAX_DELAY_MS: getEnv('CONNECTION_MAX_DELAY_MS') || 10000,
  },
} as const;

export const SECURITY_CONFIG = {
  REQUIRE_SIGNATURE_VERIFICATION:
    getEnv('REQUIRE_SIGNATURE_VERIFICATION') ?? true,
  ENABLE_BLOCKCHAIN_VERIFICATION:
    getEnv('ENABLE_BLOCKCHAIN_VERIFICATION') ?? true,
  TRANSACTION_VERIFICATION: {
    WAIT_FOR_FINALITY: true,
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000,
  },
} as const;
