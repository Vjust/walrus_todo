import 'dotenv/config';
import { Network } from './types';

// Define supported networks
export const SUPPORTED_NETWORKS = ['testnet', 'mainnet'] as const;

// Default to testnet if not specified
export const DEFAULT_NETWORK: Network = 'testnet';

// Get network from environment variable or use default
export const CURRENT_NETWORK: Network = 
  (process.env.NETWORK as Network) || DEFAULT_NETWORK;

// Ensure the network is supported
if (CURRENT_NETWORK && !SUPPORTED_NETWORKS.includes(CURRENT_NETWORK as any)) {
  console.warn(`Warning: Unsupported network "${CURRENT_NETWORK}". Using ${DEFAULT_NETWORK} instead.`);
}

export const NETWORK_URLS = {
  testnet: process.env.SUI_RPC_URL || 'https://fullnode.testnet.sui.io:443',
  mainnet: 'https://fullnode.mainnet.sui.io:443',
} as const;

// Time periods in milliseconds
export const TIME_PERIODS = {
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
} as const;

// Sui Package Config for smart contract
// Ensure the package ID is set in the environment variables
if (!process.env.PACKAGE_ID) {
  throw new Error('PACKAGE_ID environment variable is not set. Please set it to the Sui package ID.');
}
// Ensure the module name is set in the environment variables
if (!process.env.MODULE_NAME) {
  throw new Error('MODULE_NAME environment variable is not set. Please set it to the Sui module name.');
}
// Sui package ID and module name
// These are used to interact with the smart contract

export const PACKAGE_CONFIG = {
  ID: process.env.PACKAGE_ID,
  MODULE: process.env.MODULE_NAME || 'todo_list'
} as const;

// CLI specific constants
export const CLI_CONFIG = {
  APP_NAME: 'waltodo',
  CONFIG_FILE: '.waltodo.json',
  VERSION: '1.0.0',
} as const;

// Walrus configuration
export const WALRUS_CONFIG = {
  STORAGE_URL: process.env.WALRUS_STORAGE_URL || 'https://api.walrus.testnet.site',
  NETWORK: CURRENT_NETWORK
} as const;