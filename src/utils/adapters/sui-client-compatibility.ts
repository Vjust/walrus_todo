/**
 * SuiClient Compatibility Adapter
 * 
 * This module provides compatibility wrappers for SuiClient import changes
 * between different versions of @mysten/sui library.
 */

import { Logger } from '../Logger';

const logger = new Logger('sui-client-compatibility');

// Export common utility functions
export { getFullnodeUrl } from '@mysten/sui/client';

// Try to import SuiClient from different possible locations
let SuiClientExport: any = null;
let SuiClientOptionsExport: any = null;

try {
  // Try newer import path first
  const clientModule = require('@mysten/sui/client');
  SuiClientExport = clientModule.SuiClient;
  SuiClientOptionsExport = clientModule.SuiClientOptions;
  logger.debug('Successfully imported SuiClient from @mysten/sui/client');
} catch (error) {
  logger.warn('Failed to import from @mysten/sui/client:', error);
  
  try {
    // Try older import path
    const suiModule = require('@mysten/sui');
    SuiClientExport = suiModule.SuiClient;
    SuiClientOptionsExport = suiModule.SuiClientOptions;
    logger.debug('Successfully imported SuiClient from @mysten/sui');
  } catch (fallbackError) {
    logger.error('Failed to import SuiClient from any location:', fallbackError);
    
    // Create a mock SuiClient for development/testing
    SuiClientExport = class MockSuiClient {
      constructor(options?: any) {
        logger.warn('Using MockSuiClient - SuiClient not available');
        this.options = options;
      }
      
      async getLatestSuiSystemState() {
        throw new Error('MockSuiClient: getLatestSuiSystemState not implemented');
      }
      
      async getObject(_params: any) {
        throw new Error('MockSuiClient: getObject not implemented');
      }
      
      async multiGetObjects(_params: any) {
        throw new Error('MockSuiClient: multiGetObjects not implemented');
      }
      
      async executeTransactionBlock(_params: any) {
        throw new Error('MockSuiClient: executeTransactionBlock not implemented');
      }
      
      async signAndExecuteTransaction(_params: any) {
        throw new Error('MockSuiClient: signAndExecuteTransaction not implemented');
      }
      
      async getBalance(_params: any) {
        throw new Error('MockSuiClient: getBalance not implemented');
      }
      
      async getAllBalances(_params: any) {
        throw new Error('MockSuiClient: getAllBalances not implemented');
      }
      
      async getCoins(_params: any) {
        throw new Error('MockSuiClient: getCoins not implemented');
      }
      
      async getAllCoins(_params: any) {
        throw new Error('MockSuiClient: getAllCoins not implemented');
      }
      
      async getTransactionBlock(_params: any) {
        throw new Error('MockSuiClient: getTransactionBlock not implemented');
      }
      
      async getRpcApiVersion() {
        return '1.0.0-mock';
      }
      
      async getCheckpoint(_params: any) {
        throw new Error('MockSuiClient: getCheckpoint not implemented');
      }
      
      async getChainIdentifier() {
        return 'mock-chain';
      }
      
      async dryRunTransactionBlock(_params: any) {
        throw new Error('MockSuiClient: dryRunTransactionBlock not implemented');
      }
    };
    
    SuiClientOptionsExport = {};
  }
}

// Export the compatible SuiClient
export const SuiClient = SuiClientExport;
export const SuiClientOptions = SuiClientOptionsExport;

// Type definitions for compatibility
export interface CompatibleSuiClientOptions {
  url?: string;
  transport?: any;
  headers?: Record<string, string>;
}

// Re-export types that are commonly needed
export type SuiTransactionBlockResponse = any;
export type SuiObjectResponse = any;
export type SuiObjectData = any;
export type SuiMoveObject = any;
export type PaginatedObjectsResponse = any;

// Try to export actual types if available
try {
  const clientTypes = require('@mysten/sui/client');
  if (clientTypes.SuiObjectResponse) {
    module.exports.SuiObjectResponse = clientTypes.SuiObjectResponse;
  }
  if (clientTypes.SuiMoveObject) {
    module.exports.SuiMoveObject = clientTypes.SuiMoveObject;
  }
  if (clientTypes.PaginatedObjectsResponse) {
    module.exports.PaginatedObjectsResponse = clientTypes.PaginatedObjectsResponse;
  }
} catch (error) {
  logger.warn('Could not import additional types from @mysten/sui/client:', error);
}

// Helper function to create a SuiClient with compatibility handling
export function createCompatibleSuiClient(options?: CompatibleSuiClientOptions): any {
  if (!SuiClientExport) {
    throw new Error('SuiClient is not available in this environment');
  }
  
  try {
    return new SuiClientExport(options);
  } catch (error) {
    logger.error('Failed to create SuiClient:', error);
    throw new Error(`Failed to create SuiClient: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper function to check if SuiClient is available
export function isSuiClientAvailable(): boolean {
  return SuiClientExport !== null && typeof SuiClientExport === 'function';
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
export type SuiClientType = typeof SuiClientExport;
export type SuiClientOptionsType = typeof SuiClientOptionsExport;

// Default export for convenience
export default {
  SuiClient: SuiClientExport,
  SuiClientOptions: SuiClientOptionsExport,
  createCompatibleSuiClient,
  isSuiClientAvailable,
  getCompatibleFullnodeUrl
};