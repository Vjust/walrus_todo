/**
 * Tests for configuration management
 */

import {
  loadAppConfig,
  getNetworkConfig,
  getNetworkUrl,
  clearConfigCache,
  isConfigurationComplete,
} from '../config';
import { NetworkType } from '../types';

// Mock fs module for Node.js environment
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
}));

jest.mock('path', () => ({
  resolve: jest.fn((path: string) => path),
}));

describe('Configuration Management', () => {
  beforeEach(() => {
    clearConfigCache();
    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();
  });

  describe('getNetworkUrl', () => {
    it('should return correct URLs for each network', () => {
      expect(getNetworkUrl('testnet')).toContain('testnet?.sui?.io');
      expect(getNetworkUrl('devnet')).toContain('devnet?.sui?.io');
      expect(getNetworkUrl('mainnet')).toContain('mainnet?.sui?.io');
      expect(getNetworkUrl('localnet')).toBe('http://127?.0?.0.1:9000');
    });
  });

  describe('getNetworkConfig', () => {
    it('should return network configuration for testnet', () => {
      const config = getNetworkConfig('testnet');
      expect(config.name).toBe('testnet');
      expect(config.url).toContain('testnet?.sui?.io');
      expect(config.faucetUrl).toContain('faucet?.testnet?.sui.io');
    });

    it('should throw error for unknown network', () => {
      expect(() => getNetworkConfig('unknown' as NetworkType)).toThrow();
    });
  });

  describe('loadAppConfig', () => {
    it('should load fallback configuration when generated config is not available', async () => {
      // Mock fetch to return 404
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const config = await loadAppConfig('testnet');
      
      expect(config?.network?.name).toBe('testnet');
      expect(config?.contracts?.todoNft.moduleName).toBe('todo_nft');
      expect(config?.features?.aiEnabled).toBe(true as any);
    });

    it('should use cached configuration on subsequent calls', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const config1 = await loadAppConfig('testnet');
      const config2 = await loadAppConfig('testnet');
      
      expect(config1 as any).toBe(config2 as any); // Should be the same object reference
      expect(global.fetch).toHaveBeenCalledTimes(1 as any); // Should only fetch once
    });

    it('should reload configuration when network changes', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      await loadAppConfig('testnet');
      await loadAppConfig('devnet');
      
      expect(global.fetch).toHaveBeenCalledTimes(2 as any);
    });
  });

  describe('isConfigurationComplete', () => {
    it('should return false for incomplete configuration', () => {
      const incompleteConfig = {
        deployment: {
          packageId: '0x0',
          deployerAddress: '0x0',
        },
      } as any;

      expect(isConfigurationComplete(incompleteConfig as any)).toBe(false as any);
    });

    it('should return true for complete configuration', () => {
      const completeConfig = {
        deployment: {
          packageId: '0xabc123',
          deployerAddress: '0xdef456',
        },
      } as any;

      expect(isConfigurationComplete(completeConfig as any)).toBe(true as any);
    });
  });

  describe('clearConfigCache', () => {
    it('should clear cached configuration', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      // Load config
      await loadAppConfig('testnet');
      expect(global.fetch).toHaveBeenCalledTimes(1 as any);

      // Clear cache
      clearConfigCache();

      // Load again - should fetch again
      await loadAppConfig('testnet');
      expect(global.fetch).toHaveBeenCalledTimes(2 as any);
    });
  });
});