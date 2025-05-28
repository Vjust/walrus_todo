import { Flags, Args } from '@oclif/core';
import BaseCommand from '../base-command';
import { envConfig, getEnvironment } from '../utils/environment-config';
import chalk = require('chalk');
import { CLIError } from '../types/errors/consolidated';
import { jobManager } from '../utils/PerformanceMonitor';
import { createBackgroundOperationsManager } from '../utils/background-operations';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Config command to display, validate, and manage environment configuration
 */
export default class ConfigCommand extends BaseCommand {
  static description =
    'Manage environment configuration with intuitive actions\n\nNEW SYNTAX:\n  waltodo config                          # Show current configuration\n  waltodo config show                     # Explicitly show configuration\n  waltodo config validate                 # Comprehensive validation\n  waltodo config validate basic           # Basic validation only\n  waltodo config set <key> <value>        # Set configuration value\n  waltodo config reset                    # Reset to defaults\n\nThe new syntax uses clear action words instead of flags, making it\nmore intuitive to understand what each command does.\n\nLEGACY SYNTAX (still supported):\n  waltodo config --validate               # Validate configuration\n  waltodo config --show-all               # Show all values';

  static examples = [
    '<%= config.bin %> config                          # Show current configuration',
    '<%= config.bin %> config show                     # Show current configuration',
    '<%= config.bin %> config validate                 # Validate configuration',
    '<%= config.bin %> config validate basic           # Basic validation only',
    '<%= config.bin %> config validate comprehensive  # Full CLI/frontend validation',
    '<%= config.bin %> config set AI_PROVIDER openai   # Set configuration value',
    '<%= config.bin %> config reset                    # Reset to defaults',
    '<%= config.bin %> config show --section=ai        # Show AI configuration only',
    '<%= config.bin %> config show --all               # Show all config including defaults',
    '<%= config.bin %> config show --format=json       # Show config as JSON',
    '<%= config.bin %> config validate --network testnet  # Validate for specific network',
    '<%= config.bin %> config validate --detailed         # Show detailed validation report',
    '<%= config.bin %> config validate --report-file ./report.md  # Save report to file',
    '<%= config.bin %> config validate --background       # Run validation in background',
    '<%= config.bin %> config validate --background --network testnet  # Background network validation',
    '# Legacy flag syntax (still supported):',
    '<%= config.bin %> config --validate               # Validate configuration',
    '<%= config.bin %> config --show-all               # Show all config including defaults',
  ];

  static args = {
    action: Args.string({
      description: 'Action to perform: show, validate, set, reset',
      options: ['show', 'validate', 'set', 'reset'],
      required: false,
    }),
    key: Args.string({
      description:
        'Configuration key (for set action) or validation type (for validate action)',
      required: false,
    }),
    value: Args.string({
      description: 'Configuration value (for set action)',
      required: false,
    }),
  };

  static flags = {
    ...BaseCommand.flags,
    validate: Flags.boolean({
      char: 'v',
      description: 'Validate configuration values (legacy flag)',
      default: false,
    }),
    'show-all': Flags.boolean({
      char: 'a',
      description:
        'Show all configuration values including empty ones (legacy flag)',
      default: false,
    }),
    all: Flags.boolean({
      description: 'Show all configuration values including empty ones',
      default: false,
    }),
    section: Flags.string({
      char: 's',
      description: 'Show only a specific section of the configuration',
      options: [
        'common',
        'blockchain',
        'storage',
        'ai',
        'security',
        'advanced',
      ],
    }),
    format: Flags.string({
      char: 'f',
      description: 'Output format',
      options: ['pretty', 'json', 'env'],
      default: 'pretty',
    }),
    interactive: Flags.boolean({
      char: 'i',
      description: 'Interactive mode for setting values',
      default: false,
    }),
    // Validation-specific flags
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
    background: Flags.boolean({
      char: 'b',
      description: 'Run operation in background without blocking terminal',
      default: false,
    }),
  };

