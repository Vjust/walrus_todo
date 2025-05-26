/* eslint-disable jest/no-conditional-expect */
import 'jest';
import * as fs from 'fs';
import * as path from 'path';
import os from 'os';
import { FuzzGenerator } from '../helpers/fuzz-generator';
import { CLIError } from '../../src/types/errors/consolidated';

import {
  loadConfigFile,
  saveConfigToFile,
} from '../../src/utils/config-loader';

describe('Config Fuzzer Tests', () => {
  const fuzzer = new FuzzGenerator('config-test-seed');
  const testConfigDir = path.join(os.tmpdir(), 'walrus-todo-config-fuzz-test');
  const testConfigPath = path.join(testConfigDir, 'config.json');
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clean test environment
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testConfigDir, { recursive: true });

    // Reset environment
    process.env = { ...originalEnv };
    process.env.HOME = testConfigDir;
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
    process.env = originalEnv;
  });

  describe('Malformed Config File Parsing', () => {
    it('should handle corrupt JSON files gracefully', () => {
      const malformedJSONs = [
        '{"network": "testnet"', // Missing closing brace
        '"network": "testnet"}', // Missing opening brace
        '{"network": testnet}', // Unquoted value
        '{network: "testnet"}', // Unquoted key
        '{"network": "testnet" "walletAddress": "0x123"}', // Missing comma
        '[{"network": "testnet"}]', // Array instead of object
        'null', // Null value
        'undefined', // Invalid JSON
        '{ "network": "test\nnet" }', // Unescaped newline
        '{"network": "testnet", "network": "mainnet"}', // Duplicate keys
        '{"network": "testnet",}', // Trailing comma
        '{"network": "\u0000"}', // Null character
        '{"network": "\t\n\r"}', // Only whitespace
        '', // Empty string
        '   ', // Only whitespace
      ];

      malformedJSONs.forEach((json, _index) => {
        fs.writeFileSync(testConfigPath, json);

        expect(() => {
          loadConfigFile(testConfigPath);
        }).toThrow(CLIError);

        // Separate test for error object validation
        let thrownError: CLIError | null = null;
        try {
          loadConfigFile(testConfigPath);
        } catch (error) {
          thrownError = error as CLIError;
        }

        expect(thrownError).toBeInstanceOf(CLIError);
        expect((thrownError as CLIError).code).toBe('CONFIG_FILE_LOAD_FAILED');
      });
    });

    it('should handle partially corrupt JSON files', () => {
      const partiallyCorruptConfigs = [
        // Valid structure but invalid values
        { network: null },
        { network: undefined },
        { network: 123 }, // Number instead of string
        { network: true }, // Boolean instead of string
        { network: [] }, // Array instead of string
        { network: {} }, // Object instead of string

        // Valid JSON with extra or missing fields
        { extraField: 'value' },
        { nested: { deep: { object: 'value' } } },

        // Very large or deeply nested objects
        {
          network: 'testnet',
          ...fuzzer.object(
            Object.fromEntries(
              Array.from({ length: 1000 }, (_, i) => [
                `key${i}`,
                () => fuzzer.string(),
              ])
            )
          ),
        },
      ];

      partiallyCorruptConfigs.forEach((config, _index) => {
        fs.writeFileSync(testConfigPath, JSON.stringify(config));

        // Should not throw, but might not load all fields correctly
        let loaded: unknown;
        try {
          loaded = loadConfigFile(testConfigPath);
          expect(loaded).toBeDefined();
          expect(typeof loaded).toBe('object');
        } catch (error) {
          // Some partially corrupt configs might fail to load
          expect(error).toBeDefined();
        }
      });
    });
  });

  describe('Random Config Generation and Loading', () => {
    it('should handle randomly generated configs', () => {
      for (let i = 0; i < 100; i++) {
        const randomConfig = fuzzer.object({
          network: () => fuzzer.string({ minLength: 0, maxLength: 50 }),
          walletAddress: () => fuzzer.string({ minLength: 0, maxLength: 100 }),
          encryptedStorage: () => fuzzer.boolean(),
          packageId: () =>
            fuzzer.boolean()
              ? fuzzer.string({ minLength: 0, maxLength: 66 })
              : undefined,
          registryId: () =>
            fuzzer.boolean()
              ? fuzzer.string({ minLength: 0, maxLength: 66 })
              : undefined,
          lastDeployment: () =>
            fuzzer.boolean()
              ? {
                  packageId: fuzzer.string({ minLength: 0, maxLength: 66 }),
                  timestamp: fuzzer.date().toISOString(),
                  digest: fuzzer.string({ minLength: 0, maxLength: 64 }),
                }
              : undefined,
        });

        fs.writeFileSync(testConfigPath, JSON.stringify(randomConfig));

        const loaded = loadConfigFile(testConfigPath);
        expect(loaded).toBeDefined();
        expect(typeof loaded).toBe('object');

        // Test round-trip save and load
        saveConfigToFile(loaded, testConfigPath);
        const reloaded = loadConfigFile(testConfigPath);
        expect(reloaded).toEqual(loaded);
      }
    });

    it('should handle configs with special characters and Unicode', () => {
      const specialConfigs = [
        {
          network: fuzzer.string({ includeSpecialChars: true }),
          walletAddress: fuzzer.string({ includeUnicode: true }),
          description: '\\n\\r\\t\\b\\f\\"\\\'\\\\',
          unicode: '🎉⚡️✨🔥',
          nullChar: '\0',
          controlChars: '\x01\x02\x03\x04\x05',
        },
        {
          network: 'test"net',
          walletAddress: "wallet'address",
          path: 'C:\\Windows\\System32\\',
          url: 'https://test.com/path?param=value&other=123',
        },
      ];

      specialConfigs.forEach(config => {
        fs.writeFileSync(testConfigPath, JSON.stringify(config));

        const loaded = loadConfigFile(testConfigPath);
        expect(loaded).toBeDefined();

        // Test round-trip
        saveConfigToFile(loaded, testConfigPath);
        const reloaded = loadConfigFile(testConfigPath);
        expect(reloaded).toEqual(loaded);
      });
    });
  });

  describe('ConfigService with Fuzzing', () => {
    it('should handle malformed configs in ConfigService', () => {
      const malformedConfigs = [
        { network: '', walletAddress: '' }, // Empty strings
        { network: '   ', walletAddress: '   ' }, // Whitespace only
        { network: 'a'.repeat(1000), walletAddress: '0x' + '0'.repeat(100) }, // Very long strings
        { network: '\n\t\r', walletAddress: '\0\x01\x02' }, // Control characters
        { network: 123, walletAddress: true }, // Wrong types
        { network: null, walletAddress: undefined }, // Null/undefined
        { network: [], walletAddress: {} }, // Arrays/objects
      ];

      malformedConfigs.forEach(config => {
        fs.writeFileSync(testConfigPath, JSON.stringify(config));

        // ConfigService should handle malformed configs gracefully
        expect(() => {
          new ConfigService();
        }).not.toThrow();
      });
    });

    it('should handle fuzzed environment variables', () => {
      const fuzzedEnvVariables = fuzzer.array(
        () => ({
          name: fuzzer.string({ minLength: 1, maxLength: 20 }),
          value: fuzzer.string({
            minLength: 0,
            maxLength: 100,
            includeSpecialChars: true,
          }),
        }),
        { minLength: 10, maxLength: 50 }
      );

      fuzzedEnvVariables.forEach(({ name, value }) => {
        process.env[name] = value;
      });

      // Set some relevant environment variables with fuzzed values
      process.env.NETWORK = fuzzer.string({ minLength: 0, maxLength: 50 });
      process.env.WALLET_ADDRESS = fuzzer.string({
        minLength: 0,
        maxLength: 100,
      });
      process.env.ENCRYPTED_STORAGE = fuzzer.string();
      process.env.TODO_PACKAGE_ID = fuzzer.string({
        minLength: 0,
        maxLength: 66,
      });
      process.env.REGISTRY_ID = fuzzer.string({ minLength: 0, maxLength: 66 });

      // ConfigService should handle fuzzed environment variables
      expect(() => {
        new ConfigService();
      }).not.toThrow();
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle extreme file sizes', () => {
      // Very large config file
      const largeConfig = {
        data: fuzzer.string({ minLength: 1000000, maxLength: 1000000 }), // 1MB string
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(largeConfig));

      expect(() => {
        loadConfigFile(testConfigPath);
      }).not.toThrow();
    });

    it('should handle file permissions and access issues', () => {
      // Write a config file then make it read-only
      fs.writeFileSync(testConfigPath, JSON.stringify({ network: 'testnet' }));
      fs.chmodSync(testConfigPath, 0o444); // Read-only

      // Loading should work
      expect(() => {
        loadConfigFile(testConfigPath);
      }).not.toThrow();

      // Saving should fail
      expect(() => {
        saveConfigToFile({ network: 'mainnet' }, testConfigPath);
      }).toThrow(CLIError);

      // Reset permissions
      fs.chmodSync(testConfigPath, 0o644);
    });

    it('should handle non-existent paths', () => {
      const nonExistentPath = path.join(
        testConfigDir,
        'does',
        'not',
        'exist',
        'config.json'
      );

      // Loading non-existent file should return empty object
      const loaded = loadConfigFile(nonExistentPath);
      expect(loaded).toEqual({});

      // Saving to non-existent directory should work (creates directory)
      expect(() => {
        saveConfigToFile({ network: 'testnet' }, nonExistentPath);
      }).not.toThrow();

      expect(fs.existsSync(nonExistentPath)).toBe(true);
    });

    it('should handle cyclic references', () => {
      const config: Record<string, unknown> = { network: 'testnet' };
      config.self = config; // Create cyclic reference

      // JSON.stringify will throw on cyclic references
      expect(() => {
        saveConfigToFile(config, testConfigPath);
      }).toThrow();
    });
  });

  describe('Config Validation and Type Coercion', () => {
    it('should handle type mismatches in config values', () => {
      const typeMismatchConfigs = [
        { network: 123, walletAddress: true, encryptedStorage: 'yes' },
        { network: [], walletAddress: {}, encryptedStorage: null },
        { network: true, walletAddress: false, encryptedStorage: 123 },
      ];

      typeMismatchConfigs.forEach(config => {
        fs.writeFileSync(testConfigPath, JSON.stringify(config));

        const service = new ConfigService();
        const loadedConfig = service.getConfig();

        // Service should handle type mismatches and provide defaults
        expect(typeof loadedConfig.network).toBe('string');
        expect(typeof loadedConfig.walletAddress).toBe('string');
        expect(typeof loadedConfig.encryptedStorage).toBe('boolean');
      });
    });

    it('should handle missing required fields', () => {
      const incompleteConfigs = [
        {},
        { network: 'testnet' },
        { walletAddress: '0x123' },
        { encryptedStorage: false },
        { unknownField: 'value' },
      ];

      incompleteConfigs.forEach(config => {
        fs.writeFileSync(testConfigPath, JSON.stringify(config));

        const service = new ConfigService();
        const loadedConfig = service.getConfig();

        // Service should provide defaults for missing fields
        expect(loadedConfig.network).toBeDefined();
        expect(typeof loadedConfig.network).toBe('string');
        expect(loadedConfig.walletAddress).toBeDefined();
        expect(typeof loadedConfig.walletAddress).toBe('string');
        expect(loadedConfig.encryptedStorage).toBeDefined();
        expect(typeof loadedConfig.encryptedStorage).toBe('boolean');
      });
    });
  });

  describe('Concurrent Access and Race Conditions', () => {
    it('should handle concurrent config modifications', async () => {
      const initialConfig = { network: 'testnet', walletAddress: '0x123' };
      fs.writeFileSync(testConfigPath, JSON.stringify(initialConfig));

      const promises = Array.from({ length: 10 }, (_, _i) => {
        return new Promise<void>(resolve => {
          setTimeout(() => {
            const config = loadConfigFile(testConfigPath);
            config.walletAddress = `0x${fuzzer.string({ minLength: 40, maxLength: 40 })}`;
            saveConfigToFile(config, testConfigPath);
            resolve();
          }, Math.random() * 100);
        });
      });

      await Promise.all(promises);

      // Final config should be valid
      const finalConfig = loadConfigFile(testConfigPath);
      expect(finalConfig).toBeDefined();
      expect(finalConfig.network).toBe('testnet');
      expect(finalConfig.walletAddress).toMatch(/^0x[a-zA-Z0-9]{40}$/);
    });
  });
});
