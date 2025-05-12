import { Command, Help, Config, Args } from '@oclif/core';
import chalk from 'chalk';
import { ICONS, PRIORITY, STORAGE } from '../base-command';

/**
 * Custom help command that makes the CLI output more fun and engaging
 * with colorful formatting and playful elements
 */
export default class HelpCommand extends Command {
  static description = 'Display fun and engaging help information for WalTodo CLI';

  static args = {
    command: Args.string({
      description: 'Command to show help for',
      required: false
    })
  };

  private icons = {
    command: '🪄',
    topic: '📚',
    flag: '🚩',
    usage: '🔍',
    version: '📌',
    example: '💡',
  };

  /**
   * Generate a random decorative element for section titles
   */
  private getRandomDecoration(): string {
    const decorations = ['✨', '🌟', '💫', '🚀', '💥', '🔮', '🧩', '🎯'];
    return decorations[Math.floor(Math.random() * decorations.length)];
  }

  /**
   * Generate a random color function for sections
   */
  private getRandomColor(): chalk.ChalkFunction {
    const colors = [chalk.cyan, chalk.magenta, chalk.green, chalk.yellow, chalk.blue];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Format a section title with fun decorations
   */
  private formatTitle(title: string): string {
    const decoration = this.getRandomDecoration();
    const color = this.getRandomColor();
    return color(`\n${decoration} ${chalk.bold(title.toUpperCase())} ${decoration}`);
  }

  /**
   * Format a command name and description in a fun way
   */
  private formatCommand(name: string, description: string): string {
    const nameColor = chalk.cyan.bold;
    const descColor = chalk.white;
    return `  ${this.icons.command} ${nameColor(name.padEnd(18))} ${descColor(description)}`;
  }

  /**
   * Format a topic name and description in a fun way
   */
  private formatTopic(name: string, description: string): string {
    const nameColor = chalk.yellow.bold;
    const descColor = chalk.white;
    return `  ${this.icons.topic} ${nameColor(name.padEnd(18))} ${descColor(description)}`;
  }

  /**
   * Format a flag in a fun way
   */
  private formatFlag(flag: string, description: string): string {
    const flagColor = chalk.green.bold;
    const descColor = chalk.dim;
    return `  ${this.icons.flag} ${flagColor(flag.padEnd(20))} ${descColor(description)}`;
  }

  /**
   * Format an example in a fun way
   */
  private formatExample(example: string): string {
    return `  ${this.icons.example} ${chalk.cyan(example)}`;
  }

  /**
   * Create a fun border
   */
  private createBorder(width: number = 60): string {
    const color = this.getRandomColor();
    return color('╭' + '─'.repeat(width - 2) + '╮\n' +
                 '│' + ' '.repeat(width - 2) + '│\n' +
                 '╰' + '─'.repeat(width - 2) + '╯');
  }

  async run(): Promise<void> {
    try {
      const { args } = await this.parse(HelpCommand);

      // For command-specific help, style it ourselves
      if (args.command) {
        await this.showCommandHelp(args.command);
        return;
      }

      // Show our custom fun general help
      this.showFunHelp();
    } catch (error) {
      // In case of error, fall back to our custom general help
      this.showFunHelp();
    }
  }

  /**
   * Show styled help for a specific command
   */
  private async showCommandHelp(commandId: string): Promise<void> {
    // Find the command
    const cmd = this.config.findCommand(commandId);
    if (!cmd) {
      console.log(chalk.red(`${ICONS.ERROR} Command ${chalk.bold(commandId)} not found`));
      return;
    }

    // Get a fun decoration and color
    const deco = this.getRandomDecoration();
    const color = this.getRandomColor();

    // Build a styled header
    console.log('\n' + color('╭' + '─'.repeat(60) + '╮'));
    console.log(color('│') + ' '.repeat(28 - Math.floor(commandId.length/2)) +
                chalk.bold.white(`${deco} ${commandId} ${deco}`) +
                ' '.repeat(28 - Math.floor(commandId.length/2)) + color('│'));
    console.log(color('╰' + '─'.repeat(60) + '╯'));

    // Description with emoji
    console.log(`\n${chalk.bold.cyan('WHAT IT DOES:')} ${ICONS.INFO} ${cmd.description}`);

    // Usage with emoji
    console.log(`\n${chalk.bold.green('HOW TO USE:')} ${this.icons.command}`);
    console.log(chalk.cyan(`  $ waltodo ${commandId} ${cmd.argsHelp || ''}`));

    // Examples with emoji if available
    if (cmd.examples && cmd.examples.length > 0) {
      console.log(`\n${chalk.bold.yellow('TRY THESE:')} ⭐`);
      cmd.examples.forEach(example => {
        if (typeof example === 'string') {
          console.log(chalk.green(`  ${this.icons.example} ${example.replace(/\\S+/g, '')}`));
        } else {
          console.log(chalk.green(`  ${this.icons.example} ${String(example)}`));
        }
      });
    }

    // Arguments if available
    if (cmd.args && Object.keys(cmd.args).length > 0) {
      console.log(`\n${chalk.bold.magenta('ARGUMENTS:')} ➜`);
      Object.entries(cmd.args).forEach(([name, arg]: [string, any]) => {
        const required = arg.required ? chalk.red(' (required)') : '';
        console.log(`  ${chalk.yellow(name.padEnd(15))} ${arg.description}${required}`);
      });
    }

    // Flags if available
    if (Object.keys(cmd.flags || {}).length > 0) {
      console.log(`\n${chalk.bold.blue('OPTIONS:')} ${ICONS.CONFIG}`);
      Object.entries(cmd.flags || {}).forEach(([name, flag]: [string, any]) => {
        if (name === 'help') return; // Skip help flag
        const alias = flag.char ? `, -${flag.char}` : '';
        const required = flag.required ? chalk.red(' (required)') : '';
        console.log(`  ${chalk.green(`--${name}${alias}`.padEnd(20))} ${flag.description}${required}`);
      });
    }

    // Fun footer
    console.log('\n' + chalk.dim('───────────────────────────────────────────────────────'));
    console.log(`${chalk.dim('Need general help? Run')} ${chalk.cyan('waltodo help')}`);
  }

  private showFunHelp(): void {
    const config = this.config;
    const commandIDs = config.commandIDs;
    const commands = commandIDs.map(id => config.findCommand(id))
                               .filter(Boolean) as any[];
    
    // Create a fun welcome box
    const welcomeText = `${ICONS.WALRUS} WELCOME TO WALTODO CLI ${ICONS.WALRUS}`;
    const boxWidth = welcomeText.length + 10;
    const colorFn = this.getRandomColor();
    
    console.log('\n' + colorFn('╭' + '─'.repeat(boxWidth - 2) + '╮'));
    console.log(colorFn('│') + ' '.repeat((boxWidth - welcomeText.length) / 2) + 
                chalk.bold.white(welcomeText) + 
                ' '.repeat((boxWidth - welcomeText.length) / 2) + colorFn('│'));
    console.log(colorFn('╰' + '─'.repeat(boxWidth - 2) + '╯'));
    
    // Add a fun description
    console.log(`\n${chalk.bold('A playful todo app with blockchain superpowers!')} ${ICONS.BLOCKCHAIN}`);
    
    // Version with emoji
    console.log(`\n${this.icons.version} ${chalk.dim('Version:')} ${chalk.cyan.bold(config.version)}`);
    
    // Usage section
    console.log(this.formatTitle('How to Use'));
    console.log(`  ${this.icons.usage} ${chalk.white('$')} ${chalk.green('waltodo')} ${chalk.yellow('[command]')}`);

    // Commands section
    console.log(this.formatTitle('Magic Commands'));
    
    // Get topics for better grouping
    const topics = config.topics;
    
    // If we have topics, use them for grouping
    if (Object.keys(topics).length > 0) {
      console.log(`\n${chalk.bold.yellow('Command Categories:')}`);
      
      // Get only the proper topics
      const mainTopics = ['account', 'simple', 'storage', 'ai'];
      mainTopics.forEach(name => {
        const topic = topics[name];
        if (topic && typeof topic === 'object' && 'description' in topic) {
          console.log(this.formatTopic(name, String(topic.description) || 'No description'));
        }
      });
    }
    
    // List main commands only (without subtopics)
    console.log(`\n${chalk.bold.cyan('Available Commands:')}`);
    
    // Group by common tasks for easier understanding
    const commandCategories = {
      'Todo Management': ['add', 'list', 'complete', 'check', 'update', 'delete'],
      'Blockchain Features': ['create', 'store', 'retrieve', 'deploy', 'verify'],
      'Smart Features': ['ai', 'suggest', 'image'],
      'Settings & Config': ['config', 'configure', 'env'],
    };
    
    // Display commands by category
    Object.entries(commandCategories).forEach(([category, cmdNames]) => {
      console.log(`\n  ${chalk.yellow.bold(category)}`);
      
      cmdNames.forEach(name => {
        const cmd = commands.find(c => c.id === name);
        if (cmd) {
          console.log(this.formatCommand(cmd.id, cmd.description || 'No description'));
        }
      });
    });
    
    // Global flags section
    console.log(this.formatTitle('Useful Flags'));
    console.log(this.formatFlag('--help, -h', 'Show this fabulous help menu'));
    console.log(this.formatFlag('--verbose, -v', 'Show more details (for the curious minds)'));
    console.log(this.formatFlag('--json', 'Output in JSON format (for the serious folks)'));

    // Examples section
    console.log(this.formatTitle('Examples to Try'));
    console.log(this.formatExample('waltodo list'));
    console.log(this.formatExample('waltodo add my-list -t "Make something awesome" -p high'));
    console.log(this.formatExample('waltodo complete my-list -i "Make something awesome"'));
    
    // Fun footer
    console.log('\n' + chalk.dim('───────────────────────────────────────────────────────'));
    console.log(`${ICONS.SUCCESS} ${chalk.green.bold('Happy')} ${chalk.yellow.bold('task')} ${chalk.blue.bold('management!')} ${ICONS.SUCCESS}`);
    console.log(`${chalk.dim('Need more details? Try')} ${chalk.cyan('waltodo [command] --help')}`);
    console.log('\n');
  }
}