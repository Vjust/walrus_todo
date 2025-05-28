/**
 * Runtime network configuration loader for WalTodo applications
 */

import type {
  AppConfig,
  NetworkConfigFile,
  ConfigLoaderOptions,
  ConfigLoadResult,
  NetworkName
} from './types.js';
import { ConfigLoadError, ConfigValidationError } from './types.js';
import { getFallbackConfig, isSupportedNetwork } from './fallbacks.js';

/**
 * Configuration cache to avoid repeated loading
 */
interface CacheEntry {
  config: AppConfig;
  timestamp: number;
  source: 'file' | 'fallback';
}

const configCache = new Map<string, CacheEntry>();

/**
 * Default configuration loader options
 */
const DEFAULT_OPTIONS: Required<ConfigLoaderOptions> = {
  configPath: '/config',
  enableCache: true,
  cacheTimeout: 5 * 60 * 1000, // 5 minutes
  fallbackToLocalnet: true
};

/**
 * Load network configuration at runtime
 * 
 * @param network - Network name (testnet, devnet, localnet, mainnet)
 * @param options - Configuration loader options
 * @returns Promise resolving to configuration load result
 */
export async function loadNetworkConfig(
  network: string,
  options: ConfigLoaderOptions = {}
): Promise<ConfigLoadResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const cacheKey = `${network}:${opts.configPath}`;

  // Check cache first
  if (opts.enableCache) {
    const cached = getCachedConfig(cacheKey, opts.cacheTimeout);
    if (cached) {
      return {
        config: cached.config,
        fromCache: true,
        isFallback: cached.source === 'fallback',
        source: 'cache'
      };
    }
  }

  try {
    // Try to load from file first
    const fileConfig = await loadConfigFromFile(network, opts.configPath);
    if (fileConfig) {
      const normalizedConfig = normalizeConfig(fileConfig);
      validateConfig(normalizedConfig);

      // Cache successful load
      if (opts.enableCache) {
        cacheConfig(cacheKey, normalizedConfig, 'file');
      }

      return {
        config: normalizedConfig,
        fromCache: false,
        isFallback: false,
        source: 'file'
      };
    }
  } catch (error) {
    console.warn(`Failed to load config file for ${network}:`, error);
  }

  // Fall back to default configuration
  if (opts.fallbackToLocalnet || isSupportedNetwork(network)) {
    const fallbackConfig = getFallbackConfig(network as NetworkName);
    
    // Cache fallback
    if (opts.enableCache) {
      cacheConfig(cacheKey, fallbackConfig, 'fallback');
    }

    console.warn(
      `Using fallback configuration for ${network}. ` +
      'Run CLI deployment to generate proper config.'
    );

    return {
      config: fallbackConfig,
      fromCache: false,
      isFallback: true,
      source: 'fallback'
    };
  }

  throw new ConfigLoadError(
    `No configuration available for network "${network}" and fallback is disabled`
  );
}

/**
 * Load configuration from JSON file
 */
