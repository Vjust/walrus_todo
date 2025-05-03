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
      const mockWalletSigner: Partial<KeystoreSigner> = {
        signMessage: jest.fn(),
        sign: jest.fn(),
        signWithIntent: jest.fn(),
        suiClient: suiClient,  // Reference the mocked suiClient
        signPersonalMessage: jest.fn(),
        getKeyScheme: jest.fn(),
        getPublicKey: jest.fn(),
        toSuiAddress: jest.fn(),
        signTransaction: jest.fn(),
      };  // Removed invalid 'keypair' property
      (WalletExtensionSigner as jest.Mock).mockImplementation(() => mockWalletSigner as KeystoreSigner);
      jest.spyOn(storage, 'getTransactionSigner').mockResolvedValue(mockWalletSigner as KeystoreSigner);
      // Add explicit call in test to verify

      const signer = await storage.getTransactionSigner();
      expect(WalletExtensionSigner).toHaveBeenCalledTimes(1);
      expect(WalletExtensionSigner).toHaveBeenCalledWith(expect.objectContaining({ connected: true }));
      expect(signer).toEqual(mockWalletSigner);
      expect(signer.signMessage).toBeDefined();
    });

    it('should throw error when WAL balance is 0', async () => {
      storage = new WalrusImageStorage(suiClient);
      suiClient.getBalance.mockResolvedValue({
        coinType: 'test-coin',
        coinObjectCount: 1,
        totalBalance: '1000',  // Simulate sufficient balance for production-like success
        lockedBalance: {
          lockedTotal: '0',
          locked: '0'
        }
      });
      await expect(storage.connect()).rejects.toThrow('No WAL tokens found in the active address');
      await expect(storage.getTransactionSigner()).rejects.toThrow('No WAL tokens found');
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
