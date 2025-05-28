/**
 * Environment Validator for Testnet Configuration
 * Verifies all required configurations and prerequisites for testnet deployment
 */

import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { Logger } from '../../../apps/cli/src/utils/Logger';

const logger = new Logger('environment-validator');

export interface TestnetConfig {
  suiPath: string;
  suiAddress: string;
  suiBalance: bigint;
  privateKey: string;
  walrusConfig: string;
  walrusTokens: number;
  networkUrl: string;
  movePackageId?: string;
  gasBudget: bigint;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  config?: TestnetConfig;
}

export class EnvironmentValidator {
  private errors: string[] = [];
  private warnings: string[] = [];
  private config: Partial<TestnetConfig> = {};

  /**
   * Run all validation checks
   */
  async validate(): Promise<ValidationResult> {
    this.errors = [];
    this.warnings = [];

    await this.validateSuiCLI();
    await this.validateWalrusCLI();
    await this.validateSuiAddress();
    await this.validateSuiBalance();
    await this.validatePrivateKey();
    await this.validateWalrusConfig();
    await this.validateNetworkConnectivity();
    await this.validateMovePackage();
    await this.validateGasBudget();

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      config:
        this.errors.length === 0 ? (this.config as TestnetConfig) : undefined,
    };
  }

  /**
   * Validate Sui CLI installation
   */
  private async validateSuiCLI(): Promise<void> {
    try {
      const version = execSync('sui --version', { encoding: 'utf8' }).trim();
      logger.info(`✓ Sui CLI found: ${version}`);
      this.config.suiPath = execSync('which sui', { encoding: 'utf8' }).trim();
    } catch (error) {
      this.errors.push(
        'Sui CLI not found. Please install it from https://docs.sui.io/guides/developer/getting-started'
      );
    }
  }

  /**
   * Validate Walrus CLI installation
   */
  private async validateWalrusCLI(): Promise<void> {
    try {
      const version = execSync('walrus --version', { encoding: 'utf8' }).trim();
      logger.info(`✓ Walrus CLI found: ${version}`);
    } catch (error) {
      this.errors.push(
        'Walrus CLI not found. Please install it from https://docs.wal.app'
      );
    }
  }

  /**
   * Validate Sui address
   */
  private async validateSuiAddress(): Promise<void> {
    const address = process.env.SUI_ADDRESS;
    if (!address) {
      this.errors.push('SUI_ADDRESS environment variable not set');
      return;
    }

    if (!address.startsWith('0x') || address.length !== 66) {
      this.errors.push(
        'Invalid SUI_ADDRESS format. Must be a 66-character hex string starting with 0x'
      );
      return;
    }

    this.config.suiAddress = address;
    logger.info(`✓ Sui address configured: ${address}`);
  }

  /**
   * Validate Sui balance
   */
  private async validateSuiBalance(): Promise<void> {
    if (!this.config.suiAddress) return;

    try {
      const gasObj = execSync(`sui client gas --json`, { encoding: 'utf8' });
      const gasData = JSON.parse(gasObj);

      let totalBalance = BigInt(0);
      for (const coin of gasData) {
        totalBalance += BigInt(coin.gasBalance);
      }

      this.config.suiBalance = totalBalance;
      const balanceInSui = Number(totalBalance) / 1e9;

      logger.info(`✓ Sui balance: ${balanceInSui} SUI`);

      if (balanceInSui < 0.1) {
        this.warnings.push(
          `Low Sui balance: ${balanceInSui} SUI. Consider getting more from the faucet.`
        );
      }
    } catch (error) {
      this.errors.push(
        'Failed to check Sui balance. Make sure you have active Sui client.'
      );
    }
  }

  /**
   * Validate private key availability
   */
  private async validatePrivateKey(): Promise<void> {
    const privateKey = process.env.SUI_PRIVATE_KEY;

    if (!privateKey) {
      // Try to load from keystore
      const keystorePath = path.join(
        process.env.HOME || '',
        '.sui',
        'keystore'
      );

      if (existsSync(keystorePath)) {
        try {
          const keystore = JSON.parse(readFileSync(keystorePath, 'utf8'));
          if (keystore.length > 0) {
            logger.info('✓ Private key found in Sui keystore');
            this.config.privateKey = 'keystore';
            return;
          }
        } catch (error) {
          // Ignore parse errors
        }
      }

      this.errors.push(
        'No private key found. Set SUI_PRIVATE_KEY or configure Sui keystore'
      );
    } else {
      logger.info('✓ Private key configured via environment variable');
      this.config.privateKey = privateKey;
    }
  }

  /**
   * Validate Walrus configuration
   */
  private async validateWalrusConfig(): Promise<void> {
    const configPath = path.join(
      process.env.HOME || '',
      '.config',
      'walrus',
      'client_config.yaml'
    );

    if (!existsSync(configPath)) {
      this.errors.push(
        `Walrus config not found at ${configPath}. Run 'walrus --context testnet config'`
      );
      return;
    }

    this.config.walrusConfig = configPath;
    logger.info(`✓ Walrus config found: ${configPath}`);

    // Check Walrus tokens
    try {
      const output = execSync('walrus --context testnet balance', {
        encoding: 'utf8',
      });
      const tokenMatch = output.match(/Balance:\s*(\d+)/);

      if (tokenMatch) {
        this.config.walrusTokens = parseInt(tokenMatch[1]);
        logger.info(`✓ Walrus balance: ${this.config.walrusTokens} tokens`);

        if (this.config.walrusTokens < 10) {
          this.warnings.push(
            `Low Walrus token balance: ${this.config.walrusTokens}. Run 'walrus --context testnet get-wal'`
          );
        }
      }
    } catch (error) {
      this.warnings.push(
        'Failed to check Walrus balance. Make sure Walrus CLI is configured.'
      );
    }
  }

  /**
   * Validate network connectivity
   */
  private async validateNetworkConnectivity(): Promise<void> {
    const networkUrl =
      process.env.SUI_NETWORK_URL || 'https://fullnode.testnet.sui.io:443';

    try {
      // Simple check using curl
      execSync(`curl -s -f ${networkUrl}`, { encoding: 'utf8' });
      logger.info(`✓ Network connectivity confirmed: ${networkUrl}`);
      this.config.networkUrl = networkUrl;
    } catch (error) {
      this.warnings.push(
        `Failed to connect to ${networkUrl}. Network may be slow or unavailable.`
      );
      this.config.networkUrl = networkUrl;
    }
  }

  /**
   * Validate Move package
   */
  private async validateMovePackage(): Promise<void> {
    const movePath = path.join(process.cwd(), 'src', 'move', 'Move.toml');

    if (!existsSync(movePath)) {
      this.errors.push('Move package not found at src/move/Move.toml');
      return;
    }

    logger.info('✓ Move package found');

    // Check if package is already deployed
    const deployedId = process.env.TODO_PACKAGE_ID;
    if (deployedId) {
      logger.info(`✓ Deployed package ID: ${deployedId}`);
      this.config.movePackageId = deployedId;
    } else {
      this.warnings.push(
        'TODO_PACKAGE_ID not set. Package may need to be deployed.'
      );
    }
  }

  /**
   * Validate gas budget configuration
   */
  private async validateGasBudget(): Promise<void> {
    const gasBudget = process.env.GAS_BUDGET || '100000000'; // 0.1 SUI default

    try {
      this.config.gasBudget = BigInt(gasBudget);
      const gasInSui = Number(this.config.gasBudget) / 1e9;
      logger.info(`✓ Gas budget configured: ${gasInSui} SUI`);

      if (gasInSui > 1) {
        this.warnings.push(
          `High gas budget: ${gasInSui} SUI. Consider reducing to save costs.`
        );
      }
    } catch (error) {
      this.errors.push('Invalid GAS_BUDGET format. Must be a numeric string.');
    }
  }

  /**
   * Generate environment template file
   */
  static generateEnvTemplate(): string {
    return `# Testnet Environment Configuration

# Sui Configuration
SUI_ADDRESS=0x... # Your Sui testnet address
SUI_PRIVATE_KEY=... # Optional: Your private key (alternatively use keystore)
SUI_NETWORK_URL=https://fullnode.testnet.sui.io:443
GAS_BUDGET=100000000 # 0.1 SUI

# Deployed Contract IDs (set after deployment)
TODO_PACKAGE_ID=0x...
TODO_REGISTRY_ID=0x...
NFT_REGISTRY_ID=0x...

# AI Configuration (optional)
XAI_API_KEY=... # For AI features

# Storage Configuration
# Using real Walrus testnet storage
`;
  }

  /**
   * Print validation report
   */
  static printReport(result: ValidationResult): void {
    logger.info('\n=== Testnet Environment Validation Report ===\n');

    if (result.errors.length > 0) {
      logger.info('❌ ERRORS:');
      result.errors.forEach(error => logger.info(`   - ${error}`));
      logger.info('');
    }

    if (result.warnings.length > 0) {
      logger.info('⚠️  WARNINGS:');
      result.warnings.forEach(warning => logger.info(`   - ${warning}`));
      logger.info('');
    }

    if (result.isValid) {
      logger.info('✅ All required configurations are valid!');
      logger.info('\nConfiguration Summary:');
      logger.info(JSON.stringify(result.config, null, 2));
    } else {
      logger.info(
        '❌ Please fix the errors above before proceeding with testnet deployment.'
      );
    }

    logger.info('\n===========================================\n');
  }
}

// Export validator function for easy use
export async function validateTestnetEnvironment(): Promise<ValidationResult> {
  const validator = new EnvironmentValidator();
  return await validator.validate();
}

// If running directly, perform validation
if (require.main === module) {
  (async () => {
    const result = await validateTestnetEnvironment();
    EnvironmentValidator.printReport(result);

    if (!result.isValid) {
      process.exit(1);
    }
  })();
}
