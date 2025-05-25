/**
import { Logger } from '../../../../src/utils/Logger';

const logger = new Logger('custom-setup');
 * Custom Setup Example
 * 
 * Demonstrates advanced configuration options for Sui testnet setup
 */

import { setupTestnet, WalletSetupConfig } from '../sui-setup';
import * as path from 'path';

async function runCustomSetup() {
  try {
    logger.info('🚀 Starting custom Sui testnet setup...\n');

    // Define custom configuration
    const config: WalletSetupConfig = {
      network: 'testnet',
      walletType: 'ed25519',
      keystorePath: path.join(
        process.cwd(),
        '.test-wallets',
        'custom.keystore'
      ),
      configPath: path.join(
        process.cwd(),
        '.test-wallets',
        'custom-config.yaml'
      ),
      enableFaucet: true,
      faucetAmount: '5000000000', // Request 5 SUI
      backupWallet: true,
      backupPath: path.join(
        process.cwd(),
        '.test-wallets',
        'backups',
        `backup-${Date.now()}`
      ),
    };

    // Run setup with custom configuration
    const result = await setupTestnet(config);

    // Display results
    logger.info('\n=== Custom Setup Complete ===');
    logger.info(`Wallet Type: ${config.walletType}`);
    logger.info(`Wallet Address: ${result.wallet.address}`);
    logger.info(`Balance: ${formatSuiBalance(result.wallet.balance)} SUI`);
    logger.info(`Custom Keystore: ${result.keystorePath}`);
    logger.info(`Custom Config: ${result.configPath}`);

    if (result.backupPath) {
      logger.info(`Backup Location: ${result.backupPath}`);
    }

    // Test wallet functionality
    logger.info('\n🧪 Testing wallet...');
    logger.info(`Public Key: ${result.wallet.publicKey.substring(0, 20)}...`);
    logger.info(`RPC URL: ${result.wallet.networkUrl}`);

    logger.info('\n✅ Custom setup successful!');

    return result;
  } catch (_error) {
    logger.error('❌ Setup failed:', error);
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
