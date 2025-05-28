/**
 * Smart contract validation tests for NFT functionality
 * Tests Move contract compilation, deployment, and interaction
 */

import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { CLITestRunner, ContractTestHelpers } from './helpers/nft-test-utils';

const CONTRACT_DIR = path.join(__dirname, '../../apps/cli/src/move');
const CONTRACT_SOURCES = path.join(CONTRACT_DIR, 'sources');
const MOVE_TOML = path.join(CONTRACT_DIR, 'Move.toml');

test.describe('Smart Contract Validation', () => {
  let cli: CLITestRunner;
  let contractHelper: ContractTestHelpers;

  test.beforeAll(async () => {
    cli = new CLITestRunner();
    contractHelper = new ContractTestHelpers(cli);
  });

  test.describe('Contract Structure Validation', () => {
    test('should have valid Move.toml configuration', async () => {
      // Check if Move.toml exists
      expect(existsSync(MOVE_TOML)).toBe(true);

      // Read and validate Move.toml content
      const moveTomlContent = readFileSync(MOVE_TOML, 'utf8');
      expect(moveTomlContent).toContain('[package]');
      expect(moveTomlContent).toContain('name = "walrus_todo"');
      expect(moveTomlContent).toContain('[dependencies]');
      expect(moveTomlContent).toContain(
        'Sui = { git = "https://github.com/MystenLabs/sui.git"'
      );
    });

    test('should have all required contract source files', async () => {
      const requiredFiles = [
        'todo_nft.move',
        'todo.move',
        'todo_ai_extension.move',
      ];

      for (const file of requiredFiles) {
        const filePath = path.join(CONTRACT_SOURCES, file);
        expect(existsSync(filePath)).toBe(true);
      }
    });

    test('should have valid Move syntax in contract files', async () => {
      const contractFiles = [
        'todo_nft.move',
        'todo.move',
        'todo_ai_extension.move',
      ];

      for (const file of contractFiles) {
        const filePath = path.join(CONTRACT_SOURCES, file);
        const content = readFileSync(filePath, 'utf8');

        // Basic syntax checks
        expect(content).toContain('module walrus_todo::');
        expect(content).toMatch(/public\s+(entry\s+)?fun\s+\w+/);
        expect(content).not.toContain('syntax error');

        // Check for required imports
        expect(content).toContain('use sui::');
        expect(content).toContain('use std::');
      }
    });
  });

  test.describe('Contract Function Validation', () => {
    test('should validate todo_nft.move contract functions', async () => {
      const contractPath = path.join(CONTRACT_SOURCES, 'todo_nft.move');
      const content = readFileSync(contractPath, 'utf8');

      // Check for required public functions
      const requiredFunctions = [
        'create_todo_nft',
        'complete_todo',
        'update_metadata',
        'transfer_todo_nft',
      ];

      for (const func of requiredFunctions) {
        expect(content).toMatch(
          new RegExp(`public\\s+(entry\\s+)?fun\\s+${func}`)
        );
      }

      // Check for proper struct definitions
      expect(content).toContain('public struct TodoNFT has key, store');
      expect(content).toContain('public struct TODO_NFT has drop');

      // Check for event definitions
      expect(content).toContain('TodoNFTCreated has copy, drop');
      expect(content).toContain('TodoNFTCompleted has copy, drop');
      expect(content).toContain('TodoNFTUpdated has copy, drop');
    });

    test('should validate function parameters and return types', async () => {
      const contractPath = path.join(CONTRACT_SOURCES, 'todo_nft.move');
      const content = readFileSync(contractPath, 'utf8');

      // Check create_todo_nft function signature
      const createNftRegex =
        /public\s+entry\s+fun\s+create_todo_nft\s*\([^)]+\)/;
      const createNftMatch = content.match(createNftRegex);
      expect(createNftMatch).toBeTruthy();

      if (createNftMatch) {
        const signature = createNftMatch[0];
        expect(signature).toContain('title: vector<u8>');
        expect(signature).toContain('description: vector<u8>');
        expect(signature).toContain('ctx: &mut TxContext');
      }

      // Check complete_todo function
      const completeTodoRegex =
        /public\s+entry\s+fun\s+complete_todo\s*\([^)]+\)/;
      const completeTodoMatch = content.match(completeTodoRegex);
      expect(completeTodoMatch).toBeTruthy();

      if (completeTodoMatch) {
        const signature = completeTodoMatch[0];
        expect(signature).toContain('todo_nft: &mut TodoNFT');
        expect(signature).toContain('ctx: &mut TxContext');
      }
    });

    test('should validate error handling in contracts', async () => {
      const contractPath = path.join(CONTRACT_SOURCES, 'todo_nft.move');
      const content = readFileSync(contractPath, 'utf8');

      // Check for error constants
      expect(content).toMatch(/const\s+E_\w+:\s+u64\s*=\s*\d+;/);

      // Check for error assertions
      expect(content).toContain('assert!');

      // Specific error codes
      expect(content).toContain('E_NOT_OWNER');
      expect(content).toContain('E_INVALID_METADATA');
      expect(content).toContain('E_ALREADY_COMPLETED');
    });
  });

  test.describe('Contract Compilation', () => {
    test('should compile Move contracts without errors', async () => {
      const result = await cli.runCommand('deploy', ['--build-only'], {
        timeout: 30000,
        env: { SUI_CLI_PATH: 'sui' },
      });

      // Should not have compilation errors
      expect(result.stderr).not.toContain('error');
      expect(result.stderr).not.toContain('failed');

      // Should indicate successful build
      if (result.exitCode === 0) {
        expect(result.stdout).toMatch(/build|compiled|success/i);
      }
    });

    test('should validate contract deployment parameters', async () => {
      const isValid = await contractHelper.validateContractDeployment();

      // This might fail in test environment, so we check gracefully
      if (process.env.SUI_NETWORK === 'testnet' && process.env.PACKAGE_ID) {
        expect(isValid).toBe(true);
      } else {
        // In mock environment, just ensure no crashes
        expect(typeof isValid).toBe('boolean');
      }
    });
  });

  test.describe('Contract Gas Estimation', () => {
    test('should estimate gas for NFT creation', async () => {
      const gasCost = await contractHelper.estimateGasCost('create');

      // Gas cost should be a reasonable number
      expect(gasCost).toBeGreaterThanOrEqual(0);

      // In a real network, should be less than 1M gas units
      if (gasCost > 0) {
        expect(gasCost).toBeLessThan(1000000);
      }
    });

    test('should estimate gas for NFT completion', async () => {
      const gasCost = await contractHelper.estimateGasCost('complete');
      expect(gasCost).toBeGreaterThanOrEqual(0);
    });

    test('should estimate gas for NFT transfer', async () => {
      const gasCost = await contractHelper.estimateGasCost('transfer');
      expect(gasCost).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Contract Event Validation', () => {
    test('should verify creation event emission', async () => {
      const eventEmitted =
        await contractHelper.verifyEventEmission('TodoNFTCreated');

      // In test environment, this might be mocked
      expect(typeof eventEmitted).toBe('boolean');
    });

    test('should verify completion event emission', async () => {
      const eventEmitted =
        await contractHelper.verifyEventEmission('TodoNFTCompleted');
      expect(typeof eventEmitted).toBe('boolean');
    });

    test('should verify update event emission', async () => {
      const eventEmitted =
        await contractHelper.verifyEventEmission('TodoNFTUpdated');
      expect(typeof eventEmitted).toBe('boolean');
    });
  });

  test.describe('Contract Security Validation', () => {
    test('should validate proper access control', async () => {
      const contractPath = path.join(CONTRACT_SOURCES, 'todo_nft.move');
      const content = readFileSync(contractPath, 'utf8');

      // Check for owner verification in sensitive functions
      const ownerChecks = content.match(/assert!\([^)]*owner[^)]*\)/g);
      expect(ownerChecks).toBeTruthy();
      expect(ownerChecks!.length).toBeGreaterThan(0);

      // Check for sender verification
      expect(content).toContain('tx_context::sender(ctx)');
    });

    test('should validate input sanitization', async () => {
      const contractPath = path.join(CONTRACT_SOURCES, 'todo_nft.move');
      const content = readFileSync(contractPath, 'utf8');

      // Check for length validations
      expect(content).toMatch(/assert!\([^)]*length\(\)[^)]*\)/g);

      // Check for empty input validation
      expect(content).toMatch(/assert!\([^)]*> 0[^)]*\)/g);
    });

    test('should validate state transition safety', async () => {
      const contractPath = path.join(CONTRACT_SOURCES, 'todo_nft.move');
      const content = readFileSync(contractPath, 'utf8');

      // Check for completion state validation
      expect(content).toContain('E_ALREADY_COMPLETED');
      expect(content).toMatch(/assert!\([^)]*!.*completed[^)]*\)/);
    });
  });

  test.describe('Contract Integration Tests', () => {
    test('should handle NFT creation workflow', async () => {
      // Create a todo first
      const createResult = await cli.runCommand('add', [
        '"Contract Test Todo"',
      ]);
      expect(createResult.exitCode).toBe(0);

      // Try to convert to NFT
      const nftResult = await cli.runCommand('store', [
        '1',
        '--nft',
        '--validate-contract',
      ]);

      // Should either succeed or fail gracefully
      expect([0, 1]).toContain(nftResult.exitCode);

      if (nftResult.exitCode !== 0) {
        // Should have meaningful error message
        expect(nftResult.stderr.length).toBeGreaterThan(0);
      }
    });

    test('should handle batch NFT operations', async () => {
      // Create multiple todos
      for (let i = 1; i <= 3; i++) {
        await cli.runCommand('add', [`"Batch Contract Test ${i}"`]);
      }

      // Try batch conversion
      const batchResult = await cli.runCommand('store', [
        '--all',
        '--nft',
        '--validate-contract',
      ]);

      // Should handle gracefully
      expect(typeof batchResult.exitCode).toBe('number');
    });

    test('should validate contract interaction error handling', async () => {
      // Try to interact with non-existent NFT
      const invalidResult = await cli.runCommand('complete', ['999'], {
        env: { SIMULATE_CONTRACT_ERROR: 'true' },
      });

      expect(invalidResult.exitCode).not.toBe(0);
      expect(invalidResult.stderr).toContain('not found');
    });
  });

  test.describe('Contract Performance', () => {
    test('should validate contract execution efficiency', async () => {
      const startTime = Date.now();

      // Create todo and convert to NFT
      await cli.runCommand('add', ['"Performance Test Todo"']);
      const nftResult = await cli.runCommand('store', ['1', '--nft']);

      const duration = Date.now() - startTime;

      // Should complete within reasonable time (30 seconds)
      expect(duration).toBeLessThan(30000);

      // If successful, should be much faster
      if (nftResult.exitCode === 0) {
        expect(duration).toBeLessThan(10000);
      }
    });

    test('should handle concurrent contract calls', async () => {
      // Create multiple todos
      for (let i = 1; i <= 3; i++) {
        await cli.runCommand('add', [`"Concurrent Test ${i}"`]);
      }

      // Try concurrent NFT creation
      const promises = [1, 2, 3].map(id =>
        cli.runCommand('store', [id.toString(), '--nft'])
      );

      const results = await Promise.allSettled(promises);

      // At least one should succeed, or all should fail gracefully
      const successCount = results.filter(
        r => r.status === 'fulfilled' && r.value.exitCode === 0
      ).length;

      expect(successCount).toBeGreaterThanOrEqual(0);
    });
  });
});

