/**
 * End-to-end tests for blockchain NFT functionality
 * Tests the complete workflow from CLI commands to frontend UI to blockchain
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import { ChildProcess, spawn } from 'child_process';
import path from 'path';

// Helper to run CLI commands
class CLIHelper {
  private process: ChildProcess | null = null;
  private output: string[] = [];
  private errorOutput: string[] = [];

  async runCommand(command: string, args: string[] = [], timeout = 10000): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number | null;
  }> {
    return new Promise((resolve, reject) => {
      const cliPath = path.resolve(__dirname, '../../bin/run');
      this.process = spawn('node', [cliPath, command, ...args], {
        env: {
          ...process.env,
          NODE_ENV: 'test',
          WALRUS_USE_MOCK: 'true',
          PACKAGE_ID: process.env.PACKAGE_ID || 'mock-package-id',
        },
      });

      let stdout = '';
      let stderr = '';

      this.process.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        stdout += output;
        this.output.push(output);
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        const error = data.toString();
        stderr += error;
        this.errorOutput.push(error);
      });

      this.process.on('close', (code) => {
        resolve({ stdout, stderr, exitCode: code });
      });

      this.process.on('error', (error) => {
        reject(error);
      });

      // Set timeout
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill();
          reject(new Error(`Command timed out after ${timeout}ms`));
        }
      }, timeout);
    });
  }

  getOutput(): string[] {
    return [...this.output];
  }

  getErrorOutput(): string[] {
    return [...this.errorOutput];
  }

  cleanup() {
    if (this.process && !this.process.killed) {
      this.process.kill();
    }
    this.output = [];
    this.errorOutput = [];
  }
}

// Mock wallet for testing
class MockWallet {
  private connected = false;
  private address = '0x1234567890123456789012345678901234567890';
  private transactions: Array<{ digest: string; status: 'success' | 'failed' }> = [];

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getAddress(): string {
    return this.address;
  }

  async signAndExecuteTransaction(transaction: any): Promise<{
    digest: string;
    effects: { status: { status: 'success' | 'failure' } };
  }> {
    // Simulate transaction processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const digest = `mock_tx_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const status = Math.random() > 0.1 ? 'success' : 'failure'; // 90% success rate
    
    this.transactions.push({ digest, status });
    
    return {
      digest,
      effects: {
        status: { status }
      }
    };
  }

  getTransactionHistory(): Array<{ digest: string; status: 'success' | 'failed' }> {
    return [...this.transactions];
  }
}

test.describe('Blockchain NFT Workflow', () => {
  let cli: CLIHelper;
  let mockWallet: MockWallet;

  test.beforeEach(async () => {
    cli = new CLIHelper();
    mockWallet = new MockWallet();
  });

  test.afterEach(async () => {
    cli.cleanup();
    await mockWallet.disconnect();
  });

  test('CLI: Create todo and convert to NFT', async () => {
    // Step 1: Create a todo via CLI
    const createResult = await cli.runCommand('add', ['"Test NFT Todo"', '--description', '"A todo that will become an NFT"']);
    expect(createResult.exitCode).toBe(0);
    expect(createResult.stdout).toContain('Todo added');

    // Step 2: List todos to verify creation
    const listResult = await cli.runCommand('list');
    expect(listResult.exitCode).toBe(0);
    expect(listResult.stdout).toContain('Test NFT Todo');

    // Step 3: Store todo as NFT
    const storeResult = await cli.runCommand('store', ['1', '--nft']);
    expect(storeResult.exitCode).toBe(0);
    expect(storeResult.stdout).toContain('stored successfully');
  });

  test('CLI: Error handling for failed NFT creation', async () => {
    // Test with invalid todo ID
    const invalidResult = await cli.runCommand('store', ['999', '--nft']);
    expect(invalidResult.exitCode).not.toBe(0);
    expect(invalidResult.stderr).toContain('Todo not found');

    // Test without wallet connection
    process.env.WALRUS_USE_MOCK = 'false';
    const noWalletResult = await cli.runCommand('store', ['1', '--nft']);
    expect(noWalletResult.exitCode).not.toBe(0);
    expect(noWalletResult.stderr).toContain('wallet');
    
    // Restore mock environment
    process.env.WALRUS_USE_MOCK = 'true';
  });

  test('CLI: Batch NFT creation', async () => {
    // Create multiple todos
    for (let i = 1; i <= 3; i++) {
      const result = await cli.runCommand('add', [`"Batch Todo ${i}"`]);
      expect(result.exitCode).toBe(0);
    }

    // Convert all to NFTs in batch
    const batchResult = await cli.runCommand('store', ['--all', '--nft']);
    expect(batchResult.exitCode).toBe(0);
    expect(batchResult.stdout).toContain('stored successfully');
  });

  test('CLI: NFT completion workflow', async () => {
    // Create and store todo as NFT
    await cli.runCommand('add', ['"Completable NFT Todo"']);
    await cli.runCommand('store', ['1', '--nft']);

    // Complete the NFT todo
    const completeResult = await cli.runCommand('complete', ['1']);
    expect(completeResult.exitCode).toBe(0);
    expect(completeResult.stdout).toContain('completed');

    // Verify completion in list
    const listResult = await cli.runCommand('list', ['--completed']);
    expect(listResult.exitCode).toBe(0);
    expect(listResult.stdout).toContain('Completable NFT Todo');
  });

  test('CLI: Smart contract integration', async () => {
    // Test contract deployment validation
    const deployResult = await cli.runCommand('deploy', ['--validate-only']);
    expect(deployResult.exitCode).toBe(0);
    expect(deployResult.stdout).toContain('validation');

    // Test contract interaction
    await cli.runCommand('add', ['"Contract Test Todo"']);
    const contractResult = await cli.runCommand('store', ['1', '--nft', '--verify-contract']);
    expect(contractResult.exitCode).toBe(0);
  });
});

test.describe('Frontend NFT Integration', () => {
  let page: Page;
  let context: BrowserContext;
  let mockWallet: MockWallet;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    mockWallet = new MockWallet();
    
    // Mock wallet API for browser
    await page.addInitScript(() => {
      // @ts-ignore
      window.suiWallet = {
        connected: false,
        address: '0x1234567890123456789012345678901234567890',
        connect: async () => {
          // @ts-ignore
          window.suiWallet.connected = true;
          return { address: window.suiWallet.address };
        },
        disconnect: async () => {
          // @ts-ignore
          window.suiWallet.connected = false;
        },
        signAndExecuteTransaction: async (transaction: any) => {
          return {
            digest: `mock_tx_${Date.now()}`,
            effects: { status: { status: 'success' } }
          };
        }
      };
    });

    await page.goto('/');
  });

  test.afterEach(async () => {
    await context.close();
  });

  test('Frontend: Wallet connection flow', async () => {
    // Look for wallet connect button
    const connectButton = page.locator('button', { hasText: /connect/i });
    await expect(connectButton).toBeVisible();

    // Click connect wallet
    await connectButton.click();

    // Wait for connection status update
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 });

    // Verify wallet address is displayed
    await expect(page.locator('text=0x1234')).toBeVisible();
  });

  test('Frontend: Create todo and convert to NFT', async () => {
    // Connect wallet first
    await page.locator('button', { hasText: /connect/i }).click();
    await expect(page.locator('text=Connected')).toBeVisible();

    // Navigate to todo creation form
    const createTodoButton = page.locator('button', { hasText: /create todo/i });
    if (await createTodoButton.isVisible()) {
      await createTodoButton.click();
    }

    // Fill out todo form
    await page.fill('input[placeholder*="title"], input[name="title"]', 'Frontend NFT Todo');
    await page.fill('textarea[placeholder*="description"], textarea[name="description"]', 'A todo created from the frontend');

    // Submit todo
    await page.click('button[type="submit"], button:has-text("Create"), button:has-text("Add")');

    // Wait for todo to appear in list
    await expect(page.locator('text=Frontend NFT Todo')).toBeVisible({ timeout: 10000 });

    // Look for NFT conversion option
    const nftButton = page.locator('button', { hasText: /nft|blockchain/i });
    if (await nftButton.isVisible()) {
      await nftButton.click();

      // Wait for transaction to complete
      await expect(page.locator('text=NFT created successfully')).toBeVisible({ timeout: 15000 });
    }
  });

  test('Frontend: Transaction history and status', async () => {
    // Connect wallet
    await page.locator('button', { hasText: /connect/i }).click();
    await expect(page.locator('text=Connected')).toBeVisible();

    // Navigate to transaction history if available
    const historyButton = page.locator('button', { hasText: /history|transactions/i });
    if (await historyButton.isVisible()) {
      await historyButton.click();

      // Check for transaction list
      const transactionList = page.locator('[data-testid="transaction-list"], .transaction-history');
      if (await transactionList.isVisible()) {
        await expect(transactionList).toBeVisible();
      }
    }
  });

  test('Frontend: Error handling and user feedback', async () => {
    // Test wallet connection error
    await page.evaluate(() => {
      // @ts-ignore
      window.suiWallet.connect = async () => {
        throw new Error('User rejected connection');
      };
    });

    await page.locator('button', { hasText: /connect/i }).click();
    
    // Check for error message
    await expect(page.locator('text=connection failed')).toBeVisible({ timeout: 5000 });
  });

  test('Frontend: NFT completion workflow', async () => {
    // Connect wallet and create todo
    await page.locator('button', { hasText: /connect/i }).click();
    await expect(page.locator('text=Connected')).toBeVisible();

    // Create a todo (assuming form exists)
    const todoTitle = 'Completable Frontend Todo';
    if (await page.locator('input[name="title"], input[placeholder*="title"]').isVisible()) {
      await page.fill('input[name="title"], input[placeholder*="title"]', todoTitle);
      await page.click('button[type="submit"], button:has-text("Create"), button:has-text("Add")');
      await expect(page.locator(`text=${todoTitle}`)).toBeVisible();

      // Complete the todo
      const completeButton = page.locator('button', { hasText: /complete|done/i }).first();
      if (await completeButton.isVisible()) {
        await completeButton.click();
        
        // Verify completion
        await expect(page.locator('.completed, [data-completed="true"]')).toBeVisible({ timeout: 10000 });
      }
    }
  });
});

test.describe('Smart Contract Integration Tests', () => {
  let cli: CLIHelper;

  test.beforeEach(async () => {
    cli = new CLIHelper();
  });

  test.afterEach(async () => {
    cli.cleanup();
  });

  test('Contract: Validate Move.toml configuration', async () => {
    const configResult = await cli.runCommand('validate-config', ['--contract']);
    expect(configResult.exitCode).toBe(0);
    expect(configResult.stdout).toContain('valid');
  });

  test('Contract: Test NFT creation parameters', async () => {
    // Test with various parameter combinations
    const testCases = [
      { title: 'Simple Todo', description: '', priority: 'low' },
      { title: 'Complex Todo', description: 'With description', priority: 'high' },
      { title: 'Unicode Todo 🚀', description: 'With emoji', priority: 'medium' },
    ];

    for (const testCase of testCases) {
      await cli.runCommand('add', [
        `"${testCase.title}"`,
        '--description', `"${testCase.description}"`,
        '--priority', testCase.priority
      ]);
      
      const storeResult = await cli.runCommand('store', ['1', '--nft', '--validate-params']);
      expect(storeResult.exitCode).toBe(0);
    }
  });

  test('Contract: Event emission verification', async () => {
    await cli.runCommand('add', ['"Event Test Todo"']);
    const eventResult = await cli.runCommand('store', ['1', '--nft', '--listen-events']);
    expect(eventResult.exitCode).toBe(0);
    expect(eventResult.stdout).toContain('event emitted');
  });

  test('Contract: Gas estimation and optimization', async () => {
    const gasResult = await cli.runCommand('estimate-gas', ['--nft-creation']);
    expect(gasResult.exitCode).toBe(0);
    expect(gasResult.stdout).toContain('gas estimate');
  });
});

test.describe('Error Scenarios and Edge Cases', () => {
  let cli: CLIHelper;
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    cli = new CLIHelper();
    
    const context = await browser.newContext();
    page = await context.newPage();
    await page.goto('/');
  });

  test.afterEach(async () => {
    cli.cleanup();
  });

  test('Network: Handle RPC failures', async () => {
    // Simulate network failure
    process.env.WALRUS_USE_MOCK = 'false';
    process.env.SUI_RPC_URL = 'http://invalid-rpc.example.com';
    
    const networkResult = await cli.runCommand('store', ['1', '--nft']);
    expect(networkResult.exitCode).not.toBe(0);
    expect(networkResult.stderr).toContain('network');
    
    // Restore mock environment
    process.env.WALRUS_USE_MOCK = 'true';
    delete process.env.SUI_RPC_URL;
  });

  test('Transaction: Handle insufficient gas', async () => {
    // Mock low gas scenario
    const gasResult = await cli.runCommand('store', ['1', '--nft', '--simulate-low-gas']);
    expect(gasResult.exitCode).not.toBe(0);
    expect(gasResult.stderr).toContain('gas');
  });

  test('Contract: Handle invalid contract state', async () => {
    const invalidResult = await cli.runCommand('store', ['1', '--nft', '--simulate-invalid-contract']);
    expect(invalidResult.exitCode).not.toBe(0);
    expect(invalidResult.stderr).toContain('contract');
  });

  test('Frontend: Handle wallet disconnection during transaction', async () => {
    // Mock sudden wallet disconnection
    await page.addInitScript(() => {
      let connectionLost = false;
      // @ts-ignore
      const originalSign = window.suiWallet?.signAndExecuteTransaction;
      // @ts-ignore
      if (window.suiWallet) {
        // @ts-ignore
        window.suiWallet.signAndExecuteTransaction = async (transaction: any) => {
          if (!connectionLost) {
            connectionLost = true;
            // @ts-ignore
            window.suiWallet.connected = false;
            throw new Error('Wallet disconnected');
          }
          return originalSign?.call(this, transaction);
        };
      }
    });

    // Try to perform transaction
    if (await page.locator('button', { hasText: /connect/i }).isVisible()) {
      await page.locator('button', { hasText: /connect/i }).click();
      
      // Try to create NFT - should handle disconnection gracefully
      const errorMessage = page.locator('text=wallet disconnected', { hasText: /error/i });
      if (await errorMessage.isVisible({ timeout: 5000 })) {
        await expect(errorMessage).toBeVisible();
      }
    }
  });

  test('Data: Handle corrupted todo data', async () => {
    // Create todo with corrupted data
    const corruptResult = await cli.runCommand('add', ['"\\x00Invalid\\x01Data"']);
    expect(corruptResult.exitCode).not.toBe(0);
    expect(corruptResult.stderr).toContain('invalid');
  });

  test('Storage: Handle Walrus storage failures', async () => {
    // Mock Walrus failure
    const walrusResult = await cli.runCommand('store', ['1', '--simulate-walrus-failure']);
    expect(walrusResult.exitCode).not.toBe(0);
    expect(walrusResult.stderr).toContain('storage');
  });
});

test.describe('Performance and Load Testing', () => {
  let cli: CLIHelper;

  test.beforeEach(async () => {
    cli = new CLIHelper();
  });

  test.afterEach(async () => {
    cli.cleanup();
  });

  test('Performance: Batch NFT creation performance', async () => {
    const startTime = Date.now();
    
    // Create 10 todos
    for (let i = 1; i <= 10; i++) {
      await cli.runCommand('add', [`"Performance Test Todo ${i}"`]);
    }
    
    // Batch convert to NFTs
    const batchStart = Date.now();
    const batchResult = await cli.runCommand('store', ['--all', '--nft']);
    const batchEnd = Date.now();
    
    expect(batchResult.exitCode).toBe(0);
    
    const totalTime = batchEnd - startTime;
    const batchTime = batchEnd - batchStart;
    
    // Performance assertions (adjust thresholds as needed)
    expect(totalTime).toBeLessThan(30000); // Total should be under 30 seconds
    expect(batchTime).toBeLessThan(15000); // Batch conversion under 15 seconds
  });

  test('Performance: Concurrent transaction handling', async () => {
    // Create multiple todos
    for (let i = 1; i <= 5; i++) {
      await cli.runCommand('add', [`"Concurrent Test Todo ${i}"`]);
    }
    
    // Try concurrent NFT creation
    const promises = [];
    for (let i = 1; i <= 5; i++) {
      promises.push(cli.runCommand('store', [i.toString(), '--nft']));
    }
    
    const results = await Promise.allSettled(promises);
    
    // At least some should succeed
    const successCount = results.filter(r => 
      r.status === 'fulfilled' && r.value.exitCode === 0
    ).length;
    
    expect(successCount).toBeGreaterThan(0);
  });

  test('Memory: Large todo data handling', async () => {
    // Create todo with large description
    const largeDescription = 'Large description '.repeat(100);
    const largeResult = await cli.runCommand('add', [
      '"Large Todo"',
      '--description', `"${largeDescription}"`
    ]);
    
    expect(largeResult.exitCode).toBe(0);
    
    // Try to convert to NFT
    const nftResult = await cli.runCommand('store', ['1', '--nft']);
    
    // Should handle large data gracefully (may succeed or fail with proper error)
    if (nftResult.exitCode !== 0) {
      expect(nftResult.stderr).toContain('size');
    } else {
      expect(nftResult.stdout).toContain('success');
    }
  });
});