async function loadConfigFromFile(
  network: string, 
  configPath: string
): Promise<NetworkConfigFile | null> {
  const configUrl = `${configPath}/${network}.json`;

  try {
    // Handle both browser and Node.js environments
    let response: Response;
    
    if (typeof fetch !== 'undefined') {
      // Browser or Node.js with fetch
      response = await fetch(configUrl);
    } else if (typeof window === 'undefined') {
      // Node.js without fetch - use dynamic import
      const { readFile } = await import('fs/promises');
      const { join } = await import('path');
      
      try {
        // Try relative to current working directory
        const configData = await readFile(join(process.cwd(), 'public', configPath, `${network}.json`), 'utf-8');
        return JSON.parse(configData);
      } catch {
        // Try relative to module location
        const configData = await readFile(join(__dirname, '..', '..', 'public', configPath, `${network}.json`), 'utf-8');
        return JSON.parse(configData);
      }
    } else {
      throw new Error('No fetch implementation available');
    }

    if (!response.ok) {
      if (response.status === 404) {
        return null; // File not found, use fallback
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const config = await response.json();
    return config;
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) {
      return null; // File not found
    }
    throw new ConfigLoadError(
      `Failed to load config from ${configUrl}`,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Normalize CLI config format to application config format
 */
function normalizeConfig(fileConfig: NetworkConfigFile): AppConfig {
  return {
    network: {
      name: fileConfig.network,
      url: fileConfig.rpcUrl,
      explorerUrl: getExplorerUrl(fileConfig.network),
      faucetUrl: getFaucetUrl(fileConfig.network)
    },
    walrus: {
      networkUrl: fileConfig.walrus.networkUrl || getDefaultWalrusNetworkUrl(fileConfig.network),
      publisherUrl: fileConfig.walrus.publisherUrl,
      aggregatorUrl: fileConfig.walrus.aggregatorUrl,
      apiPrefix: fileConfig.walrus.apiPrefix || getDefaultWalrusApiPrefix(fileConfig.network)
    },
    deployment: {
      packageId: fileConfig.deployment.packageId,
      upgradeCapId: fileConfig.deployment.upgradeCapId,
      deployerAddress: fileConfig.deployment.deployerAddress,
      timestamp: fileConfig.deployment.timestamp,
      gasUsed: fileConfig.deployment.gasUsed,
      transactionHash: fileConfig.deployment.transactionHash
    },
    contracts: {
      todoNft: {
        packageId: fileConfig.deployment.packageId,
        moduleName: 'todo_nft',
        structName: 'TodoNFT'
      }
    },
    features: {
      aiIntegration: fileConfig.features.aiIntegration,
      batchOperations: fileConfig.features.batchOperations,
      storageOptimization: fileConfig.features.storageOptimization,
      realTimeUpdates: fileConfig.features.realTimeUpdates,
      blockchainVerification: fileConfig.features.blockchainVerification,
      encryptedStorage: fileConfig.features.encryptedStorage
    },
    environment: fileConfig.environment
  };
}

/**
 * Validate configuration completeness
 */
function validateConfig(config: AppConfig): void {
  if (!config.network.name) {
    throw new ConfigValidationError('Network name is required', 'network.name');
  }

  if (!config.network.url) {
    throw new ConfigValidationError('Network RPC URL is required', 'network.url');
  }

  if (!config.walrus.publisherUrl) {
    throw new ConfigValidationError('Walrus publisher URL is required', 'walrus.publisherUrl');
  }

  if (!config.walrus.aggregatorUrl) {
    throw new ConfigValidationError('Walrus aggregator URL is required', 'walrus.aggregatorUrl');
  }

  if (!config.deployment.packageId || config.deployment.packageId === '0x0') {
    console.warn('Package ID not set - blockchain features may not work properly');
  }
}

/**
 * Get cached configuration if valid
 */
function getCachedConfig(cacheKey: string, cacheTimeout: number): CacheEntry | null {
  const cached = configCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  const now = Date.now();
  if (now - cached.timestamp > cacheTimeout) {
    configCache.delete(cacheKey);
    return null;
  }

  return cached;
}

/**
 * Cache configuration
 */
function cacheConfig(cacheKey: string, config: AppConfig, source: 'file' | 'fallback'): void {
  configCache.set(cacheKey, {
    config,
    timestamp: Date.now(),
    source
  });
}

/**
 * Clear configuration cache
 */
export function clearConfigCache(): void {
  configCache.clear();
}

/**
 * Get explorer URL for network
 */
function getExplorerUrl(network: string): string {
  switch (network) {
    case 'mainnet':
      return 'https://suivision.xyz';
    case 'testnet':
      return 'https://testnet.suivision.xyz';
    case 'devnet':
      return 'https://devnet.suivision.xyz';
    case 'localnet':
      return 'http://localhost:9001';
    default:
      return 'https://testnet.suivision.xyz';
  }
}

/**
 * Get faucet URL for network
 */
function getFaucetUrl(network: string): string | undefined {
  switch (network) {
    case 'testnet':
      return 'https://faucet.testnet.sui.io';
    case 'devnet':
      return 'https://faucet.devnet.sui.io';
    case 'localnet':
      return 'http://localhost:9123/gas';
    case 'mainnet':
      return undefined; // No faucet on mainnet
    default:
      return undefined;
  }
}

/**
 * Get default Walrus network URL
 */
function getDefaultWalrusNetworkUrl(network: string): string {
  switch (network) {
    case 'mainnet':
      return 'https://wal.mainnet.sui.io';
    case 'testnet':
      return 'https://wal.testnet.sui.io';
    case 'devnet':
      return 'https://wal.devnet.sui.io';
    case 'localnet':
      return 'http://localhost:31415';
    default:
      return 'https://wal.testnet.sui.io';
  }
}

/**
 * Get default Walrus API prefix
 */
function getDefaultWalrusApiPrefix(network: string): string {
  switch (network) {
    case 'mainnet':
      return 'https://api.walrus.space/v1';
    case 'testnet':
      return 'https://api.walrus-testnet.walrus.space/v1';
    case 'devnet':
      return 'https://api.walrus-devnet.walrus.space/v1';
    case 'localnet':
      return 'http://localhost:31418/v1';
    default:
      return 'https://api.walrus-testnet.walrus.space/v1';
  }
}