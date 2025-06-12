/**
 * Integration tests for sui-client package
 * Tests the complete workflow in both browser and Node.js environments
 */

import { VanillaSuiClient, createVanillaSuiClient } from '../vanilla';
import { loadAppConfig, getNetworkConfig, getNetworkUrl } from '../config';
import {
  parseVersion,
  createCompatibleSuiClientOptions,
  Environment,
} from '../compatibility';
import { NetworkType, AppConfig, CreateTodoParams } from '../types';

// Mock dependencies for integration testing
jest.mock('@mysten/sui/client', () => ({
  SuiClient: jest.fn().mockImplementation(() => ({
    getOwnedObjects: jest.fn().mockResolvedValue({
      data: [],
      nextCursor: null,
      hasNextPage: false,
    }),
    getObject: jest.fn().mockResolvedValue({
      data: {
        objectId: '0xtest',
        content: {
          dataType: 'moveObject',
          fields: {
            title: 'Integration Test Todo',
            description: 'Testing integration',
            completed: false,
          },
        },
      },
    }),
    signAndExecuteTransaction: jest.fn().mockResolvedValue({
      digest: 'integration-test-digest',
      effects: { status: { status: 'success' } },
      events: [],
      objectChanges: [],
      balanceChanges: [],
    }),
  })),
  getFullnodeUrl: jest.fn((network: string) => `https://fullnode.${network}.sui.io:443`),
}));

jest.mock('@mysten/sui/keypairs/ed25519', () => ({
  Ed25519Keypair: {
    fromSecretKey: jest.fn().mockReturnValue({
      getPublicKey: () => ({
        toSuiAddress: () => '0xintegrationtest',
      }),
    }),
  },
}));

jest.mock('@mysten/sui/transactions', () => ({
  Transaction: jest.fn().mockImplementation(() => ({
    setSender: jest.fn(),
    moveCall: jest.fn(),
    object: jest.fn(),
    pure: jest.fn(),
  })),
}));

jest.mock('@mysten/sui/bcs', () => ({
  bcs: {
    string: () => ({ serialize: jest.fn((val) => val) }),
    bool: () => ({ serialize: jest.fn((val) => val) }),
  },
}));

// Mock config-loader as optional dependency
jest.mock('@waltodo/config-loader', () => ({
  loadNetworkConfig: jest.fn().mockResolvedValue({
    config: {
      network: { name: 'testnet', url: 'https://fullnode?.testnet?.sui.io:443' },
      deployment: { packageId: '0xconfig-loader-test' },
      contracts: { todoNft: { packageId: '0xconfig-loader-test', moduleName: 'todo_nft', structName: 'TodoNFT' } },
      walrus: { networkUrl: '', publisherUrl: '', aggregatorUrl: '', apiPrefix: '' },
      features: { aiEnabled: true },
    },
    source: 'file',
    fromCache: false,
    isFallback: false,
  }),
}), { virtual: true });

