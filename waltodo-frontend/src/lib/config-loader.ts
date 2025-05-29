/**
 * Frontend Configuration Loader
 *
 * Loads configuration dynamically based on the current network environment.
 * This system allows the frontend to automatically use the correct contract addresses
 * and network settings that were generated during CLI deployment.
 */

import React, { useState, useEffect } from 'react';

// Simple hydration check hook
function useIsHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}

/**
 * Network configuration interface
 */
export interface NetworkConfig {
  name: string;
  url: string;
  faucetUrl?: string;
  explorerUrl: string;
}

/**
 * Walrus configuration interface
 */
export interface WalrusConfig {
  networkUrl: string;
  publisherUrl: string;
  aggregatorUrl: string;
  apiPrefix: string;
}

/**
 * Deployment configuration interface
 */
export interface DeploymentConfig {
  packageId: string;
  digest: string;
  timestamp: string;
  deployerAddress: string;
}

/**
 * Complete configuration interface
 */
export interface AppConfig {
  network: NetworkConfig;
  walrus: WalrusConfig;
  deployment: DeploymentConfig;
  contracts: {
    todoNft: {
      packageId: string;
      moduleName: string;
      structName: string;
    };
  };
  features: {
    aiEnabled: boolean;
    blockchainVerification: boolean;
    encryptedStorage: boolean;
  };
}

/**
 * Configuration cache to avoid repeated loading
 */
let cachedConfig: AppConfig | null = null;
let currentNetwork: string | null = null;

/**
 * Fallback configurations for when auto-generated configs are not available
 */
const FALLBACK_CONFIGS: Record<string, Partial<AppConfig>> = {
  testnet: {
    network: {
      name: 'testnet',
      url: 'https://fullnode.testnet.sui.io:443',
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
      packageId: '0x0', // Placeholder - should be replaced by deployment
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
  devnet: {
    network: {
      name: 'devnet',
      url: 'https://fullnode.devnet.sui.io:443',
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
  localnet: {
    network: {
      name: 'localnet',
      url: 'http://localhost:9000',
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
 * Gets the current network from environment variables
 * Uses consistent logic for both server and client to prevent hydration mismatches
 */
function getCurrentNetwork(): string {
  // Always use the same environment variable logic
  // NEXT_PUBLIC_ variables are available on both server and client
  return process.env.NEXT_PUBLIC_NETWORK || 'testnet';
}

/**
 * Load network configuration dynamically at runtime
 * This replaces build-time imports with runtime loading
 */
export async function loadNetworkConfig(network: string): Promise<AppConfig | null> {
  try {
    // Try to load the JSON configuration file from public directory
    const configResponse = await fetch(`/config/${network}.json`);
    if (configResponse.ok) {
      const config = await configResponse.json();
      console.log(`Loaded runtime configuration for ${network}`);
      return transformConfigFormat(config);
    }
  } catch (error) {
    console.warn(`Failed to load runtime config for ${network}:`, error);
  }

  return null;
}

/**
 * Transform config from CLI format to frontend format
 */
function transformConfigFormat(config: any): AppConfig {
  return {
    network: {
      name: config.network || 'testnet',
      url: config.rpcUrl || config.environment?.apiEndpoint || 'https://fullnode.testnet.sui.io:443',
      faucetUrl: config.faucetUrl,
      explorerUrl: config.explorerUrl || 'https://testnet.suiexplorer.com',
    },
    walrus: {
      networkUrl: config.walrus?.networkUrl || 'https://wal.testnet.sui.io',
      publisherUrl: config.walrus?.publisherUrl || 'https://publisher-testnet.walrus.space',
      aggregatorUrl: config.walrus?.aggregatorUrl || 'https://aggregator-testnet.walrus.space',
      apiPrefix: config.walrus?.apiPrefix || 'https://api-testnet.walrus.tech/1.0',
    },
    deployment: {
      packageId: config.deployment?.packageId || '0x0',
      digest: config.deployment?.transactionHash || 'unknown',
      timestamp: config.deployment?.timestamp || new Date().toISOString(),
      deployerAddress: config.deployment?.deployerAddress || '0x0',
    },
    contracts: {
      todoNft: {
        packageId: config.deployment?.packageId || '0x0',
        moduleName: 'todo_nft',
        structName: 'TodoNFT',
      },
    },
    features: {
      aiEnabled: config.features?.aiIntegration || false,
      blockchainVerification: config.features?.blockchainVerification || false,
      encryptedStorage: config.features?.encryptedStorage || false,
    },
  };
}

/**
 * Loads configuration from auto-generated files
 */
async function loadGeneratedConfig(network: string): Promise<AppConfig | null> {
  return loadNetworkConfig(network);
}

/**
 * Creates a complete configuration from fallback data
 */
function createFallbackConfig(network: string): AppConfig {
  const fallback = FALLBACK_CONFIGS[network];
  if (!fallback) {
    throw new Error(`No configuration available for network: ${network}`);
  }

  console.warn(
    `Using fallback configuration for ${network} - run 'waltodo deploy' to generate proper config`
  );

  return fallback as AppConfig;
}

/**
 * Loads the application configuration for the current network
 */
export async function loadAppConfig(): Promise<AppConfig> {
  const network = getCurrentNetwork();

  // Return cached config if network hasn't changed
  if (cachedConfig && currentNetwork === network) {
    return cachedConfig;
  }

  console.log(`Loading configuration for ${network} network`);

  // Try to load generated configuration first
  let config = await loadGeneratedConfig(network);

  // Fall back to default configuration if needed
  if (!config) {
    config = createFallbackConfig(network);
  }

  // Validate configuration
  if (!config.deployment.packageId || config.deployment.packageId === '0x0') {
    console.warn('Package ID not set - some blockchain features may not work');
  }

  // Cache the configuration
  cachedConfig = config;
  currentNetwork = network;

  return config;
}

/**
 * Gets the current network configuration synchronously (for client components)
 */
export function getNetworkName(): string {
  return getCurrentNetwork();
}

/**
 * Hook for React components to load configuration
 * Prevents hydration mismatches by ensuring client-only execution
 */
export function useAppConfig() {
  const [config, setConfig] = React.useState<AppConfig | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const hydrated = useIsHydrated();

  React.useEffect(() => {
    // Only load config after hydration is complete
    if (!hydrated) return;

    loadAppConfig()
      .then(setConfig)
      .catch(err => {
        setError(err.message);
        console.error('Failed to load app configuration:', err);
      })
      .finally(() => setLoading(false));
  }, [hydrated]);

  return { config, loading, error };
}

/**
 * Clears the configuration cache (useful for testing or network switching)
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
