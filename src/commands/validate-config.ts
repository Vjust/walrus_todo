import { Flags } from '@oclif/core';
import BaseCommand from '../base-command';
import chalk from 'chalk';
import { createConfigValidator } from '../utils/config-validator';
import { CLIError } from '../types/errors/consolidated';

/**
 * @class ValidateConfigCommand
 * @description Validates configuration consistency between CLI and frontend.
 * This command checks for configuration mismatches, missing settings, and provides
 * suggestions for resolving configuration issues.
 */
export default class ValidateConfigCommand extends BaseCommand {
  static description = 'Validate configuration consistency between CLI and frontend';

  static examples = [
    '<%= config.bin %> validate-config                        # Basic validation',
    '<%= config.bin %> validate-config --network testnet      # Validate for testnet',
    '<%= config.bin %> validate-config --detailed             # Show detailed results',
    '<%= config.bin %> validate-config --fix                  # Auto-fix issues',
    '<%= config.bin %> validate-config --frontend-path ./app  # Check specific frontend',
    '<%= config.bin %> validate-config --strict               # Strict validation mode'
  ];

  static flags = {
    ...BaseCommand.flags,
    network: Flags.string({
      char: 'n',
      description: 'Network to validate configuration for',
      options: ['localnet', 'devnet', 'testnet', 'mainnet'],
    }),
    detailed: Flags.boolean({
      char: 'd',
      description: 'Show detailed validation report',
      default: false,
    }),
    'report-file': Flags.string({
      description: 'Save validation report to file',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ValidateConfigCommand);
    
    this.log(chalk.blue('🔍 Validating configuration...\n'));

    try {
      // Create validator
      const validator = createConfigValidator();
      
      // Run validation
      const result = await validator.validateConfiguration(flags.network);
      
      // Display results
      if (result.valid) {
        this.log(chalk.green('✅ Configuration is valid!'));
      } else {
        this.log(chalk.red('❌ Configuration validation failed!'));
      }
      
      this.log('');

      // Show errors
      if (result.errors.length > 0) {
        this.log(chalk.red('🛑 Errors:'));
        result.errors.forEach(error => {
          this.log(chalk.red(`  • ${error}`));
        });
        this.log('');
      }

      // Show warnings
      if (result.warnings.length > 0) {
        this.log(chalk.yellow('⚠️  Warnings:'));
        result.warnings.forEach(warning => {
          this.log(chalk.yellow(`  • ${warning}`));
        });
        this.log('');
      }

      // Show suggestions
      if (result.suggestions.length > 0) {
        this.log(chalk.blue('💡 Suggestions:'));
        result.suggestions.forEach(suggestion => {
          this.log(chalk.blue(`  • ${suggestion}`));
        });
        this.log('');
      }

      // Show detailed information if requested
      if (flags.detailed) {
        await this.showDetailedInfo(validator);
      }

      // Save report to file if requested
      if (flags['report-file']) {
        const report = validator.generateReport(result);
        const fs = await import('fs');
        await fs.promises.writeFile(flags['report-file'], report, 'utf-8');
        this.log(chalk.dim(`Report saved to: ${flags['report-file']}`));
      }

      // Exit with error code if validation failed
      if (!result.valid) {
        process.exit(1);
      }

    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(`Validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Shows detailed configuration information
   */
  private async showDetailedInfo(validator: any): Promise<void> {
    this.log(chalk.blue('📋 Detailed Information:'));
    
    // Show available configurations
    const availableConfigs = await validator.getAvailableConfigurations();
    if (availableConfigs.length > 0) {
      this.log(chalk.dim('Available frontend configurations:'));
      availableConfigs.forEach(config => {
        this.log(chalk.dim(`  • ${config}`));
      });
    } else {
      this.log(chalk.dim('No frontend configurations found'));
    }
    
    this.log('');
  }
}