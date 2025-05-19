import { Command, Flags } from '@oclif/core';
import BaseCommand from '../base-command';
import { InteractiveMode } from '../utils/interactive-mode';

/**
 * Interactive mode command for Walrus Todo CLI
 * Provides a REPL-like experience for managing todos
 */
export default class InteractiveCommand extends BaseCommand {
  static description = 'Start interactive mode for managing todos';

  static aliases = ['i', 'repl'];

  static examples = [
    `<%= config.bin %> interactive        # Start interactive mode`,
    `<%= config.bin %> i                  # Using alias`,
    ``,
    `Once in interactive mode:`,
    `  sl my-list      # Set current list to 'my-list'`,
    `  a Buy milk      # Add "Buy milk" to current list`,
    `  l               # List todos in current list`,
    `  c abc123        # Complete todo with ID abc123`,
    `  help            # Show all available commands`,
    `  exit            # Exit interactive mode`
  ];

  static flags = {
    ...BaseCommand.flags,
    'start-list': Flags.string({
      description: 'Start with a specific list selected',
      char: 'l'
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(InteractiveCommand);

    // Don't show the usual command output in interactive mode
    const originalLog = this.log;
    const originalError = this.error;
    
    try {
      // Create and start interactive mode
      const interactive = new InteractiveMode();
      
      // Set initial list if provided
      if (flags['start-list']) {
        await this.validateList(flags['start-list']);
        interactive.setCurrentList(flags['start-list']);
      }

      // Start the interactive session
      await interactive.start();
    } catch (error) {
      // Restore original logging for error handling
      this.log = originalLog;
      this.error = originalError;
      
      this.errorWithHelp(
        'Failed to start interactive mode',
        error.message,
        'Please try running the command again'
      );
    }
  }

  private async validateList(listName: string): Promise<void> {
    const todoService = new (await import('../services/todoService')).TodoService();
    const list = await todoService.getList(listName);
    
    if (!list) {
      throw new Error(`List "${listName}" not found`);
    }
  }
}