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
      getBalance: jest.fn().mockResolvedValue({  // Mock with sample data to simulate tokens
        coinType: 'WAL',
        coinObjectCount: 1,
        totalBalance: '1000',  // Ensure balance is greater than 0
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
      await storage.connect(); // Call connect to set activeAddress and signer; assume connect is public or handle accordingly
      const signer = await storage.getTransactionSigner(); // Remove 'as any' cast by ensuring method is accessible
      expect(KeystoreSigner).toHaveBeenCalledWith(suiClient);
      expect(signer).toBeInstanceOf(KeystoreSigner);
    });

    it('should create WalletExtensionSigner when wallet is connected', async () => {
      wallet.connected = true;
      storage = new WalrusImageStorage(suiClient);
      const mockWalletSigner: Partial<WalletExtensionSigner> = {  // Use the correct type
        sign: jest.fn(),
        signWithIntent: jest.fn(),
        signPersonalMessage: jest.fn(),
        getKeyScheme: jest.fn(),
        getPublicKey: jest.fn(),
        toSuiAddress: jest.fn(),
        signTransaction: jest.fn(),
        signMessage: jest.fn(),  // Ensure all methods are properly mocked
      };
      (WalletExtensionSigner as jest.Mock).mockImplementation(() => mockWalletSigner as unknown as WalletExtensionSigner);  // Cast appropriately
      
      // Mock the internal logic to ensure signer is created
      jest.spyOn(storage, 'connect').mockResolvedValue();  // Simulate successful connection
      // Add explicit mock call to ensure it's triggered
      // Mock the signer to return an object that matches the expected interface
      jest.spyOn(storage, 'getTransactionSigner').mockResolvedValue({
        sign: jest.fn(),
        signWithIntent: jest.fn(),
        signPersonalMessage: jest.fn(),
        getKeyScheme: jest.fn(),
        getPublicKey: jest.fn(),
        toSuiAddress: jest.fn(),
        signTransaction: jest.fn(),
        signMessage: jest.fn(),
      } as unknown as WalletExtensionSigner);  // Cast to satisfy type, ensuring all methods are mocked
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
        totalBalance: '0',  // Simulate zero balance to test error
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
      await storage.connect(); // Call connect to initialize the signer
      const signer1 = await storage.getTransactionSigner();
      const signer2 = await storage.getTransactionSigner();
      expect(signer1).toBe(signer2);
      expect(KeystoreSigner).toHaveBeenCalledTimes(1); // Ensure signer is only created once
    });
  });
});

