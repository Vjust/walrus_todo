/**
 * Sui Testnet Setup Utilities
 * 
 * This module provides automated tools for setting up and configuring Sui wallets
 * and testnet environment for testing the WalTodo CLI.
 * 
 * Key features:
 * - Automated wallet creation with keypair generation
 * - Testnet faucet funding for new wallets
 * - Configuration file generation
 * - Environment variable setup
 * - Wallet backup and restoration
 * - Network connectivity checks
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { execSync } from 'child_process';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Secp256k1Keypair } from '@mysten/sui/keypairs/secp256k1';
import { SuiClient } from '@mysten/sui/client';
import { bcs } from '@mysten/sui/bcs';
import { fromB64, toB64 } from '@mysten/sui/utils';
import { CLIError } from '../../../src/types/error';
import { NetworkType } from '../../../src/types/network';
import { NETWORK_URLS } from '../../../src/constants';

// Configuration constants
const TESTNET_FAUCET_URL = 'https://faucet.testnet.sui.io';
const DEFAULT_FAUCET_AMOUNT = '1000000000'; // 1 SUI in MIST
const KEYSTORE_FILE = 'sui.keystore';
const CONFIG_FILE = 'client.yaml';
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

export interface WalletSetupConfig {
  network?: NetworkType;
  walletType?: 'ed25519' | 'secp256k1';
  keystorePath?: string;
  configPath?: string;
  enableFaucet?: boolean;
  faucetAmount?: string;
  backupWallet?: boolean;
  backupPath?: string;
}

export interface WalletInfo {
  address: string;
  publicKey: string;
  privateKey: string;
  keyScheme: string;
  networkUrl: string;
  balance: string;
}

export interface TestnetSetupResult {
  wallet: WalletInfo;
  keystorePath: string;
  configPath: string;
  backupPath?: string;
  fundingTxDigest?: string;
}

/**
 * Main class for setting up Sui testnet environment
 */
export class SuiTestnetSetup {
  private config: Required<WalletSetupConfig>;
  private client: SuiClient;

  constructor(config: WalletSetupConfig = {}) {
    // Set default configuration values
    this.config = {
      network: config.network || 'testnet',
      walletType: config.walletType || 'ed25519',
      keystorePath: config.keystorePath || path.join(os.homedir(), '.sui', 'sui_config', KEYSTORE_FILE),
      configPath: config.configPath || path.join(os.homedir(), '.sui', CONFIG_FILE),
      enableFaucet: config.enableFaucet !== false, // Default to true
      faucetAmount: config.faucetAmount || DEFAULT_FAUCET_AMOUNT,
      backupWallet: config.backupWallet !== false, // Default to true
      backupPath: config.backupPath || path.join(os.homedir(), '.sui', 'backups', `wallet_${Date.now()}`),
    };

    // Initialize Sui client
    const networkUrl = NETWORK_URLS[this.config.network];
    if (!networkUrl) {
      throw new CLIError(`Invalid network: ${this.config.network}`, 'INVALID_NETWORK');
    }
    this.client = new SuiClient({ url: networkUrl });
  }

  /**
   * Complete testnet setup process
   */
  async setup(): Promise<TestnetSetupResult> {
    console.log('🚀 Starting Sui testnet setup...');

    try {
      // Check network connectivity
      await this.checkNetworkConnection();

      // Create or restore wallet
      const wallet = await this.createOrRestoreWallet();

      // Backup wallet if enabled
      let backupPath: string | undefined;
      if (this.config.backupWallet) {
        backupPath = await this.backupWallet(wallet);
      }

      // Fund wallet from faucet if enabled
      let fundingTxDigest: string | undefined;
      if (this.config.enableFaucet) {
        fundingTxDigest = await this.fundWalletFromFaucet(wallet.address);
        
        // Wait for funding to be confirmed
        await this.waitForFunding(wallet.address);
      }

      // Update wallet balance
      wallet.balance = await this.getBalance(wallet.address);

      // Create and save configuration files
      await this.saveWalletConfiguration(wallet);

      console.log('✅ Sui testnet setup completed successfully!');
      
      return {
        wallet,
        keystorePath: this.config.keystorePath,
        configPath: this.config.configPath,
        backupPath,
        fundingTxDigest,
      };
    } catch (error) {
      console.error('❌ Sui testnet setup failed:', error);
      throw error;
    }
  }

