import * as readline from 'readline';
import chalk from 'chalk';
import { ICONS } from '../base-command';
import { Logger } from './Logger';
import { TodoService } from '../services/todoService';
import { spawn } from 'child_process';
import * as path from 'path';

interface InteractiveContext {
  currentList?: string;
  lastCommand?: string;
  history: string[];
}

export class InteractiveMode {
  private rl: readline.Interface;
  private logger: Logger;
  private context: InteractiveContext;
  private todoService: TodoService;
  private commands: Map<string, string>;
  private running: boolean = false;

  constructor() {
    this.logger = Logger.getInstance();
    this.todoService = new TodoService();
    this.context = {
      history: [],
      currentList: undefined,
    };

    // Define command shortcuts
    this.commands = new Map([
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

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.getPrompt(),
      completer: this.completer.bind(this),
    });
  }

  private getPrompt(): string {
    const list = this.context.currentList
      ? chalk.cyan(`[${this.context.currentList}]`)
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
    this.running = true;
    this.showWelcome();

    this.rl.on('line', async input => {
      if (!this.running) return;

      const trimmed = input.trim();
      if (!trimmed) {
        this.rl.prompt();
        return;
      }

      this.context.history.push(trimmed);

      try {
        await this.handleCommand(trimmed);
      } catch (error) {
        logger.error(chalk.red(`${ICONS.ERROR} Error: ${error.message}`));
      }

      if (this.running) {
        this.rl.setPrompt(this.getPrompt());
        this.rl.prompt();
      }
    });

    this.rl.on('close', () => {
      this.showGoodbye();
      process.exit(0);
    });

    this.rl.prompt();
  }

  private showWelcome(): void {
    logger.info('\n' + chalk.blue('═'.repeat(50)));
    logger.info(
      chalk.cyan.bold('  🌊 Welcome to Walrus Todo Interactive Mode! 🌊')
    );
    logger.info(chalk.blue('═'.repeat(50)));
    logger.info();
    logger.info(chalk.yellow('Quick Commands:'));
    logger.info('  • ' + chalk.green('l') + ' - List todos');
    logger.info('  • ' + chalk.green('a <title>') + ' - Add a new todo');
    logger.info('  • ' + chalk.green('c <id>') + ' - Complete a todo');
    logger.info('  • ' + chalk.green('sl <list>') + ' - Set current list');
    logger.info('  • ' + chalk.green('help') + ' - Show all commands');
    logger.info('  • ' + chalk.green('exit') + ' - Exit interactive mode');
    logger.info();
    logger.info(chalk.dim('Tip: Use TAB for command completion'));
    logger.info();
  }

  private showGoodbye(): void {
    logger.info();
    logger.info(chalk.cyan('👋 Thanks for using Walrus Todo!'));
    logger.info(chalk.blue('See you later, alligator! 🐊'));
    logger.info();
  }

  private async handleCommand(input: string): Promise<void> {
    const parts = input.split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Expand shortcuts
    const actualCommand = this.commands.get(cmd) || cmd;

    switch (actualCommand) {
      case 'exit':
        this.running = false;
        this.rl.close();
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
        if (args.length === 0) {
          logger.info(
            chalk.yellow(`${ICONS.WARNING} Please specify a list name`)
          );
          return;
        }
        this.context.currentList = args[0];
        logger.info(
          chalk.green(`${ICONS.SUCCESS} Current list set to: ${args[0]}`)
        );
        break;

      case 'current-list':
        if (this.context.currentList) {
          logger.info(
            chalk.blue(
              `${ICONS.LIST} Current list: ${this.context.currentList}`
            )
          );
        } else {
          logger.info(chalk.yellow(`${ICONS.WARNING} No list selected`));
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
      this.context.currentList &&
      ['add', 'list', 'complete', 'delete'].includes(command)
    ) {
      if (
        command === 'add' &&
        args.length > 0 &&
        !args.includes('-t') &&
        !args.includes('--title')
      ) {
        fullArgs.push(this.context.currentList);
        fullArgs.push('-t', args.join(' '));
      } else if (command === 'list' && args.length === 0) {
        fullArgs.push(this.context.currentList);
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
    logger.info();
    logger.info(chalk.bold('📚 Interactive Mode Commands:'));
    logger.info();
    logger.info(chalk.green('List Management:'));
    logger.info(
      '  ' + chalk.cyan('set-list <name>') + ' (sl) - Set the current list'
    );
    logger.info(
      '  ' + chalk.cyan('current-list') + ' (cl) - Show current list'
    );
    logger.info(
      '  ' + chalk.cyan('list') + ' (l) - List todos in current list'
    );
    logger.info();
    logger.info(chalk.green('Todo Operations:'));
    logger.info('  ' + chalk.cyan('add <title>') + ' (a) - Add a new todo');
    logger.info('  ' + chalk.cyan('complete <id>') + ' (c) - Complete a todo');
    logger.info('  ' + chalk.cyan('delete <id>') + ' (d) - Delete a todo');
    logger.info('  ' + chalk.cyan('update <id>') + ' - Update a todo');
    logger.info();
    logger.info(chalk.green('AI Features:'));
    logger.info('  ' + chalk.cyan('suggest') + ' (s) - Get AI suggestions');
    logger.info('  ' + chalk.cyan('ai verify') + ' - Verify AI service');
    logger.info();
    logger.info(chalk.green('Storage:'));
    logger.info('  ' + chalk.cyan('store') + ' - Store todos to blockchain');
    logger.info(
      '  ' + chalk.cyan('retrieve') + ' - Retrieve todos from blockchain'
    );
    logger.info();
    logger.info(chalk.green('System:'));
    logger.info('  ' + chalk.cyan('help') + ' (h, ?) - Show this help');
    logger.info('  ' + chalk.cyan('clear') + ' - Clear the screen');
    logger.info('  ' + chalk.cyan('exit') + ' (quit) - Exit interactive mode');
    logger.info();
    logger.info(
      chalk.dim('Note: When a list is set, todo operations use it by default')
    );
    logger.info();
  }

  public setCurrentList(listName: string): void {
    this.context.currentList = listName;
  }
}
