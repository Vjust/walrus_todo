/**
 * SuiClient Compatibility Adapter
 * 
 * This module provides compatibility wrappers for SuiClient import changes
 * between different versions of @mysten/sui library.
 */

import { Logger } from '../Logger';
import { 
  SuiClient as SuiClientClass, 
  getFullnodeUrl as getFullnodeUrlFn 
} from '@mysten/sui.js/client';

const logger = new Logger('sui-client-compatibility');

// Export the actual SuiClient and utilities
export const SuiClient = SuiClientClass;
export const getFullnodeUrl = getFullnodeUrlFn;

// Type definitions for compatibility
export interface CompatibleSuiClientOptions {
  url?: string;
  transport?: unknown;
  headers?: Record<string, string>;
}

// Import and re-export types from the client module
import type {
  SuiTransactionBlockResponse,
  SuiObjectResponse,
  SuiObjectData,
  SuiMoveObject,
  PaginatedObjectsResponse
} from '@mysten/sui/client';

export type {
  SuiTransactionBlockResponse,
  SuiObjectResponse,
  SuiObjectData,
  SuiMoveObject,
  PaginatedObjectsResponse
};

// Helper function to create a SuiClient with compatibility handling
export function createCompatibleSuiClient(options?: CompatibleSuiClientOptions): SuiClientClass {
  try {
    return new SuiClient(options);
  } catch (error) {
    logger.error('Failed to create SuiClient:', error);
    throw new Error(`Failed to create SuiClient: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper function to check if SuiClient is available
export function isSuiClientAvailable(): boolean {
  return typeof SuiClient === 'function';
}

// Helper function to get a fallback URL for SuiClient
export function getCompatibleFullnodeUrl(network: 'mainnet' | 'testnet' | 'devnet' | 'localnet' = 'testnet'): string {
  const urls = {
    mainnet: 'https://fullnode.mainnet.sui.io:443',
    testnet: 'https://fullnode.testnet.sui.io:443',
    devnet: 'https://fullnode.devnet.sui.io:443',
    localnet: 'http://localhost:9000'
  };
  
  return urls[network] || urls.testnet;
}

// Re-export common types that might be needed
export type SuiClientType = SuiClientClass;
export type SuiClientConstructorType = typeof SuiClient;

// Default export for convenience
export default {
  SuiClient,
  createCompatibleSuiClient,
  isSuiClientAvailable,
  getCompatibleFullnodeUrl
};