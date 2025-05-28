/**
 * Tests for the configuration loader
 */

import { loadNetworkConfig, clearConfigCache } from '../loader';
import { getFallbackConfig } from '../fallbacks';
import { ConfigLoadError, ConfigValidationError } from '../types';

// Mock fetch for testing
global.fetch = jest.fn();

describe('Config Loader', () => {
  beforeEach(() => {
    clearConfigCache();
    jest.clearAllMocks();
  });

  describe('loadNetworkConfig', () => {
    it('should load configuration from file', async () => {
      const mockConfig = {
        network: 'testnet',
        rpcUrl: 'https://fullnode.testnet.sui.io',
        walrus: {
          publisherUrl: 'https://publisher.walrus-testnet.walrus.space',
          aggregatorUrl: 'https://aggregator.walrus-testnet.walrus.space'
        },
        deployment: {
          packageId: '0x123',
          deployerAddress: '0x456',
          timestamp: '2025-01-01T00:00:00Z'
        },
        features: {
          aiIntegration: false,
          batchOperations: true,
          storageOptimization: true,
          realTimeUpdates: true
        },
        environment: {
          mode: 'production' as const,
          debug: false
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConfig)
      });

      const result = await loadNetworkConfig('testnet');

      expect(result.fromCache).toBe(false);
      expect(result.isFallback).toBe(false);
      expect(result.source).toBe('file');
      expect(result.config.network.name).toBe('testnet');
      expect(result.config.deployment.packageId).toBe('0x123');
    });

    it('should use fallback when file not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const result = await loadNetworkConfig('testnet');

      expect(result.fromCache).toBe(false);
      expect(result.isFallback).toBe(true);
      expect(result.source).toBe('fallback');
      expect(result.config.network.name).toBe('testnet');
    });

    it('should use cache on subsequent calls', async () => {
      const mockConfig = {
        network: 'testnet',
        rpcUrl: 'https://fullnode.testnet.sui.io',
        walrus: {
          publisherUrl: 'https://publisher.walrus-testnet.walrus.space',
          aggregatorUrl: 'https://aggregator.walrus-testnet.walrus.space'
        },
        deployment: {
          packageId: '0x123',
          deployerAddress: '0x456',
          timestamp: '2025-01-01T00:00:00Z'
        },
        features: {
          aiIntegration: false,
          batchOperations: true,
          storageOptimization: true,
          realTimeUpdates: true
        },
        environment: {
          mode: 'production' as const,
          debug: false
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConfig)
      });

      // First call
      const result1 = await loadNetworkConfig('testnet');
      expect(result1.fromCache).toBe(false);

      // Second call should use cache
      const result2 = await loadNetworkConfig('testnet');
      expect(result2.fromCache).toBe(true);
      expect(result2.source).toBe('cache');
      
      // Fetch should only be called once
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should respect cache timeout', async () => {
      const mockConfig = {
        network: 'testnet',
        rpcUrl: 'https://fullnode.testnet.sui.io',
        walrus: {
          publisherUrl: 'https://publisher.walrus-testnet.walrus.space',
          aggregatorUrl: 'https://aggregator.walrus-testnet.walrus.space'
        },
        deployment: {
          packageId: '0x123',
          deployerAddress: '0x456',
          timestamp: '2025-01-01T00:00:00Z'
        },
        features: {
          aiIntegration: false,
          batchOperations: true,
          storageOptimization: true,
          realTimeUpdates: true
        },
        environment: {
          mode: 'production' as const,
          debug: false
        }
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockConfig)
      });

      // First call
      await loadNetworkConfig('testnet', { cacheTimeout: 100 });

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Second call should fetch again
      await loadNetworkConfig('testnet', { cacheTimeout: 100 });
      
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should disable cache when specified', async () => {
      const mockConfig = {
        network: 'testnet',
        rpcUrl: 'https://fullnode.testnet.sui.io',
        walrus: {
          publisherUrl: 'https://publisher.walrus-testnet.walrus.space',
          aggregatorUrl: 'https://aggregator.walrus-testnet.walrus.space'
        },
        deployment: {
          packageId: '0x123',
          deployerAddress: '0x456',
          timestamp: '2025-01-01T00:00:00Z'
        },
        features: {
          aiIntegration: false,
          batchOperations: true,
          storageOptimization: true,
          realTimeUpdates: true
        },
        environment: {
          mode: 'production' as const,
          debug: false
        }
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockConfig)
      });

      // Both calls should fetch
      await loadNetworkConfig('testnet', { enableCache: false });
      await loadNetworkConfig('testnet', { enableCache: false });
      
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error when network not supported and fallback disabled', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(
        loadNetworkConfig('unknown-network', { fallbackToLocalnet: false })
      ).rejects.toThrow(ConfigLoadError);
    });
  });

  describe('clearConfigCache', () => {
    it('should clear the cache', async () => {
      const mockConfig = {
        network: 'testnet',
        rpcUrl: 'https://fullnode.testnet.sui.io',
        walrus: {
          publisherUrl: 'https://publisher.walrus-testnet.walrus.space',
          aggregatorUrl: 'https://aggregator.walrus-testnet.walrus.space'
        },
        deployment: {
          packageId: '0x123',
          deployerAddress: '0x456',
          timestamp: '2025-01-01T00:00:00Z'
        },
        features: {
          aiIntegration: false,
          batchOperations: true,
          storageOptimization: true,
          realTimeUpdates: true
        },
        environment: {
          mode: 'production' as const,
          debug: false
        }
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockConfig)
      });

      // Load and cache
      await loadNetworkConfig('testnet');
      
      // Clear cache
      clearConfigCache();
      
      // Should fetch again
      await loadNetworkConfig('testnet');
      
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});