import * as childProcess from 'child_process';
import { NetworkValidator } from '../../apps/cli/src/utils/NetworkValidator';
import {
  getMockWalrusClient,
  type CompleteWalrusClientMock,
} from '../helpers/complete-walrus-client-mock';

jest.mock('child_process');
jest.mock('@mysten/walrus');

describe('NetworkValidator', () => {
  let validator: NetworkValidator;
  let mockWalrusClient: CompleteWalrusClientMock;
  let mockExecSync: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExecSync = jest.spyOn(childProcess, 'execSync');

    // Use the complete mock implementation
    mockWalrusClient = getMockWalrusClient();
    // Override the default network to testnet for this test
    mockWalrusClient.getConfig.mockResolvedValue({
      network: 'testnet',
      version: '1.0.0',
      maxSize: 10485760,
    });

    validator = new NetworkValidator({
      expectedEnvironment: 'testnet',
      autoSwitch: false,
    });
  });

  describe('Environment Validation', () => {
    it('should validate matching environments', async () => {
      mockExecSync.mockReturnValue('testnet');
      mockWalrusClient.getConfig.mockResolvedValue({
        network: 'testnet',
        version: '1.0.0',
        maxSize: 10485760,
      });

      await expect(
        validator.validateEnvironment(mockWalrusClient)
      ).resolves.not.toThrow();
    });

    it('should throw on Sui environment mismatch without auto-switch', async () => {
      mockExecSync.mockReturnValue('devnet');
      mockWalrusClient.getConfig.mockResolvedValue({
        network: 'testnet',
        version: '1.0.0',
        maxSize: 10485760,
      });

      await expect(
        validator.validateEnvironment(mockWalrusClient)
      ).rejects.toThrow(
        'Sui environment mismatch. Expected: testnet, got: devnet'
      );
    });

    it('should auto-switch Sui environment when enabled', async () => {
      validator = new NetworkValidator({
        expectedEnvironment: 'testnet',
        autoSwitch: true,
      });

      mockExecSync
        .mockReturnValueOnce('devnet') // First call for checking environment
        .mockReturnValueOnce(''); // Second call for switching environment

      await validator.validateEnvironment(mockWalrusClient);

      expect(mockExecSync).toHaveBeenCalledWith(
        'sui client switch --env testnet',
        { encoding: 'utf8' }
      );
    });

    it('should throw on Walrus environment mismatch', async () => {
      mockExecSync.mockReturnValue('testnet');
      mockWalrusClient.getConfig.mockResolvedValue({
        network: 'devnet',
        version: '1.0.0',
        maxSize: 10485760,
      });

      await expect(
        validator.validateEnvironment(mockWalrusClient)
      ).rejects.toThrow(
        'Walrus environment mismatch. Expected: testnet, got: devnet'
      );
    });

    it('should throw on invalid Sui environment', async () => {
      mockExecSync.mockReturnValue('invalid-env');

      await expect(
        validator.validateEnvironment(mockWalrusClient)
      ).rejects.toThrow('Invalid Sui environment: invalid-env');
    });

    it('should throw on invalid Walrus environment', async () => {
      mockExecSync.mockReturnValue('testnet');
      mockWalrusClient.getConfig.mockResolvedValue({
        network: 'invalid-env',
        version: '1.0.0',
        maxSize: 10485760,
      });

      await expect(
        validator.validateEnvironment(mockWalrusClient)
      ).rejects.toThrow('Invalid Walrus environment: invalid-env');
    });

    it('should handle Sui CLI errors', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('CLI error');
      });

      await expect(
        validator.validateEnvironment(mockWalrusClient)
      ).rejects.toThrow('Failed to get Sui environment: CLI error');
    });

    it('should handle Walrus client errors', async () => {
      mockExecSync.mockReturnValue('testnet');
      mockWalrusClient.getConfig.mockRejectedValue(new Error('Client error'));

      await expect(
        validator.validateEnvironment(mockWalrusClient)
      ).rejects.toThrow('Failed to get Walrus environment: Client error');
    });
  });

  describe('Network Status', () => {
    it('should return correct network status when valid', async () => {
      mockExecSync.mockReturnValue('testnet');
      mockWalrusClient.getConfig.mockResolvedValue({
        network: 'testnet',
        version: '1.0.0',
        maxSize: 10485760,
      });

      const status = await validator.getNetworkStatus(mockWalrusClient);

      expect(status).toEqual({
        suiEnvironment: 'testnet',
        walrusEnvironment: 'testnet',
        isValid: true,
      });
    });

    it('should return invalid status on environment mismatch', async () => {
      mockExecSync.mockReturnValue('devnet');
      mockWalrusClient.getConfig.mockResolvedValue({
        network: 'testnet',
        version: '1.0.0',
        maxSize: 10485760,
      });

      const status = await validator.getNetworkStatus(mockWalrusClient);

      expect(status).toEqual({
        suiEnvironment: 'devnet',
        walrusEnvironment: 'testnet',
        isValid: false,
      });
    });

    it('should handle errors in status check', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('CLI error');
      });

      await expect(
        validator.getNetworkStatus(mockWalrusClient)
      ).rejects.toThrow('Failed to get Sui environment: CLI error');
    });
  });
});
