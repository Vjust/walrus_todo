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
  logDebug(message: string, ...args: any[]): void {
    // Get the flags from the command
    const { flags } = this.parse() as any;

    // Check if verbose flag is set
    if (flags.verbose) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  // Helper method to ensure output is displayed
  logForce(message: string, ...args: any[]): void {
    // Use console.log directly to ensure output is displayed
    console.log(message, ...args);
  }
}