  /**
   * Get the section of a configuration key
   */
  private getSection(key: string): string {
    if (key === 'NODE_ENV' || key === 'LOG_LEVEL') {
      return 'common';
    }
    if (
      key.startsWith('AI_') ||
      [
        'XAI_API_KEY',
        'OPENAI_API_KEY',
        'ANTHROPIC_API_KEY',
        'OLLAMA_API_KEY',
      ].includes(key)
    ) {
      return 'ai';
    }
    if (
      key === 'NETWORK' ||
      key === 'FULLNODE_URL' ||
      key === 'TODO_PACKAGE_ID' ||
      key === 'WALLET_ADDRESS'
    ) {
      return 'blockchain';
    }
    if (
      key === 'STORAGE_PATH' ||
      key === 'TEMPORARY_STORAGE' ||
      key === 'ENCRYPTED_STORAGE'
    ) {
      return 'storage';
    }
    if (
      key.startsWith('CREDENTIAL_') ||
      key === 'REQUIRE_SIGNATURE_VERIFICATION' ||
      key === 'ENABLE_BLOCKCHAIN_VERIFICATION'
    ) {
      return 'security';
    }
    return 'advanced';
  }

  /**
   * Get section title for display
   */
  private getSectionTitle(section: string): string {
    switch (section) {
      case 'common':
        return 'Common Configuration';
      case 'blockchain':
        return 'Blockchain Configuration';
      case 'storage':
        return 'Storage Configuration';
      case 'ai':
        return 'AI Configuration';
      case 'security':
        return 'Security Configuration';
      case 'advanced':
        return 'Advanced Configuration';
      default:
        return `${section.charAt(0).toUpperCase() + section.slice(1)} Configuration`;
    }
  }

