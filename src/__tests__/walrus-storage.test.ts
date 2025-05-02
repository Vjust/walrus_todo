import { SuiClient } from '@mysten/sui/client';
import { WalletAdapter } from '@mysten/wallet-adapter-base';
import { WalrusImageStorage } from '../utils/walrus-image-storage';
import { KeystoreSigner } from '../utils/sui-keystore';
import { WalletExtensionSigner } from '../utils/wallet-extension';
import { execSync } from 'child_process';

jest.mock('child_process');
jest.mock('@mysten/sui/client');
jest.mock('../utils/sui-keystore'); // Mock KeystoreSigner
jest.mock('../utils/wallet-extension'); // Mock WalletExtensionSigner
jest.mock('@mysten/wallet-adapter-base');


describe('WalrusImageStorage', () => {
  let suiClient: jest.Mocked<SuiClient>;
  let wallet: jest.Mocked<WalletAdapter>;
  let storage: WalrusImageStorage;

  beforeEach(() => {
    suiClient = {
      getBalance: jest.fn(),
      signAndExecuteTransactionBlock: jest.fn().mockImplementation((txb) => Promise.resolve({ digest: 'test-digest' })),
      waitForTransactionBlock: jest.fn()
    } as any;

    wallet = {
      connected: false,
      getAccounts: jest.fn().mockReturnValue([{
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
        coinType: 'test-coin',
        coinObjectCount: 1,
        totalBalance: '1000',
        lockedBalance: {
          lockedTotal: '0',
          locked: '0'
        }
      });
    });

    it('should create KeystoreSigner when wallet is not connected', async () => {
      storage = new WalrusImageStorage(suiClient);
      await (storage as any).connect(); // Call connect to set activeAddress and signer
      const signer = await (storage as any).getTransactionSigner();
      expect(KeystoreSigner).toHaveBeenCalledWith(suiClient);
      expect(signer).toBeInstanceOf(KeystoreSigner);
    });

    it('should create WalletExtensionSigner when wallet is connected', async () => {
      wallet.connected = true;
      storage = new WalrusImageStorage(suiClient);
      // Need to mock the WalletExtensionSigner constructor to return a mock instance
      const mockWalletSigner = { signMessage: jest.fn() };
      (WalletExtensionSigner as jest.Mock).mockReturnValue(mockWalletSigner);

      // We need a way to pass the wallet to WalrusImageStorage if it's connected.
      // The current constructor doesn't take a wallet.
      // For this test to pass with the current class structure, we'll have to
      // manually set the wallet property on the storage instance if it exists.
      // A better approach would be to pass the wallet in the constructor or a connect method.
      // For now, let's assume a way to set the wallet for testing purposes.
      // In a real refactor, the constructor or connect method should handle this.

      // Assuming a test-specific way to set the wallet:
      (storage as any).wallet = wallet;
      (storage as any).isInitialized = true; // Manually set initialized for this test

      const signer = await (storage as any).getTransactionSigner();
      expect(WalletExtensionSigner).toHaveBeenCalledWith(wallet);
      expect(signer).toBe(mockWalletSigner); // Expect the mock instance
    });

    it('should throw error when WAL balance is 0', async () => {
      storage = new WalrusImageStorage(suiClient);
      suiClient.getBalance.mockResolvedValue({
        coinType: 'test-coin',
        coinObjectCount: 1,
        totalBalance: '0',
        lockedBalance: {
          lockedTotal: '0',
          locked: '0'
        }
      });
      await (storage as any).connect(); // Call connect to trigger balance check
      await expect((storage as any).getTransactionSigner()).rejects.toThrow('No WAL tokens found');
    });

    it('should reuse existing signer instance', async () => {
      storage = new WalrusImageStorage(suiClient);
      await (storage as any).connect(); // Call connect to initialize the signer
      const signer1 = await (storage as any).getTransactionSigner();
      const signer2 = await (storage as any).getTransactionSigner();
      expect(signer1).toBe(signer2);
      expect(KeystoreSigner).toHaveBeenCalledTimes(1); // Ensure signer is only created once
    });
  });
});
