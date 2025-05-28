/**
import { Logger } from '../../../../apps/cli/src/utils/Logger';

const logger = new Logger('basic-setup');
 * Basic Setup Example
 * 
 * Demonstrates how to use the Sui testnet setup utilities
 */

import { quickSetup } from '../sui-setup';

async function runBasicSetup() {
  try {
    logger.info('🚀 Starting basic Sui testnet setup...\n');

    // Run quick setup with all defaults
    const result = await quickSetup();

    // Display results
    logger.info('\n=== Setup Complete ===');
    logger.info(`Wallet Address: ${result.wallet.address}`);
    logger.info(`Network: testnet`);
    logger.info(`Key Scheme: ${result.wallet.keyScheme}`);
    logger.info(`Balance: ${formatSuiBalance(result.wallet.balance)} SUI`);
    logger.info(`\nFiles Created:`);
    logger.info(`- Keystore: ${result.keystorePath}`);
    logger.info(`- Config: ${result.configPath}`);

    if (result.backupPath) {
      logger.info(`- Backup: ${result.backupPath}`);
    }

    if (result.fundingTxDigest) {
      logger.info(`\nFunding Transaction: ${result.fundingTxDigest}`);
    }

    logger.info(
      '\n✅ Setup successful! You can now use this wallet for testing.'
    );

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
  runBasicSetup();
}

export { runBasicSetup };
