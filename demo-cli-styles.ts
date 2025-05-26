import chalk from 'chalk';
import BaseCommand, { ICONS } from './src/base-command';
import { Logger } from './src/utils/Logger';

const logger = new Logger('demo-cli-styles');

/**
 * A demo class to showcase our new CLI styling
 */
class StyleDemo extends BaseCommand {
  static description = 'Demo of the new CLI styling';

  async run(): Promise<void> {
    // Demo all the fun new styling elements
    this.log('\n🎨 WALRUS TODO CLI STYLE SHOWCASE 🎨\n');

    // Demo the different status messages
    this.log(chalk.bold.underline('Status Messages:'));
    this.success('Task completed successfully!');
    this.info('Here is some helpful information');
    this.warning('Be careful with this operation');

    try {
      this.errorWithHelp(
        'Something went wrong',
        'Could not connect to the server',
        'Try checking your internet connection or try again later'
      );
    } catch (error) {
      // Just catch the error for the demo
      this.log('\n');
    }

    // Demo the fun section boxes
    this.log(chalk.bold.underline('\nFun Section Boxes:'));
    this.section(
      'Quick Tips',
      'Here are some helpful tips for using the CLI:\n' +
        '- Use "list" to see all your todos\n' +
        '- Use "add" to create new todos\n' +
        '- Use "complete" to mark todos as done'
    );

    // Demo the simple list with new bullet points
    this.log(chalk.bold.underline('\nColored Lists with Fun Bullets:'));
    this.simpleList('Available Commands', [
      'add - Create a new todo',
      'list - Show all todos',
      'complete - Mark a todo as done',
      'delete - Remove a todo',
      'update - Edit a todo',
    ]);

    // Demo the todo formatting with new priority labels
    this.log(chalk.bold.underline('\nTodo Formatting:'));

    const todos = [
      {
        id: '123',
        title: 'Finish project presentation',
        completed: false,
        priority: 'high' as const,
        dueDate: '2025-05-15',
        tags: ['work', 'important'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        private: false,
      },
      {
        id: '456',
        title: 'Buy groceries',
        completed: false,
        priority: 'medium' as const,
        tags: ['personal'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        private: false,
      },
      {
        id: '789',
        title: 'Call Mom',
        completed: true,
        priority: 'low' as const,
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        private: true,
      },
    ];

    todos.forEach(todo => {
      this.log(this.formatTodo(todo));
      this.log(''); // Add spacing
    });

    // Demo storage types
    this.log(chalk.bold.underline('\nStorage Types:'));
    this.log(`Local storage: ${this.formatStorage('local')}`);
    this.log(`Blockchain storage: ${this.formatStorage('blockchain')}`);
    this.log(`Hybrid storage: ${this.formatStorage('both')}`);

    // Demo debug output
    this.log(chalk.bold.underline('\nDebug Output:'));
    this.debugLog('Processing todo list data', {
      count: 5,
      lastUpdated: '2025-05-11',
    });

    // Demo all the icons
    this.log(chalk.bold.underline('\nFun Icons:'));

    // Group the icons by category
    const iconGroups = {
      'Status Icons': [
        'SUCCESS',
        'ERROR',
        'WARNING',
        'INFO',
        'PENDING',
        'ACTIVE',
        'LOADING',
        'DEBUG',
      ],
      'Object Icons': [
        'TODO',
        'LIST',
        'LISTS',
        'TAG',
        'PRIORITY',
        'DATE',
        'TIME',
      ],
      'Feature Icons': [
        'BLOCKCHAIN',
        'WALRUS',
        'LOCAL',
        'HYBRID',
        'AI',
        'STORAGE',
        'CONFIG',
        'USER',
        'SEARCH',
        'SECURE',
        'INSECURE',
      ],
    };

    // Display all icon groups
    Object.entries(iconGroups).forEach(([groupName, iconNames]) => {
      this.log(chalk.yellow(`\n${groupName}:`));

      let line = '';
      iconNames.forEach(name => {
        const icon = ICONS[name as keyof typeof ICONS];
        line += `${icon} ${name.padEnd(12)}`;

        // Break into multiple lines for readability
        if (line.length > 50) {
          this.log(line);
          line = '';
        }
      });

      if (line) this.log(line);
    });

    this.log('\n✨ End of Style Demo ✨\n');
  }
}

// Run the demo using OCLIF's run method
StyleDemo.run([], {
  root: __dirname,
  pjson: {
    name: 'demo',
    version: '1.0.0',
    oclif: {
      update: {
        node: {
          version: '18.0.0',
          targets: ['node18'],
        },
        s3: {
          bucket: 'demo-bucket',
          templates: { target: {}, vanilla: {} },
        },
      },
    },
  },
}).catch(_error => {
  logger.error('Error running demo:', _error);
  process.exit(1);
});
