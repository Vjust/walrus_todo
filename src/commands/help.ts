import { Args, Flags } from '@oclif/core';
import BaseCommand from '../base-command';
import { commandRegistry } from '../utils/CommandRegistry';
import {
  CommandShortcuts,
  formatShortcutsTable,
} from '../utils/command-shortcuts';
import chalk from 'chalk';

// Import CommandMetadata type
import type { CommandMetadata } from '../utils/CommandRegistry';

/**
 * Enhanced help command with command groups and suggestions
 */
export default class HelpCommand extends BaseCommand {
  static description = 'Display help for WalTodo';

  static examples = [
    '<%= config.bin %> help',
    '<%= config.bin %> help add',
    '<%= config.bin %> help todos',
  ];

  static args = {
    command: Args.string({
      required: false,
      description: 'Command or topic to show help for',
    }),
  };

  static flags = {
    ...BaseCommand.flags,
    shortcuts: Flags.boolean({
      description: 'Show all available command shortcuts',
      char: 's',
      required: false,
    }),
  };

  static aliases = ['h', '?'];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(HelpCommand);

    // Show shortcuts if flag is set
    if (flags.shortcuts) {
      this.showShortcuts();
      return;
    }

    if (args.command) {
      // First try to expand shortcut
      const expandedCommand = CommandShortcuts.expand(args.command);

      // Show help for specific command
      const command = commandRegistry.resolveAlias(expandedCommand);
      const metadata = commandRegistry.getCommand(command);

      if (metadata) {
        this.showCommandHelp(metadata);
      } else {
        // Suggest commands if not found
        const suggestions = commandRegistry.suggestCommands(args.command);
        if (suggestions.length > 0) {
          this.error(
            `Command '${args.command}' not found. Did you mean: ${suggestions
              .map(s => chalk.cyan(s.name))
              .join(', ')}?`
          );
        } else {
          this.error(`Command '${args.command}' not found`);
        }
      }
    } else {
      // Show general help with groups
      this.showGeneralHelp();
    }
  }

  private showGeneralHelp(): void {
    this.log(`
${chalk.bold('WalTodo - A powerful CLI for managing todos with blockchain integration')}

${chalk.bold('Usage')}
  $ ${this.config.bin} COMMAND

${chalk.bold('Command Groups')}
${commandRegistry.generateGroupHelp()}

${chalk.bold('Common Commands')}
  add [title]     Add a new todo
  list            List todos
  complete        Mark todo as complete
  
${chalk.bold('Getting Started')}
  $ ${this.config.bin} add "My first todo"
  $ ${this.config.bin} list
  $ ${this.config.bin} complete --id 123

${chalk.bold('Options')}
  -h, --help      Show help
  -v, --version   Show version
  --json          Format output as json
  --verbose       Show detailed output

${chalk.bold('Command Shortcuts')}
  Single-letter: a (add), l (list), c (complete), d (delete)
  Smart: todo (add), done (complete), nft (create NFT)
  Unix-style: ls (list), rm (delete)
  
  ${chalk.dim('Run')} ${chalk.cyan(`${this.config.bin} help --shortcuts`)} ${chalk.dim('to see all available shortcuts.')}

${chalk.bold('Examples')}
  ${chalk.dim('# Add a todo with priority')}
  $ ${this.config.bin} add "Important task" -p high
  
  ${chalk.dim('# Using shortcuts')}
  $ ${this.config.bin} a "Quick todo"      ${chalk.dim('# Same as: add')}
  $ ${this.config.bin} l                   ${chalk.dim('# Same as: list')}
  $ ${this.config.bin} c --id 456          ${chalk.dim('# Same as: complete')}
  
  ${chalk.dim('# Smart shortcuts')}
  $ ${this.config.bin} todo "Get groceries" ${chalk.dim('# Natural way to add')}
  $ ${this.config.bin} done 123            ${chalk.dim('# Natural way to complete')}

${chalk.dim('Run')} ${chalk.cyan(`${this.config.bin} help COMMAND`)} ${chalk.dim('for more information on a specific command.')}
`);
  }

  private showCommandHelp(command: CommandMetadata): void {
    const shortcuts = CommandShortcuts.getShortcutsForCommand(command.name);

    this.log(`
${chalk.bold(command.name)} - ${command.description}

${chalk.bold('Usage')}
  $ ${this.config.bin} ${command.name} ${command.usage?.join(' ') || ''}

${command.aliases?.length ? `${chalk.bold('Aliases')}\n  ${command.aliases.join(', ')}\n` : ''}
${shortcuts.length ? `${chalk.bold('Shortcuts')}\n  ${shortcuts.join(', ')}\n` : ''}

${command.examples?.length ? `${chalk.bold('Examples')}\n${command.examples.map(ex => `  ${ex}`).join('\n')}` : ''}
`);
  }

  private showShortcuts(): void {
    this.log(`
${chalk.bold('WalTodo Command Shortcuts')}

${chalk.bold('How to use shortcuts')}
  Instead of typing the full command, you can use these shorter versions:
  
  $ waltodo a "Buy milk"     ${chalk.dim('# Same as: waltodo add "Buy milk"')}
  $ waltodo l                ${chalk.dim('# Same as: waltodo list')}
  $ waltodo done 123         ${chalk.dim('# Same as: waltodo complete 123')}

${formatShortcutsTable()}

${chalk.bold('Smart Shortcuts')}
  todo     → add       ${chalk.dim('Natural language for adding todos')}
  done     → complete  ${chalk.dim('Mark todo as complete')}
  all      → list      ${chalk.dim('Show all todos')}
  upload   → store     ${chalk.dim('Upload to storage')}
  download → retrieve  ${chalk.dim('Download from storage')}
  nft      → image:create-nft  ${chalk.dim('Create NFT directly')}

${chalk.bold('Tips')}
  • Single-letter shortcuts are great for frequently used commands
  • Smart shortcuts make the CLI feel more natural
  • Unix-style shortcuts (ls, rm) are familiar to terminal users
  • Use ${chalk.cyan('waltodo help <shortcut>')} to see help for the full command
`);
  }
}
