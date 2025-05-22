/**
 * Basic Setup Example
 * 
 * Demonstrates how to use the Sui testnet setup utilities
 */

import { quickSetup } from '../sui-setup';

async function runBasicSetup() {
  try {
    console.log('🚀 Starting basic Sui testnet setup...\n');

    // Run quick setup with all defaults
    const result = await quickSetup();

    // Display results
    console.log('\n=== Setup Complete ===');
    console.log(`Wallet Address: ${result.wallet.address}`);
    console.log(`Network: testnet`);
    console.log(`Key Scheme: ${result.wallet.keyScheme}`);
    console.log(`Balance: ${formatSuiBalance(result.wallet.balance)} SUI`);
    console.log(`\nFiles Created:`);
    console.log(`- Keystore: ${result.keystorePath}`);
    console.log(`- Config: ${result.configPath}`);
    
    if (result.backupPath) {
      console.log(`- Backup: ${result.backupPath}`);
    }
    
    if (result.fundingTxDigest) {
      console.log(`\nFunding Transaction: ${result.fundingTxDigest}`);
    }

    console.log('\n✅ Setup successful! You can now use this wallet for testing.');
    
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
  runBasicSetup();
}

export { runBasicSetup };