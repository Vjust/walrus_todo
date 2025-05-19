/**
 * Test suite for Sui testnet setup utilities
 */

import { jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { 
  SuiTestnetSetup, 
  setupTestnet, 
  quickSetup,
  restoreFromBackup,
  WalletSetupConfig,
  TestnetSetupResult
} from './sui-setup';

// Mock dependencies
jest.mock('fs');
jest.mock('axios');
jest.mock('child_process');
jest.mock('@mysten/sui/client');
jest.mock('@mysten/sui/keypairs/ed25519');

// Type the mocked modules
const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SuiTestnetSetup', () => {
  const mockWalletInfo = {
    address: '0x1234567890abcdef',
    publicKey: 'mock-public-key',
    privateKey: 'mock-private-key',
    keyScheme: 'ED25519',
    networkUrl: 'https://fullnode.testnet.sui.io:443',
    balance: '1000000000',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockedFs.existsSync.mockReturnValue(false);
    mockedFs.mkdirSync.mockReturnValue(undefined);
    mockedFs.writeFileSync.mockReturnValue(undefined);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(['mock-keystore-data']));
    mockedFs.copyFileSync.mockReturnValue(undefined);

    // Mock axios for faucet requests
    mockedAxios.post.mockResolvedValue({
      data: {
        transferredGasObjects: [{
          transferTxDigest: 'mock-tx-digest'
        }]
      }
    });
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const setup = new SuiTestnetSetup();
      expect(setup).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const config: WalletSetupConfig = {
        network: 'testnet',
        walletType: 'secp256k1',
        enableFaucet: false,
      };
      
      const setup = new SuiTestnetSetup(config);
      expect(setup).toBeDefined();
    });

    it('should throw error for invalid network', () => {
      expect(() => {
        new SuiTestnetSetup({ network: 'invalid' as any });
      }).toThrow('Invalid network');
    });
  });

  describe('setup', () => {
    let setup: SuiTestnetSetup;

    beforeEach(() => {
      setup = new SuiTestnetSetup();
      
      // Mock network check
      jest.spyOn(setup['client'], 'getLatestCheckpointSequenceNumber')
        .mockResolvedValue('12345' as any);
    });

    it('should complete full setup successfully', async () => {
      // Mock that keystore doesn't exist (new wallet)
      mockedFs.existsSync.mockImplementation((path) => {
        if (path.toString().includes('keystore')) return false;
        return true;
      });

      const result = await setup.setup();

      expect(result).toBeDefined();
      expect(result.wallet).toBeDefined();
      expect(result.keystorePath).toBeDefined();
      expect(result.configPath).toBeDefined();
    });

    it('should restore existing wallet if keystore exists', async () => {
      // Mock that keystore exists
      mockedFs.existsSync.mockImplementation((path) => {
        if (path.toString().includes('keystore')) return true;
        return false;
      });

      const result = await setup.setup();

      expect(result).toBeDefined();
      expect(mockedFs.readFileSync).toHaveBeenCalled();
    });

    it('should skip faucet if disabled', async () => {
      setup = new SuiTestnetSetup({ enableFaucet: false });
      
      const result = await setup.setup();

      expect(result.fundingTxDigest).toBeUndefined();
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });

  describe('wallet creation', () => {
    let setup: SuiTestnetSetup;

    beforeEach(() => {
      setup = new SuiTestnetSetup();
    });

    it('should create Ed25519 wallet by default', async () => {
      const wallet = await setup['createNewWallet']();

      expect(wallet).toBeDefined();
      expect(wallet.keyScheme).toBe('ED25519');
      expect(mockedFs.writeFileSync).toHaveBeenCalled();
    });

    it('should create Secp256k1 wallet when specified', async () => {
      setup = new SuiTestnetSetup({ walletType: 'secp256k1' });
      const wallet = await setup['createNewWallet']();

      expect(wallet).toBeDefined();
      expect(wallet.keyScheme).toBe('Secp256k1');
    });

    it('should save wallet to keystore', async () => {
      await setup['createNewWallet']();

      expect(mockedFs.mkdirSync).toHaveBeenCalled();
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('keystore'),
        expect.any(String)
      );
    });
  });

  describe('faucet funding', () => {
    let setup: SuiTestnetSetup;

    beforeEach(() => {
      setup = new SuiTestnetSetup();
    });

    it('should request funds from faucet', async () => {
      const txDigest = await setup['fundWalletFromFaucet']('0xtest-address');

      expect(txDigest).toBe('mock-tx-digest');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('faucet'),
        expect.objectContaining({
          FixedAmountRequest: expect.any(Object)
        }),
        expect.any(Object)
      );
    });

    it('should retry on faucet failure', async () => {
      mockedAxios.post
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          data: {
            transferredGasObjects: [{
              transferTxDigest: 'mock-tx-digest'
            }]
          }
        });

      const txDigest = await setup['fundWalletFromFaucet']('0xtest-address');

      expect(txDigest).toBe('mock-tx-digest');
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      await expect(
        setup['fundWalletFromFaucet']('0xtest-address')
      ).rejects.toThrow('Failed to fund wallet from faucet');
    });

    it('should throw error for non-testnet', async () => {
      setup = new SuiTestnetSetup({ network: 'mainnet' });

      await expect(
        setup['fundWalletFromFaucet']('0xtest-address')
      ).rejects.toThrow('Faucet is only available on testnet');
    });
  });

  describe('backup and restore', () => {
    let setup: SuiTestnetSetup;

    beforeEach(() => {
      setup = new SuiTestnetSetup();
    });

    it('should backup wallet successfully', async () => {
      const backupPath = await setup['backupWallet'](mockWalletInfo);

      expect(backupPath).toBeDefined();
      expect(mockedFs.mkdirSync).toHaveBeenCalled();
      expect(mockedFs.copyFileSync).toHaveBeenCalled();
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('wallet-info.json'),
        expect.any(String)
      );
    });

    it('should not save private key in wallet info', async () => {
      await setup['backupWallet'](mockWalletInfo);

      const writeCall = mockedFs.writeFileSync.mock.calls.find(
        call => call[0].toString().includes('wallet-info.json')
      );
      
      expect(writeCall).toBeDefined();
      const savedData = JSON.parse(writeCall![1] as string);
      expect(savedData.privateKey).toBe('[REDACTED]');
    });
  });

  describe('configuration', () => {
    let setup: SuiTestnetSetup;

    beforeEach(() => {
      setup = new SuiTestnetSetup();
    });

    it('should save wallet configuration', async () => {
      await setup['saveWalletConfiguration'](mockWalletInfo);

      // Should save client config
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('client'),
        expect.stringContaining('active_address')
      );

      // Should save .env file
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.env.testnet'),
        expect.stringContaining('WALLET_ADDRESS')
      );
    });
  });

  describe('static helpers', () => {
    it('should provide quick setup', async () => {
      // Mock the setup process
      jest.spyOn(SuiTestnetSetup.prototype, 'setup')
        .mockResolvedValue({
          wallet: mockWalletInfo,
          keystorePath: '/mock/keystore',
          configPath: '/mock/config',
        } as TestnetSetupResult);

      const result = await quickSetup();
      expect(result).toBeDefined();
      expect(result.wallet).toBeDefined();
    });

    it('should restore from backup', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      
      const wallet = await restoreFromBackup('/mock/backup');
      expect(wallet).toBeDefined();
      expect(mockedFs.copyFileSync).toHaveBeenCalled();
    });

    it('should check Sui CLI installation', () => {
      // Mock execSync to simulate CLI presence
      const childProcess = require('child_process');
      jest.spyOn(childProcess, 'execSync').mockReturnValue('sui version 1.0.0');

      const isInstalled = SuiTestnetSetup.checkSuiCliInstallation();
      expect(isInstalled).toBe(true);
    });
  });

  describe('error handling', () => {
    let setup: SuiTestnetSetup;

    beforeEach(() => {
      setup = new SuiTestnetSetup();
    });

    it('should handle network connection failure', async () => {
      jest.spyOn(setup['client'], 'getLatestCheckpointSequenceNumber')
        .mockRejectedValue(new Error('Connection failed'));

      await expect(setup.setup()).rejects.toThrow('Failed to connect to Sui');
    });

    it('should handle invalid keystore format', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('invalid-json');

      await expect(setup['restoreWalletFromKeystore']())
        .rejects.toThrow('Failed to restore wallet from keystore');
    });

    it('should handle backup directory creation failure', async () => {
      mockedFs.mkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(setup['backupWallet'](mockWalletInfo))
        .rejects.toThrow('Failed to backup wallet');
    });
  });
});

describe('Integration Examples', () => {
  it('should work with testing frameworks', async () => {
    // Mock a simple test scenario
    let testWallet: any;

    // Simulate beforeAll hook
    const setupResult = await quickSetup();
    testWallet = setupResult.wallet;

    // Simulate test assertions
    expect(testWallet).toBeDefined();
    expect(testWallet.address).toBeTruthy();
    expect(BigInt(testWallet.balance)).toBeGreaterThanOrEqual(0n);
  });

  it('should support multiple wallet creation', async () => {
    const walletConfigs = [
      { keystorePath: './wallet1.keystore' },
      { keystorePath: './wallet2.keystore' },
      { keystorePath: './wallet3.keystore' },
    ];

    // Mock the setup for parallel creation
    const mockSetup = jest.fn().mockResolvedValue({
      wallet: mockWalletInfo,
      keystorePath: 'mock-path',
      configPath: 'mock-config',
    });

    jest.spyOn(SuiTestnetSetup.prototype, 'setup').mockImplementation(mockSetup);

    const wallets = await Promise.all(
      walletConfigs.map(config => setupTestnet(config))
    );

    expect(wallets).toHaveLength(3);
    expect(mockSetup).toHaveBeenCalledTimes(3);
  });
});