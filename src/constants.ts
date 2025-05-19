/**
 * Constants and configuration values for the application.
 * These are loaded from the environment configuration system.
 */
import { envConfig, getEnv, initializeConfig } from './utils/environment-config';

// Initialize environment configuration if not already initialized
if (typeof process.env.ENV_CONFIG_INITIALIZED === 'undefined') {
  initializeConfig();
  process.env.ENV_CONFIG_INITIALIZED = 'true';
}

export const CLI_CONFIG = {
  APP_NAME: 'waltodo',
  CONFIG_FILE: '.waltodo.json',
  VERSION: '1.0.0',
  DEFAULT_LIST: 'default'
} as const;

export const STORAGE_CONFIG = {
  TODOS_DIR: getEnv('STORAGE_PATH'),
  FILE_EXT: '.json',
  TEMPORARY_DIR: getEnv('TEMPORARY_STORAGE')
} as const;

export const NETWORK_URLS = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
  local: 'http://127.0.0.1:9000',
  localnet: 'http://127.0.0.1:9000'
} as const;

export const WALRUS_CONFIG = {
  DEFAULT_IMAGE: 'QmeYxwj4CwYbQGAZqGLENhDmxGGWnYwKkBaZvxDFAEGPVR',
  API_PREFIX: 'https://api.walrus.tech/1.0'
} as const;

export const TODO_NFT_CONFIG = {
  PACKAGE_NAME: 'TodoNFT',
  MODULE_NAME: 'todo_nft',
  MODULE_ADDRESS: getEnv('TODO_PACKAGE_ID') || '0x25a04efc88188231b2f9eb35310a5025c293c4211d2482fd24fe2c8e2dbc9f74',
  STRUCT_NAME: 'TodoNFT'
} as const;

export const CURRENT_NETWORK = getEnv('NETWORK');

export const AI_CONFIG = {
  DEFAULT_MODEL: getEnv('AI_DEFAULT_MODEL'),
  DEFAULT_PROVIDER: getEnv('AI_DEFAULT_PROVIDER'),
  TEMPERATURE: getEnv('AI_TEMPERATURE'),
  MAX_TOKENS: getEnv('AI_MAX_TOKENS'),
  CACHE_ENABLED: getEnv('AI_CACHE_ENABLED'),
  CACHE_TTL_MS: getEnv('AI_CACHE_TTL_MS'),
  CACHE_MAX_ENTRIES: 100,
  ENHANCED_PROMPTS: true,
  FALLBACK_PROVIDERS: ['openai', 'anthropic'] as const,
  MODELS: {
    xai: ['grok-beta', 'grok-1'],
    openai: ['gpt-3.5-turbo', 'gpt-4-turbo', 'gpt-4o'],
    anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku']
  },
  CREDENTIAL_ENCRYPTION: {
    ALGORITHM: 'aes-256-gcm',
    KEY_DERIVATION: 'pbkdf2',
    KEY_ITERATIONS: getEnv('CREDENTIAL_KEY_ITERATIONS'),
    SALT_SIZE: 32,
    KEY_SIZE: 32,
    IV_SIZE: 16
  },
  CREDENTIAL_SECURITY: {
    AUTO_ROTATION_DAYS: getEnv('CREDENTIAL_AUTO_ROTATION_DAYS'),
    ROTATION_WARNING_DAYS: getEnv('CREDENTIAL_ROTATION_WARNING_DAYS'),
    MAX_FAILED_AUTH: getEnv('CREDENTIAL_MAX_FAILED_AUTH')
  }
} as const;

export const RETRY_CONFIG = {
  ATTEMPTS: getEnv('RETRY_ATTEMPTS'),
  DELAY_MS: getEnv('RETRY_DELAY_MS'),
  TIMEOUT_MS: getEnv('TIMEOUT_MS')
} as const;

export const SECURITY_CONFIG = {
  REQUIRE_SIGNATURE_VERIFICATION: getEnv('REQUIRE_SIGNATURE_VERIFICATION') ?? true,
  ENABLE_BLOCKCHAIN_VERIFICATION: getEnv('ENABLE_BLOCKCHAIN_VERIFICATION') ?? true,
  TRANSACTION_VERIFICATION: {
    WAIT_FOR_FINALITY: true,
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000,
  }
} as const;
