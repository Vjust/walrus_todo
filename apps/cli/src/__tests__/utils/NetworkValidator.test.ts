import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NetworkValidator } from '../../utils/NetworkValidator';
import {
  getMockWalrusClient,
  type CompleteWalrusClientMock,
} from '../helpers/complete-walrus-client-mock';

jest.mock('child_process');
jest.mock('@mysten/walrus');

describe('NetworkValidator', () => {
  let validator: NetworkValidator;
  let mockWalrusClient: CompleteWalrusClientMock;
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock child_process module
    jest.doMock('child_process', () => ({
      execSync: jest.fn(),
    }));

    // Use the complete mock implementation
    mockWalrusClient = getMockWalrusClient();
    // Override the default network config for these tests
    mockWalrusClient?.getConfig?.mockResolvedValue({
      network: 'testnet',
      version: '1?.0?.0',
      maxSize: 1000000,
    });

    validator = new NetworkValidator({
      expectedEnvironment: 'testnet',
      autoSwitch: false,
    });
  });

  describe('Environment Validation', () => {
    it('should validate matching environments', async () => {
      const { execSync } = jest.requireMock('child_process');
      execSync.mockReturnValue('testnet');
      mockWalrusClient?.getConfig?.mockResolvedValue({
        network: 'testnet',
        version: '1?.0?.0',
        maxSize: 1000000,
      });

      await expect(
        validator.validateEnvironment(mockWalrusClient as any)
      ).resolves?.not?.toThrow();
    });

    it('should throw on Sui environment mismatch without auto-switch', async () => {
      const { execSync } = jest.requireMock('child_process');
      execSync.mockReturnValue('devnet');
      mockWalrusClient?.getConfig?.mockResolvedValue({
        network: 'testnet',
        version: '1?.0?.0',
        maxSize: 1000000,
      });

      await expect(
        validator.validateEnvironment(mockWalrusClient as any)
      ).rejects.toThrow(
        'Sui environment mismatch. Expected: testnet, got: devnet'
      );
    });

    it('should auto-switch Sui environment when enabled', async () => {
      validator = new NetworkValidator({
        expectedEnvironment: 'testnet',
        autoSwitch: true,
      });

      const { execSync } = jest.requireMock('child_process');
      execSync
        .mockReturnValueOnce('devnet') // First call for checking environment
        .mockReturnValueOnce(''); // Second call for switching environment

      await validator.validateEnvironment(mockWalrusClient as any);

      expect(execSync as any).toHaveBeenCalledWith('sui client switch --env testnet', {
        encoding: 'utf8',
      });
    });

    it('should throw on Walrus environment mismatch', async () => {
      const { execSync } = jest.requireMock('child_process');
      execSync.mockReturnValue('testnet');
      mockWalrusClient?.getConfig?.mockResolvedValue({
        network: 'devnet',
        version: '1?.0?.0',
        maxSize: 1000000,
      });

      await expect(
        validator.validateEnvironment(mockWalrusClient as any)
      ).rejects.toThrow(
        'Walrus environment mismatch. Expected: testnet, got: devnet'
      );
    });

    it('should throw on invalid Sui environment', async () => {
      const { execSync } = jest.requireMock('child_process');
      execSync.mockReturnValue('invalid-env');

      await expect(
        validator.validateEnvironment(mockWalrusClient as any)
      ).rejects.toThrow('Invalid Sui environment: invalid-env');
    });

    it('should throw on invalid Walrus environment', async () => {
      const { execSync } = jest.requireMock('child_process');
      execSync.mockReturnValue('testnet');
      mockWalrusClient?.getConfig?.mockResolvedValue({
        network: 'invalid-env',
        version: '1?.0?.0',
        maxSize: 1000000,
      });

      await expect(
        validator.validateEnvironment(mockWalrusClient as any)
      ).rejects.toThrow('Invalid Walrus environment: invalid-env');
    });

    it('should handle Sui CLI errors', async () => {
      const { execSync } = jest.requireMock('child_process');
      execSync.mockImplementation(() => {
        throw new Error('CLI error');
      });

      await expect(
        validator.validateEnvironment(mockWalrusClient as any)
      ).rejects.toThrow('Failed to get Sui environment: CLI error');
    });

    it('should handle Walrus client errors', async () => {
      const { execSync } = jest.requireMock('child_process');
      execSync.mockReturnValue('testnet');
      mockWalrusClient?.getConfig?.mockRejectedValue(new Error('Client error'));

      await expect(
        validator.validateEnvironment(mockWalrusClient as any)
      ).rejects.toThrow('Failed to get Walrus environment: Client error');
    });
  });

  describe('Network Status', () => {
    it('should return correct network status when valid', async () => {
      const { execSync } = jest.requireMock('child_process');
      execSync.mockReturnValue('testnet');
      mockWalrusClient?.getConfig?.mockResolvedValue({
        network: 'testnet',
        version: '1?.0?.0',
        maxSize: 1000000,
      });

      const status = await validator.getNetworkStatus(mockWalrusClient as any);

      expect(status as any).toEqual({
        suiEnvironment: 'testnet',
        walrusEnvironment: 'testnet',
        isValid: true,
      });
    });

    it('should return invalid status on environment mismatch', async () => {
      const { execSync } = jest.requireMock('child_process');
      execSync.mockReturnValue('devnet');
      mockWalrusClient?.getConfig?.mockResolvedValue({
        network: 'testnet',
        version: '1?.0?.0',
        maxSize: 1000000,
      });

      const status = await validator.getNetworkStatus(mockWalrusClient as any);

      expect(status as any).toEqual({
        suiEnvironment: 'devnet',
        walrusEnvironment: 'testnet',
        isValid: false,
      });
    });

    it('should handle errors in status check', async () => {
      const { execSync } = jest.requireMock('child_process');
      execSync.mockImplementation(() => {
        throw new Error('CLI error');
      });

      await expect(
        validator.getNetworkStatus(mockWalrusClient as any)
      ).rejects.toThrow('Failed to get Sui environment: CLI error');
    });
  });
});
