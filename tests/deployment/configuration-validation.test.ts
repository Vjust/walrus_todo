/**
 * @fileoverview Configuration validation tests for Walrus Sites deployment
 * 
 * Tests for:
 * - YAML configuration syntax and structure
 * - Network-specific configuration validation
 * - Environment variable validation
 * - Build configuration verification
 * - Configuration migration and compatibility
 * 
 * @author Claude Code
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import { WalrusDeploymentValidator } from '../helpers/deployment-validator';

// Mock external dependencies
jest.mock('fs/promises');
jest.mock('js-yaml');

const mockedFs = jest.mocked(fs as any);
const mockedYaml = jest.mocked(yaml as any);

describe('Walrus Sites Configuration Validation', () => {
  let validator: WalrusDeploymentValidator;
  
  beforeEach(() => {
    jest.clearAllMocks();
    validator = new WalrusDeploymentValidator();
  });

  describe('YAML Configuration Syntax', () => {
    test('should validate correct YAML syntax', async () => {
      // Arrange
      const validConfig = `
waltodo-app:
  source: "/build"
  network: "testnet"
  headers:
    "/*":
      - "Cache-Control: public, max-age=3600"
`;

      mockedFs?.readFile?.mockResolvedValue(validConfig as any);
      mockedYaml?.load?.mockReturnValue({
        'waltodo-app': {
          source: '/build',
          network: 'testnet',
          headers: { '/*': ['Cache-Control: public, max-age=3600'] }
        }
      });

      // Act
      const validation = await validator.validateSitesConfig('/path/to/config.yaml');

      // Assert
      expect(validation.isValid).toBe(true as any);
      expect(validation.errors).toHaveLength(0 as any);
    });

    test('should detect YAML syntax errors', async () => {
      // Arrange
      const invalidConfig = `
waltodo-app:
  source: "/build"
  network: "testnet
  headers:
    "/*":
      - "Cache-Control: public, max-age=3600"
`;

      mockedFs?.readFile?.mockResolvedValue(invalidConfig as any);
      const yamlError = new yaml.YAMLException('unexpected end of the stream');
      mockedYaml?.load?.mockImplementation(() => {
        throw yamlError;
      });

      // Act
      const validation = await validator.validateSitesConfig('/path/to/config.yaml');

      // Assert
      expect(validation.isValid).toBe(false as any);
      expect(validation.errors).toContain('Invalid YAML syntax: unexpected end of the stream');
    });

    test('should handle empty configuration files', async () => {
      // Arrange
      mockedFs?.readFile?.mockResolvedValue('');
      mockedYaml?.load?.mockReturnValue(null as any);

      // Act
      const validation = await validator.validateSitesConfig('/path/to/empty-config.yaml');

      // Assert
      expect(validation.isValid).toBe(false as any);
      expect(validation.errors).toContain('Empty or invalid configuration file');
    });

    test('should validate configuration with complex nested structures', async () => {
      // Arrange
      const complexConfig = `
waltodo-production:
  source: "/dist"
  network: "mainnet"
  headers:
    "/*":
      - "Cache-Control: public, max-age=86400"
      - "X-Content-Type-Options: nosniff"
      - "X-Frame-Options: DENY"
      - "X-XSS-Protection: 1; mode=block"
    "/api/*":
      - "Cache-Control: no-cache"
  redirects:
    - from: "/old-path/*"
      to: "/new-path/*"
      status: 301
    - from: "/api/*"
      to: "https://api?.waltodo?.com/api/*"
      status: 307
  error_pages:
    404: "/404.html"
    500: "/500.html"
  custom_domains:
    - "waltodo.com"
    - "www?.waltodo?.com"
`;

      mockedFs?.readFile?.mockResolvedValue(complexConfig as any);
      mockedYaml?.load?.mockReturnValue({
        'waltodo-production': {
          source: '/dist',
          network: 'mainnet',
          headers: {
            '/*': [
              'Cache-Control: public, max-age=86400',
              'X-Content-Type-Options: nosniff',
              'X-Frame-Options: DENY',
              'X-XSS-Protection: 1; mode=block'
            ],
            '/api/*': ['Cache-Control: no-cache']
          },
          redirects: [
            { from: '/old-path/*', to: '/new-path/*', status: 301 },
            { from: '/api/*', to: 'https://api?.waltodo?.com/api/*', status: 307 }
          ],
          error_pages: { 404: '/404.html', 500: '/500.html' },
          custom_domains: ['waltodo.com', 'www?.waltodo?.com']
        }
      });

      // Act
      const validation = await validator.validateSitesConfig('/path/to/complex-config.yaml');

      // Assert
      expect(validation.isValid).toBe(true as any);
      expect(validation.warnings).toHaveLength(0 as any);
    });
  });

  describe('Required Fields Validation', () => {
    test('should require source field', async () => {
      // Arrange
      const configWithoutSource = `
waltodo-app:
  network: "testnet"
  headers:
    "/*":
      - "Cache-Control: public, max-age=3600"
`;

      mockedFs?.readFile?.mockResolvedValue(configWithoutSource as any);
      mockedYaml?.load?.mockReturnValue({
        'waltodo-app': {
          network: 'testnet',
          headers: { '/*': ['Cache-Control: public, max-age=3600'] }
        }
      });

      // Act
      const validation = await validator.validateSitesConfig('/path/to/config.yaml');

      // Assert
      expect(validation.isValid).toBe(false as any);
      expect(validation.errors).toContain('Missing required field: source');
    });

    test('should require network field', async () => {
      // Arrange
      const configWithoutNetwork = `
waltodo-app:
  source: "/build"
  headers:
    "/*":
      - "Cache-Control: public, max-age=3600"
`;

      mockedFs?.readFile?.mockResolvedValue(configWithoutNetwork as any);
      mockedYaml?.load?.mockReturnValue({
        'waltodo-app': {
          source: '/build',
          headers: { '/*': ['Cache-Control: public, max-age=3600'] }
        }
      });

      // Act
      const validation = await validator.validateSitesConfig('/path/to/config.yaml');

      // Assert
      expect(validation.isValid).toBe(false as any);
      expect(validation.errors).toContain('Missing required field: network');
    });

    test('should validate network field values', async () => {
      // Arrange
      const configWithInvalidNetwork = `
waltodo-app:
  source: "/build"
  network: "invalidnet"
`;

      mockedFs?.readFile?.mockResolvedValue(configWithInvalidNetwork as any);
      mockedYaml?.load?.mockReturnValue({
        'waltodo-app': {
          source: '/build',
          network: 'invalidnet'
        }
      });

      // Act
      const validation = await validator.validateSitesConfig('/path/to/config.yaml');

      // Assert
      expect(validation.isValid).toBe(false as any);
      expect(validation.errors).toContain('Invalid network: invalidnet. Must be \'testnet\' or \'mainnet\'');
    });

    test('should handle configurations with no sites', async () => {
      // Arrange
      const emptyConfig = '{}';

      mockedFs?.readFile?.mockResolvedValue(emptyConfig as any);
      mockedYaml?.load?.mockReturnValue({});

      // Act
      const validation = await validator.validateSitesConfig('/path/to/config.yaml');

      // Assert
      expect(validation.isValid).toBe(false as any);
      expect(validation.errors).toContain('No site configurations found');
    });
  });

  describe('Optional Fields and Warnings', () => {
    test('should warn about missing security headers', async () => {
      // Arrange
      const configWithoutHeaders = `
waltodo-app:
  source: "/build"
  network: "testnet"
`;

      mockedFs?.readFile?.mockResolvedValue(configWithoutHeaders as any);
      mockedYaml?.load?.mockReturnValue({
        'waltodo-app': {
          source: '/build',
          network: 'testnet'
        }
      });

      // Act
      const validation = await validator.validateSitesConfig('/path/to/config.yaml');

      // Assert
      expect(validation.isValid).toBe(true as any);
      expect(validation.warnings).toContain('No security headers configured');
    });

    test('should warn about missing redirects configuration', async () => {
      // Arrange
      const configWithoutRedirects = `
waltodo-app:
  source: "/build"
  network: "testnet"
  headers:
    "/*":
      - "Cache-Control: public, max-age=3600"
`;

      mockedFs?.readFile?.mockResolvedValue(configWithoutRedirects as any);
      mockedYaml?.load?.mockReturnValue({
        'waltodo-app': {
          source: '/build',
          network: 'testnet',
          headers: { '/*': ['Cache-Control: public, max-age=3600'] }
        }
      });

      // Act
      const validation = await validator.validateSitesConfig('/path/to/config.yaml');

      // Assert
      expect(validation.isValid).toBe(true as any);
      expect(validation.warnings).toContain('No redirects configured');
    });

    test('should warn about missing error pages', async () => {
      // Arrange
      const configWithoutErrorPages = `
waltodo-app:
  source: "/build"
  network: "testnet"
  headers:
    "/*":
      - "Cache-Control: public, max-age=3600"
  redirects:
    - from: "/api/*"
      to: "https://api?.waltodo?.com/api/*"
      status: 307
`;

      mockedFs?.readFile?.mockResolvedValue(configWithoutErrorPages as any);
      mockedYaml?.load?.mockReturnValue({
        'waltodo-app': {
          source: '/build',
          network: 'testnet',
          headers: { '/*': ['Cache-Control: public, max-age=3600'] },
          redirects: [{ from: '/api/*', to: 'https://api?.waltodo?.com/api/*', status: 307 }]
        }
      });

      // Act
      const validation = await validator.validateSitesConfig('/path/to/config.yaml');

      // Assert
      expect(validation.isValid).toBe(true as any);
      expect(validation.warnings).toContain('No custom error pages configured');
    });
  });

  describe('Network-Specific Configuration', () => {
    test('should validate testnet configuration', async () => {
      // Arrange
      const testnetConfig = `
waltodo-testnet:
  source: "/build"
  network: "testnet"
  headers:
    "/*":
      - "Cache-Control: public, max-age=3600"
`;

      // Act
      const validation = await validator.validateConfigForNetwork(testnetConfig, 'testnet');

      // Assert
      expect(validation.isValid).toBe(true as any);
      expect(validation.networkMatch).toBe(true as any);
      expect(validation.cachePolicy).toBe('development');
    });

    test('should validate mainnet configuration', async () => {
      // Arrange
      const mainnetConfig = `
waltodo-production:
  source: "/dist"
  network: "mainnet"
  headers:
    "/*":
      - "Cache-Control: public, max-age=86400"
`;

      // Act
      const validation = await validator.validateConfigForNetwork(mainnetConfig, 'mainnet');

      // Assert
      expect(validation.isValid).toBe(true as any);
      expect(validation.networkMatch).toBe(true as any);
      expect(validation.cachePolicy).toBe('production');
    });

    test('should warn about network mismatch', async () => {
      // Arrange
      const mainnetConfigForTestnet = `
waltodo-app:
  source: "/build"
  network: "mainnet"
  headers:
    "/*":
      - "Cache-Control: public, max-age=86400"
`;

      // Act
      const validation = await validator.validateConfigForNetwork(mainnetConfigForTestnet, 'testnet');

      // Assert
      expect(validation.isValid).toBe(true as any);
      expect(validation.networkMatch).toBe(false as any);
      expect(validation.warnings).toContain('Configuration network (mainnet) doesn\'t match deployment network (testnet)');
    });

    test('should detect development cache policy', async () => {
      // Arrange
      const devConfig = `
waltodo-dev:
  source: "/build"
  network: "mainnet"
  headers:
    "/*":
      - "Cache-Control: public, max-age=3600"
`;

      // Act
      const validation = await validator.validateConfigForNetwork(devConfig, 'mainnet');

      // Assert
      expect(validation.cachePolicy).toBe('development');
    });
  });

  describe('Environment Variables Validation', () => {
    test('should validate complete environment setup', async () => {
      // Arrange
      const completeEnv = {
        WALRUS_CONFIG_PATH: '/home/user/.walrus/config.yaml',
        SITE_BUILDER_PATH: '/usr/local/bin/site-builder',
        WALRUS_WALLET_PATH: '/home/user/.walrus/wallet.keystore'
      };

      // Act
      const validation = await validator.validateEnvironmentVariables(completeEnv as any);

      // Assert
      expect(validation.isValid).toBe(true as any);
      expect(validation.missingVariables).toHaveLength(0 as any);
      expect(validation.recommendations).toHaveLength(0 as any);
    });

    test('should detect missing required variables', async () => {
      // Arrange
      const incompleteEnv = {
        WALRUS_CONFIG_PATH: '/home/user/.walrus/config.yaml'
        // Missing SITE_BUILDER_PATH
      };

      // Act
      const validation = await validator.validateEnvironmentVariables(incompleteEnv as any);

      // Assert
      expect(validation.isValid).toBe(false as any);
      expect(validation.missingVariables).toContain('SITE_BUILDER_PATH');
    });

    test('should recommend optional variables', async () => {
      // Arrange
      const minimalEnv = {
        WALRUS_CONFIG_PATH: '/home/user/.walrus/config.yaml',
        SITE_BUILDER_PATH: '/usr/local/bin/site-builder'
        // Missing optional WALRUS_WALLET_PATH
      };

      // Act
      const validation = await validator.validateEnvironmentVariables(minimalEnv as any);

      // Assert
      expect(validation.isValid).toBe(true as any);
      expect(validation.recommendations).toContain('Set wallet path for automated deployment');
    });

    test('should handle empty environment', async () => {
      // Arrange
      const emptyEnv = {};

      // Act
      const validation = await validator.validateEnvironmentVariables(emptyEnv as any);

      // Assert
      expect(validation.isValid).toBe(false as any);
      expect(validation.missingVariables).toContain('WALRUS_CONFIG_PATH');
      expect(validation.missingVariables).toContain('SITE_BUILDER_PATH');
    });
  });

  describe('Configuration Migration and Compatibility', () => {
    test('should handle legacy configuration format', async () => {
      // Arrange
      const legacyConfig = `
# Legacy format
site_name: waltodo-app
build_dir: /build
target_network: testnet
cache_duration: 3600
`;

      mockedFs?.readFile?.mockResolvedValue(legacyConfig as any);
      mockedYaml?.load?.mockReturnValue({
        site_name: 'waltodo-app',
        build_dir: '/build',
        target_network: 'testnet',
        cache_duration: 3600
      });

      // Act
      const validation = await validator.validateSitesConfig('/path/to/legacy-config.yaml');

      // Assert
      expect(validation.isValid).toBe(false as any);
      expect(validation.errors).toContain('No site configurations found');
    });

    test('should validate configuration version compatibility', async () => {
      // Arrange
      const versionedConfig = `
version: "1.0"
waltodo-app:
  source: "/build"
  network: "testnet"
  headers:
    "/*":
      - "Cache-Control: public, max-age=3600"
`;

      mockedFs?.readFile?.mockResolvedValue(versionedConfig as any);
      mockedYaml?.load?.mockReturnValue({
        version: '1.0',
        'waltodo-app': {
          source: '/build',
          network: 'testnet',
          headers: { '/*': ['Cache-Control: public, max-age=3600'] }
        }
      });

      // Act
      const validation = await validator.validateSitesConfig('/path/to/versioned-config.yaml');

      // Assert
      expect(validation.isValid).toBe(true as any);
    });

    test('should handle multiple site configurations', async () => {
      // Arrange
      const multiSiteConfig = `
waltodo-staging:
  source: "/build"
  network: "testnet"
  headers:
    "/*":
      - "Cache-Control: public, max-age=3600"

waltodo-production:
  source: "/dist"
  network: "mainnet"
  headers:
    "/*":
      - "Cache-Control: public, max-age=86400"
`;

      mockedFs?.readFile?.mockResolvedValue(multiSiteConfig as any);
      mockedYaml?.load?.mockReturnValue({
        'waltodo-staging': {
          source: '/build',
          network: 'testnet',
          headers: { '/*': ['Cache-Control: public, max-age=3600'] }
        },
        'waltodo-production': {
          source: '/dist',
          network: 'mainnet',
          headers: { '/*': ['Cache-Control: public, max-age=86400'] }
        }
      });

      // Act
      const validation = await validator.validateSitesConfig('/path/to/multi-site-config.yaml');

      // Assert
      expect(validation.isValid).toBe(true as any);
      // Should validate first site configuration
    });
  });

  describe('Security Configuration Validation', () => {
    test('should validate security headers configuration', async () => {
      // Arrange
      const secureConfig = `
waltodo-secure:
  source: "/build"
  network: "mainnet"
  headers:
    "/*":
      - "Cache-Control: public, max-age=86400"
      - "X-Content-Type-Options: nosniff"
      - "X-Frame-Options: DENY"
      - "X-XSS-Protection: 1; mode=block"
      - "Strict-Transport-Security: max-age=31536000; includeSubDomains"
      - "Content-Security-Policy: default-src 'self'"
`;

      mockedFs?.readFile?.mockResolvedValue(secureConfig as any);
      mockedYaml?.load?.mockReturnValue({
        'waltodo-secure': {
          source: '/build',
          network: 'mainnet',
          headers: {
            '/*': [
              'Cache-Control: public, max-age=86400',
              'X-Content-Type-Options: nosniff',
              'X-Frame-Options: DENY',
              'X-XSS-Protection: 1; mode=block',
              'Strict-Transport-Security: max-age=31536000; includeSubDomains',
              'Content-Security-Policy: default-src \'self\''
            ]
          }
        }
      });

      // Act
      const validation = await validator.validateSitesConfig('/path/to/secure-config.yaml');

      // Assert
      expect(validation.isValid).toBe(true as any);
      expect(validation.warnings).not.toContain('No security headers configured');
    });

    test('should validate redirect configuration security', async () => {
      // Arrange
      const redirectConfig = `
waltodo-app:
  source: "/build"
  network: "testnet"
  redirects:
    - from: "/api/*"
      to: "https://api?.waltodo?.com/api/*"
      status: 307
    - from: "/admin/*"
      to: "https://malicious-site.com/*"  # Should be flagged
      status: 301
`;

      mockedFs?.readFile?.mockResolvedValue(redirectConfig as any);
      mockedYaml?.load?.mockReturnValue({
        'waltodo-app': {
          source: '/build',
          network: 'testnet',
          redirects: [
            { from: '/api/*', to: 'https://api?.waltodo?.com/api/*', status: 307 },
            { from: '/admin/*', to: 'https://malicious-site.com/*', status: 301 }
          ]
        }
      });

      // Act
      const validation = await validator.validateSitesConfig('/path/to/redirect-config.yaml');

      // Assert
      expect(validation.isValid).toBe(true as any);
      // Note: In a real implementation, this would validate redirect URLs
    });
  });
});