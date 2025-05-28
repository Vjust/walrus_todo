/**
 * @waltodo/config-loader - Runtime network configuration loader
 * 
 * This package provides runtime loading of network configurations for WalTodo applications,
 * replacing build-time imports with dynamic loading from JSON files.
 */

// Main loader function
export { loadNetworkConfig, clearConfigCache } from './loader.js';

// Fallback configurations
export {
  LOCALNET_CONFIG,
  TESTNET_CONFIG,
  DEVNET_CONFIG,
  MAINNET_CONFIG,
  FALLBACK_CONFIGS,
  getFallbackConfig,
  isSupportedNetwork,
  getSupportedNetworks
} from './fallbacks.js';

// Type definitions
export type {
  NetworkConfig,
  WalrusConfig,
  DeploymentConfig,
  ContractsConfig,
  FeaturesConfig,
  EnvironmentConfig,
  NetworkConfigFile,
  AppConfig,
  ConfigLoaderOptions,
  ConfigLoadResult,
  NetworkName
} from './types.js';

// Error classes
export {
  ConfigValidationError,
  ConfigLoadError
} from './types.js';

/**
 * Convenience function to load configuration for current environment
 * 
 * @param network - Network name (defaults to NETWORK env var or 'localnet')
 * @param options - Configuration loader options
 */
export async function loadCurrentNetworkConfig(options?: import('./types.js').ConfigLoaderOptions) {
  const { loadNetworkConfig } = await import('./loader.js');
  // Get network from environment variables
  const network = getNetworkFromEnvironment();
  return loadNetworkConfig(network, options);
}

/**
 * Get network name from environment variables
 */
function getNetworkFromEnvironment(): string {
  // Browser environment
  if (typeof window !== 'undefined') {
    return (window as any).process?.env?.NEXT_PUBLIC_NETWORK || 
           (window as any).NEXT_PUBLIC_NETWORK || 
           'localnet';
  }
  
  // Node.js environment
  return process.env.NETWORK || 
         process.env.NEXT_PUBLIC_NETWORK || 
         process.env.SUI_NETWORK || 
         'localnet';
}

/**
 * Utility function to check if a configuration is complete (has deployment info)
 */
export function isConfigurationComplete(config: import('./types.js').AppConfig): boolean {
  return !!(
    config.deployment.packageId &&
    config.deployment.packageId !== '0x0000000000000000000000000000000000000000000000000000000000000000' &&
    config.deployment.packageId !== '0x0' &&
    config.deployment.deployerAddress &&
    config.deployment.deployerAddress !== '0x0000000000000000000000000000000000000000000000000000000000000000' &&
    config.deployment.deployerAddress !== '0x0'
  );
}

/**
 * Get explorer URL for a specific object or transaction
 */
export function getExplorerUrl(config: import('./types.js').AppConfig, objectId: string, type: 'object' | 'txn' = 'object'): string {
  const baseUrl = config.network.explorerUrl;
  const network = config.network.name;
  
  if (type === 'txn') {
    return `${baseUrl}/txblock/${objectId}?network=${network}`;
  }
  
  return `${baseUrl}/object/${objectId}?network=${network}`;
}

/**
 * Get faucet URL for the current network (if available)
 */
export function getFaucetUrl(config: import('./types.js').AppConfig): string | null {
  return config.network.faucetUrl || null;
}

/**
 * Check if the current network has a faucet available
 */
export function hasFaucet(config: import('./types.js').AppConfig): boolean {
  return !!config.network.faucetUrl;
}

/**
 * Get Walrus blob URL for reading
 */
export function getWalrusBlobUrl(config: import('./types.js').AppConfig, blobId: string): string {
  return `${config.walrus.aggregatorUrl}/v1/${blobId}`;
}

/**
 * Get Walrus publisher URL for uploading
 */
export function getWalrusPublisherUrl(config: import('./types.js').AppConfig): string {
  return `${config.walrus.publisherUrl}/v1/store`;
}