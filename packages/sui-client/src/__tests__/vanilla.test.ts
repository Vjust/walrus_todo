/**
 * Tests for vanilla Sui client
 */

import { VanillaSuiClient, createVanillaSuiClient } from '../vanilla';
import { SuiClientError, WalletNotConnectedError } from '../types';

// Mock the Sui client
jest.mock('@mysten/sui/client', () => ({
  SuiClient: jest.fn().mockImplementation(() => ({
    getOwnedObjects: jest.fn().mockResolvedValue({
      data: [
        {
          data: {
            objectId: '0xtest',
            content: {
              dataType: 'moveObject',
              fields: {
                title: 'Test Todo',
                description: 'Test Description',
                completed: false,
                image_url: 'https://example.com/image.jpg',
                owner: '0xowner',
                created_at: '1234567890',
                is_private: false,
              },
            },
          },
        },
      ],
      nextCursor: null,
      hasNextPage: false,
    }),
    getObject: jest.fn().mockResolvedValue({
      data: {
        objectId: '0xtest',
        content: {
          dataType: 'moveObject',
          fields: {
            title: 'Test Todo',
            description: 'Test Description',
            completed: false,
          },
        },
      },
    }),
    getTransactionBlock: jest.fn().mockResolvedValue({
      digest: 'test-digest',
      effects: { status: { status: 'success' } },
      timestampMs: 1234567890,
    }),
    signAndExecuteTransaction: jest.fn().mockResolvedValue({
      digest: 'test-digest',
      effects: { status: { status: 'success' } },
      events: [],
      objectChanges: [],
      balanceChanges: [],
    }),
  })),
  getFullnodeUrl: jest.fn((network: string) => `https://fullnode.${network}.sui.io:443`),
}));

// Mock bcs
jest.mock('@mysten/sui/bcs', () => ({
  bcs: {
    string: () => ({ serialize: jest.fn((val) => val) }),
    bool: () => ({ serialize: jest.fn((val) => val) }),
  },
}));

// Mock Transaction
jest.mock('@mysten/sui/transactions', () => ({
  Transaction: jest.fn().mockImplementation(() => ({
    setSender: jest.fn(),
    moveCall: jest.fn(),
    object: jest.fn(),
    pure: jest.fn(),
  })),
}));

// Mock Ed25519Keypair
jest.mock('@mysten/sui/keypairs/ed25519', () => ({
  Ed25519Keypair: {
    fromSecretKey: jest.fn().mockReturnValue({
      getPublicKey: () => ({
        toSuiAddress: () => '0x1234567890abcdef',
      }),
    }),
    generate: jest.fn(() => ({
      getPublicKey: () => ({
        toSuiAddress: () => '0x1234567890abcdef',
      }),
    })),
  },
}));

// Mock config loading
jest.mock('../config', () => ({
  loadAppConfig: jest.fn().mockResolvedValue({
    network: {
      name: 'testnet',
      url: 'https://fullnode.testnet.sui.io:443',
      explorerUrl: 'https://testnet.suiexplorer.com',
    },
    contracts: {
      todoNft: {
        packageId: '0xe8d420d723b6813d1e001d8cba0dfc8613cbc814dedb4adcd41909f2e11daa8b',
        moduleName: 'todo_nft',
        structName: 'TodoNFT',
      },
    },
    deployment: {
      packageId: '0xe8d420d723b6813d1e001d8cba0dfc8613cbc814dedb4adcd41909f2e11daa8b',
      deployerAddress: '0xdeployer',
      timestamp: '2024-01-01T00:00:00Z',
      digest: 'test-digest',
    },
    walrus: {
      networkUrl: 'https://wal.testnet.sui.io',
      publisherUrl: 'https://publisher-testnet.walrus.space',
      aggregatorUrl: 'https://aggregator-testnet.walrus.space',
      apiPrefix: 'https://api-testnet.walrus.tech/1.0',
    },
    features: {
      aiEnabled: true,
      blockchainVerification: false,
      encryptedStorage: false,
    },
  }),
}));