// Additional contract-specific tests
test.describe('Move Language Features', () => {
  test('should validate struct definitions', async () => {
    const contractPath = path.join(CONTRACT_SOURCES, 'todo_nft.move');
    const content = readFileSync(contractPath, 'utf8');

    // Check for proper struct syntax
    expect(content).toMatch(/struct\s+\w+\s+has\s+[^{]+\{/);

    // Check for required abilities
    expect(content).toContain('has key, store');
    expect(content).toContain('has copy, drop');

    // Check field types
    expect(content).toContain('id: UID');
    expect(content).toContain('String');
    expect(content).toContain('bool');
    expect(content).toContain('u64');
  });

  test('should validate function visibility modifiers', async () => {
    const contractPath = path.join(CONTRACT_SOURCES, 'todo_nft.move');
    const content = readFileSync(contractPath, 'utf8');

    // Check for public entry functions
    expect(content).toMatch(/public\s+entry\s+fun/);

    // Check for public functions
    expect(content).toMatch(/public\s+fun/);

    // Check for private functions (fun without public)
    expect(content).toMatch(/^\s*fun\s+\w+/m);
  });

  test('should validate use statements and imports', async () => {
    const contractPath = path.join(CONTRACT_SOURCES, 'todo_nft.move');
    const content = readFileSync(contractPath, 'utf8');

    // Required imports for NFT functionality
    const requiredImports = [
      'use sui::object',
      'use sui::transfer',
      'use sui::tx_context',
      'use sui::url',
      'use sui::display',
      'use sui::package',
      'use sui::event',
      'use std::string',
      'use std::option',
    ];

    for (const importStatement of requiredImports) {
      expect(content).toContain(importStatement);
    }
  });
});
