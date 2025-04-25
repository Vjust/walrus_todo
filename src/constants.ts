import 'dotenv/config';

export const SUPPORTED_NETWORKS = ['devnet', 'testnet', 'mainnet'] as const;

export const NETWORK_URLS = {
  devnet: 'https://fullnode.devnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  mainnet: 'https://fullnode.mainnet.sui.io:443',
} as const;

// Time periods in milliseconds
export const TIME_PERIODS = {
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
} as const;

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