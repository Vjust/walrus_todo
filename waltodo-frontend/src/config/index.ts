/**
 * Auto-generated configuration index
 * Exports all network configurations with enhanced network switching
 */

import TESTNET_CONFIG from './testnet';
import DEVNET_CONFIG from './devnet';

export type NetworkName = 'testnet' | 'devnet';

export const NETWORK_CONFIGS = {
  testnet: TESTNET_CONFIG,
  devnet: DEVNET_CONFIG,
} as const;

export { TESTNET_CONFIG, DEVNET_CONFIG };

// Network endpoint health check
export interface NetworkHealthStatus {
  network: NetworkName;
  healthy: boolean;
  latency?: number;
  lastChecked: number;
  error?: string;
}

// Enhanced network configuration type - use a union of actual configs
export type NetworkConfig = typeof TESTNET_CONFIG | typeof DEVNET_CONFIG;

// Network switching utilities
export const SUPPORTED_NETWORKS: NetworkName[] = ['testnet', 'devnet'];

/**
 * Get configuration for a specific network with validation
 */
export function getNetworkConfig(network: NetworkName): NetworkConfig {
  const config = NETWORK_CONFIGS[network];
  if (!config) {
    throw new Error(`Configuration not found for network: ${network}`);
  }
  return config;
}

/**
 * Get network configuration with fallback support
 */
export function getNetworkConfigWithFallback(network: NetworkName): NetworkConfig {
  try {
    return getNetworkConfig(network);
  } catch (error) {
    console.warn(`Failed to get config for ${network}, falling back to testnet:`, error);
    return TESTNET_CONFIG;
  }
}

/**
 * Check if a network is supported
 */
export function isNetworkSupported(network: string): network is NetworkName {
  return SUPPORTED_NETWORKS.includes(network as NetworkName);
}

/**
 * Get all available networks
 */
export function getAvailableNetworks(): NetworkName[] {
  return SUPPORTED_NETWORKS;
}

/**
 * Validate network endpoint
 */
export async function validateNetworkEndpoint(network: NetworkName): Promise<NetworkHealthStatus> {
  const config = getNetworkConfig(network);
  const startTime = Date.now();
  
  try {
    const response = await fetch(config.network.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sui_getChainIdentifier',
        params: [],
      }),
      signal: AbortSignal.timeout(config.connectivity.timeout),
    });
    
    const latency = Date.now() - startTime;
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      network,
      healthy: !!data.result,
      latency,
      lastChecked: Date.now(),
    };
  } catch (error) {
    return {
      network,
      healthy: false,
      lastChecked: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get current network configuration from environment
 * Safe for both SSR and client-side rendering with enhanced validation
 */
export function getCurrentNetworkConfig(): NetworkConfig {
  // NEXT_PUBLIC_ variables are available on both server and client with same values
  const envNetwork = process.env.NEXT_PUBLIC_NETWORK || 'testnet';
  const network = isNetworkSupported(envNetwork) ? envNetwork : 'testnet';
  
  if (envNetwork !== network) {
    console.warn(`Invalid network '${envNetwork}' in environment, falling back to '${network}'`);
  }
  
  return getNetworkConfig(network);
}

/**
 * Get current network name safely with validation
 */
export function getCurrentNetworkName(): NetworkName {
  const envNetwork = process.env.NEXT_PUBLIC_NETWORK || 'testnet';
  return isNetworkSupported(envNetwork) ? envNetwork : 'testnet';
}

/**
 * Switch network configuration (client-side only)
 */
export function switchNetworkConfig(newNetwork: NetworkName): NetworkConfig {
  if (typeof window === 'undefined') {
    throw new Error('Network switching is only available on the client side');
  }
  
  if (!isNetworkSupported(newNetwork)) {
    throw new Error(`Unsupported network: ${newNetwork}`);
  }
  
  // Store the selected network in localStorage for persistence
  try {
    localStorage.setItem('walrus-todo-network', newNetwork);
  } catch (error) {
    console.warn('Failed to persist network selection:', error);
  }
  
  return getNetworkConfig(newNetwork);
}

/**
 * Get persisted network from localStorage (client-side only)
 */
export function getPersistedNetwork(): NetworkName | null {
  if (typeof window === 'undefined') {
    return null;
  }
  
  try {
    const stored = localStorage.getItem('walrus-todo-network');
    return stored && isNetworkSupported(stored) ? stored : null;
  } catch (error) {
    console.warn('Failed to read persisted network:', error);
    return null;
  }
}

/**
 * Get effective network (persisted or environment or default)
 */
export function getEffectiveNetwork(): NetworkName {
  // Try persisted network first (client-side)
  const persisted = getPersistedNetwork();
  if (persisted) {
    return persisted;
  }
  
  // Fall back to environment or default
  return getCurrentNetworkName();
}

/**
 * Get effective network configuration
 */
export function getEffectiveNetworkConfig(): NetworkConfig {
  return getNetworkConfig(getEffectiveNetwork());
}
