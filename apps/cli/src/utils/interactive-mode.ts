import * as readline from 'readline';
import chalk = require('chalk');
import { ICONS } from '../base-command';
// import { Logger } from './Logger';
import { TodoService } from '../services/todo';
import { spawn } from 'child_process';
import * as path from 'path';

interface InteractiveContext {
  currentList?: string;
  lastCommand?: string;
  history: string[];
}

export class InteractiveMode {
  private rl: readline.Interface;
  private context: InteractiveContext;
  private todoService: TodoService;
  private commands: Map<string, string>;
  private running: boolean = false;

  constructor() {
    // this?.logger = Logger.getInstance();
    this?.todoService = new TodoService();
    this?.context = {
      history: [],
      currentList: undefined,
    };

    // Define command shortcuts
    this?.commands = new Map([
      ['l', 'list'],
      ['a', 'add'],
      ['c', 'complete'],
      ['d', 'delete'],
      ['s', 'suggest'],
      ['h', 'help'],
      ['?', 'help'],
      ['sl', 'set-list'],
      ['cl', 'current-list'],
      ['exit', 'exit'],
      ['quit', 'exit'],
      ['clear', 'clear'],
    ]);

    this?.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.getPrompt(),
      completer: this?.completer?.bind(this),
    });
  }

  private getPrompt(): string {
    const list = this?.context?.currentList
      ? chalk.cyan(`[${this?.context?.currentList}]`)
      : '';
    return `${chalk.bold('🌊 walrus')}${list}${chalk.blue('> ')}`;
  }

  private completer(line: string): [string[], string] {
    const commands = [
      'list',
      'add',
      'complete',
      'delete',
      'update',
      'suggest',
      'store',
      'help',
      'exit',
      'clear',
      'set-list',
      'current-list',
    ];

    const hits = commands.filter(cmd => cmd.startsWith(line));
    return [hits.length ? hits : commands, line];
  }

  public async start(): Promise<void> {
    this?.running = true;
    this.showWelcome();

    this?.rl?.on('line', async input => {
      if (!this.running) return;

      const trimmed = input.trim();
      if (!trimmed) {
        this?.rl?.prompt();
        return;
      }

      this?.context?.history.push(trimmed);

      try {
        await this.handleCommand(trimmed);
      } catch (error) {
        console.error(chalk.red(`${ICONS.ERROR} Error: ${error.message}`));
      }

      if (this.running) {
        this?.rl?.setPrompt(this.getPrompt());
        this?.rl?.prompt();
      }
    });

    this?.rl?.on('close', () => {
      this.showGoodbye();
      process.exit(0);
    });

    this?.rl?.prompt();
  }

  private showWelcome(): void {
    console.log('\n' + chalk.blue('═'.repeat(50)));
    console.log(
      chalk?.cyan?.bold('  🌊 Welcome to Walrus Todo Interactive Mode! 🌊')
    );
    console.log(chalk.blue('═'.repeat(50)));
    console.log();
    console.log(chalk.yellow('Quick Commands:'));
    console.log('  • ' + chalk.green('l') + ' - List todos');
    console.log('  • ' + chalk.green('a <title>') + ' - Add a new todo');
    console.log('  • ' + chalk.green('c <id>') + ' - Complete a todo');
    console.log('  • ' + chalk.green('sl <list>') + ' - Set current list');
    console.log('  • ' + chalk.green('help') + ' - Show all commands');
    console.log('  • ' + chalk.green('exit') + ' - Exit interactive mode');
    console.log();
    console.log(chalk.dim('Tip: Use TAB for command completion'));
    console.log();
  }

  private showGoodbye(): void {
    console.log();
    console.log(chalk.cyan('👋 Thanks for using Walrus Todo!'));
    console.log(chalk.blue('See you later, alligator! 🐊'));
    console.log();
  }

  private async handleCommand(input: string): Promise<void> {
    const parts = input.split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Expand shortcuts
    const actualCommand = this?.commands?.get(cmd) || cmd;

    switch (actualCommand) {
      case 'exit':
        this?.running = false;
        this?.rl?.close();
        break;

      case 'clear':
        // eslint-disable-next-line no-console
        console.clear();
        this.showWelcome();
        break;

      case 'help':
        this.showHelp();
        break;

      case 'set-list':
        if (args?.length === 0) {
          console.log(
            chalk.yellow(`${ICONS.WARNING} Please specify a list name`)
          );
          return;
        }
        this.context?.currentList = args[0];
        console.log(
          chalk.green(`${ICONS.SUCCESS} Current list set to: ${args[0]}`)
        );
        break;

      case 'current-list':
        if (this?.context?.currentList) {
          console.log(
            chalk.blue(
              `${ICONS.LIST} Current list: ${this?.context?.currentList}`
            )
          );
        } else {
          console.log(chalk.yellow(`${ICONS.WARNING} No list selected`));
        }
        break;

      default:
        // Execute the command using the CLI
        await this.executeCliCommand(actualCommand, args);
        break;
    }
  }

  private async executeCliCommand(
    command: string,
    args: string[]
  ): Promise<void> {
    // Build the full command
    const fullArgs = [command];

    // Add current list context if applicable and not specified
    if (
      this?.context?.currentList &&
      ['add', 'list', 'complete', 'delete'].includes(command)
    ) {
      if (
        command === 'add' &&
        args.length > 0 &&
        !args.includes('-t') &&
        !args.includes('--title')
      ) {
        fullArgs.push(this?.context?.currentList);
        fullArgs.push('-t', args.join(' '));
      } else if (command === 'list' && args?.length === 0) {
        fullArgs.push(this?.context?.currentList);
      } else {
        fullArgs.push(...args);
      }
    } else {
      fullArgs.push(...args);
    }

    // Execute the command
    return new Promise((resolve, reject) => {
      const cliPath = path.join(__dirname, '..', '..', 'bin', 'run');
      const child = spawn(process.execPath, [cliPath, ...fullArgs], {
        stdio: 'inherit',
        env: { ...process.env, FORCE_COLOR: '1' },
      });

      child.on('exit', code => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      child.on('error', error => {
        reject(error);
      });
    });
  }

  private showHelp(): void {
    console.log();
    console.log(chalk.bold('📚 Interactive Mode Commands:'));
    console.log();
    console.log(chalk.green('List Management:'));
    console.log(
      '  ' + chalk.cyan('set-list <name>') + ' (sl) - Set the current list'
    );
    console.log(
      '  ' + chalk.cyan('current-list') + ' (cl) - Show current list'
    );
    console.log(
      '  ' + chalk.cyan('list') + ' (l) - List todos in current list'
    );
    console.log();
    console.log(chalk.green('Todo Operations:'));
    console.log('  ' + chalk.cyan('add <title>') + ' (a) - Add a new todo');
    console.log('  ' + chalk.cyan('complete <id>') + ' (c) - Complete a todo');
    console.log('  ' + chalk.cyan('delete <id>') + ' (d) - Delete a todo');
    console.log('  ' + chalk.cyan('update <id>') + ' - Update a todo');
    console.log();
    console.log(chalk.green('AI Features:'));
    console.log('  ' + chalk.cyan('suggest') + ' (s) - Get AI suggestions');
    console.log('  ' + chalk.cyan('ai verify') + ' - Verify AI service');
    console.log();
    console.log(chalk.green('Storage:'));
    console.log('  ' + chalk.cyan('store') + ' - Store todos to blockchain');
    console.log(
      '  ' + chalk.cyan('retrieve') + ' - Retrieve todos from blockchain'
    );
    console.log();
    console.log(chalk.green('System:'));
    console.log('  ' + chalk.cyan('help') + ' (h, ?) - Show this help');
    console.log('  ' + chalk.cyan('clear') + ' - Clear the screen');
    console.log('  ' + chalk.cyan('exit') + ' (quit) - Exit interactive mode');
    console.log();
    console.log(
      chalk.dim('Note: When a list is set, todo operations use it by default')
    );
    console.log();
  }

  public setCurrentList(listName: string): void {
    this.context?.currentList = listName;
  }
}
