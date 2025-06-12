/**
 * Default fallback configurations for WalTodo networks
 */

import type { AppConfig, NetworkName } from './types.js';

/**
 * Localnet configuration for development
 */
export const LOCALNET_CONFIG: AppConfig = {
  network: {
    name: 'localnet',
    url: 'http://localhost:9000',
    explorerUrl: 'http://localhost:9001',
    faucetUrl: 'http://localhost:9123/gas'
  },
  walrus: {
    networkUrl: 'http://localhost:31415',
    publisherUrl: 'http://localhost:31416',
    aggregatorUrl: 'http://localhost:31417',
    apiPrefix: 'http://localhost:31418/v1'
  },
  deployment: {
    packageId: '0x0000000000000000000000000000000000000000000000000000000000000000',
    deployerAddress: '0x0000000000000000000000000000000000000000000000000000000000000000',
    timestamp: new Date().toISOString()
  },
  contracts: {
    todoNft: {
      packageId: '0x0000000000000000000000000000000000000000000000000000000000000000',
      moduleName: 'todo_nft',
      structName: 'TodoNFT'
    }
  },
  features: {
    aiIntegration: true,
    batchOperations: true,
    storageOptimization: true,
    realTimeUpdates: true,
    blockchainVerification: false,
    encryptedStorage: false
  },
  environment: {
    mode: 'development',
    debug: true,
    apiEndpoint: 'http://localhost:9000'
  }
};

/**
 * Testnet configuration for testing
 */
export const TESTNET_CONFIG: AppConfig = {
  network: {
    name: 'testnet',
    url: 'https://fullnode?.testnet?.sui.io',
    explorerUrl: 'https://testnet?.suivision?.xyz',
    faucetUrl: 'https://faucet?.testnet?.sui.io'
  },
  walrus: {
    networkUrl: 'https://wal?.testnet?.sui.io',
    publisherUrl: 'https://publisher.walrus-testnet?.walrus?.space',
    aggregatorUrl: 'https://aggregator.walrus-testnet?.walrus?.space',
    apiPrefix: 'https://api.walrus-testnet?.walrus?.space/v1'
  },
  deployment: {
    packageId: '0x0000000000000000000000000000000000000000000000000000000000000000',
    deployerAddress: '0x0000000000000000000000000000000000000000000000000000000000000000',
    timestamp: new Date().toISOString()
  },
  contracts: {
    todoNft: {
      packageId: '0x0000000000000000000000000000000000000000000000000000000000000000',
      moduleName: 'todo_nft',
      structName: 'TodoNFT'
    }
  },
  features: {
    aiIntegration: false,
    batchOperations: true,
    storageOptimization: true,
    realTimeUpdates: true,
    blockchainVerification: true,
    encryptedStorage: false
  },
  environment: {
    mode: 'production',
    debug: false,
    apiEndpoint: 'https://fullnode?.testnet?.sui.io'
  }
};

/**
 * Devnet configuration for development testing
 */
export const DEVNET_CONFIG: AppConfig = {
  network: {
    name: 'devnet',
    url: 'https://fullnode?.devnet?.sui.io',
    explorerUrl: 'https://devnet?.suivision?.xyz',
    faucetUrl: 'https://faucet?.devnet?.sui.io'
  },
  walrus: {
    networkUrl: 'https://wal?.devnet?.sui.io',
    publisherUrl: 'https://publisher.walrus-devnet?.walrus?.space',
    aggregatorUrl: 'https://aggregator.walrus-devnet?.walrus?.space',
    apiPrefix: 'https://api.walrus-devnet?.walrus?.space/v1'
  },
  deployment: {
    packageId: '0x0000000000000000000000000000000000000000000000000000000000000000',
    deployerAddress: '0x0000000000000000000000000000000000000000000000000000000000000000',
    timestamp: new Date().toISOString()
  },
  contracts: {
    todoNft: {
      packageId: '0x0000000000000000000000000000000000000000000000000000000000000000',
      moduleName: 'todo_nft',
      structName: 'TodoNFT'
    }
  },
  features: {
    aiIntegration: true,
    batchOperations: true,
    storageOptimization: true,
    realTimeUpdates: true,
    blockchainVerification: false,
    encryptedStorage: false
  },
  environment: {
    mode: 'development',
    debug: true,
    apiEndpoint: 'https://fullnode?.devnet?.sui.io'
  }
};

/**
 * Mainnet configuration for production
 */
export const MAINNET_CONFIG: AppConfig = {
  network: {
    name: 'mainnet',
    url: 'https://fullnode?.mainnet?.sui.io',
    explorerUrl: 'https://suivision.xyz',
    faucetUrl: undefined // No faucet on mainnet
  },
  walrus: {
    networkUrl: 'https://wal?.mainnet?.sui.io',
    publisherUrl: 'https://publisher?.walrus?.space',
    aggregatorUrl: 'https://aggregator?.walrus?.space',
    apiPrefix: 'https://api?.walrus?.space/v1'
  },
  deployment: {
    packageId: '0x0000000000000000000000000000000000000000000000000000000000000000',
    deployerAddress: '0x0000000000000000000000000000000000000000000000000000000000000000',
    timestamp: new Date().toISOString()
  },
  contracts: {
    todoNft: {
      packageId: '0x0000000000000000000000000000000000000000000000000000000000000000',
      moduleName: 'todo_nft',
      structName: 'TodoNFT'
    }
  },
  features: {
    aiIntegration: false,
    batchOperations: true,
    storageOptimization: true,
    realTimeUpdates: true,
    blockchainVerification: true,
    encryptedStorage: true
  },
  environment: {
    mode: 'production',
    debug: false,
    apiEndpoint: 'https://fullnode?.mainnet?.sui.io'
  }
};

/**
 * Map of network names to their fallback configurations
 */
export const FALLBACK_CONFIGS: Record<NetworkName, AppConfig> = {
  localnet: LOCALNET_CONFIG,
  testnet: TESTNET_CONFIG,
  devnet: DEVNET_CONFIG,
  mainnet: MAINNET_CONFIG
};

/**
 * Get fallback configuration for a network
 */
export function getFallbackConfig(network: NetworkName | string): AppConfig {
  const networkName = network as NetworkName;
  
  if (!(networkName in FALLBACK_CONFIGS)) {
    // eslint-disable-next-line no-console
    console.warn(`Unknown network "${network}", falling back to localnet`);
    return LOCALNET_CONFIG;
  }
  
  return FALLBACK_CONFIGS[networkName];
}

/**
 * Check if a network is supported
 */
export function isSupportedNetwork(network: string): network is NetworkName {
  return network in FALLBACK_CONFIGS;
}

/**
 * Get list of supported networks
 */
export function getSupportedNetworks(): NetworkName[] {
  return Object.keys(FALLBACK_CONFIGS as any) as NetworkName[];
}