  /**
   * Check network connection to Sui RPC endpoint
   */
  private async checkNetworkConnection(): Promise<void> {
    console.log('🔍 Checking network connection...');
    
    try {
      const health = await this.client.getLatestCheckpointSequenceNumber();
      if (typeof health !== 'string' && typeof health !== 'number') {
        throw new Error('Invalid health check response');
      }
      console.log('✅ Network connection successful');
    } catch (error) {
      throw new CLIError(
        `Failed to connect to Sui ${this.config.network}: ${error instanceof Error ? error.message : String(error)}`,
        'NETWORK_CONNECTION_FAILED'
      );
    }
  }

  /**
   * Create a new wallet or restore from existing keystore
   */
  private async createOrRestoreWallet(): Promise<WalletInfo> {
    console.log('🔐 Creating/restoring wallet...');

    // Check if keystore already exists
    if (fs.existsSync(this.config.keystorePath)) {
      console.log('Found existing keystore, attempting to restore...');
      return await this.restoreWalletFromKeystore();
    }

    // Create new wallet
    console.log('Creating new wallet...');
    return await this.createNewWallet();
  }

  /**
   * Create a new wallet with specified key type
   */
  private async createNewWallet(): Promise<WalletInfo> {
    let keypair: Ed25519Keypair | Secp256k1Keypair;
    
    // Generate keypair based on wallet type
    if (this.config.walletType === 'ed25519') {
      keypair = new Ed25519Keypair();
    } else {
      keypair = new Secp256k1Keypair();
    }

    const address = keypair.getPublicKey().toSuiAddress();
    const publicKey = keypair.getPublicKey().toBase64();
    const privateKey = toB64(keypair.export().privateKey);

    // Create keystore directory if it doesn't exist
    const keystoreDir = path.dirname(this.config.keystorePath);
    if (!fs.existsSync(keystoreDir)) {
      fs.mkdirSync(keystoreDir, { recursive: true });
    }

    // Save keypair to keystore
    const keystoreData = [
      toB64(new Uint8Array([keypair.getKeyScheme() === 'ED25519' ? 0 : 1, ...keypair.export().privateKey]))
    ];
    fs.writeFileSync(this.config.keystorePath, JSON.stringify(keystoreData, null, 2));

    console.log(`✅ Created new ${this.config.walletType} wallet`);
    console.log(`📍 Address: ${address}`);

    return {
      address,
      publicKey,
      privateKey,
      keyScheme: keypair.getKeyScheme(),
      networkUrl: NETWORK_URLS[this.config.network],
      balance: '0',
    };
  }

  /**
   * Restore wallet from existing keystore
   */
  private async restoreWalletFromKeystore(): Promise<WalletInfo> {
    try {
      const keystoreData = JSON.parse(fs.readFileSync(this.config.keystorePath, 'utf-8'));
      
      if (!Array.isArray(keystoreData) || keystoreData.length === 0) {
        throw new Error('Invalid keystore format');
      }

      // Use the first key in the keystore
      const keyBase64 = keystoreData[0];
      const keyBuffer = fromB64(keyBase64);
      
      // Determine key type and create keypair
      const keyType = keyBuffer[0];
      let keypair: Ed25519Keypair | Secp256k1Keypair;
      
      if (keyType === 0) {
        keypair = Ed25519Keypair.fromSecretKey(keyBuffer.slice(1));
      } else if (keyType === 1) {
        keypair = Secp256k1Keypair.fromSecretKey(keyBuffer.slice(1));
      } else {
        throw new Error(`Unknown key type: ${keyType}`);
      }

      const address = keypair.getPublicKey().toSuiAddress();
      const publicKey = keypair.getPublicKey().toBase64();
      const privateKey = toB64(keypair.export().privateKey);

      console.log(`✅ Restored ${keypair.getKeyScheme()} wallet from keystore`);
      console.log(`📍 Address: ${address}`);

      return {
        address,
        publicKey,
        privateKey,
        keyScheme: keypair.getKeyScheme(),
        networkUrl: NETWORK_URLS[this.config.network],
        balance: await this.getBalance(address),
      };
    } catch (error) {
      throw new CLIError(
        `Failed to restore wallet from keystore: ${error instanceof Error ? error.message : String(error)}`,
        'KEYSTORE_RESTORE_FAILED'
      );
    }
  }

