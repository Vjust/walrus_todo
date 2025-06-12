/**
 * Network configuration interfaces for WalTodo applications
 */

/**
 * Core network configuration
 */
export interface NetworkConfig {
  /** Network name (testnet, devnet, localnet, mainnet) */
  name: string;
  /** RPC endpoint URL */
  url: string;
  /** Optional faucet URL for testnet/devnet */
  faucetUrl?: string;
  /** Blockchain explorer URL */
  explorerUrl: string;
}

/**
 * Walrus storage configuration
 */
export interface WalrusConfig {
  /** Walrus network URL */
  networkUrl: string;
  /** Publisher service URL for uploading */
  publisherUrl: string;
  /** Aggregator service URL for reading */
  aggregatorUrl: string;
  /** API prefix for Walrus operations */
  apiPrefix: string;
}

/**
 * Smart contract deployment information
 */
export interface DeploymentConfig {
  /** Deployed package ID on Sui */
  packageId: string;
  /** Optional upgrade capability ID */
  upgradeCapId?: string;
  /** Address that deployed the contracts */
  deployerAddress: string;
  /** Deployment timestamp */
  timestamp: string;
  /** Gas used for deployment */
  gasUsed?: string;
  /** Transaction hash of deployment */
  transactionHash?: string;
}

/**
 * Contract-specific configuration
 */
export interface ContractsConfig {
  todoNft: {
    packageId: string;
    moduleName: string;
    structName: string;
  };
}

/**
 * Feature flags for the application
 */
export interface FeaturesConfig {
  /** AI integration enabled */
  aiIntegration: boolean;
  /** Batch operations support */
  batchOperations: boolean;
  /** Storage optimization features */
  storageOptimization: boolean;
  /** Real-time updates via WebSocket */
  realTimeUpdates: boolean;
  /** Blockchain verification for AI operations */
  blockchainVerification?: boolean;
  /** Encrypted storage support */
  encryptedStorage?: boolean;
}

/**
 * Environment-specific settings
 */
export interface EnvironmentConfig {
  // Index signature for type-safe string access
  [key: string]: unknown;
  
  /** Environment mode (development, production) */
  mode: 'development' | 'production';
  /** Debug mode flag */
  debug: boolean;
  /** API endpoint override */
  apiEndpoint?: string;
}

/**
 * Complete network configuration structure
 * This matches the CLI-generated config format
 */
export interface NetworkConfigFile {
  /** Network identifier */
  network: string;
  /** RPC URL */
  rpcUrl: string;
  /** Walrus configuration */
  walrus: {
    publisherUrl: string;
    aggregatorUrl: string;
    networkUrl?: string;
    apiPrefix?: string;
  };
  /** Deployment information */
  deployment: DeploymentConfig;
  /** Feature flags */
  features: FeaturesConfig;
  /** Environment settings */
  environment: EnvironmentConfig;
}

/**
 * Complete application configuration
 * This is the normalized format used by applications
 */
export interface AppConfig {
  /** Network configuration */
  network: NetworkConfig;
  /** Walrus storage configuration */
  walrus: WalrusConfig;
  /** Smart contract deployment info */
  deployment: DeploymentConfig;
  /** Contract addresses and info */
  contracts: ContractsConfig;
  /** Feature flags */
  features: FeaturesConfig;
  /** Environment settings */
  environment: EnvironmentConfig;
}

/**
 * Configuration loader options
 */
export interface ConfigLoaderOptions {
  /** Base path for config files (default: '/config') */
  configPath?: string;
  /** Enable caching (default: true) */
  enableCache?: boolean;
  /** Cache timeout in milliseconds (default: 5 minutes) */
  cacheTimeout?: number;
  /** Fallback to localnet if config not found (default: true) */
  fallbackToLocalnet?: boolean;
}

/**
 * Configuration loading result
 */
export interface ConfigLoadResult {
  /** The loaded configuration */
  config: AppConfig;
  /** Whether this came from cache */
  fromCache: boolean;
  /** Whether this is a fallback configuration */
  isFallback: boolean;
  /** Source of the configuration */
  source: 'file' | 'fallback' | 'cache';
}

/**
 * Network identifier type
 */
export type NetworkName = 'testnet' | 'devnet' | 'localnet' | 'mainnet';

/**
 * Configuration validation error
 */
export class ConfigValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message as any);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Configuration loading error
 */
export class ConfigLoadError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message as any);
    this.name = 'ConfigLoadError';
  }
}