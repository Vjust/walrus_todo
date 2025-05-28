import { Flags } from '@oclif/core';
import BaseCommand from '../base-command';
import chalk = require('chalk');
import { CLIError } from '../types/errors/consolidated';
import { configService } from '../services/config-service';
import { createFrontendConfigGenerator } from '../utils/frontend-config-generator';

/**
 * @class GenerateFrontendConfigCommand
 * @description Generates frontend configuration files based on current deployment settings.
 * This command creates TypeScript and JSON configuration files that the frontend can consume
 * to ensure consistent contract addresses, network settings, and feature flags.
 */
export default class GenerateFrontendConfigCommand extends BaseCommand {
  static description =
    'Generate frontend configuration files from current deployment settings';

  static examples = [
    '<%= config.bin %> generate-frontend-config                                    # Generate config',
    '<%= config.bin %> generate-frontend-config --network testnet                  # For testnet',
    '<%= config.bin %> generate-frontend-config --package-id 0x123... --network devnet  # Custom package',
    '<%= config.bin %> generate-frontend-config --output ./custom-config.json      # Custom output',
    '<%= config.bin %> generate-frontend-config --format typescript                # TS format',
    '<%= config.bin %> generate-frontend-config --include-examples                 # With examples',
  ];

  static flags = {
    ...BaseCommand.flags,
    network: Flags.string({
      char: 'n',
      description: 'Network to generate config for (overrides config file)',
      options: ['localnet', 'devnet', 'testnet', 'mainnet'],
    }),
    'package-id': Flags.string({
      char: 'p',
      description: 'Package ID to use (overrides config file)',
    }),
    'deployer-address': Flags.string({
      char: 'a',
      description: 'Deployer address (overrides config file)',
    }),
    'ai-enabled': Flags.boolean({
      description: 'Enable AI features in frontend',
      default: true,
    }),
    'blockchain-verification': Flags.boolean({
      description: 'Enable blockchain verification in frontend',
      default: true,
    }),
    'encrypted-storage': Flags.boolean({
      description: 'Enable encrypted storage in frontend',
      default: false,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Overwrite existing configuration files',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(GenerateFrontendConfigCommand);

    try {
      // Get current configuration
      const config = configService.getConfig();

      // Determine values to use (flags override config)
      const network = flags.network || config.network;
      const packageId =
        flags['package-id'] ||
        config.packageId ||
        config.lastDeployment?.packageId;
      const deployerAddress = flags['deployer-address'] || config.walletAddress;

      // Validate required values
      if (!network) {
        throw new CLIError(
          'Network not specified. Use --network flag or run configure/deploy first.',
          'NETWORK_NOT_SPECIFIED'
        );
      }

      if (!packageId) {
        throw new CLIError(
          'Package ID not found. Use --package-id flag or run deploy first.',
          'PACKAGE_ID_NOT_FOUND'
        );
      }

      if (!deployerAddress) {
        throw new CLIError(
          'Deployer address not found. Use --deployer-address flag or run configure first.',
          'DEPLOYER_ADDRESS_NOT_FOUND'
        );
      }

      this.log(
        chalk.blue(
          `Generating frontend configuration for ${network} network...`
        )
      );
      this.log(chalk.dim(`Package ID: ${packageId}`));
      this.log(chalk.dim(`Deployer: ${deployerAddress}`));

      // Create frontend config generator
      const frontendConfigGenerator = createFrontendConfigGenerator();

      // Check if frontend exists
      const frontendExists = await frontendConfigGenerator.frontendExists();
      if (!frontendExists) {
        throw new CLIError(
          'Frontend directory not found. Make sure waltodo-frontend exists in the project root.',
          'FRONTEND_NOT_FOUND'
        );
      }

      // Check if config already exists and force flag is not set
      const configDir = frontendConfigGenerator.getConfigDirectory();
      if (!flags.force) {
        const fs = await import('fs');
        const path = await import('path');
        const networkConfigPath = path.join(configDir, `${network}.ts`);

        if (fs.existsSync(networkConfigPath)) {
          this.log(
            chalk.yellow(`⚠ Configuration for ${network} already exists at:`)
          );
          this.log(chalk.dim(`  ${networkConfigPath}`));
          this.log(
            chalk.dim('  Use --force flag to overwrite existing configuration')
          );
          return;
        }
      }

      // Generate configuration
      await frontendConfigGenerator.generateConfig(
        network,
        packageId,
        config.lastDeployment?.timestamp || 'unknown',
        deployerAddress,
        {
          aiEnabled: flags['ai-enabled'],
          blockchainVerification: flags['blockchain-verification'],
          encryptedStorage: flags['encrypted-storage'],
        }
      );

      this.log(chalk.green('✓ Frontend configuration generated successfully!'));
      this.log(chalk.blue('Generated files:'));
      this.log(
        chalk.dim(`  ${configDir}/${network}.ts - TypeScript configuration`)
      );
      this.log(
        chalk.dim(`  ${configDir}/${network}.json - JSON configuration`)
      );
      this.log(chalk.dim(`  ${configDir}/index.ts - Configuration index`));

      this.log(chalk.blue('\nUsage in frontend:'));
      this.log(chalk.cyan(`  import { getNetworkConfig } from '@/config';`));
      this.log(chalk.cyan(`  const config = getNetworkConfig('${network}');`));

      this.log(chalk.blue('\nNext steps:'));
      this.log(
        chalk.dim(
          '  1. Set NEXT_PUBLIC_NETWORK environment variable in your frontend:'
        )
      );
      this.log(chalk.cyan(`     export NEXT_PUBLIC_NETWORK=${network}`));
      this.log(chalk.dim('  2. Start the frontend development server:'));
      this.log(chalk.cyan('     pnpm run nextjs'));
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to generate frontend configuration: ${error instanceof Error ? error.message : String(error)}`,
        'CONFIG_GENERATION_FAILED'
      );
    }
  }
}
