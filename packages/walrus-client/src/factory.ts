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
  networkOrConfig?: WalrusNetwork | WalrusConfig | Partial<WalrusConfig>
): WalrusTodoStorage {
  if (typeof networkOrConfig === 'string') {
    return new WalrusTodoStorage(WalrusConfig.forNetwork(networkOrConfig));
  }
  
  if (networkOrConfig instanceof WalrusConfig) {
    return new WalrusTodoStorage(networkOrConfig);
  }
  
  return new WalrusTodoStorage(new WalrusConfig(networkOrConfig));
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
  const config = WalrusConfig.forNetwork(network);
  // In a real implementation, this would return a mock client
  // For now, return regular client with mock URLs
  config.update({
    publisherUrl: `http://localhost:31415`, // Mock URLs
    aggregatorUrl: `http://localhost:31416`,
  });
  return new WalrusClient(config);
}