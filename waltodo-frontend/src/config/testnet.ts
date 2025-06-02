/**
 * Auto-generated configuration for testnet network
 * Generated at: 2025-05-30T00:00:00.000Z
 * Package ID: 0xe8d420d723b6813d1e001d8cba0dfc8613cbc814dedb4adcd41909f2e11daa8b
 */

export const TESTNET_CONFIG = {
  network: {
    name: 'testnet',
    url: 'https://fullnode.testnet.sui.io:443',
    faucetUrl: 'https://faucet.testnet.sui.io',
    explorerUrl: 'https://testnet.suiexplorer.com',
    websocketUrl: 'wss://fullnode.testnet.sui.io:443',
    fallbackUrls: [
      'https://sui-testnet-endpoint.blockvision.org/v1',
      'https://sui-testnet.publicnode.com',
      'https://testnet.sui.rpcpool.com',
    ],
    chainId: '4c78adac',
  },
  
  walrus: {
    networkUrl: 'https://wal.testnet.sui.io',
    publisherUrl: 'https://publisher-testnet.walrus.site',
    aggregatorUrl: 'https://aggregator-testnet.walrus.site',
    apiPrefix: 'https://api-testnet.walrus.tech/1.0',
    fallbackPublisherUrls: [
      'https://walrus-testnet-publisher.nodes.guru',
      'https://walrus-testnet-publisher.blockscope.net',
    ],
  },
  
  slushWallet: {
    enabled: true,
    autoConnect: true,
    features: [
      'transaction_signing',
      'account_management',
      'network_switching',
    ],
    supportedNetworks: ['testnet', 'devnet'],
    networkSwitchingEnabled: true,
  },
  
  deployment: {
    packageId: '0xe8d420d723b6813d1e001d8cba0dfc8613cbc814dedb4adcd41909f2e11daa8b',
    digest: 'unknown',
    timestamp: '2025-05-30T00:00:00.000Z',
    deployerAddress: '0xca793690985183dc8e2180fd059d76f3b0644f5c2ecd3b01cdebe7d40b0cca39',
  },
  
  contracts: {
    todoNft: {
      packageId: '0xe8d420d723b6813d1e001d8cba0dfc8613cbc814dedb4adcd41909f2e11daa8b',
      moduleName: 'todo_nft',
      structName: 'TodoNFT',
    },
  },
  
  features: {
    aiEnabled: true,
    blockchainVerification: true,
    encryptedStorage: false,
    networkSwitching: true,
    automaticRetry: true,
    fallbackEndpoints: true,
  },
  
  networkSwitching: {
    enabled: true,
    supportedNetworks: ['testnet', 'devnet'],
    autoDetectNetwork: true,
    confirmationRequired: true,
  },
  
  connectivity: {
    timeout: 10000,
    retryAttempts: 3,
    retryDelay: 1000,
    healthCheckInterval: 30000,
  },
} as const;

export default TESTNET_CONFIG;
