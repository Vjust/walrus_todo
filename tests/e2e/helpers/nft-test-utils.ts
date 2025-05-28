/**
 * Utility functions for NFT testing
 * Provides reusable test helpers for blockchain NFT functionality
 */

import { Page } from 'playwright';
import { ChildProcess, spawn } from 'child_process';
import path from 'path';

export interface MockTransaction {
  digest: string;
  status: 'success' | 'failure';
  objectId?: string;
  error?: string;
}

export interface MockWalletConfig {
  address: string;
  connected: boolean;
  failureRate: number; // 0-1 (0 = never fail, 1 = always fail)
  gasBalance: number;
}

export interface TestTodo {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  isNFT: boolean;
  objectId?: string;
}

/**
 * Mock wallet implementation for testing
 */
export class MockWalletManager {
  private transactions: MockTransaction[] = [];
  private config: MockWalletConfig;

  constructor(config: Partial<MockWalletConfig> = {}) {
    this.config = {
      address: '0x1234567890123456789012345678901234567890',
      connected: false,
      failureRate: 0.1, // 10% failure rate by default
      gasBalance: 1000000, // Mock gas balance
      ...config,
    };
  }

  getWalletScript(): string {
    return `
      window.mockWallet = {
        config: ${JSON.stringify(this.config)},
        transactions: [],
        
        connect: async function() {
          await new Promise(resolve => setTimeout(resolve, 500));
          this.config.connected = true;
          this.dispatchEvent('connect', { address: this.config.address });
          return { address: this.config.address };
        },
        
        disconnect: async function() {
          this.config.connected = false;
          this.dispatchEvent('disconnect');
        },
        
        signAndExecuteTransaction: async function(transaction) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Simulate gas check
          if (this.config.gasBalance < 1000) {
            throw new Error('Insufficient gas for transaction');
          }
          
          // Simulate random failures
          const shouldFail = Math.random() < this.config.failureRate;
          if (shouldFail) {
            const error = 'Transaction failed: ' + ['Insufficient funds', 'Network error', 'Contract error'][Math.floor(Math.random() * 3)];
            throw new Error(error);
          }
          
          const digest = 'mock_tx_' + Date.now() + '_' + Math.random().toString(36).substring(7);
          const objectId = 'mock_nft_' + Date.now();
          
          const result = {
            digest,
            effects: {
              status: { status: 'success' },
              created: [{
                reference: { objectId },
                objectType: 'TodoNFT'
              }],
              gasUsed: { computationCost: 100, storageCost: 50 }
            }
          };
          
          this.transactions.push({
            digest,
            status: 'success',
            objectId
          });
          
          this.config.gasBalance -= 1000;
          this.dispatchEvent('transaction', result);
          return result;
        },
        
        getTransactionHistory: function() {
          return this.transactions;
        },
        
        // Event system
        listeners: {},
        addEventListener: function(event, callback) {
          if (!this.listeners[event]) this.listeners[event] = [];
          this.listeners[event].push(callback);
        },
        
        removeEventListener: function(event, callback) {
          if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
          }
        },
        
        dispatchEvent: function(event, data) {
          if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
          }
        }
      };
      
      // Expose as standard wallet APIs
      window.suiWallet = window.mockWallet;
      window.sui = { wallet: window.mockWallet };
      window.slush = { wallet: window.mockWallet };
    `;
  }

  addTransaction(transaction: MockTransaction): void {
    this.transactions.push(transaction);
  }

  getTransactions(): MockTransaction[] {
    return [...this.transactions];
  }

  setFailureRate(rate: number): void {
    this.config.failureRate = Math.max(0, Math.min(1, rate));
  }

  setGasBalance(balance: number): void {
    this.config.gasBalance = balance;
  }
}

/**
 * CLI command runner for testing
 */
export class CLITestRunner {
  private cliPath: string;
  private defaultEnv: Record<string, string>;

  constructor(
    options: { cliPath?: string; env?: Record<string, string> } = {}
  ) {
    this.cliPath =
      options.cliPath || path.resolve(__dirname, '../../../bin/run');
    this.defaultEnv = {
      NODE_ENV: 'test',
      WALRUS_USE_MOCK: 'true',
      PACKAGE_ID: process.env.PACKAGE_ID || 'mock-package-id',
      ...options.env,
    };
  }

