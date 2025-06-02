/**
 * Devnet configuration for Walrus Todo application
 */

export interface DevnetConfig {
  network: {
    name: string;
    url: string;
    faucet?: string;
  };
  walrus: {
    publisherUrl: string;
    aggregatorUrl: string;
    storeEndpoint: string;
    epochs: number;
    maxBlobSize: number;
  };
  contracts: {
    packageId: string;
    upgradeCapId?: string;
    adminCapId?: string;
  };
  connectivity: {
    timeout: number;
    retries: number;
    backoff: number;
  };
  features: {
    enableWalrusStorage: boolean;
    enableNFTCreation: boolean;
    enableOfflineMode: boolean;
    enableAnalytics: boolean;
  };
  ui: {
    name: string;
    description: string;
    networkBadge: string;
    supportedWallets: string[];
  };
  slushWallet: {
    enabled: boolean;
    chainId: string;
    rpcUrl: string;
  };
  networkSwitching: {
    enabled: boolean;
    supportedNetworks: string[];
  };
}

const DEVNET_CONFIG: DevnetConfig = {
  network: {
    name: 'devnet',
    url: 'https://fullnode.devnet.sui.io:443',
    faucet: 'https://faucet.devnet.sui.io/gas'
  },
  walrus: {
    publisherUrl: 'https://publisher-devnet.walrus.space',
    aggregatorUrl: 'https://aggregator-devnet.walrus.space',
    storeEndpoint: 'https://walrus-testnet-api.nodes.guru',
    epochs: 5,
    maxBlobSize: 13 * 1024 * 1024 // 13MB max for devnet
  },
  contracts: {
    packageId: '0xf99aee9f21493e1590e7e5a9aea6f343a1f381031a04a732724871fc294be799', // Using testnet package as placeholder
    upgradeCapId: '0x456...', // Placeholder
    adminCapId: '0x789...' // Placeholder
  },
  connectivity: {
    timeout: 30000, // 30 seconds
    retries: 3,
    backoff: 1000 // 1 second base backoff
  },
  features: {
    enableWalrusStorage: true,
    enableNFTCreation: true,
    enableOfflineMode: true,
    enableAnalytics: false // Disabled in devnet for privacy
  },
  ui: {
    name: 'Walrus Todo (Devnet)',
    description: 'Decentralized Todo App on Sui Devnet with Walrus Storage',
    networkBadge: 'DEVNET',
    supportedWallets: [
      'Sui Wallet',
      'Suiet',
      'Ethos',
      'Glasseater',
      'OneKey'
    ]
  },
  slushWallet: {
    enabled: true,
    chainId: 'sui:devnet',
    rpcUrl: 'https://fullnode.devnet.sui.io:443'
  },
  networkSwitching: {
    enabled: true,
    supportedNetworks: ['devnet', 'testnet']
  }
};

export default DEVNET_CONFIG;