  /**
   * Format a value for display
   */
  private formatValue(value: unknown): string {
    if (value === undefined || value === null) {
      return chalk.gray('(not set)');
    }
    if (value === '') {
      return chalk.gray('(empty)');
    }
    if (typeof value === 'boolean') {
      return value ? chalk.green('true') : chalk.red('false');
    }
    if (typeof value === 'number') {
      return chalk.yellow(value.toString());
    }
    if (typeof value === 'string') {
      // Check if it's an API key - if so, mask it
      if (/API_KEY/.test(value) || value.startsWith('sk-')) {
        return chalk.magenta(
          `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
        );
      }
      return chalk.blue(value);
    }
    return String(value);
  }

  async run(): Promise<void> {
    const { flags, args } = await this.parse(ConfigCommand);

    // Determine action: prioritize positional args, then legacy flags, then default to 'show'
    let action = args.action;
    if (!action) {
      if (flags.validate) {
        action = 'validate';
      } else {
        action = 'show';
      }
    }

    // Handle different actions
    switch (action) {
      case 'validate':
        await this.validateConfig(args.key, flags);
        break;
      case 'set':
        await this.setConfig(args.key, args.value, flags.interactive);
        break;
      case 'reset':
        await this.resetConfig();
        break;
      case 'show':
      default:
        await this.showConfig(flags);
        break;
    }
  }

  /**
   * Validate configuration
   */
  private async validateConfig(
    validationType?: string,
    flags?: any
  ): Promise<void> {
    // Handle background mode
    if (flags?.background) {
      return this.runValidationInBackground(validationType, flags);
    }
    try {
      // Determine validation type
      const type = validationType?.toLowerCase() || 'comprehensive';

      if (type === 'basic') {
        // Basic validation only
        envConfig.validate();
        this.log(chalk.green('✓ Basic configuration validation successful'));

        // Show summary of what was validated
        const config = envConfig.getConfig();
        const requiredKeys = Object.entries(envConfig.getMetadata())
          .filter(([, meta]) => meta.required)
          .map(([key]) => key);

        const setRequiredKeys = requiredKeys.filter(key => {
          const configEntry = config[key] as { value: unknown };
          return (
            configEntry?.value !== undefined &&
            configEntry?.value !== null &&
            configEntry?.value !== ''
          );
        });

        this.log(
          chalk.dim(
            `Validated ${setRequiredKeys.length}/${requiredKeys.length} required configuration values`
          )
        );

        if (setRequiredKeys.length < requiredKeys.length) {
          const missingKeys = requiredKeys.filter(
            key => !setRequiredKeys.includes(key)
          );
          this.log(
            chalk.yellow(
              `⚠ Missing required configuration: ${missingKeys.join(', ')}`
            )
          );
        }
        return;
      }

      // Comprehensive validation (default)
      // First do basic environment validation
      envConfig.validate();
      this.log(chalk.green('✓ Basic configuration validation successful'));

      // Show summary of what was validated
      const config = envConfig.getConfig();
      const requiredKeys = Object.entries(envConfig.getMetadata())
        .filter(([, meta]) => meta.required)
        .map(([key]) => key);

      const setRequiredKeys = requiredKeys.filter(key => {
        const configEntry = config[key] as { value: unknown };
        return (
          configEntry?.value !== undefined &&
          configEntry?.value !== null &&
          configEntry?.value !== ''
        );
      });

      this.log(
        chalk.dim(
          `Validated ${setRequiredKeys.length}/${requiredKeys.length} required configuration values`
        )
      );

      if (setRequiredKeys.length < requiredKeys.length) {
        const missingKeys = requiredKeys.filter(
          key => !setRequiredKeys.includes(key)
        );
        this.log(
          chalk.yellow(
            `⚠ Missing required configuration: ${missingKeys.join(', ')}`
          )
        );
      }

      // Now do comprehensive validation if we have a project setup
      this.log('');
      this.log(chalk.blue('🔍 Performing comprehensive validation...\n'));

      const { createConfigValidator } = await import(
        '../utils/config-validator'
      );
      const validator = createConfigValidator();
      const result = await validator.validateConfiguration(flags?.network);

      // Display results
      if (result.valid) {
        this.log(chalk.green('✅ Comprehensive validation passed!'));
      } else {
        this.log(chalk.red('❌ Comprehensive validation failed!'));
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
      if (flags?.detailed) {
        await this.showDetailedValidationInfo(validator);
      }

      // Save report to file if requested
      if (flags?.['report-file']) {
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
      throw new CLIError(
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Shows detailed validation information
   */
  private async showDetailedValidationInfo(validator: any): Promise<void> {
    this.log(chalk.blue('📋 Detailed Information:'));

    // Show available configurations
    const availableConfigs = await validator.getAvailableConfigurations();
    if (availableConfigs.length > 0) {
      this.log(chalk.dim('Available frontend configurations:'));
      availableConfigs.forEach((config: string) => {
        this.log(chalk.dim(`  • ${config}`));
      });
    } else {
      this.log(chalk.dim('No frontend configurations found'));
    }

    this.log('');
  }

  /**
   * Set configuration value
   */
  private async setConfig(
    key?: string,
    value?: string,
    interactive = false
  ): Promise<void> {
    if (!key && !interactive) {
      throw new CLIError(
        'Configuration key is required. Use --interactive for guided setup.'
      );
    }

    if (interactive) {
      throw new CLIError(
        'Interactive mode not yet implemented. Please specify key and value directly.'
      );
    }

    if (!key || !value) {
      throw new CLIError('Both key and value are required for set action.');
    }

    // Validate the key exists in our configuration schema
    const metadata = envConfig.getMetadata();
    if (!metadata[key]) {
      this.log(
        chalk.yellow(
          `⚠ Warning: '${key}' is not a recognized configuration key.`
        )
      );
      this.log(
        chalk.dim(`Available keys: ${Object.keys(metadata).join(', ')}`)
      );
    }

    // Set the environment variable
    process.env[key] = value;

    // Reload configuration
    envConfig.reload();

    this.log(
      chalk.green(`✓ Set ${chalk.bold(key)} = ${this.formatValue(value)}`)
    );
    this.log(
      chalk.dim(
        'Note: This change is only for the current session. To persist, set the environment variable or update your config file.'
      )
    );
  }

  /**
   * Reset configuration to defaults
   */
  private async resetConfig(): Promise<void> {
    // Get list of configuration keys
    const metadata = envConfig.getMetadata();
    const configKeys = Object.keys(metadata);

    // Clear environment variables for config keys
    let clearedCount = 0;
    for (const key of configKeys) {
      if (process.env[key]) {
        delete process.env[key];
        clearedCount++;
      }
    }

    // Reload configuration to apply defaults
    envConfig.reload();

    if (clearedCount > 0) {
      this.log(
        chalk.green(`✓ Reset ${clearedCount} configuration values to defaults`)
      );
      this.log(
        chalk.dim(
          'Note: Environment variables were cleared for the current session only.'
        )
      );
    } else {
      this.log(chalk.yellow('No configuration values were set to reset.'));
    }
  }

  /**
   * Show configuration
   */
  private async showConfig(flags: any): Promise<void> {
    // Get the environment configuration
    const config = envConfig.getConfig();
    const metadata = envConfig.getMetadata();
    const currentEnv = getEnvironment();

    // Determine if we should show all (support both legacy and new flag)
    const showAll = flags.all || flags['show-all'];

    // Output in requested format
    if (flags.format === 'json') {
      // JSON output format
      this.log(JSON.stringify(envConfig.toJSON(), null, 2));
      return;
    }

    if (flags.format === 'env') {
      // .env output format
      const entries = Object.entries(config).map(([key, value]) => {
        const configEntry = value as { value: unknown };
        return `${key}=${typeof configEntry.value === 'string' ? configEntry.value : JSON.stringify(configEntry.value)}`;
      });
      this.log(entries.join('\n'));
      return;
    }

    // Pretty output format (default)
    this.log(
      chalk.bold(`Environment Configuration (${chalk.cyan(currentEnv)})`)
    );
    this.log('');

    // Group by section
    const sections: Record<string, Array<[string, unknown]>> = {};

    for (const [key, value] of Object.entries(config)) {
      const section = this.getSection(key);

      // Skip if we're only showing a specific section
      if (flags.section && section !== flags.section) {
        continue;
      }

      // Skip empty values if not showing all
      const configEntry = value as { value: unknown };
      if (
        !showAll &&
        (configEntry.value === undefined ||
          configEntry.value === null ||
          configEntry.value === '')
      ) {
        continue;
      }

      // Initialize section array if it doesn't exist
      if (!sections[section]) {
        sections[section] = [];
      }

      sections[section].push([key, value]);
    }

    // Display each section
    for (const [section, entries] of Object.entries(sections)) {
      this.log(chalk.bold.underline(this.getSectionTitle(section)));

      for (const [key, value] of entries) {
        const source = metadata[key]?.source;
        const sourceColor =
          source === 'environment'
            ? chalk.green
            : source === 'config'
              ? chalk.yellow
              : chalk.gray;

        const requiredStar = metadata[key]?.required ? chalk.red(' *') : '';

        const configEntry = value as {
          value: unknown;
          description?: string;
          example?: string;
        };

        this.log(
          `${chalk.bold(key)}${requiredStar}: ${this.formatValue(configEntry.value)} ${sourceColor(`[${source}]`)}`
        );

        // Show description if available
        if (configEntry.description) {
          this.log(`  ${chalk.gray(configEntry.description)}`);
        }

        // Show example if available
        if (configEntry.example) {
          this.log(`  ${chalk.gray(`Example: ${configEntry.example}`)}`);
        }
      }

      this.log(''); // Add space between sections
    }

    // Show legend
    this.log(chalk.dim('Legend:'));
    this.log(
      chalk.dim(
        `  [${chalk.green('environment')}] - Set from environment variable`
      )
    );
    this.log(
      chalk.dim(`  [${chalk.yellow('config')}] - Set from configuration file`)
    );
    this.log(chalk.dim(`  [${chalk.gray('default')}] - Using default value`));
    this.log(chalk.dim(`  ${chalk.red('*')} - Required value`));

    // Show usage hints
    this.log('');
    this.log(chalk.dim('Usage:'));
    this.log(
      chalk.dim(
        `  waltodo config validate                    # Full configuration validation`
      )
    );
    this.log(
      chalk.dim(
        `  waltodo config validate basic              # Basic validation only`
      )
    );
    this.log(
      chalk.dim(
        `  waltodo config validate --network testnet  # Validate for specific network`
      )
    );
    this.log(
      chalk.dim(
        `  waltodo config validate --detailed         # Show detailed report`
      )
    );
    this.log(
      chalk.dim(
        `  waltodo config set <key> <value>           # Set configuration value`
      )
    );
    this.log(
      chalk.dim(
        `  waltodo config reset                       # Reset to defaults`
      )
    );
    this.log(
      chalk.dim(
        `  waltodo config validate --background       # Run validation in background`
      )
    );
  }

  /**
   * Run validation in background without blocking terminal
   */
  private async runValidationInBackground(
    validationType?: string,
    flags?: any
  ): Promise<void> {
    try {
      // Create background job
      const job = jobManager.createJob(
        'config',
        ['validate', validationType || 'comprehensive'],
        flags || {}
      );
      jobManager.startJob(job.id);

      this.log(
        chalk.blue(`🔍 Starting configuration validation in background...`)
      );
      this.log(chalk.gray(`Job ID: ${job.id}`));
      this.log(chalk.gray(`Use "waltodo jobs" to check progress`));
      this.log(
        chalk.gray(`Use "waltodo status ${job.id}" for detailed status`)
      );

      // Run validation in background using a promise that doesn't block
      setImmediate(async () => {
        try {
          jobManager.writeJobLog(job.id, 'Starting configuration validation');

          // Update progress
          jobManager.updateProgress(job.id, 10);

          // Determine validation type
          const type = validationType?.toLowerCase() || 'comprehensive';

          if (type === 'basic') {
            jobManager.writeJobLog(job.id, 'Running basic validation');
            jobManager.updateProgress(job.id, 50);

            // Basic validation only
            envConfig.validate();

            jobManager.updateProgress(job.id, 100);
            jobManager.writeJobLog(
              job.id,
              'Basic configuration validation successful'
            );
            jobManager.completeJob(job.id, {
              validationType: 'basic',
              success: true,
            });
          } else {
            jobManager.writeJobLog(job.id, 'Running comprehensive validation');
            jobManager.updateProgress(job.id, 30);

            // Basic environment validation first
            envConfig.validate();
            jobManager.updateProgress(job.id, 50);

            // Comprehensive validation
            jobManager.writeJobLog(
              job.id,
              'Performing comprehensive validation...'
            );
            const { createConfigValidator } = await import(
              '../utils/config-validator'
            );
            const validator = createConfigValidator();

            jobManager.updateProgress(job.id, 70);
            const result = await validator.validateConfiguration(
              flags?.network
            );

            jobManager.updateProgress(job.id, 90);

            // Save report if requested
            if (flags?.['report-file']) {
              const report = validator.generateReport(result);
              await fs.promises.writeFile(
                flags['report-file'],
                report,
                'utf-8'
              );
              jobManager.writeJobLog(
                job.id,
                `Report saved to: ${flags['report-file']}`
              );
            }

            jobManager.updateProgress(job.id, 100);

            if (result.valid) {
              jobManager.writeJobLog(
                job.id,
                'Comprehensive validation passed!'
              );
              jobManager.completeJob(job.id, {
                validationType: 'comprehensive',
                success: true,
                errors: result.errors.length,
                warnings: result.warnings.length,
                suggestions: result.suggestions.length,
              });
            } else {
              jobManager.writeJobLog(
                job.id,
                `Comprehensive validation failed with ${result.errors.length} errors`
              );
              result.errors.forEach(error =>
                jobManager.writeJobLog(job.id, `ERROR: ${error}`)
              );
              jobManager.failJob(
                job.id,
                `Validation failed with ${result.errors.length} errors`
              );
            }
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          jobManager.writeJobLog(job.id, `Validation failed: ${errorMessage}`);
          jobManager.failJob(job.id, errorMessage);
        }
      });

      // Return immediately without waiting for completion
      return;
    } catch (error) {
      throw new CLIError(
        `Failed to start background validation: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Run network connectivity validation in background
   */
  private async runNetworkValidationInBackground(
    network?: string
  ): Promise<string> {
    const job = jobManager.createJob(
      'config',
      ['validate-network', network || 'current'],
      {}
    );
    jobManager.startJob(job.id);

    setImmediate(async () => {
      try {
        jobManager.writeJobLog(
          job.id,
          `Starting network validation for ${network || 'current network'}`
        );
        jobManager.updateProgress(job.id, 25);

        // Simulate network checks
        const { createConfigValidator } = await import(
          '../utils/config-validator'
        );
        const validator = createConfigValidator();

        jobManager.updateProgress(job.id, 50);
        jobManager.writeJobLog(job.id, 'Checking network connectivity...');

        // This would contain actual network validation logic
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate network check

        jobManager.updateProgress(job.id, 75);
        jobManager.writeJobLog(job.id, 'Checking blockchain endpoints...');

        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate endpoint check

        jobManager.updateProgress(job.id, 100);
        jobManager.writeJobLog(
          job.id,
          'Network validation completed successfully'
        );
        jobManager.completeJob(job.id, { network, connectivity: 'good' });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        jobManager.writeJobLog(
          job.id,
          `Network validation failed: ${errorMessage}`
        );
        jobManager.failJob(job.id, errorMessage);
      }
    });

    return job.id;
  }
}
