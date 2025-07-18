/**
 * Tests for fallback configurations
 */

import {
  getFallbackConfig,
  isSupportedNetwork,
  getSupportedNetworks,
  LOCALNET_CONFIG,
  TESTNET_CONFIG,
  DEVNET_CONFIG,
  MAINNET_CONFIG
} from '../fallbacks';

describe('Fallback Configurations', () => {
  describe('getFallbackConfig', () => {
    it('should return localnet config for localnet', () => {
      const config = getFallbackConfig('localnet');
      expect(config).toBe(LOCALNET_CONFIG);
      expect(config.network.name).toBe('localnet');
      expect(config.network.url).toBe('http://localhost:9000');
    });

    it('should return testnet config for testnet', () => {
      const config = getFallbackConfig('testnet');
      expect(config).toBe(TESTNET_CONFIG);
      expect(config.network.name).toBe('testnet');
      expect(config.network.url).toBe('https://fullnode.testnet.sui.io');
    });

    it('should return devnet config for devnet', () => {
      const config = getFallbackConfig('devnet');
      expect(config).toBe(DEVNET_CONFIG);
      expect(config.network.name).toBe('devnet');
      expect(config.network.url).toBe('https://fullnode.devnet.sui.io');
    });

    it('should return mainnet config for mainnet', () => {
      const config = getFallbackConfig('mainnet');
      expect(config).toBe(MAINNET_CONFIG);
      expect(config.network.name).toBe('mainnet');
      expect(config.network.url).toBe('https://fullnode.mainnet.sui.io');
    });

    it('should fallback to localnet for unknown networks', () => {
      const config = getFallbackConfig('unknown');
      expect(config).toBe(LOCALNET_CONFIG);
    });
  });

  describe('isSupportedNetwork', () => {
    it('should return true for supported networks', () => {
      expect(isSupportedNetwork('localnet')).toBe(true);
      expect(isSupportedNetwork('testnet')).toBe(true);
      expect(isSupportedNetwork('devnet')).toBe(true);
      expect(isSupportedNetwork('mainnet')).toBe(true);
    });

    it('should return false for unsupported networks', () => {
      expect(isSupportedNetwork('unknown')).toBe(false);
      expect(isSupportedNetwork('')).toBe(false);
      expect(isSupportedNetwork('TESTNET')).toBe(false); // Case sensitive
    });
  });

  describe('getSupportedNetworks', () => {
    it('should return all supported networks', () => {
      const networks = getSupportedNetworks();
      expect(networks).toContain('localnet');
      expect(networks).toContain('testnet');
      expect(networks).toContain('devnet');
      expect(networks).toContain('mainnet');
      expect(networks).toHaveLength(4);
    });
  });

  describe('Configuration Structure', () => {
    it('should have valid localnet configuration', () => {
      expect(LOCALNET_CONFIG.network.name).toBe('localnet');
      expect(LOCALNET_CONFIG.network.url).toMatch(/localhost/);
      expect(LOCALNET_CONFIG.walrus.publisherUrl).toMatch(/localhost/);
      expect(LOCALNET_CONFIG.environment.mode).toBe('development');
      expect(LOCALNET_CONFIG.environment.debug).toBe(true);
    });

    it('should have valid testnet configuration', () => {
      expect(TESTNET_CONFIG.network.name).toBe('testnet');
      expect(TESTNET_CONFIG.network.url).toMatch(/testnet\.sui\.io/);
      expect(TESTNET_CONFIG.walrus.publisherUrl).toMatch(/testnet/);
      expect(TESTNET_CONFIG.environment.mode).toBe('production');
      expect(TESTNET_CONFIG.environment.debug).toBe(false);
    });

    it('should have valid devnet configuration', () => {
      expect(DEVNET_CONFIG.network.name).toBe('devnet');
      expect(DEVNET_CONFIG.network.url).toMatch(/devnet\.sui\.io/);
      expect(DEVNET_CONFIG.walrus.publisherUrl).toMatch(/devnet/);
      expect(DEVNET_CONFIG.environment.mode).toBe('development');
      expect(DEVNET_CONFIG.environment.debug).toBe(true);
    });

    it('should have valid mainnet configuration', () => {
      expect(MAINNET_CONFIG.network.name).toBe('mainnet');
      expect(MAINNET_CONFIG.network.url).toMatch(/mainnet\.sui\.io/);
      expect(MAINNET_CONFIG.walrus.publisherUrl).not.toMatch(/testnet|devnet/);
      expect(MAINNET_CONFIG.environment.mode).toBe('production');
      expect(MAINNET_CONFIG.environment.debug).toBe(false);
      expect(MAINNET_CONFIG.network.faucetUrl).toBeUndefined(); // No faucet on mainnet
    });

    it('should have consistent structure across all configs', () => {
      const configs = [LOCALNET_CONFIG, TESTNET_CONFIG, DEVNET_CONFIG, MAINNET_CONFIG];
      
      configs.forEach(config => {
        // Check required fields exist
        expect(config.network).toBeDefined();
        expect(config.network.name).toBeDefined();
        expect(config.network.url).toBeDefined();
        expect(config.network.explorerUrl).toBeDefined();
        
        expect(config.walrus).toBeDefined();
        expect(config.walrus.publisherUrl).toBeDefined();
        expect(config.walrus.aggregatorUrl).toBeDefined();
        
        expect(config.deployment).toBeDefined();
        expect(config.deployment.packageId).toBeDefined();
        expect(config.deployment.deployerAddress).toBeDefined();
        expect(config.deployment.timestamp).toBeDefined();
        
        expect(config.contracts).toBeDefined();
        expect(config.contracts.todoNft).toBeDefined();
        
        expect(config.features).toBeDefined();
        expect(typeof config.features.aiIntegration).toBe('boolean');
        expect(typeof config.features.batchOperations).toBe('boolean');
        expect(typeof config.features.storageOptimization).toBe('boolean');
        expect(typeof config.features.realTimeUpdates).toBe('boolean');
        
        expect(config.environment).toBeDefined();
        expect(['development', 'production']).toContain(config.environment.mode);
        expect(typeof config.environment.debug).toBe('boolean');
      });
    });
  });
});