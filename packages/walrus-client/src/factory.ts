/**
 * Factory functions for creating Walrus client instances
 */

import { WalrusClient } from './client/WalrusClient';
import { WalrusImageStorage } from './client/WalrusImageStorage';
import { WalrusTodoStorage } from './client/WalrusTodoStorage';
import { WalrusConfig } from './config/WalrusConfig';
import type { WalrusNetwork } from './types';

/**
 * Create a basic Walrus client
 */
export function createWalrusClient(
  networkOrConfig?: WalrusNetwork | WalrusConfig | Partial<WalrusConfig>
): WalrusClient {
  if (typeof networkOrConfig === 'string') {
    return new WalrusClient(WalrusConfig.forNetwork(networkOrConfig));
  }
  
  if (networkOrConfig instanceof WalrusConfig) {
    return new WalrusClient(networkOrConfig);
  }
  
  return new WalrusClient(new WalrusConfig(networkOrConfig));
}

/**
 * Create a Walrus image storage client
 */
export function createWalrusImageStorage(
  networkOrConfig?: WalrusNetwork | WalrusConfig | Partial<WalrusConfig>,
  options?: {
    maxSize?: number;
    supportedFormats?: string[];
  }
): WalrusImageStorage {
  if (typeof networkOrConfig === 'string') {
    return new WalrusImageStorage(WalrusConfig.forNetwork(networkOrConfig), options);
  }
  
  if (networkOrConfig instanceof WalrusConfig) {
    return new WalrusImageStorage(networkOrConfig, options);
  }
  
  return new WalrusImageStorage(new WalrusConfig(networkOrConfig), options);
}

/**
 * Create a Walrus todo storage client
 */
export function createWalrusTodoStorage(
  network: WalrusNetwork = 'testnet',
  options?: { useMockMode?: boolean }
): WalrusTodoStorage {
  return new WalrusTodoStorage(network, options);
}

/**
 * Auto-configure client from environment
 */
export function createWalrusClientFromEnv(): WalrusClient {
  return new WalrusClient(WalrusConfig.fromEnvironment());
}

/**
 * Create client with custom config URL
 */
export async function createWalrusClientFromUrl(configUrl: string): Promise<WalrusClient> {
  const config = await WalrusConfig.fromUrl(configUrl);
  return new WalrusClient(config);
}

/**
 * Create a mock client for testing
 */
export function createMockWalrusClient(network: WalrusNetwork = 'testnet'): WalrusClient {
  return new WalrusClient({ network, useMockMode: true });
}

/**
 * Create a mock todo storage for testing
 */
export function createMockWalrusTodoStorage(network: WalrusNetwork = 'testnet'): WalrusTodoStorage {
  return new WalrusTodoStorage(network, { useMockMode: true });
}

/**
 * Create client for specific network with sensible defaults
 */
export function createTestnetClient(): WalrusClient {
  return createWalrusClient('testnet');
}

export function createMainnetClient(): WalrusClient {
  return createWalrusClient('mainnet');
}

export function createLocalClient(): WalrusClient {
  return createWalrusClient('localnet');
}

/**
 * Create clients with config-loader integration
 */
export async function createWalrusClientWithDynamicConfig(
  network: WalrusNetwork = 'testnet'
): Promise<WalrusClient> {
  try {
    // Try to import config-loader if available
    const { loadConfig } = await import('@waltodo/config-loader');
    const config = await loadConfig();
    
    return new WalrusClient({
      network: config?.walrus?.network || network,
      publisherUrl: config?.walrus?.publisherUrl,
      aggregatorUrl: config?.walrus?.aggregatorUrl,
    });
  } catch (error) {
    console.warn('Config loader not available, using default config:', error);
    return createWalrusClient(network);
  }
}