  async runCommand(
    command: string,
    args: string[] = [],
    options: { timeout?: number; env?: Record<string, string> } = {}
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number | null;
    duration: number;
  }> {
    const startTime = Date.now();
    const timeout = options.timeout || 10000;
    const env = { ...this.defaultEnv, ...options.env };

    return new Promise((resolve, reject) => {
      const process = spawn('node', [this.cliPath, command, ...args], { env });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', data => {
        stdout += data.toString();
      });

      process.stderr?.on('data', data => {
        stderr += data.toString();
      });

      process.on('close', code => {
        const duration = Date.now() - startTime;
        resolve({ stdout, stderr, exitCode: code, duration });
      });

      process.on('error', error => {
        reject(error);
      });

      setTimeout(() => {
        process.kill();
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);
    });
  }

  async createTodos(count: number, prefix = 'Test Todo'): Promise<string[]> {
    const todos: string[] = [];
    for (let i = 1; i <= count; i++) {
      const title = `${prefix} ${i}`;
      const result = await this.runCommand('add', [`"${title}"`]);
      if (result.exitCode === 0) {
        todos.push(title);
      }
    }
    return todos;
  }

  async batchCreateNFTs(todoIds: string[]): Promise<{
    successful: string[];
    failed: string[];
  }> {
    const successful: string[] = [];
    const failed: string[] = [];

    for (const todoId of todoIds) {
      try {
        const result = await this.runCommand('store', [todoId, '--nft']);
        if (result.exitCode === 0) {
          successful.push(todoId);
        } else {
          failed.push(todoId);
        }
      } catch (error) {
        failed.push(todoId);
      }
    }

    return { successful, failed };
  }
}

/**
 * Page interaction helpers for testing
 */
export class PageTestHelpers {
  constructor(private page: Page) {}

  async waitForWalletConnection(timeout = 10000): Promise<boolean> {
    try {
      await this.page.waitForFunction(
        () => {
          const text = document.body.innerText.toLowerCase();
          return text.includes('connected') || text.includes('0x');
        },
        { timeout }
      );
      return true;
    } catch {
      return false;
    }
  }

  async connectWallet(): Promise<boolean> {
    try {
      // Look for connect button
      const connectButton = await this.page
        .locator('button', { hasText: /connect/i })
        .first();
      if (await connectButton.isVisible()) {
        await connectButton.click();
        return await this.waitForWalletConnection();
      }

      // Try programmatic connection
      await this.page.evaluate(() => {
        if (window.suiWallet || window.mockWallet) {
          const wallet = window.suiWallet || window.mockWallet;
          wallet.connect();
        }
      });

      return await this.waitForWalletConnection();
    } catch {
      return false;
    }
  }

