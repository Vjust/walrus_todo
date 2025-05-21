import * as chalk from 'chalk';
import BaseCommand, { ICONS } from './src/base-command';

/**
 * A demo class to showcase our new CLI styling
 */
class StyleDemo extends BaseCommand {
  static description = 'Demo of the new CLI styling';

  async run(): Promise<void> {
    // Demo all the fun new styling elements
    console.log('\n🎨 WALRUS TODO CLI STYLE SHOWCASE 🎨\n');

    // Demo the different status messages
    console.log(chalk.bold.underline('Status Messages:'));
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
      console.log('\n');
    }

    // Demo the fun section boxes
    console.log(chalk.bold.underline('\nFun Section Boxes:'));
    this.section('Quick Tips', 
      'Here are some helpful tips for using the CLI:\n' +
      '- Use "list" to see all your todos\n' +
      '- Use "add" to create new todos\n' +
      '- Use "complete" to mark todos as done'
    );

    // Demo the simple list with new bullet points
    console.log(chalk.bold.underline('\nColored Lists with Fun Bullets:'));
    this.simpleList('Available Commands', [
      'add - Create a new todo',
      'list - Show all todos',
      'complete - Mark a todo as done',
      'delete - Remove a todo',
      'update - Edit a todo'
    ]);

    // Demo the todo formatting with new priority labels
    console.log(chalk.bold.underline('\nTodo Formatting:'));
    
    const todos = [
      { 
        id: '123', 
        title: 'Finish project presentation', 
        completed: false, 
        priority: 'high',
        dueDate: '2025-05-15',
        tags: ['work', 'important']
      },
      { 
        id: '456', 
        title: 'Buy groceries', 
        completed: false, 
        priority: 'medium',
        tags: ['personal']
      },
      { 
        id: '789', 
        title: 'Call Mom', 
        completed: true, 
        priority: 'low',
        private: true
      }
    ];
    
    todos.forEach(todo => {
      console.log(this.formatTodo(todo));
      console.log(''); // Add spacing
    });

    // Demo storage types
    console.log(chalk.bold.underline('\nStorage Types:'));
    console.log(`Local storage: ${this.formatStorage('local')}`);
    console.log(`Blockchain storage: ${this.formatStorage('blockchain')}`);
    console.log(`Hybrid storage: ${this.formatStorage('both')}`);

    // Demo debug output
    console.log(chalk.bold.underline('\nDebug Output:'));
    this.debugLog('Processing todo list data', { count: 5, lastUpdated: '2025-05-11' });

    // Demo all the icons
    console.log(chalk.bold.underline('\nFun Icons:'));
    
    // Group the icons by category
    const iconGroups = {
      'Status Icons': [
        'SUCCESS', 'ERROR', 'WARNING', 'INFO', 
        'PENDING', 'ACTIVE', 'LOADING', 'DEBUG'
      ],
      'Object Icons': [
        'TODO', 'LIST', 'LISTS', 'TAG', 
        'PRIORITY', 'DATE', 'TIME'
      ],
      'Feature Icons': [
        'BLOCKCHAIN', 'WALRUS', 'LOCAL', 'HYBRID', 
        'AI', 'STORAGE', 'CONFIG', 'USER', 
        'SEARCH', 'SECURE', 'INSECURE'
      ]
    };

    // Display all icon groups
    Object.entries(iconGroups).forEach(([groupName, iconNames]) => {
      console.log(chalk.yellow(`\n${groupName}:`));
      
      let line = '';
      iconNames.forEach(name => {
        const icon = ICONS[name as keyof typeof ICONS];
        line += `${icon} ${name.padEnd(12)}`;
        
        // Break into multiple lines for readability
        if (line.length > 50) {
          console.log(line);
          line = '';
        }
      });
      
      if (line) console.log(line);
    });

    console.log('\n✨ End of Style Demo ✨\n');
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
          targets: ['node18']
        },
        s3: {
          bucket: 'demo-bucket',
          templates: {} as any
        }
      }
    }
  }
}).catch(error => console.error('Error running demo:', error));