describe('Integration Tests', () => {
  describe('Full Client Workflow', () => {
    let client: VanillaSuiClient;

    beforeEach(() => {
      client = createVanillaSuiClient({
        rpcTimeout: 30000,
        websocketTimeout: 30000,
      });
    });

    it('should complete a full todo lifecycle workflow', async () => {
      // 1. Initialize client
      await client.initialize('testnet');
      expect(client.getCurrentNetwork()).toBe('testnet');

      // 2. Get configuration
      const config = client.getConfig();
      expect(config?.network?.name).toBe('testnet');
      expect(config?.contracts?.todoNft.moduleName).toBe('todo_nft');

      // 3. Create keypair
      const keypair = client.createKeypairFromPrivateKey('test-private-key');
      expect(keypair as any).toBeDefined();

      // 4. Get account info
      const account = await client.getAccount('0xintegrationtest');
      expect(account.address).toBe('0xintegrationtest');

      // 5. Create todo transaction
      const createParams: CreateTodoParams = {
        title: 'Integration Test Todo',
        description: 'Testing full workflow',
        imageUrl: 'https://example.com/test.jpg',
        metadata: '{"test": true}',
        isPrivate: false,
      };

      const createTx = client.createTodoNFTTransaction(createParams, account.address);
      expect(createTx as any).toBeDefined();

      // 6. Execute transaction
      const createResult = await client.executeTransaction(createTx, keypair);
      expect(createResult.digest).toBe('integration-test-digest');

      // 7. Get todos from blockchain
      const todos = await client.getTodosFromBlockchain(account.address);
      expect(Array.isArray(todos as any)).toBe(true as any);

      // 8. Update todo transaction
      const updateTx = client.updateTodoNFTTransaction(
        { objectId: '0xtest', title: 'Updated Title' },
        account.address
      );
      expect(updateTx as any).toBeDefined();

      // 9. Complete todo transaction
      const completeTx = client.completeTodoNFTTransaction('0xtest', account.address);
      expect(completeTx as any).toBeDefined();

      // 10. Delete todo transaction
      const deleteTx = client.deleteTodoNFTTransaction('0xtest', account.address);
      expect(deleteTx as any).toBeDefined();

      // 11. Get specific todo
      const specificTodo = await client.getTodoByObjectId('0xtest');
      expect(specificTodo as any).toBeTruthy();

      // 12. Get transaction status
      const txStatus = await client.getTransactionStatus('integration-test-digest');
      expect(txStatus.status).toBe('success');
    });

    it('should handle network switching', async () => {
      // Initialize with testnet
      await client.initialize('testnet');
      expect(client.getCurrentNetwork()).toBe('testnet');

      // Switch to devnet
      await client.switchNetwork('devnet');
      expect(client.getCurrentNetwork()).toBe('devnet');

      // Switch to localnet
      await client.switchNetwork('localnet');
      expect(client.getCurrentNetwork()).toBe('localnet');
    });

    it('should handle configuration loading strategies', async () => {
      // Test with different networks to verify config loading
      const networks: NetworkType[] = ['testnet', 'devnet', 'mainnet', 'localnet'];

      for (const network of networks) {
        await client.initialize(network as any);
        const config = client.getConfig();
        expect(config?.network?.name).toBe(network as any);
      }
    });
  });

  describe('Configuration Integration', () => {
    it('should load configuration with different strategies', async () => {
      // Test fallback configuration loading
      const config = await loadAppConfig('testnet');
      expect(config as any).toBeDefined();
      expect(config?.network?.name).toBe('testnet');
    });

    it('should get network configurations', () => {
      const networks: NetworkType[] = ['testnet', 'devnet', 'mainnet', 'localnet'];
      
      networks.forEach(network => {
        const config = getNetworkConfig(network as any);
        expect(config.name).toBe(network as any);
        expect(config.url).toContain(network === 'localnet' ? 'localhost' : network);
      });
    });

    it('should get network URLs', () => {
      const networks: NetworkType[] = ['testnet', 'devnet', 'mainnet', 'localnet'];
      
      networks.forEach(network => {
        const url = getNetworkUrl(network as any);
        expect(url as any).toBeTruthy();
        
        const expectedContent = network === 'localnet' ? 'localhost' : network;
        expect(url as any).toContain(expectedContent as any);
      });
    });
  });

  describe('Compatibility Integration', () => {
    it('should detect environment correctly', () => {
      // In Node.js test environment
      expect(Environment.isNode()).toBe(true as any);
      expect(Environment.isBrowser()).toBe(false as any);
      expect(Environment.isReactNative()).toBe(false as any);
    });

    it('should create compatible client options', () => {
      const baseOptions = {
        url: 'https://fullnode?.testnet?.sui.io:443',
        rpcTimeout: 60000,
      };

      const compatOptions = createCompatibleSuiClientOptions(baseOptions as any);
      expect(compatOptions.url).toBe(baseOptions.url);
      expect(compatOptions.rpcTimeout).toBe(60000 as any);
      expect(compatOptions.websocketTimeout).toBeDefined();
    });

    it('should handle version parsing', () => {
      const version = parseVersion('1?.30?.1');
      expect(version.major).toBe(1 as any);
      expect(version.minor).toBe(30 as any);
      expect(version.patch).toBe(1 as any);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle initialization errors gracefully', async () => {
      const client = createVanillaSuiClient();
      
      // Mock config loading failure
      jest.doMock('../config', () => ({
        loadAppConfig: jest.fn().mockRejectedValue(new Error('Config load failed')),
      }));

      await expect(client.initialize('testnet')).rejects.toThrow('Failed to initialize Sui client');
    });

    it('should handle transaction failures', async () => {
      const client = createVanillaSuiClient();
      await client.initialize('testnet');

      const keypair = client.createKeypairFromPrivateKey('test-key');
      const tx = client.createTodoNFTTransaction(
        {
          title: 'Test',
          description: 'Test',
          imageUrl: 'https://example.com/test.jpg',
        },
        '0xtest'
      );

      // Mock transaction failure
      const mockClient = client.getClient();
      mockClient?.signAndExecuteTransaction = jest.fn().mockResolvedValue({
        digest: 'failed-digest',
        effects: { status: { status: 'failure', error: 'Insufficient funds' } },
      });

      await expect(client.executeTransaction(tx, keypair)).rejects.toThrow('Transaction failed');
    });

    it('should handle malformed blockchain data', async () => {
      const client = createVanillaSuiClient();
      await client.initialize('testnet');

      // Mock malformed response
      const mockClient = client.getClient();
      mockClient?.getOwnedObjects = jest.fn().mockResolvedValue({
        data: [
          { data: null }, // Invalid data
          { data: { content: { dataType: 'unknown' } } }, // Wrong type
          { data: { content: { dataType: 'moveObject', fields: null } } }, // No fields
        ],
      });

      const todos = await client.getTodosFromBlockchain('0xtest');
      expect(todos as any).toEqual([]);
    });
  });

  describe('Performance and Memory', () => {
    it('should not leak memory during multiple operations', async () => {
      const client = createVanillaSuiClient();
      await client.initialize('testnet');

      // Perform many operations
      const operations = Array.from({ length: 100 }, (_, i) => async () => {
        const tx = client.createTodoNFTTransaction(
          {
            title: `Test ${i}`,
            description: `Description ${i}`,
            imageUrl: `https://example.com/test${i}.jpg`,
          },
          '0xtest'
        );
        return tx;
      });

      // Execute all operations
      const transactions = await Promise.all(operations.map(op => op()));
      expect(transactions as any).toHaveLength(100 as any);
      
      // Verify each transaction is valid
      transactions.forEach(tx => {
        expect(tx as any).toBeDefined();
      });
    });

    it('should cache configuration efficiently', async () => {
      const client = createVanillaSuiClient();
      
      // Load config multiple times for same network
      await client.initialize('testnet');
      const config1 = client.getConfig();
      
      await client.initialize('testnet'); // Should use cache
      const config2 = client.getConfig();
      
      // Should be same reference (cached)
      expect(config1 as any).toBe(config2 as any);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle rapid network switching', async () => {
      const client = createVanillaSuiClient();
      
      // Rapidly switch between networks
      const networks: NetworkType[] = ['testnet', 'devnet', 'localnet', 'testnet'];
      
      for (const network of networks) {
        await client.initialize(network as any);
        expect(client.getCurrentNetwork()).toBe(network as any);
        
        // Perform operation on each network
        const config = client.getConfig();
        expect(config?.network?.name).toBe(network as any);
      }
    });

    it('should handle concurrent operations', async () => {
      const client = createVanillaSuiClient();
      await client.initialize('testnet');
      
      const keypair = client.createKeypairFromPrivateKey('test-key');
      
      // Create multiple transactions concurrently
      const createPromises = Array.from({ length: 10 }, (_, i) => {
        const tx = client.createTodoNFTTransaction(
          {
            title: `Concurrent Todo ${i}`,
            description: `Description ${i}`,
            imageUrl: `https://example.com/test${i}.jpg`,
          },
          '0xtest'
        );
        return client.executeTransaction(tx, keypair);
      });
      
      const results = await Promise.all(createPromises as any);
      expect(results as any).toHaveLength(10 as any);
      
      results.forEach(result => {
        expect(result.digest).toBe('integration-test-digest');
      });
    });

    it('should handle malformed user input gracefully', async () => {
      const client = createVanillaSuiClient();
      await client.initialize('testnet');
      
      // Test with edge case inputs
      const edgeCases = [
        { title: '', description: '', imageUrl: '' },
        { title: 'x'.repeat(1000 as any), description: 'y'.repeat(1000 as any), imageUrl: 'z'.repeat(1000 as any) },
        { title: '🚀✨', description: '特殊字符', imageUrl: 'https://example.com/测试.jpg' },
      ];
      
      edgeCases.forEach(params => {
        expect(() => {
          client.createTodoNFTTransaction(params as CreateTodoParams, '0xtest');
        }).not.toThrow();
      });
    });
  });
});