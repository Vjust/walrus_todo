/**
 * Custom Setup Example
 * 
 * Demonstrates advanced configuration options for Sui testnet setup
 */

import { setupTestnet, WalletSetupConfig } from '../sui-setup';
import * as path from 'path';

async function runCustomSetup() {
  try {
    console.log('🚀 Starting custom Sui testnet setup...\n');

    // Define custom configuration
    const config: WalletSetupConfig = {
      network: 'testnet',
      walletType: 'ed25519',
      keystorePath: path.join(process.cwd(), '.test-wallets', 'custom.keystore'),
      configPath: path.join(process.cwd(), '.test-wallets', 'custom-config.yaml'),
      enableFaucet: true,
      faucetAmount: '5000000000', // Request 5 SUI
      backupWallet: true,
      backupPath: path.join(process.cwd(), '.test-wallets', 'backups', `backup-${Date.now()}`),
    };

    // Run setup with custom configuration
    const result = await setupTestnet(config);

    // Display results
    console.log('\n=== Custom Setup Complete ===');
    console.log(`Wallet Type: ${config.walletType}`);
    console.log(`Wallet Address: ${result.wallet.address}`);
    console.log(`Balance: ${formatSuiBalance(result.wallet.balance)} SUI`);
    console.log(`Custom Keystore: ${result.keystorePath}`);
    console.log(`Custom Config: ${result.configPath}`);
    
    if (result.backupPath) {
      console.log(`Backup Location: ${result.backupPath}`);
    }

    // Test wallet functionality
    console.log('\n🧪 Testing wallet...');
    console.log(`Public Key: ${result.wallet.publicKey.substring(0, 20)}...`);
    console.log(`RPC URL: ${result.wallet.networkUrl}`);

    console.log('\n✅ Custom setup successful!');
    
    return result;
  } catch (_error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

function formatSuiBalance(mist: string): string {
  const sui = Number(BigInt(mist)) / 1_000_000_000;
  return sui.toFixed(9);
}

// Run if executed directly
if (require.main === module) {
  runCustomSetup();
}

export { runCustomSetup };