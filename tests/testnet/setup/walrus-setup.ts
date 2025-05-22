/**
 * Walrus Setup Configuration for Tests
 * Configures Walrus binary paths and API endpoints
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface WalrusConfig {
  binaryPath: string;
  apiUrl: string;
  configPath: string;
  isTestnet: boolean;
  mock: boolean;
}

export interface WalrusTestConfig extends WalrusConfig {
  testContext: string;
  verifySetup: () => Promise<boolean>;
}

/**
 * Get default Walrus configuration for tests
 */
export function getDefaultWalrusConfig(): WalrusConfig {
  const homedir = os.homedir();
  const isTestEnvironment = process.env.NODE_ENV === 'test';
  
  return {
    binaryPath: process.env.WALRUS_BINARY_PATH || path.join(homedir, '.local', 'bin', 'walrus'),
    apiUrl: process.env.WALRUS_API_URL || 'https://walrus-testnet.sui.io',
    configPath: process.env.WALRUS_CONFIG_PATH || path.join(homedir, '.config', 'walrus', 'client_config.yaml'),
    isTestnet: process.env.WALRUS_NETWORK !== 'mainnet',
    mock: process.env.WALRUS_USE_MOCK === 'true' || isTestEnvironment
  };
}

/**
 * Setup Walrus configuration for testnet
 */
export function setupWalrusTestnet(): WalrusTestConfig {
  const config = getDefaultWalrusConfig();
  
  return {
    ...config,
    testContext: 'testnet',
    async verifySetup(): Promise<boolean> {
      try {
        // Check if binary exists
        const binaryExists = fs.existsSync(config.binaryPath);
        if (!binaryExists && !config.mock) {
          console.warn(`Walrus binary not found at ${config.binaryPath}`);
          return false;
        }
        
        // Check if config exists
        const configExists = fs.existsSync(config.configPath);
        if (!configExists && !config.mock) {
          console.warn(`Walrus config not found at ${config.configPath}`);
          return false;
        }
        
        // Verify permissions
        if (binaryExists && !config.mock) {
          try {
            fs.accessSync(config.binaryPath, fs.constants.X_OK);
          } catch (_error) {
            console.warn(`Walrus binary is not executable: ${config.binaryPath}`);
            return false;
          }
        }
        
        return true;
      } catch (_error) {
        console.error('Error verifying Walrus setup:', error);
        return false;
      }
    }
  };
}

/**
 * Get test-specific Walrus configuration
 */
export function getTestWalrusConfig(): WalrusTestConfig {
  const baseConfig = setupWalrusTestnet();
  
  // Override with test-specific settings
  return {
    ...baseConfig,
    mock: true, // Always use mock in test environment
    apiUrl: 'http://localhost:3001', // Mock API URL
    testContext: 'test',
    async verifySetup(): Promise<boolean> {
      // In test mode, setup is always valid since we're using mocks
      return true;
    }
  };
}

/**
 * Create mock Walrus binary for testing
 */
export async function createMockWalrusBinary(targetPath?: string): Promise<string> {
  const mockPath = targetPath || path.join(os.tmpdir(), 'mock-walrus');
  
  const mockContent = `#!/bin/bash
# Mock Walrus binary for testing
echo "Mock Walrus CLI"
case "$1" in
  "store")
    echo "mock-blob-id-${Date.now()}"
    ;;
  "get")
    echo "Mock blob content"
    ;;
  "version")
    echo "walrus 0.1.0 (mock)"
    ;;
  *)
    echo "Unknown command: $1"
    exit 1
    ;;
esac
`;
  
  await fs.promises.writeFile(mockPath, mockContent, { mode: 0o755 });
  return mockPath;
}

/**
 * Setup test environment for Walrus
 */
export async function setupTestEnvironment(): Promise<WalrusTestConfig> {
  const config = getTestWalrusConfig();
  
  // Create mock binary if needed
  if (config.mock && !fs.existsSync(config.binaryPath)) {
    const mockPath = await createMockWalrusBinary(config.binaryPath);
    config.binaryPath = mockPath;
  }
  
  // Create config directory if needed
  const configDir = path.dirname(config.configPath);
  if (!fs.existsSync(configDir)) {
    await fs.promises.mkdir(configDir, { recursive: true });
  }
  
  // Create mock config if needed
  if (!fs.existsSync(config.configPath)) {
    const mockConfig = {
      context: 'testnet',
      url: config.apiUrl,
      tokens: {
        WAL: 'mock-wal-token'
      }
    };
    await fs.promises.writeFile(
      config.configPath,
      JSON.stringify(mockConfig, null, 2)
    );
  }
  
  return config;
}

/**
 * Cleanup test environment
 */
export async function cleanupTestEnvironment(config: WalrusTestConfig): Promise<void> {
  try {
    // Remove mock binary if it was created
    if (config.mock && config.binaryPath.includes('mock-walrus')) {
      await fs.promises.unlink(config.binaryPath).catch(() => {});
    }
    
    // Remove mock config if it was created
    if (config.mock && config.configPath.includes('test')) {
      await fs.promises.unlink(config.configPath).catch(() => {});
    }
  } catch (_error) {
    console.warn('Error cleaning up test environment:', error);
  }
}

/**
 * Validate Walrus configuration
 */
export function validateWalrusConfig(config: WalrusConfig): string[] {
  const errors: string[] = [];
  
  if (!config.binaryPath) {
    errors.push('Walrus binary path is not set');
  }
  
  if (!config.apiUrl) {
    errors.push('Walrus API URL is not set');
  }
  
  if (!config.configPath) {
    errors.push('Walrus config path is not set');
  }
  
  // Validate URL format
  try {
    new URL(config.apiUrl);
  } catch {
    errors.push(`Invalid API URL: ${config.apiUrl}`);
  }
  
  return errors;
}

/**
 * Export configuration for use in tests
 */
export const walrusTestConfig = getTestWalrusConfig();

// Test setup helpers
export const testSetup = {
  beforeAll: async () => {
    return await setupTestEnvironment();
  },
  
  afterAll: async (config: WalrusTestConfig) => {
    await cleanupTestEnvironment(config);
  },
  
  beforeEach: () => {
    process.env.WALRUS_USE_MOCK = 'true';
  },
  
  afterEach: () => {
    delete process.env.WALRUS_USE_MOCK;
  }
};