  async createTodo(title: string, description = ''): Promise<boolean> {
    try {
      // Find title input
      const titleInput = this.page
        .locator('input[name="title"], input[placeholder*="title"]')
        .first();
      if (await titleInput.isVisible()) {
        await titleInput.fill(title);

        // Find description input if provided
        if (description) {
          const descInput = this.page
            .locator(
              'textarea[name="description"], textarea[placeholder*="description"]'
            )
            .first();
          if (await descInput.isVisible()) {
            await descInput.fill(description);
          }
        }

        // Submit form
        const submitButton = this.page
          .locator(
            'button[type="submit"], button:has-text("Create"), button:has-text("Add")'
          )
          .first();
        if (await submitButton.isVisible()) {
          await submitButton.click();

          // Wait for todo to appear
          await this.page.waitForFunction(
            (todoTitle: string) => document.body.innerText.includes(todoTitle),
            title,
            { timeout: 5000 }
          );
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  async convertToNFT(todoSelector?: string): Promise<boolean> {
    try {
      let nftButton;

      if (todoSelector) {
        // Look for NFT button within specific todo
        nftButton = this.page
          .locator(`${todoSelector} button:has-text("NFT")`)
          .first();
      } else {
        // Look for any NFT button
        nftButton = this.page
          .locator('button', { hasText: /nft|blockchain/i })
          .first();
      }

      if (await nftButton.isVisible()) {
        await nftButton.click();

        // Wait for transaction completion
        await this.page.waitForFunction(
          () => {
            const text = document.body.innerText.toLowerCase();
            return (
              text.includes('nft created') ||
              text.includes('success') ||
              text.includes('failed')
            );
          },
          { timeout: 15000 }
        );

        // Check if successful
        const isSuccess = await this.page.evaluate(() => {
          const text = document.body.innerText.toLowerCase();
          return text.includes('nft created') || text.includes('success');
        });

        return isSuccess;
      }
      return false;
    } catch {
      return false;
    }
  }

  async completeTodo(todoSelector?: string): Promise<boolean> {
    try {
      let completeButton;

      if (todoSelector) {
        completeButton = this.page
          .locator(`${todoSelector} button:has-text("Complete")`)
          .first();
      } else {
        completeButton = this.page
          .locator('button', { hasText: /complete|done/i })
          .first();
      }

      if (await completeButton.isVisible()) {
        await completeButton.click();

        // Wait for completion
        await this.page.waitForFunction(
          () => {
            const text = document.body.innerText.toLowerCase();
            return text.includes('completed') || text.includes('done');
          },
          { timeout: 10000 }
        );
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async getTransactionHistory(): Promise<MockTransaction[]> {
    return await this.page.evaluate(() => {
      if (window.mockWallet) {
        return window.mockWallet.getTransactionHistory();
      }
      return [];
    });
  }

  async simulateNetworkError(): Promise<void> {
    await this.page.evaluate(() => {
      if (window.mockWallet) {
        window.mockWallet.signAndExecuteTransaction = async () => {
          throw new Error('Network error: Unable to connect to RPC');
        };
      }
    });
  }

  async simulateGasError(): Promise<void> {
    await this.page.evaluate(() => {
      if (window.mockWallet) {
        window.mockWallet.config.gasBalance = 0;
      }
    });
  }

  async resetWalletState(): Promise<void> {
    await this.page.evaluate(() => {
      if (window.mockWallet) {
        window.mockWallet.config.gasBalance = 1000000;
        window.mockWallet.config.failureRate = 0.1;
        window.mockWallet.transactions = [];
      }
    });
  }

  async takeScreenshotWithTimestamp(name: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}-${timestamp}.png`;
    const path = `./screenshots/${filename}`;

    await this.page.screenshot({ path, fullPage: true });
    return path;
  }
}

/**
 * Smart contract interaction helpers
 */
export class ContractTestHelpers {
  constructor(private cli: CLITestRunner) {}

  async validateContractDeployment(): Promise<boolean> {
    try {
      const result = await this.cli.runCommand('deploy', ['--validate-only']);
      return result.exitCode === 0 && result.stdout.includes('valid');
    } catch {
      return false;
    }
  }

  async estimateGasCost(
    operation: 'create' | 'complete' | 'transfer'
  ): Promise<number> {
    try {
      const result = await this.cli.runCommand('estimate-gas', [
        `--${operation}`,
      ]);
      if (result.exitCode === 0) {
        const match = result.stdout.match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  async verifyEventEmission(eventType: string): Promise<boolean> {
    try {
      const result = await this.cli.runCommand('verify-events', [
        '--type',
        eventType,
      ]);
      return result.exitCode === 0 && result.stdout.includes('event emitted');
    } catch {
      return false;
    }
  }
}

/**
 * Performance testing utilities
 */
export class PerformanceTestHelpers {
  private metrics: { [key: string]: number[] } = {};

  startTimer(name: string): void {
    this.metrics[name] = this.metrics[name] || [];
    this.metrics[name].push(Date.now());
  }

  endTimer(name: string): number {
    if (!this.metrics[name] || this.metrics[name].length === 0) {
      throw new Error(`Timer ${name} was not started`);
    }

    const startTime = this.metrics[name].pop()!;
    const duration = Date.now() - startTime;

    // Store duration for analysis
    if (!this.metrics[`${name}_durations`]) {
      this.metrics[`${name}_durations`] = [];
    }
    this.metrics[`${name}_durations`].push(duration);

    return duration;
  }

  getMetrics(name: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    total: number;
  } {
    const durations = this.metrics[`${name}_durations`] || [];

    if (durations.length === 0) {
      return { count: 0, average: 0, min: 0, max: 0, total: 0 };
    }

    const total = durations.reduce((sum, duration) => sum + duration, 0);
    const average = total / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);

    return { count: durations.length, average, min, max, total };
  }

  async measurePageLoad(page: Page, url: string): Promise<number> {
    const startTime = Date.now();
    await page.goto(url, { waitUntil: 'networkidle' });
    return Date.now() - startTime;
  }

  async measureInteraction(
    page: Page,
    interaction: () => Promise<void>
  ): Promise<number> {
    const startTime = Date.now();
    await interaction();
    return Date.now() - startTime;
  }

  generateReport(): string {
    const report = ['Performance Test Report', '=' + '='.repeat(25)];

    Object.keys(this.metrics)
      .filter(key => key.endsWith('_durations'))
      .forEach(key => {
        const name = key.replace('_durations', '');
        const metrics = this.getMetrics(name);

        report.push(`\n${name}:`);
        report.push(`  Count: ${metrics.count}`);
        report.push(`  Average: ${metrics.average.toFixed(2)}ms`);
        report.push(`  Min: ${metrics.min}ms`);
        report.push(`  Max: ${metrics.max}ms`);
        report.push(`  Total: ${metrics.total}ms`);
      });

    return report.join('\n');
  }
}

// Type declarations for window objects
declare global {
  interface Window {
    suiWallet?: any;
    mockWallet?: any;
    sui?: any;
    slush?: any;
  }
}

export default {
  MockWalletManager,
  CLITestRunner,
  PageTestHelpers,
  ContractTestHelpers,
  PerformanceTestHelpers,
};
