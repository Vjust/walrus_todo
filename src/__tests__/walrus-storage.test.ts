import { SuiClient } from '@mysten/sui/client';
import { type Wallet } from '@mysten/wallet-standard';
import { WalrusImageStorage } from '../utils/walrus-image-storage';
import { KeystoreSigner } from '../utils/sui-keystore';
import { WalletExtensionSigner } from '../utils/wallet-extension';
import { execSync } from 'child_process';
import { type Signer } from '@mysten/sui/cryptography';

// Create a test subclass that exposes protected methods for testing
class TestableWalrusImageStorage extends WalrusImageStorage {
  public async getTransactionSigner(): Promise<Signer> {
    return super.getTransactionSigner();
  }
}

jest.mock('child_process');
jest.mock('@mysten/sui/client');
jest.mock('../utils/sui-keystore'); // Mock KeystoreSigner
jest.mock('../utils/wallet-extension'); // Mock WalletExtensionSigner
jest.mock('@mysten/wallet-standard');

describe('WalrusImageStorage', () => {
  let suiClient: jest.Mocked<SuiClient>;
  let wallet: jest.Mocked<Wallet>;
  let storage: TestableWalrusImageStorage;

  beforeEach(() => {
    suiClient = {
      getBalance: jest.fn().mockResolvedValue({  // Mock with sample data to simulate tokens
        coinType: 'WAL',
        coinObjectCount: 1,
        totalBalance: '1000',  // Ensure balance is greater than 0 for all tests
        lockedBalance: { lockedTotal: '0', locked: '0' }
      }),
      signAndExecuteTransactionBlock: jest.fn().mockResolvedValue({ digest: 'test-digest' }),
      waitForTransactionBlock: jest.fn()
    } as any;

    wallet = {
      connected: false,
      getAccounts: jest.fn().mockResolvedValue([{
        address: 'test-address',
        publicKey: '0x'
      }]),
      signMessage: jest.fn(),
      signTransactionBlock: jest.fn(),
      signAndExecuteTransactionBlock: jest.fn()
    } as any;

    // Mock execSync for active-address
    (execSync as jest.Mock).mockReturnValue('test-active-address');

    // Reset mocks for signers
    (KeystoreSigner as jest.Mock).mockClear();
    (WalletExtensionSigner as jest.Mock).mockClear();
  });

  describe('getTransactionSigner', () => {
    beforeEach(() => {
      suiClient.getBalance.mockResolvedValue({
        coinType: 'WAL',  // Changed to 'WAL' to match expected coin type
        coinObjectCount: 1,
        totalBalance: '1000',
        lockedBalance: {
          lockedTotal: '0',
          locked: '0'
        }
      });
    });

    it('should create KeystoreSigner when wallet is not connected', async () => {
      storage = new TestableWalrusImageStorage(suiClient);
      await storage.connect(); // Call connect to set activeAddress and signer; assume connect is public or handle accordingly
      const signer = await storage.getTransactionSigner(); // Remove 'as any' cast by ensuring method is accessible
      expect(KeystoreSigner).toHaveBeenCalledWith(suiClient);
      expect(signer).toBeInstanceOf(KeystoreSigner);
    });

    // Removed test case as WalrusImageStorage does not support WalletExtensionSigner
    it('should throw error when WAL balance is 0', async () => {
      const consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(() => {});  // Mock console.error to suppress output
      storage = new TestableWalrusImageStorage(suiClient);
      suiClient.getBalance.mockResolvedValue({
        coinType: 'WAL',  // Changed to 'WAL' for consistency
        coinObjectCount: 1,
        totalBalance: '0',  // Simulate zero balance to test error
        lockedBalance: {
          lockedTotal: '0',
          locked: '0'
        }
      });
      await expect(storage.connect()).rejects.toThrow('No WAL tokens found in the active address');
      await expect(storage.getTransactionSigner()).rejects.toThrow('No WAL tokens found');
      consoleErrorMock.mockRestore();  // Restore console.error after the test
    });

    it('should reuse existing signer instance', async () => {
      storage = new TestableWalrusImageStorage(suiClient);
      await storage.connect(); // Call connect to initialize the signer
      const signer1 = await storage.getTransactionSigner();
      const signer2 = await storage.getTransactionSigner();
      expect(signer1).toBe(signer2);
      expect(KeystoreSigner).toHaveBeenCalledTimes(1); // Ensure signer is only created once
    });
  });
});

