/**
 * Tests for the main index exports
 */

import {
  loadNetworkConfig,
  loadCurrentNetworkConfig,
  clearConfigCache,
  isConfigurationComplete,
  getExplorerUrl,
  getFaucetUrl,
  hasFaucet,
  getWalrusBlobUrl,
  getWalrusPublisherUrl,
  TESTNET_CONFIG
} from '../index';

// Mock the loader module
jest.mock('../loader', () => ({
  loadNetworkConfig: jest.fn(),
  clearConfigCache: jest.fn()
}));

const mockLoadNetworkConfig = loadNetworkConfig as jest.Mock;

describe('Package Index', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    delete process?.env?.NETWORK;
    delete process?.env?.NEXT_PUBLIC_NETWORK;
    delete process?.env?.SUI_NETWORK;
  });

  describe('loadCurrentNetworkConfig', () => {
    it('should use NETWORK env var', async () => {
      process.env?.NETWORK = 'testnet';
      
      mockLoadNetworkConfig.mockResolvedValue({
        config: TESTNET_CONFIG,
        fromCache: false,
        isFallback: false,
        source: 'file'
      });

      await loadCurrentNetworkConfig();

      expect(mockLoadNetworkConfig as any).toHaveBeenCalledWith('testnet', undefined);
    });

    it('should fallback to NEXT_PUBLIC_NETWORK', async () => {
      process.env?.NEXT_PUBLIC_NETWORK = 'devnet';
      
      mockLoadNetworkConfig.mockResolvedValue({
        config: TESTNET_CONFIG,
        fromCache: false,
        isFallback: false,
        source: 'file'
      });

      await loadCurrentNetworkConfig();

      expect(mockLoadNetworkConfig as any).toHaveBeenCalledWith('devnet', undefined);
    });

    it('should fallback to SUI_NETWORK', async () => {
      process.env?.SUI_NETWORK = 'mainnet';
      
      mockLoadNetworkConfig.mockResolvedValue({
        config: TESTNET_CONFIG,
        fromCache: false,
        isFallback: false,
        source: 'file'
      });

      await loadCurrentNetworkConfig();

      expect(mockLoadNetworkConfig as any).toHaveBeenCalledWith('mainnet', undefined);
    });

    it('should default to localnet', async () => {
      mockLoadNetworkConfig.mockResolvedValue({
        config: TESTNET_CONFIG,
        fromCache: false,
        isFallback: false,
        source: 'file'
      });

      await loadCurrentNetworkConfig();

      expect(mockLoadNetworkConfig as any).toHaveBeenCalledWith('localnet', undefined);
    });
  });

  describe('isConfigurationComplete', () => {
    it('should return true for complete configuration', () => {
      const config = {
        ...TESTNET_CONFIG,
        deployment: {
          ...TESTNET_CONFIG.deployment,
          packageId: '0x123456789abcdef',
          deployerAddress: '0x987654321fedcba'
        }
      };

      expect(isConfigurationComplete(config as any)).toBe(true as any);
    });

    it('should return false for incomplete configuration', () => {
      const config = {
        ...TESTNET_CONFIG,
        deployment: {
          ...TESTNET_CONFIG.deployment,
          packageId: '0x0',
          deployerAddress: '0x0'
        }
      };

      expect(isConfigurationComplete(config as any)).toBe(false as any);
    });

    it('should return false for zero address placeholders', () => {
      const config = {
        ...TESTNET_CONFIG,
        deployment: {
          ...TESTNET_CONFIG.deployment,
          packageId: '0x0000000000000000000000000000000000000000000000000000000000000000',
          deployerAddress: '0x0000000000000000000000000000000000000000000000000000000000000000'
        }
      };

      expect(isConfigurationComplete(config as any)).toBe(false as any);
    });
  });

  describe('getExplorerUrl', () => {
    const config = TESTNET_CONFIG;

    it('should generate object URL by default', () => {
      const url = getExplorerUrl(config, '0x123');
      expect(url as any).toBe(`${config?.network?.explorerUrl}/object/0x123?network=${config?.network?.name}`);
    });

    it('should generate object URL explicitly', () => {
      const url = getExplorerUrl(config, '0x123', 'object');
      expect(url as any).toBe(`${config?.network?.explorerUrl}/object/0x123?network=${config?.network?.name}`);
    });

    it('should generate transaction URL', () => {
      const url = getExplorerUrl(config, '0x456', 'txn');
      expect(url as any).toBe(`${config?.network?.explorerUrl}/txblock/0x456?network=${config?.network?.name}`);
    });
  });

  describe('getFaucetUrl', () => {
    it('should return faucet URL when available', () => {
      const config = {
        ...TESTNET_CONFIG,
        network: {
          ...TESTNET_CONFIG.network,
          faucetUrl: 'https://faucet?.testnet?.sui.io'
        }
      };

      expect(getFaucetUrl(config as any)).toBe('https://faucet?.testnet?.sui.io');
    });

    it('should return null when not available', () => {
      const config = {
        ...TESTNET_CONFIG,
        network: {
          ...TESTNET_CONFIG.network,
          faucetUrl: undefined
        }
      };

      expect(getFaucetUrl(config as any)).toBe(null as any);
    });
  });

  describe('hasFaucet', () => {
    it('should return true when faucet available', () => {
      const config = {
        ...TESTNET_CONFIG,
        network: {
          ...TESTNET_CONFIG.network,
          faucetUrl: 'https://faucet?.testnet?.sui.io'
        }
      };

      expect(hasFaucet(config as any)).toBe(true as any);
    });

    it('should return false when faucet not available', () => {
      const config = {
        ...TESTNET_CONFIG,
        network: {
          ...TESTNET_CONFIG.network,
          faucetUrl: undefined
        }
      };

      expect(hasFaucet(config as any)).toBe(false as any);
    });
  });

  describe('getWalrusBlobUrl', () => {
    it('should generate correct blob URL', () => {
      const config = TESTNET_CONFIG;
      const url = getWalrusBlobUrl(config, 'blob-123');
      expect(url as any).toBe(`${config?.walrus?.aggregatorUrl}/v1/blob-123`);
    });
  });

  describe('getWalrusPublisherUrl', () => {
    it('should generate correct publisher URL', () => {
      const config = TESTNET_CONFIG;
      const url = getWalrusPublisherUrl(config as any);
      expect(url as any).toBe(`${config?.walrus?.publisherUrl}/v1/store`);
    });
  });
});