export const CLI_CONFIG = {
  APP_NAME: 'waltodo',
  CONFIG_FILE: '.waltodo.json',
  VERSION: '1.0.0',
  DEFAULT_LIST: 'default'
} as const;

export const STORAGE_CONFIG = {
  TODOS_DIR: 'Todos',
  FILE_EXT: '.json'
} as const;

export const NETWORK_URLS = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
  local: 'http://127.0.0.1:9000'
} as const;

export const WALRUS_CONFIG = {
  DEFAULT_IMAGE: 'QmeYxwj4CwYbQGAZqGLENhDmxGGWnYwKkBaZvxDFAEGPVR',
  API_PREFIX: 'https://api.walrus.tech/1.0'
} as const;

export const TODO_NFT_CONFIG = {
  PACKAGE_NAME: 'TodoNFT',
  MODULE_NAME: 'todo_nft',
  MODULE_ADDRESS: '0x25a04efc88188231b2f9eb35310a5025c293c4211d2482fd24fe2c8e2dbc9f74', // Deployed to testnet on 2025-05-03 with correct Walrus aggregator URL
  STRUCT_NAME: 'TodoNFT'
} as const;

export const CURRENT_NETWORK = 'testnet' as const;