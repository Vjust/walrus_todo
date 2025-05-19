/**
 * Test Integration Example
 * 
 * Shows how to integrate Sui testnet setup with test suites
 */

import { setupTestnet, restoreFromBackup, TestnetSetupResult } from '../sui-setup';
import * as path from 'path';
import * as fs from 'fs';

// Mock test framework functions for demonstration
const describe = (name: string, fn: () => void) => {
  console.log(`\n📋 Test Suite: ${name}`);
  fn();
};

const beforeAll = async (fn: () => Promise<void>) => {
  console.log('🔧 Running beforeAll hook...');
  await fn();
};

const afterAll = async (fn: () => Promise<void>) => {
  console.log('🧹 Running afterAll hook...');
  await fn();
};

const test = (name: string, fn: () => void | Promise<void>) => {
  console.log(`  ✓ ${name}`);
  return fn();
};

// Test suite example
describe('WalTodo Sui Integration Tests', () => {
  let testSetup: TestnetSetupResult;
  let testDataDir: string;

  beforeAll(async () => {
    console.log('Setting up test environment...');
    
    // Create test data directory
    testDataDir = path.join(process.cwd(), '.test-data', `run-${Date.now()}`);
    fs.mkdirSync(testDataDir, { recursive: true });

    // Setup test wallet
    testSetup = await setupTestnet({
      network: 'testnet',
      walletType: 'ed25519',
      keystorePath: path.join(testDataDir, 'test.keystore'),
      configPath: path.join(testDataDir, 'test-config.yaml'),
      enableFaucet: true,
      faucetAmount: '2000000000', // 2 SUI for testing
      backupWallet: true,
      backupPath: path.join(testDataDir, 'backup'),
    });

    console.log(`Test wallet created: ${testSetup.wallet.address}`);
    console.log(`Initial balance: ${formatSuiBalance(testSetup.wallet.balance)} SUI`);
  });

  test('should have a funded wallet', async () => {
    const balance = BigInt(testSetup.wallet.balance);
    if (balance === 0n) {
      throw new Error('Wallet should be funded');
    }
    console.log(`    Balance: ${formatSuiBalance(testSetup.wallet.balance)} SUI`);
  });

  test('should have correct network configuration', () => {
    if (testSetup.wallet.networkUrl !== 'https://fullnode.testnet.sui.io:443') {
      throw new Error('Incorrect network URL');
    }
    console.log(`    Network: ${testSetup.wallet.networkUrl}`);
  });

  test('should backup and restore wallet', async () => {
    // Test backup was created
    if (!testSetup.backupPath || !fs.existsSync(testSetup.backupPath)) {
      throw new Error('Backup should exist');
    }

    // Test restore from backup
    const restoredWallet = await restoreFromBackup(testSetup.backupPath);
    if (restoredWallet.address !== testSetup.wallet.address) {
      throw new Error('Restored wallet address should match original');
    }
    console.log(`    Restored wallet: ${restoredWallet.address}`);
  });

  test('should create environment file', () => {
    const envPath = path.join(process.cwd(), '.env.testnet');
    if (!fs.existsSync(envPath)) {
      throw new Error('Environment file should be created');
    }
    
    const envContent = fs.readFileSync(envPath, 'utf-8');
    if (!envContent.includes(testSetup.wallet.address)) {
      throw new Error('Environment file should contain wallet address');
    }
    console.log(`    Environment file created`);
  });

  afterAll(async () => {
    console.log('Cleaning up test environment...');
    
    // Clean up test data directory
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }

    // Clean up environment file
    const envPath = path.join(process.cwd(), '.env.testnet');
    if (fs.existsSync(envPath)) {
      fs.unlinkSync(envPath);
    }

    console.log('Test cleanup complete');
  });
});

function formatSuiBalance(mist: string): string {
  const sui = Number(BigInt(mist)) / 1_000_000_000;
  return sui.toFixed(9);
}

// Run the test suite
console.log('🧪 Running Sui Integration Test Example\n');
console.log('(This demonstrates test integration patterns)\n');