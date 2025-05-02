import { Command, Flags } from '@oclif/core';
import { CLIError } from '../utils/error-handler';
import { execSync } from 'child_process';

export default class AccountCommand extends Command {
  static description = 'Manage Sui account for todos';

  static examples = [
    '<%= config.bin %> account show',
    '<%= config.bin %> account switch 0x123...',
  ];

  static flags = {
    show: Flags.boolean({
      char: 's',
      description: 'Show current active address',
      exclusive: ['switch'],
    }),
    switch: Flags.string({
      char: 'w',
      description: 'Switch to specified address',
      exclusive: ['show'],
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AccountCommand);

    try {
      if (flags.show || (!flags.show && !flags.switch)) {
        // Get active address from Sui CLI
        try {
          const activeAddressOutput = execSync('sui client active-address', { encoding: 'utf8' });
          const address = activeAddressOutput.trim();
          if (!address) throw new CLIError('No active address found', 'NO_ACTIVE_ADDRESS');
          this.log(`Current active Sui address: ${address}`);
        } catch (error) {
          throw new CLIError(
            'Failed to get active address. Please make sure Sui CLI is installed and configured.',
            'CLI_ERROR'
          );
        }
      }

      if (flags.switch) {
        try {
          execSync(`sui client switch --address ${flags.switch}`, { encoding: 'utf8' });
          this.log(`✅ Switched to address: ${flags.switch}`);
        } catch (error) {
          throw new CLIError(
            `Failed to switch address: ${error instanceof Error ? error.message : String(error)}`,
            'CLI_ERROR'
          );
        }
      }
    } catch (error) {
      if (error instanceof CLIError) {
        this.error(error.message);
      } else {
        this.error(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}