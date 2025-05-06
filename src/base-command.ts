import { Command, Flags } from '@oclif/core';

export default abstract class BaseCommand extends Command {
  static flags = {
    verbose: Flags.boolean({
      char: 'v',
      description: 'Show verbose output',
      default: false,
    }),
  };

  // Helper method to log debug messages
  async logDebug(message: string, ...args: unknown[]): Promise<void> {
    // Get the flags from the command
    // Await the parse result and use a simpler type assertion
    const { flags } = await this.parse() as { flags: { verbose?: boolean } }; // Call parse without arguments

    // Check if verbose flag is set
    if (flags.verbose) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  // Helper method to ensure output is displayed
  logForce(message: string, ...args: unknown[]): void {
    // Use console.log directly to ensure output is displayed
    console.log(message, ...args);
  }
}
