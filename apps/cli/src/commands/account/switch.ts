import { Args } from '@oclif/core';
import { BaseCommand } from '../../base-command';
import { CLIError } from '../../types/errors/consolidated';
import { switchSuiAddress } from '../../utils/command-executor';
import { ValidationRules, validateInput } from '../../utils/input-validator';

/**
 * @class AccountSwitchCommand
 * @description This command allows users to switch to a different Sui wallet address for blockchain operations.
 * It uses the Sui CLI to perform the switch, updating the active address for subsequent commands.
 *
 * @param {string} address - The Sui wallet address to switch to. (Required argument)
 */
export default class AccountSwitchCommand extends BaseCommand {
  static description =
    'Change the active Sui wallet address for blockchain transactions';

  static args = {
    address: Args.string({
      name: 'address',
      description:
        'Address to switch to (must be a valid 0x-prefixed hex address)',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(AccountSwitchCommand);
    try {
      // Validate the address format first
      validateInput(args.address, ValidationRules.SuiAddress, 'address');

      // Use the safe command execution utility to switch the address
      switchSuiAddress(args.address);

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
