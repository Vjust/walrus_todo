/**
 * Auto-generated configuration index
 * Exports all network configurations
 */

import TESTNET_CONFIG from './testnet';

export type NetworkName = 'testnet';

export const NETWORK_CONFIGS = {
  testnet: TESTNET_CONFIG,
} as const;

export { TESTNET_CONFIG };

/**
 * Get configuration for a specific network
 */
export function getNetworkConfig(network: NetworkName) {
  const config = NETWORK_CONFIGS[network];
  if (!config) {
    throw new Error(`Configuration not found for network: ${network}`);
  }
  return config;
}

/**
 * Get current network configuration from environment
 * Safe for both SSR and client-side rendering
 */
export function getCurrentNetworkConfig() {
  // NEXT_PUBLIC_ variables are available on both server and client with same values
  const network = (process.env.NEXT_PUBLIC_NETWORK || 'testnet') as NetworkName;
  return getNetworkConfig(network);
}

/**
 * Get current network name safely
 */
export function getCurrentNetworkName(): NetworkName {
  return (process.env.NEXT_PUBLIC_NETWORK || 'testnet') as NetworkName;
}
