/**
 * Configuration management for Sui client
 * Handles dynamic configuration loading for both browser and Node.js environments
 */

import { getFullnodeUrl } from '@mysten/sui/client';
import { AppConfig, NetworkConfig, NetworkType, NetworkError } from './types';

// Configuration cache
let cachedConfig: AppConfig | null = null;
let currentNetwork: string | null = null;

/**
 * Fallback network URLs
 */
const NETWORK_URLS: Record<NetworkType, string> = {
  mainnet: getFullnodeUrl('mainnet'),
  testnet: getFullnodeUrl('testnet'),
  devnet: getFullnodeUrl('devnet'),
  localnet: 'http://127.0.0.1:9000',
};

/**
 * Fallback configurations when auto-generated configs are not available
 */
const FALLBACK_CONFIGS: Record<string, Partial<AppConfig>> = {
  testnet: {
    network: {
      name: 'testnet',
      url: NETWORK_URLS.testnet,
      faucetUrl: 'https://faucet.testnet.sui.io',
      explorerUrl: 'https://testnet.suiexplorer.com',
    },
    walrus: {
      networkUrl: 'https://wal.testnet.sui.io',
      publisherUrl: 'https://publisher-testnet.walrus.space',
      aggregatorUrl: 'https://aggregator-testnet.walrus.space',
      apiPrefix: 'https://api-testnet.walrus.tech/1.0',
    },
    deployment: {
      packageId: '0xe8d420d723b6813d1e001d8cba0dfc8613cbc814dedb4adcd41909f2e11daa8b',
      digest: 'unknown',
      timestamp: new Date().toISOString(),
      deployerAddress: '0x0',
    },
    contracts: {
      todoNft: {
        packageId: '0xe8d420d723b6813d1e001d8cba0dfc8613cbc814dedb4adcd41909f2e11daa8b',
        moduleName: 'todo_nft',
        structName: 'TodoNFT',
      },
    },
    features: {
      aiEnabled: true,
      blockchainVerification: false,
      encryptedStorage: false,
    },
  },
  devnet: {
    network: {
      name: 'devnet',
      url: NETWORK_URLS.devnet,
      faucetUrl: 'https://faucet.devnet.sui.io',
      explorerUrl: 'https://devnet.suiexplorer.com',
    },
    walrus: {
      networkUrl: 'https://wal.devnet.sui.io',
      publisherUrl: 'https://publisher-devnet.walrus.space',
      aggregatorUrl: 'https://aggregator-devnet.walrus.space',
      apiPrefix: 'https://api-devnet.walrus.tech/1.0',
    },
    deployment: {
      packageId: '0x0',
      digest: 'unknown',
      timestamp: new Date().toISOString(),
      deployerAddress: '0x0',
    },
    contracts: {
      todoNft: {
        packageId: '0x0',
        moduleName: 'todo_nft',
        structName: 'TodoNFT',
      },
    },
    features: {
      aiEnabled: true,
      blockchainVerification: false,
      encryptedStorage: false,
    },
  },
  mainnet: {
    network: {
      name: 'mainnet',
      url: NETWORK_URLS.mainnet,
      explorerUrl: 'https://suiexplorer.com',
    },
    walrus: {
      networkUrl: 'https://wal.mainnet.sui.io',
      publisherUrl: 'https://publisher.walrus.space',
      aggregatorUrl: 'https://aggregator.walrus.space',
      apiPrefix: 'https://api.walrus.tech/1.0',
    },
    deployment: {
      packageId: '0x0',
      digest: 'unknown',
      timestamp: new Date().toISOString(),
      deployerAddress: '0x0',
    },
    contracts: {
      todoNft: {
        packageId: '0x0',
        moduleName: 'todo_nft',
        structName: 'TodoNFT',
      },
    },
    features: {
      aiEnabled: true,
      blockchainVerification: false,
      encryptedStorage: false,
    },
  },
  localnet: {
    network: {
      name: 'localnet',
      url: NETWORK_URLS.localnet,
      explorerUrl: 'http://localhost:9001',
    },
    walrus: {
      networkUrl: 'http://localhost:31415',
      publisherUrl: 'http://localhost:31416',
      aggregatorUrl: 'http://localhost:31417',
      apiPrefix: 'http://localhost:31418/1.0',
    },
    deployment: {
      packageId: '0x0',
      digest: 'unknown',
      timestamp: new Date().toISOString(),
      deployerAddress: '0x0',
    },
    contracts: {
      todoNft: {
        packageId: '0x0',
        moduleName: 'todo_nft',
        structName: 'TodoNFT',
      },
    },
    features: {
      aiEnabled: true,
      blockchainVerification: false,
      encryptedStorage: false,
    },
  },
};

/**
 * Detects the current environment (browser vs Node.js)
 */
function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Gets the current network from environment variables
 */