// Mock compatibility functions
jest.mock('../compatibility', () => ({
  createCompatibleSuiClientOptions: jest.fn((options) => options),
  normalizeTransactionResult: jest.fn((result) => result),
  normalizeOwnedObjectsResponse: jest.fn((response) => response),
  normalizeObjectResponse: jest.fn((response) => response),
  checkVersionCompatibility: jest.fn(),
}));

describe('VanillaSuiClient', () => {
  let client: VanillaSuiClient;

  beforeEach(() => {
    client = createVanillaSuiClient();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create a client instance', () => {
      expect(client).toBeInstanceOf(VanillaSuiClient);
    });

    it('should initialize with testnet by default', async () => {
      await client.initialize();
      expect(client.getCurrentNetwork()).toBe('testnet');
    });

    it('should initialize with specified network', async () => {
      await client.initialize('devnet');
      expect(client.getCurrentNetwork()).toBe('devnet');
    });

    it('should throw error when getting client before initialization', () => {
      expect(() => client.getClient()).toThrow(SuiClientError);
    });

    it('should throw error when getting config before initialization', () => {
      expect(() => client.getConfig()).toThrow(SuiClientError);
    });
  });

  describe('after initialization', () => {
    beforeEach(async () => {
      await client.initialize('testnet');
    });

    it('should return client instance after initialization', () => {
      const suiClient = client.getClient();
      expect(suiClient).toBeDefined();
    });

    it('should return config after initialization', () => {
      const config = client.getConfig();
      expect(config).toBeDefined();
      expect(config.network.name).toBe('testnet');
    });

    it('should create TodoNFT transaction', () => {
      const params = {
        title: 'Test Todo',
        description: 'Test Description',
        imageUrl: 'https://example.com/image.jpg',
      };

      const tx = client.createTodoNFTTransaction(params, '0x123');
      expect(tx).toBeDefined();
    });

    it('should create update TodoNFT transaction', () => {
      const params = {
        objectId: '0xabc',
        title: 'Updated Todo',
      };

      const tx = client.updateTodoNFTTransaction(params, '0x123');
      expect(tx).toBeDefined();
    });

    it('should create complete TodoNFT transaction', () => {
      const tx = client.completeTodoNFTTransaction('0xabc', '0x123');
      expect(tx).toBeDefined();
    });

    it('should create delete TodoNFT transaction', () => {
      const tx = client.deleteTodoNFTTransaction('0xabc', '0x123');
      expect(tx).toBeDefined();
    });

    it('should get account information', async () => {
      const account = await client.getAccount('0x123');
      expect(account.address).toBe('0x123');
      expect(account.chains).toContain('sui:testnet');
    });

    it('should execute transaction with keypair', async () => {
      const mockKeypair = { getPublicKey: () => ({ toSuiAddress: () => '0x123' }) } as any;
      const mockTx = { setSender: jest.fn() } as any;
      
      const result = await client.executeTransaction(mockTx, mockKeypair);
      expect(result.digest).toBe('test-digest');
    });

    it('should get todos from blockchain', async () => {
      const todos = await client.getTodosFromBlockchain('0x123');
      expect(Array.isArray(todos)).toBe(true);
      
      // If todos exist, validate their structure
      todos.forEach(todo => {
        expect(todo).toHaveProperty('id');
        expect(todo).toHaveProperty('title');
        expect(todo).toHaveProperty('completed');
      });
    });

    it('should get todo by object ID', async () => {
      const todo = await client.getTodoByObjectId('0xtest');
      expect(todo).toBeTruthy();
      expect(todo?.id).toBe('0xtest');
      expect(todo?.title).toBe('Test Todo');
    });

    it('should get transaction status', async () => {
      const status = await client.getTransactionStatus('test-digest');
      expect(status.digest).toBe('test-digest');
      expect(status.status).toBe('success');
    });
  });

  describe('network switching', () => {
    beforeEach(async () => {
      await client.initialize('testnet');
    });

    it('should switch networks successfully', async () => {
      expect(client.getCurrentNetwork()).toBe('testnet');
      
      await client.switchNetwork('devnet');
      expect(client.getCurrentNetwork()).toBe('devnet');
    });
  });

  describe('createKeypairFromPrivateKey', () => {
    beforeEach(async () => {
      await client.initialize('testnet');
    });

    it('should create keypair from private key', () => {
      const privateKey = 'test-private-key';
      const keypair = client.createKeypairFromPrivateKey(privateKey);
      expect(keypair).toBeDefined();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await client.initialize('testnet');
    });

    it('should handle transaction errors', async () => {
      const mockKeypair = { getPublicKey: () => ({ toSuiAddress: () => '0x123' }) } as any;
      const mockTx = { setSender: jest.fn() } as any;
      
      // Mock transaction failure
      const mockClient = client.getClient();
      mockClient.signAndExecuteTransaction = jest.fn().mockResolvedValue({
        digest: 'test-digest',
        effects: { status: { status: 'failure', error: 'Insufficient gas' } },
      });
      
      await expect(client.executeTransaction(mockTx, mockKeypair))
        .rejects.toThrow('Transaction failed');
    });

    it('should handle network errors', async () => {
      const mockKeypair = { getPublicKey: () => ({ toSuiAddress: () => '0x123' }) } as any;
      const mockTx = { setSender: jest.fn() } as any;
      
      // Mock network error
      const mockClient = client.getClient();
      mockClient.signAndExecuteTransaction = jest.fn().mockRejectedValue(new Error('Network error'));
      
      await expect(client.executeTransaction(mockTx, mockKeypair))
        .rejects.toThrow('Failed to execute transaction');
    });
  });

  describe('data transformation', () => {
    beforeEach(async () => {
      await client.initialize('testnet');
    });

    it('should handle invalid object data', async () => {
      // Mock invalid object response
      const mockClient = client.getClient();
      mockClient.getOwnedObjects = jest.fn().mockResolvedValue({
        data: [
          {
            data: {
              content: { dataType: 'package' }, // Invalid type
            },
          },
          {
            data: {
              content: {
                dataType: 'moveObject',
                fields: null, // Invalid fields
              },
            },
          },
        ],
      });
      
      const todos = await client.getTodosFromBlockchain('0x123');
      expect(todos).toEqual([]);
    });
  });

  describe('factory function', () => {
    it('should create client instance with options', () => {
      const options = { rpcTimeout: 30000 };
      const client = createVanillaSuiClient(options);
      expect(client).toBeInstanceOf(VanillaSuiClient);
    });

    it('should create client instance without options', () => {
      const client = createVanillaSuiClient();
      expect(client).toBeInstanceOf(VanillaSuiClient);
    });
  });

  describe('Browser vs Node.js compatibility', () => {
    it('should work in Node.js environment', async () => {
      // This test runs in Node.js by default
      expect(typeof window).toBe('undefined');
      expect(typeof process).toBe('object');
      
      await client.initialize('testnet');
      expect(client.getCurrentNetwork()).toBe('testnet');
    });

    it('should handle missing browser APIs gracefully', () => {
      // Ensure client doesn't rely on browser-specific APIs
      expect(() => createVanillaSuiClient()).not.toThrow();
    });
  });

  describe('network configuration', () => {
    it('should support all network types', async () => {
      const networks: NetworkType[] = ['testnet', 'devnet', 'mainnet', 'localnet'];
      
      for (const network of networks) {
        await client.initialize(network);
        expect(client.getCurrentNetwork()).toBe(network);
      }
    });

    it('should reload configuration when switching networks', async () => {
      await client.initialize('testnet');
      expect(client.getCurrentNetwork()).toBe('testnet');
      
      await client.switchNetwork('devnet');
      expect(client.getCurrentNetwork()).toBe('devnet');
    });
    });
});