  /**
   * Fund wallet from testnet faucet
   */
  private async fundWalletFromFaucet(address: string): Promise<string> {
    console.log('💰 Requesting funds from testnet faucet...');
    
    if (this.config.network !== 'testnet') {
      throw new CLIError(
        'Faucet is only available on testnet',
        'INVALID_NETWORK_FOR_FAUCET'
      );
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      try {
        const response = await axios.post(
          `${TESTNET_FAUCET_URL}/gas`,
          {
            FixedAmountRequest: {
              recipient: address,
              amount: this.config.faucetAmount,
            }
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          }
        );

        if (response.data.error) {
          throw new Error(response.data.error);
        }

        const txDigest = response.data.transferredGasObjects?.[0]?.transferTxDigest;
        if (!txDigest) {
          throw new Error('No transaction digest received from faucet');
        }

        console.log(`✅ Faucet request successful! Tx: ${txDigest}`);
        return txDigest;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < RETRY_ATTEMPTS) {
          console.warn(`Faucet request attempt ${attempt} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }

    throw new CLIError(
      `Failed to fund wallet from faucet: ${lastError?.message || 'Unknown error'}`,
      'FAUCET_REQUEST_FAILED'
    );
  }

  /**
   * Wait for faucet funding to be confirmed
   */
  private async waitForFunding(address: string): Promise<void> {
    console.log('⏳ Waiting for funding to be confirmed...');
    
    const startBalance = await this.getBalance(address);
    const startTime = Date.now();
    const maxWaitTime = 60000; // 60 seconds
    
    while (Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const currentBalance = await this.getBalance(address);
      if (BigInt(currentBalance) > BigInt(startBalance)) {
        console.log('✅ Funding confirmed!');
        console.log(`💰 New balance: ${this.formatBalance(currentBalance)} SUI`);
        return;
      }
    }
    
    console.warn('⚠️  Funding confirmation timeout - please check wallet balance manually');
  }

  /**
   * Get wallet balance
   */
  private async getBalance(address: string): Promise<string> {
    try {
      const balance = await this.client.getBalance({
        owner: address,
        coinType: '0x2::sui::SUI',
      });
      
      return balance.totalBalance;
    } catch (error) {
      console.warn('Failed to get balance:', error);
      return '0';
    }
  }

  /**
   * Format balance from MIST to SUI
   */
  private formatBalance(balanceInMist: string): string {
    const mist = BigInt(balanceInMist);
    const sui = Number(mist) / 1_000_000_000;
    return sui.toFixed(9);
  }

  /**
   * Backup wallet to specified location
   */
  private async backupWallet(wallet: WalletInfo): Promise<string> {
    console.log('💾 Backing up wallet...');
    
    try {
      // Create backup directory
      if (!fs.existsSync(this.config.backupPath)) {
        fs.mkdirSync(this.config.backupPath, { recursive: true });
      }

      // Backup keystore
      const keystoreBackupPath = path.join(this.config.backupPath, KEYSTORE_FILE);
      fs.copyFileSync(this.config.keystorePath, keystoreBackupPath);

      // Save wallet info
      const walletInfoPath = path.join(this.config.backupPath, 'wallet-info.json');
      const walletInfoToSave = {
        ...wallet,
        privateKey: '[REDACTED]', // Don't save private key in plain text
        backupDate: new Date().toISOString(),
        network: this.config.network,
      };
      fs.writeFileSync(walletInfoPath, JSON.stringify(walletInfoToSave, null, 2));

      console.log(`✅ Wallet backed up to: ${this.config.backupPath}`);
      return this.config.backupPath;
    } catch (error) {
      console.error('Failed to backup wallet:', error);
      throw new CLIError(
        `Failed to backup wallet: ${error instanceof Error ? error.message : String(error)}`,
        'WALLET_BACKUP_FAILED'
      );
    }
  }

  /**
   * Save wallet configuration files
   */
  private async saveWalletConfiguration(wallet: WalletInfo): Promise<void> {
    console.log('📝 Saving configuration files...');
    
    try {
      // Create config directory if it doesn't exist
      const configDir = path.dirname(this.config.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Create Sui client configuration
      const clientConfig = {
        envs: [
          {
            alias: this.config.network,
            rpc: wallet.networkUrl,
            ws: null,
          }
        ],
        active_env: this.config.network,
        active_address: wallet.address,
      };

      fs.writeFileSync(this.config.configPath, JSON.stringify(clientConfig, null, 2));

      // Also save a .env file for easy integration
      const envPath = path.join(process.cwd(), '.env.testnet');
      const envContent = `
# Sui Testnet Configuration
NETWORK=${this.config.network}
WALLET_ADDRESS=${wallet.address}
SUI_RPC_URL=${wallet.networkUrl}
SUI_KEY_SCHEME=${wallet.keyScheme}

# Generated on ${new Date().toISOString()}
`.trim();

      fs.writeFileSync(envPath, envContent);

      console.log('✅ Configuration files saved successfully');
    } catch (error) {
      throw new CLIError(
        `Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`,
        'CONFIG_SAVE_FAILED'
      );
    }
  }

  /**
   * Static helper to run quick setup with defaults
   */
  static async quickSetup(): Promise<TestnetSetupResult> {
    const setup = new SuiTestnetSetup();
    return await setup.setup();
  }

  /**
   * Static helper to restore wallet from backup
   */
  static async restoreFromBackup(backupPath: string): Promise<WalletInfo> {
    const keystoreBackupPath = path.join(backupPath, KEYSTORE_FILE);
    
    if (!fs.existsSync(keystoreBackupPath)) {
      throw new CLIError(
        'Backup keystore not found',
        'BACKUP_NOT_FOUND'
      );
    }

    // Copy keystore to default location
    const defaultKeystorePath = path.join(os.homedir(), '.sui', 'sui_config', KEYSTORE_FILE);
    const defaultKeystoreDir = path.dirname(defaultKeystorePath);
    
    if (!fs.existsSync(defaultKeystoreDir)) {
      fs.mkdirSync(defaultKeystoreDir, { recursive: true });
    }
    
    fs.copyFileSync(keystoreBackupPath, defaultKeystorePath);

    // Create setup instance and restore
    const setup = new SuiTestnetSetup();
    return await setup.restoreWalletFromKeystore();
  }

  /**
   * Static helper to check if Sui CLI is installed
   */
  static checkSuiCliInstallation(): boolean {
    try {
      execSync('sui --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Static helper to install Sui CLI if not present
   */
  static async installSuiCli(): Promise<void> {
    if (SuiTestnetSetup.checkSuiCliInstallation()) {
      console.log('✅ Sui CLI is already installed');
      return;
    }

    console.log('📦 Installing Sui CLI...');
    
    try {
      // Install using cargo (requires Rust)
      execSync('cargo install --locked --git https://github.com/MystenLabs/sui.git --branch mainnet --bin sui', {
        stdio: 'inherit'
      });
      
      console.log('✅ Sui CLI installed successfully');
    } catch (error) {
      throw new CLIError(
        'Failed to install Sui CLI. Please install Rust and try again.',
        'SUI_CLI_INSTALL_FAILED'
      );
    }
  }
}

// Export convenience functions
export async function setupTestnet(config?: WalletSetupConfig): Promise<TestnetSetupResult> {
  const setup = new SuiTestnetSetup(config);
  return await setup.setup();
}

export async function quickSetup(): Promise<TestnetSetupResult> {
  return await SuiTestnetSetup.quickSetup();
}

export async function restoreFromBackup(backupPath: string): Promise<WalletInfo> {
  return await SuiTestnetSetup.restoreFromBackup(backupPath);
}

// Example usage
if (require.main === module) {
  (async () => {
    try {
      console.log('Running Sui testnet setup...');
      const result = await quickSetup();
      console.log('\nSetup complete!');
      console.log('Wallet address:', result.wallet.address);
      console.log('Balance:', result.wallet.balance, 'MIST');
      console.log('Keystore:', result.keystorePath);
      console.log('Config:', result.configPath);
      if (result.backupPath) {
        console.log('Backup:', result.backupPath);
      }
    } catch (error) {
      console.error('Setup failed:', error);
      process.exit(1);
    }
  })();
}