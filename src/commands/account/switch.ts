import { Command, Args } from '@oclif/core';
import { CLIError } from '../../utils/error-handler';
import { execSync } from 'child_process';

export default class AccountSwitchCommand extends Command {
  static description = 'Switch to a different Sui address';

  static args = {
    address: Args.string({
      name: 'address',
      description: 'Address to switch to',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(AccountSwitchCommand);
    try {
      execSync(`sui client switch --address ${args.address}`, { encoding: 'utf8' });
      this.log(`✅ Switched to address: ${args.address}`);
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to switch address: ${error instanceof Error ? error.message : String(error)}`,
        'CLI_ERROR'
      );
    }
  }
}
