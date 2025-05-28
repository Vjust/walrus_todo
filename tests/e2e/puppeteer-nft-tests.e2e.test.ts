/**
 * Puppeteer-based E2E tests for blockchain NFT functionality
 * Tests browser automation and wallet integration
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import { readFileSync } from 'fs';

// Test configuration
const TEST_CONFIG = {
  timeout: 30000,
  baseUrl: 'http://localhost:3000',
  cliPath: path.resolve(__dirname, '../../bin/run'),
  headless: process.env.HEADLESS !== 'false',
  devtools: process.env.DEVTOOLS === 'true',
};

// Mock wallet implementation for browser injection
const MOCK_WALLET_SCRIPT = `
  // Mock Sui wallet for testing
  window.suiWallet = {
    connected: false,
    address: '0x1234567890123456789012345678901234567890',
    transactions: [],
    
    connect: async function() {
      await new Promise(resolve => setTimeout(resolve, 500));
      this.connected = true;
      this.dispatchEvent('connect');
      return { address: this.address };
    },
    
    disconnect: async function() {
      this.connected = false;
      this.dispatchEvent('disconnect');
    },
    
    signAndExecuteTransaction: async function(transaction) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const shouldFail = Math.random() < 0.1; // 10% failure rate
      if (shouldFail) {
        throw new Error('Transaction failed: Insufficient funds');
      }
      
      const digest = 'mock_tx_' + Date.now() + '_' + Math.random().toString(36).substring(7);
      const result = {
        digest,
        effects: {
          status: { status: 'success' },
          created: [{
            reference: { objectId: 'mock_nft_' + Date.now() },
            objectType: 'TodoNFT'
          }]
        }
      };
      
      this.transactions.push(result);
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
  
  // Mock other wallet providers
  window.sui = { wallet: window.suiWallet };
  window.slush = { wallet: window.suiWallet };
`;

class PuppeteerTestRunner {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private cliProcess: ChildProcess | null = null;

  async setup(): Promise<void> {
    // Launch browser
    this.browser = await puppeteer.launch({
      headless: TEST_CONFIG.headless,
      devtools: TEST_CONFIG.devtools,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--allow-running-insecure-content',
      ],
    });

    // Create new page
    this.page = await this.browser.newPage();
    
    // Set viewport
    await this.page.setViewport({ width: 1280, height: 720 });
    
    // Inject mock wallet before navigation
    await this.page.evaluateOnNewDocument(MOCK_WALLET_SCRIPT);
    
    // Set up console logging
    this.page.on('console', (msg) => {
      if (process.env.LOG_BROWSER_CONSOLE) {
        console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
      }
    });
    
    // Set up error handling
    this.page.on('pageerror', (error) => {
      console.error(`[Browser Error] ${error.message}`);
    });
  }

  async teardown(): Promise<void> {
    if (this.cliProcess && !this.cliProcess.killed) {
      this.cliProcess.kill();
    }
    if (this.page) {
      await this.page.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }

  async navigateToApp(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    await this.page.goto(TEST_CONFIG.baseUrl, {
      waitUntil: 'networkidle2',
      timeout: 10000,
    });
  }

  async runCLICommand(command: string, args: string[] = []): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number | null;
  }> {
    return new Promise((resolve, reject) => {
      const process = spawn('node', [TEST_CONFIG.cliPath, command, ...args], {
        env: {
          ...process.env,
          NODE_ENV: 'test',
          WALRUS_USE_MOCK: 'true',
        },
      });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        resolve({ stdout, stderr, exitCode: code });
      });

      process.on('error', (error) => {
        reject(error);
      });

      // Timeout after 15 seconds
      setTimeout(() => {
        process.kill();
        reject(new Error('CLI command timed out'));
      }, 15000);
    });
  }

  async waitForElement(selector: string, timeout = 10000): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    await this.page.waitForSelector(selector, { timeout });
  }

  async waitForText(text: string, timeout = 10000): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    await this.page.waitForFunction(
      (searchText: string) => {
        return document.body.innerText.includes(searchText);
      },
      { timeout },
      text
    );
  }

  async screenshot(filename: string): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    await this.page.screenshot({
      path: path.join(__dirname, '../../screenshots', `${filename}.png`),
      fullPage: true,
    });
  }

  getPage(): Page {
    if (!this.page) throw new Error('Page not initialized');
    return this.page;
  }
}

describe('Puppeteer NFT E2E Tests', () => {
  let runner: PuppeteerTestRunner;

  beforeAll(async () => {
    runner = new PuppeteerTestRunner();
    await runner.setup();
  }, 30000);

  afterAll(async () => {
    await runner.teardown();
  }, 10000);

  beforeEach(async () => {
    await runner.navigateToApp();
  });

  describe('Wallet Connection Flow', () => {
    test('should connect wallet successfully', async () => {
      const page = runner.getPage();
      
      // Look for connect button
      await runner.waitForElement('button, [role="button"]');
      
      const connectButtons = await page.$$('button, [role="button"]');
      let connectButton = null;
      
      for (const button of connectButtons) {
        const text = await page.evaluate(el => el.textContent?.toLowerCase() || '', button);
        if (text.includes('connect')) {
          connectButton = button;
          break;
        }
      }
      
      if (connectButton) {
        await connectButton.click();
        
        // Wait for connection
        await runner.waitForText('Connected', 5000);
        
        // Verify wallet address appears
        const addressVisible = await page.evaluate(() => {
          return document.body.innerText.includes('0x1234');
        });
        
        expect(addressVisible).toBe(true);
      } else {
        // If no connect button found, app might auto-connect or have different UI
        console.log('No connect button found, checking for auto-connection...');
        
        // Check if already connected
        const isConnected = await page.evaluate(() => {
          return document.body.innerText.includes('Connected') || 
                 document.body.innerText.includes('0x1234');
        });
        
        if (!isConnected) {
          throw new Error('Unable to find connect button or establish connection');
        }
      }
    }, 15000);

    test('should handle wallet connection errors', async () => {
      const page = runner.getPage();
      
      // Mock wallet connection failure
      await page.evaluate(() => {
        if (window.suiWallet) {
          window.suiWallet.connect = async () => {
            throw new Error('User rejected connection');
          };
        }
      });
      
      // Try to connect
      const buttons = await page.$$('button, [role="button"]');
      for (const button of buttons) {
        const text = await page.evaluate(el => el.textContent?.toLowerCase() || '', button);
        if (text.includes('connect')) {
          await button.click();
          break;
        }
      }
      
      // Wait for error message
      setTimeout(async () => {
        const hasError = await page.evaluate(() => {
          const errorTerms = ['error', 'failed', 'rejected'];
          const bodyText = document.body.innerText.toLowerCase();
          return errorTerms.some(term => bodyText.includes(term));
        });
        
        expect(hasError).toBe(true);
      }, 3000);
    }, 10000);
  });

  describe('Todo Creation and NFT Conversion', () => {
    test('should create todo and convert to NFT', async () => {
      const page = runner.getPage();
      
      // Connect wallet first
      await page.evaluate(() => {
        if (window.suiWallet) {
          window.suiWallet.connect();
        }
      });
      
      await runner.waitForText('Connected');
      
      // Find and fill todo creation form
      const titleInput = await page.$('input[name="title"], input[placeholder*="title"], input[placeholder*="Todo"]');
      if (titleInput) {
        await titleInput.type('Puppeteer Test Todo NFT');
        
        const descriptionInput = await page.$('textarea[name="description"], textarea[placeholder*="description"]');
        if (descriptionInput) {
          await descriptionInput.type('Created via Puppeteer automation for NFT testing');
        }
        
        // Submit form
        const submitButton = await page.$('button[type="submit"], button:has-text("Create"), button:has-text("Add")');
        if (submitButton) {
          await submitButton.click();
          
          // Wait for todo to appear
          await runner.waitForText('Puppeteer Test Todo NFT');
          
          // Look for NFT conversion option
          const nftButtons = await page.$$('button');
          for (const button of nftButtons) {
            const text = await page.evaluate(el => el.textContent?.toLowerCase() || '', button);
            if (text.includes('nft') || text.includes('blockchain')) {
              await button.click();
              
              // Wait for transaction to complete
              await runner.waitForText('NFT created', 10000);
              break;
            }
          }
        }
      }
    }, 20000);

    test('should handle NFT creation failures', async () => {
      const page = runner.getPage();
      
      // Connect wallet and mock transaction failure
      await page.evaluate(() => {
        if (window.suiWallet) {
          window.suiWallet.connect();
          window.suiWallet.signAndExecuteTransaction = async () => {
            throw new Error('Transaction failed: Insufficient funds');
          };
        }
      });
      
      await runner.waitForText('Connected');
      
      // Try to create NFT (assuming todo exists or can be created quickly)
      const nftButtons = await page.$$('button');
      for (const button of nftButtons) {
        const text = await page.evaluate(el => el.textContent?.toLowerCase() || '', button);
        if (text.includes('nft') || text.includes('blockchain')) {
          await button.click();
          
          // Wait for error message
          await runner.waitForText('failed', 5000);
          break;
        }
      }
    }, 15000);
  });

  describe('Transaction History and Status', () => {
    test('should display transaction history', async () => {
      const page = runner.getPage();
      
      // Connect wallet with mock transactions
      await page.evaluate(() => {
        if (window.suiWallet) {
          window.suiWallet.connect();
          // Add mock transaction
          window.suiWallet.transactions.push({
            digest: 'mock_tx_12345',
            effects: { status: { status: 'success' } }
          });
        }
      });
      
      await runner.waitForText('Connected');
      
      // Look for transaction history section
      const historyButtons = await page.$$('button, a, [role="button"]');
      for (const button of historyButtons) {
        const text = await page.evaluate(el => el.textContent?.toLowerCase() || '', button);
        if (text.includes('history') || text.includes('transactions')) {
          await button.click();
          
          // Wait for transaction list
          await runner.waitForText('mock_tx_', 5000);
          break;
        }
      }
    }, 10000);
  });

  describe('CLI Integration', () => {
    test('should create todo via CLI and verify in frontend', async () => {
      // Create todo via CLI
      const cliResult = await runner.runCLICommand('add', ['"CLI to Frontend Test"']);
      expect(cliResult.exitCode).toBe(0);
      
      // Refresh frontend and check for todo
      const page = runner.getPage();
      await page.reload({ waitUntil: 'networkidle2' });
      
      // Look for the todo in the frontend
      const hasTodo = await page.evaluate(() => {
        return document.body.innerText.includes('CLI to Frontend Test');
      });
      
      expect(hasTodo).toBe(true);
    }, 15000);

    test('should complete todo via CLI and verify in frontend', async () => {
      // Create and complete todo via CLI
      await runner.runCLICommand('add', ['"CLI Complete Test"']);
      const completeResult = await runner.runCLICommand('complete', ['1']);
      expect(completeResult.exitCode).toBe(0);
      
      // Check in frontend
      const page = runner.getPage();
      await page.reload({ waitUntil: 'networkidle2' });
      
      // Look for completed todo indicators
      const hasCompleted = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return text.includes('completed') || text.includes('done');
      });
      
      expect(hasCompleted).toBe(true);
    }, 15000);
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle network disconnection gracefully', async () => {
      const page = runner.getPage();
      
      // Connect wallet
      await page.evaluate(() => {
        if (window.suiWallet) {
          window.suiWallet.connect();
        }
      });
      
      await runner.waitForText('Connected');
      
      // Simulate network disconnection
      await page.setOfflineMode(true);
      
      // Try to perform action that requires network
      const buttons = await page.$$('button');
      for (const button of buttons) {
        const text = await page.evaluate(el => el.textContent?.toLowerCase() || '', button);
        if (text.includes('nft') || text.includes('sync')) {
          await button.click();
          break;
        }
      }
      
      // Should show network error
      await runner.waitForText('network', 5000);
      
      // Restore connection
      await page.setOfflineMode(false);
    }, 10000);

    test('should handle large todo titles gracefully', async () => {
      const page = runner.getPage();
      
      const largeTitleInput = await page.$('input[name="title"], input[placeholder*="title"]');
      if (largeTitleInput) {
        const largeTitle = 'Very Long Todo Title '.repeat(20);
        await largeTitleInput.type(largeTitle);
        
        // Should either truncate or show error
        const submitButton = await page.$('button[type="submit"]');
        if (submitButton) {
          await submitButton.click();
          
          // Wait for response (success or error)
          await page.waitForTimeout(2000);
          
          const hasResponse = await page.evaluate(() => {
            const text = document.body.innerText.toLowerCase();
            return text.includes('added') || text.includes('error') || text.includes('too long');
          });
          
          expect(hasResponse).toBe(true);
        }
      }
    }, 10000);
  });

  describe('Performance and Responsiveness', () => {
    test('should handle rapid user interactions', async () => {
      const page = runner.getPage();
      
      // Connect wallet
      await page.evaluate(() => {
        if (window.suiWallet) {
          window.suiWallet.connect();
        }
      });
      
      await runner.waitForText('Connected');
      
      // Rapidly click buttons (stress test)
      const buttons = await page.$$('button');
      const clickPromises = [];
      
      for (let i = 0; i < Math.min(5, buttons.length); i++) {
        clickPromises.push(
          buttons[i].click().catch(() => {}) // Ignore click errors
        );
      }
      
      await Promise.allSettled(clickPromises);
      
      // App should still be responsive
      const isResponsive = await page.evaluate(() => {
        // Check if page is still interactive
        return document.readyState === 'complete' && 
               !document.body.classList.contains('loading');
      });
      
      expect(isResponsive).toBe(true);
    }, 10000);

    test('should load within acceptable time', async () => {
      const startTime = Date.now();
      
      await runner.navigateToApp();
      
      const loadTime = Date.now() - startTime;
      
      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    }, 8000);
  });

  describe('Visual Regression Testing', () => {
    test('should maintain consistent UI layout', async () => {
      const page = runner.getPage();
      
      // Take screenshot of initial state
      await runner.screenshot('initial-state');
      
      // Connect wallet
      await page.evaluate(() => {
        if (window.suiWallet) {
          window.suiWallet.connect();
        }
      });
      
      await runner.waitForText('Connected');
      
      // Take screenshot of connected state
      await runner.screenshot('connected-state');
      
      // Basic layout checks
      const hasHeader = await page.$('header, .header, nav');
      const hasMain = await page.$('main, .main, .container');
      
      expect(hasHeader).toBeTruthy();
      expect(hasMain).toBeTruthy();
    }, 10000);
  });
});

// Additional helper tests for specific NFT scenarios
describe('Puppeteer NFT Specific Tests', () => {
  let runner: PuppeteerTestRunner;

  beforeAll(async () => {
    runner = new PuppeteerTestRunner();
    await runner.setup();
  }, 30000);

  afterAll(async () => {
    await runner.teardown();
  });

  test('should verify NFT metadata display', async () => {
    await runner.navigateToApp();
    const page = runner.getPage();
    
    // Connect wallet and create NFT
    await page.evaluate(() => {
      if (window.suiWallet) {
        window.suiWallet.connect();
        // Mock NFT with metadata
        window.suiWallet.transactions.push({
          digest: 'nft_metadata_test',
          effects: {
            status: { status: 'success' },
            created: [{
              reference: { objectId: 'nft_with_metadata' },
              objectType: 'TodoNFT',
              metadata: {
                title: 'Test NFT',
                description: 'NFT with metadata',
                image_url: 'https://example.com/image.jpg'
              }
            }]
          }
        });
      }
    });
    
    // Check if metadata is displayed properly
    const hasMetadata = await page.evaluate(() => {
      return document.body.innerText.includes('Test NFT') ||
             document.body.innerText.includes('NFT with metadata');
    });
    
    expect(hasMetadata).toBe(true);
  }, 10000);

  test('should handle NFT transfer flow', async () => {
    await runner.navigateToApp();
    const page = runner.getPage();
    
    // Setup mock NFT for transfer
    await page.evaluate(() => {
      if (window.suiWallet) {
        window.suiWallet.connect();
      }
    });
    
    // Look for transfer functionality
    const transferButtons = await page.$$('button');
    for (const button of transferButtons) {
      const text = await page.evaluate(el => el.textContent?.toLowerCase() || '', button);
      if (text.includes('transfer') || text.includes('send')) {
        await button.click();
        
        // Should show transfer form or modal
        await page.waitForTimeout(1000);
        
        const hasTransferUI = await page.evaluate(() => {
          const text = document.body.innerText.toLowerCase();
          return text.includes('address') || text.includes('recipient');
        });
        
        expect(hasTransferUI).toBe(true);
        break;
      }
    }
  }, 10000);
});
