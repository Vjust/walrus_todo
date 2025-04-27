import chalk from 'chalk';

export class CLIError extends Error {
  constructor(message: string, public code: string = 'GENERAL_ERROR') {
    super(message);
    this.name = 'CLIError';
  }
}

export function handleError(error: any): void {
  if (error instanceof CLIError) {
    console.error(chalk.red('\nError:'), error.message);
    
    // Add helpful suggestions based on error code
    switch (error.code) {
      case 'INVALID_LIST':
        console.log(chalk.yellow('\nSuggestions:'));
        console.log('• Check if the list name is correct');
        console.log('• Use "waltodo list" to see all available lists');
        console.log('• Create the list first using "waltodo add <list-name> -t <task>"');
        break;
      
      case 'INVALID_TASK_ID':
        console.log(chalk.yellow('\nSuggestions:'));
        console.log('• Check if the task ID is correct');
        console.log('• Use "waltodo list <list-name>" to see all tasks and their IDs');
        break;
      
      case 'INVALID_PRIORITY':
        console.log(chalk.yellow('\nSuggestions:'));
        console.log('• Priority must be one of: high, medium, low');
        console.log('• Example: waltodo add "my-list" -t "task" -p high');
        break;
      
      case 'INVALID_DATE':
        console.log(chalk.yellow('\nSuggestions:'));
        console.log('• Date must be in YYYY-MM-DD format');
        console.log('• Example: waltodo add "my-list" -t "task" -d 2024-12-31');
        break;
      
      case 'NO_TASKS':
        console.log(chalk.yellow('\nSuggestions:'));
        console.log('• Add at least one task using -t flag');
        console.log('• Example: waltodo add "my-list" -t "task1" -t "task2"');
        break;
      
      case 'MISSING_LIST':
        console.log(chalk.yellow('\nSuggestions:'));
        console.log('• Specify a list name using -l flag or as first argument');
        console.log('• Example: waltodo add "my-list" -t "task"');
        console.log('• Or: waltodo add -l "my-list" -t "task"');
        break;
    }
  } else if (error?.message?.includes('Unknown command')) {
    console.error(chalk.red('\nError: Unknown command'));
    console.log(chalk.yellow('\nAvailable commands:'));
    console.log('• add     - Add new todo(s)');
    console.log('• list    - List todos or todo lists');
    console.log('• update  - Update a todo');
    console.log('• check   - Mark a todo as complete/incomplete');
    console.log('• delete  - Delete a todo or list');
    console.log('• publish - Publish list to blockchain');
    console.log('• sync    - Sync with blockchain');
    console.log('\nRun "waltodo --help" for more information');
  } else if (error?.message?.includes('unknown option')) {
    console.error(chalk.red('\nError:'), error.message);
    console.log(chalk.yellow('\nRun "waltodo <command> --help" to see available options'));
  } else {
    console.error(chalk.red('\nError:'), error?.message || 'An unknown error occurred');
  }
  
  process.exit(1);
} 