import { SuiClient } from '@mysten/sui/client';
import { WalletAdapter } from '@mysten/wallet-adapter-base';
import { WalrusImageStorage } from '../utils/walrus-image-storage';
import { KeystoreSigner } from '../utils/sui-keystore';
import { WalletExtensionSigner } from '../utils/wallet-extension';
import { execSync } from 'child_process';

jest.mock('child_process');
jest.mock('@mysten/sui/client');
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

    (execSync as jest.Mock).mockReturnValue('testnet');
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
      (execSync as jest.Mock).mockReturnValue('active-address');
      const signer = await (storage as any).getTransactionSigner();
      expect(signer).toBeInstanceOf(KeystoreSigner);
    });

    it('should create WalletExtensionSigner when wallet is connected', async () => {
      wallet.connected = true;
      storage = new WalrusImageStorage(suiClient);
      const signer = await (storage as any).getTransactionSigner();
      expect(signer).toBeInstanceOf(WalletExtensionSigner);
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
      await expect((storage as any).getTransactionSigner()).rejects.toThrow('No WAL tokens found');
    });

    it('should reuse existing signer instance', async () => {
      storage = new WalrusImageStorage(suiClient);
      (execSync as jest.Mock).mockReturnValue('active-address');
      const signer1 = await (storage as any).getTransactionSigner();
      const signer2 = await (storage as any).getTransactionSigner();
      expect(signer1).toBe(signer2);
    });
  });
});