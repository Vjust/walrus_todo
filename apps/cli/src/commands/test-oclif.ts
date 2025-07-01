import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';

/**
 * Simple test command to verify OCLIF integration is working correctly
 */
export default class TestOclifCommand extends Command {
  static description = 'Test command to verify OCLIF integration';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --verbose',
  ];

  static flags = {
    verbose: Flags.boolean({
      char: 'v',
      description: 'Show verbose output',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(TestOclifCommand);

    this.log(chalk.green('✅ OCLIF integration is working correctly!'));
    
    if (flags.verbose) {
      this.log(chalk.blue('📋 Command details:'));
      this.log(`  • Command ID: ${this.id}`);
      this.log(`  • CLI Binary: ${this?.config?.bin}`);
      this.log(`  • OCLIF Version: ${this?.config?.version}`);
      this.log(`  • Commands Directory: ${this?.config?.commands}`);
      this.log(`  • Auto-discovery: Enabled`);
    }

    this.log(chalk.yellow('🎯 This command was discovered automatically by OCLIF!'));
  }
}