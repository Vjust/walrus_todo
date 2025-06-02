/**
 * Auto-generated configuration for testnet network
 * Generated at: 2025-05-30T00:00:00.000Z
 * Package ID: 0x9a679ea2ab90d62abf6ffe20e52942222c858c3e4a87ad0cfeb8104877d5dd32
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
    packageId: '0xd84704c17fc870b8764832c535aa6b11f21a95cd6f5bb38a9b07d2cf42220c66',
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
    packageId: '0x9a679ea2ab90d62abf6ffe20e52942222c858c3e4a87ad0cfeb8104877d5dd32',
    digest: 'unknown',
    timestamp: '2025-05-30T00:00:00.000Z',
    deployerAddress: '0xca793690985183dc8e2180fd059d76f3b0644f5c2ecd3b01cdebe7d40b0cca39',
  },
  
  contracts: {
    todoNft: {
      packageId: '0x9a679ea2ab90d62abf6ffe20e52942222c858c3e4a87ad0cfeb8104877d5dd32',
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
