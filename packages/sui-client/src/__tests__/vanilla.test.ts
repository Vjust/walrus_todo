/**
 * Tests for vanilla Sui client
 */

import { VanillaSuiClient, createVanillaSuiClient } from '../vanilla';
import { SuiClientError, WalletNotConnectedError } from '../types';

// Mock the Sui client
jest.mock('@mysten/sui/client', () => ({
  SuiClient: jest.fn().mockImplementation(() => ({
    getOwnedObjects: jest.fn(),
    getObject: jest.fn(),
    getTransactionBlock: jest.fn(),
    signAndExecuteTransaction: jest.fn(),
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
    fromSecretKey: jest.fn(),
    generate: jest.fn(() => ({
      getPublicKey: () => ({
        toSuiAddress: () => '0x1234567890abcdef',
      }),
    })),
  },
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

  describe('factory function', () => {
    it('should create client instance with options', () => {
      const options = { rpcTimeout: 30000 };
      const client = createVanillaSuiClient(options);
      expect(client).toBeInstanceOf(VanillaSuiClient);
    });
  });
});