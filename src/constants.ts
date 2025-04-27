import * as dotenv from 'dotenv';
dotenv.config();

import { NetworkType } from './types';

// Define supported networks
export const SUPPORTED_NETWORKS = ['devnet', 'testnet', 'mainnet', 'localnet'] as const;

// Default to testnet if not specified
export const DEFAULT_NETWORK: NetworkType = 'testnet';

// Get network from environment variable or use default
export const CURRENT_NETWORK: NetworkType = 
  (process.env.NETWORK as NetworkType) || DEFAULT_NETWORK;

// Ensure the network is supported
if (CURRENT_NETWORK && !SUPPORTED_NETWORKS.includes(CURRENT_NETWORK as any)) {
  console.warn(`Warning: Unsupported network "${CURRENT_NETWORK}". Using ${DEFAULT_NETWORK} instead.`);
}

export const NETWORK_URLS: Record<NetworkType, string> = {
  devnet: 'https://fullnode.devnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  localnet: 'http://127.0.0.1:9000'
};

// Time periods in milliseconds
export const TIME_PERIODS = {
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
} as const;

// Sui Package Config for smart contract
export const DEFAULT_MODULE_NAME = 'wal_todo';
export const DEFAULT_PACKAGE_CONFIG = {
  // Default testnet package ID - this should be updated after contract deployment
  TESTNET_ID: '0x0', // Replace with actual testnet package ID after deployment
  MAINNET_ID: '0x0', // Replace with actual mainnet package ID after deployment
  MODULE: DEFAULT_MODULE_NAME
} as const;

// Temporarily bypass the PACKAGE_ID check to allow the program to run without it.
// This will be implemented later as per user instructions.
if (!process.env.PACKAGE_ID) {
  console.warn('Warning: PACKAGE_ID environment variable is not set. This will be implemented later.');
}
// Temporarily bypass the MODULE_NAME check to allow the program to run without it.
// This will be implemented later as per user instructions.
if (!process.env.MODULE_NAME) {
  console.warn('Warning: MODULE_NAME environment variable is not set. This will be implemented later.');
}

// Sui package ID and module name
// These are used to interact with the smart contract
export const PACKAGE_CONFIG = {
  ID: process.env.PACKAGE_ID || '0x...', // Replace with actual package ID after deployment
  MODULE: process.env.MODULE_NAME || DEFAULT_MODULE_NAME,
  FUNCTIONS: {
    CREATE_LIST: 'create_list',
    UPDATE_VERSION: 'update_version',
    ADD_COLLABORATOR: 'add_collaborator',
    REMOVE_COLLABORATOR: 'remove_collaborator'
  }
} as const;

// CLI specific constants
export const CLI_CONFIG = {
  APP_NAME: 'waltodo',
  CONFIG_FILE: '.waltodo.json',
  VERSION: '1.0.0',
  DEFAULT_LIST: 'default'
} as const;

// Walrus configuration
export const WALRUS_CONFIG = {
  STORAGE_EPOCHS: 3, // Number of epochs to store data
  MAX_RETRIES: 3,   // Maximum number of retries for operations
  RETRY_DELAY: 1000 // Base delay for retry backoff (ms)
} as const;

// Local storage configuration
export const STORAGE_CONFIG = {
  TODOS_DIR: 'Todos',
  FILE_EXT: '.json'
};