function getCurrentNetwork(): string {
  if (isBrowserEnvironment()) {
    // Browser environment - try to get from window object or default
    return (window as any)?.NEXT_PUBLIC_NETWORK || 
           process.env.NEXT_PUBLIC_NETWORK || 
           'testnet';
  } else {
    // Node.js environment
    return process.env.SUI_NETWORK || 
           process.env.NEXT_PUBLIC_NETWORK || 
           'testnet';
  }
}

/**
 * Loads configuration from auto-generated files (browser only)
 */
async function loadGeneratedConfig(network: string): Promise<AppConfig | null> {
  if (!isBrowserEnvironment()) {
    return null; // Skip in Node.js environment
  }

  try {
    const configResponse = await fetch(`/config/${network}.json`);
    if (configResponse.ok) {
      const config = await configResponse.json();
      console.log(`[SuiClient] Loaded generated configuration for ${network}`);
      return config as AppConfig;
    }
  } catch (error) {
    console.warn(`[SuiClient] Failed to load generated config for ${network}:`, error);
  }

  return null;
}

/**
 * Loads configuration from CLI config files (Node.js only)
 */
async function loadCliConfig(network: string): Promise<AppConfig | null> {
  if (isBrowserEnvironment()) {
    return null; // Skip in browser environment
  }

  try {
    // Try to load from different possible locations
    const configPaths = [
      `./config/${network}.json`,
      `../config/${network}.json`,
      `../../config/${network}.json`,
      `./.waltodo-cache/config/${network}.json`,
    ];

    // Use dynamic import for Node.js file system operations
    const { readFileSync, existsSync } = await import('fs');
    const { resolve } = await import('path');

    for (const configPath of configPaths) {
      const fullPath = resolve(configPath);
      if (existsSync(fullPath)) {
        const configData = readFileSync(fullPath, 'utf-8');
        const config = JSON.parse(configData);
        console.log(`[SuiClient] Loaded CLI configuration from ${fullPath}`);
        return config as AppConfig;
      }
    }
  } catch (error) {
    console.warn(`[SuiClient] Failed to load CLI config for ${network}:`, error);
  }

  return null;
}

/**
 * Creates a complete configuration from fallback data
 */
function createFallbackConfig(network: string): AppConfig {
  const fallback = FALLBACK_CONFIGS[network];
  if (!fallback) {
    throw new NetworkError(`No configuration available for network: ${network}`, network);
  }

  console.warn(
    `[SuiClient] Using fallback configuration for ${network} - run 'waltodo deploy' to generate proper config`
  );

  return fallback as AppConfig;
}

/**
 * Loads the application configuration for the current network
 */
export async function loadAppConfig(networkOverride?: string): Promise<AppConfig> {
  const network = networkOverride || getCurrentNetwork();

  // Return cached config if network hasn't changed
  if (cachedConfig && currentNetwork === network) {
    return cachedConfig;
  }

  console.log(`[SuiClient] Loading configuration for ${network} network`);

  // Try to load configuration based on environment
  let config: AppConfig | null = null;

  if (isBrowserEnvironment()) {
    config = await loadGeneratedConfig(network);
  } else {
    config = await loadCliConfig(network);
  }

  // Fall back to default configuration if needed
  if (!config) {
    config = createFallbackConfig(network);
  }

  // Validate configuration
  if (!config.deployment.packageId || config.deployment.packageId === '0x0') {
    console.warn('[SuiClient] Package ID not set - some blockchain features may not work');
  }

  // Cache the configuration
  cachedConfig = config;
  currentNetwork = network;

  return config;
}

/**
 * Gets network configuration for a specific network
 */
export function getNetworkConfig(network: NetworkType): NetworkConfig {
  const fallback = FALLBACK_CONFIGS[network];
  if (!fallback?.network) {
    throw new NetworkError(`Unknown network: ${network}`, network);
  }
  return fallback.network as NetworkConfig;
}

/**
 * Gets the current cached configuration (synchronous)
 */
export function getCachedConfig(): AppConfig | null {
  return cachedConfig;
}

/**
 * Gets the current network name
 */
export function getNetworkName(): string {
  return getCurrentNetwork();
}

/**
 * Clears the configuration cache
 */
export function clearConfigCache(): void {
  cachedConfig = null;
  currentNetwork = null;
}

/**
 * Validates that the configuration has required deployment information
 */
export function isConfigurationComplete(config: AppConfig): boolean {
  return !!(
    config.deployment.packageId &&
    config.deployment.packageId !== '0x0' &&
    config.deployment.deployerAddress &&
    config.deployment.deployerAddress !== '0x0'
  );
}

/**
 * Gets the explorer URL for a specific object
 */
export function getExplorerUrl(config: AppConfig, objectId: string): string {
  return `${config.network.explorerUrl}/object/${objectId}?network=${config.network.name}`;
}

/**
 * Gets the faucet URL for the current network (if available)
 */
export function getFaucetUrl(config: AppConfig): string | null {
  return config.network.faucetUrl || null;
}

/**
 * Gets the network URL for a specific network type
 */
export function getNetworkUrl(network: NetworkType): string {
  return NETWORK_URLS[network];
}