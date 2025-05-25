import {
  Environment,
  EnvironmentConfigManager,
  getEnvironment,
} from '../../utils/environment-config';

describe('EnvironmentConfigManager', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset the environment variables before each test
    process.env = { ...originalEnv };

    // Reset the singleton instance
    // @ts-expect-error: Accessing private property for testing
    EnvironmentConfigManager.instance = undefined;
  });

  afterAll(() => {
    // Restore original env vars after all tests
    process.env = originalEnv;
  });

  describe('getEnvironment', () => {
    it('should return DEVELOPMENT by default', () => {
      delete process.env.NODE_ENV;
      expect(getEnvironment()).toBe(Environment.DEVELOPMENT);
    });

    it('should return PRODUCTION when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      expect(getEnvironment()).toBe(Environment.PRODUCTION);
    });

    it('should return STAGING when NODE_ENV is staging', () => {
      process.env.NODE_ENV = 'staging';
      expect(getEnvironment()).toBe(Environment.STAGING);
    });

    it('should return TESTING when NODE_ENV is test or testing', () => {
      process.env.NODE_ENV = 'test';
      expect(getEnvironment()).toBe(Environment.TESTING);

      process.env.NODE_ENV = 'testing';
      expect(getEnvironment()).toBe(Environment.TESTING);
    });
  });

  describe('getInstance', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = EnvironmentConfigManager.getInstance();
      const instance2 = EnvironmentConfigManager.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('get and has methods', () => {
    it('should get default values when environment variables are not set', () => {
      const manager = EnvironmentConfigManager.getInstance();

      expect(manager.get('LOG_LEVEL')).toBe('info');
      expect(manager.get('NETWORK')).toBe('testnet');
      expect(manager.get('AI_TEMPERATURE')).toBe(0.7);
      expect(manager.get('AI_CACHE_ENABLED')).toBe(true);
    });

    it('should get values from environment variables when they are set', () => {
      process.env.LOG_LEVEL = 'debug';
      process.env.NETWORK = 'mainnet';
      process.env.AI_TEMPERATURE = '0.9';
      process.env.AI_CACHE_ENABLED = 'false';

      const manager = EnvironmentConfigManager.getInstance();
      manager.loadFromEnvironment();

      expect(manager.get('LOG_LEVEL')).toBe('debug');
      expect(manager.get('NETWORK')).toBe('mainnet');
      expect(manager.get('AI_TEMPERATURE')).toBe(0.9);
      expect(manager.get('AI_CACHE_ENABLED')).toBe(false);
    });

    it('should check if a configuration value exists', () => {
      const manager = EnvironmentConfigManager.getInstance();

      expect(manager.has('LOG_LEVEL')).toBe(true);
      expect(manager.has('XAI_API_KEY')).toBe(false); // Default is empty string

      process.env.XAI_API_KEY = 'test-key';
      manager.loadFromEnvironment();

      expect(manager.has('XAI_API_KEY')).toBe(true);
    });
  });

  describe('validation', () => {
    it('should not throw error when no required variables are missing', () => {
      const manager = EnvironmentConfigManager.getInstance();

      expect(() => {
        manager.validate();
      }).not.toThrow();
    });

    it('should throw error when required variables are missing', () => {
      const manager = EnvironmentConfigManager.getInstance();
      manager.setRequired(['XAI_API_KEY']);

      expect(() => {
        manager.validate();
      }).toThrow(/Missing required environment variables/);

      process.env.XAI_API_KEY = 'test-key';
      manager.loadFromEnvironment();

      expect(() => {
        manager.validate();
      }).not.toThrow();
    });
  });

  describe('updateConfig', () => {
    it('should update configuration values', () => {
      const manager = EnvironmentConfigManager.getInstance();

      manager.updateConfig('LOG_LEVEL', 'trace');
      expect(manager.get('LOG_LEVEL')).toBe('trace');

      manager.updateConfig('AI_TEMPERATURE', 0.5);
      expect(manager.get('AI_TEMPERATURE')).toBe(0.5);
    });
  });

  describe('loadFromObject', () => {
    it('should load configuration from an object', () => {
      const manager = EnvironmentConfigManager.getInstance();

      manager.loadFromObject({
        LOG_LEVEL: 'debug',
        NETWORK: 'devnet',
        AI_TEMPERATURE: 0.8,
      });

      expect(manager.get('LOG_LEVEL')).toBe('debug');
      expect(manager.get('NETWORK')).toBe('devnet');
      expect(manager.get('AI_TEMPERATURE')).toBe(0.8);
    });
  });

  describe('getEnvSpecificConfig', () => {
    it('should set appropriate config for PRODUCTION environment', () => {
      process.env.NODE_ENV = 'production';
      const manager = EnvironmentConfigManager.getInstance();
      manager.loadFromEnvironment();
      manager.getEnvSpecificConfig();

      expect(manager.get('REQUIRE_SIGNATURE_VERIFICATION')).toBe(true);
      expect(manager.get('ENABLE_BLOCKCHAIN_VERIFICATION')).toBe(true);
      expect(manager.get('LOG_LEVEL')).toBe('info');
    });

    it('should set appropriate config for DEVELOPMENT environment', () => {
      process.env.NODE_ENV = 'development';
      const manager = EnvironmentConfigManager.getInstance();
      manager.loadFromEnvironment();
      manager.getEnvSpecificConfig();

      expect(manager.get('LOG_LEVEL')).toBe('debug');
      expect(manager.get('ENABLE_BLOCKCHAIN_VERIFICATION')).toBe(false);
    });
  });

  describe('toJSON and getMetadata', () => {
    it('should serialize configuration to JSON', () => {
      const manager = EnvironmentConfigManager.getInstance();
      const json = manager.toJSON();

      expect(json).toHaveProperty('LOG_LEVEL');
      expect(json).toHaveProperty('NETWORK');
      expect(json).toHaveProperty('AI_TEMPERATURE');
    });

    it('should return metadata about configuration variables', () => {
      const manager = EnvironmentConfigManager.getInstance();
      manager.setRequired(['XAI_API_KEY']);

      const metadata = manager.getMetadata();

      expect(metadata).toHaveProperty('XAI_API_KEY');
      expect(metadata.XAI_API_KEY.required).toBe(true);
      expect(metadata.LOG_LEVEL.required).toBe(false);
    });
  });
});
