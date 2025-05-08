import { Command, Args } from '@oclif/core';
import { CLIError } from '../../utils/error-handler';
import { execSync } from 'child_process';

/**
 * @class AccountSwitchCommand
 * @description This command allows users to switch to a different Sui wallet address for blockchain operations.
 * It uses the Sui CLI to perform the switch, updating the active address for subsequent commands.
 *
 * @param {string} address - The Sui wallet address to switch to. (Required argument)
 */
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
