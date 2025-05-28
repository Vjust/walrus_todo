import { Args, Flags } from '@oclif/core';
import BaseCommand from '../base-command';
import chalk = require('chalk');
import { confirm } from '@inquirer/prompts';
import { TodoService } from '../services/todoService';
import { CLIError } from '../types/errors/consolidated';

// Helper function for colored priority display
function getColoredPriority(priority: string): string {
  switch (priority) {
    case 'high':
      return chalk.red('High');
    case 'medium':
      return chalk.yellow('Medium');
    case 'low':
      return chalk.green('Low');
    default:
      return chalk.gray('Normal');
  }
}

/**
 * @class DeleteCommand
 * @description Enhanced delete command that supports both positional and flag-based syntax.
 * Allows users to delete specific todo items or entire lists with intuitive syntax.
 * 
 * Supported syntax:
 * - waltodo delete <list-name> <todo-id>        # Positional syntax
 * - waltodo delete <todo-id>                    # Search all lists
 * - waltodo delete <list-name> "todo title"    # Delete by title
 * - waltodo delete <list-name> --all           # Delete entire list
 * - waltodo delete --id <todo-id>              # Legacy flag syntax
 *
 * @param {string} [listName] - The name of the todo list (optional when searching all lists)
 * @param {string} [todoId] - The ID or title of the todo item to delete
 * @param {string} [id] - Todo ID or title (legacy flag support)
 * @param {boolean} [all=false] - Delete the entire list
 * @param {boolean} [force=false] - Skip confirmation prompts
 */
export default class DeleteCommand extends BaseCommand {
  static description = 'Delete a specific todo item or an entire list with smart detection';

  static examples = [
    // Primary positional syntax (recommended)
    '<%= config.bin %> delete mylist 12345                   # Delete todo by ID from specific list',
    '<%= config.bin %> delete 12345                          # Delete todo by ID from any list',
    '<%= config.bin %> delete mylist "Buy groceries"         # Delete todo by title',
    '<%= config.bin %> delete mylist --all                   # Delete entire list',
    '<%= config.bin %> delete mylist --all --force           # Force delete entire list',
    '<%= config.bin %> delete abc123                         # Delete by partial ID (will confirm if multiple matches)',
    '',
    '# Legacy flag syntax (backward compatibility):',
    '<%= config.bin %> delete mylist --id 12345              # Delete by ID using flag',
    '<%= config.bin %> delete --id 12345                     # Delete from any list using flag',
    '<%= config.bin %> delete mylist --id "Buy groceries"    # Delete by title using flag',
  ];

  static flags = {
    ...BaseCommand.flags,
    id: Flags.string({
      char: 'i',
      description: 'Todo ID or title to delete (legacy syntax)',
      exclusive: ['all'],
    }),
    all: Flags.boolean({
      char: 'a',
      description: 'Delete entire list',
      exclusive: ['id'],
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Skip confirmation prompt',
      default: false,
    }),
  };

  static args = {
    listName: Args.string({
      name: 'listName',
      description: 'Name of the todo list (optional when using todo ID only)',
      required: false,
    }),
    todoId: Args.string({
      name: 'todoId',
      description: 'Todo ID or title to delete',
      required: false,
    }),
  };

  private todoService = new TodoService();

  async run(): Promise<void> {
    try {
      const { args, flags } = await this.parse(DeleteCommand);

      // Parse input to determine what the user wants to delete
      const { listName, todoIdentifier, deleteAll } = this.parseDeleteInput(args, flags);

      // Handle --all flag (delete entire list)
      if (deleteAll) {
        if (!listName) {
          throw new CLIError(
            'List name is required when using --all flag',
            'MISSING_PARAMETER'
          );
        }
        return await this.deleteEntireList(listName, flags.force);
      }

      // Handle todo deletion
      if (todoIdentifier) {
        return await this.deleteTodo(listName, todoIdentifier, flags.force);
      }

      // No specific action provided - show interactive help
      return await this.showInteractiveHelp(listName);

    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to delete: ${error instanceof Error ? error.message : String(error)}`,
        'DELETE_FAILED'
      );
    }
  }

  /**
   * Parse input arguments and flags to determine delete operation
   */
  private parseDeleteInput(args: any, flags: any): {
    listName: string | null;
    todoIdentifier: string | null;
    deleteAll: boolean;
  } {
    // Check for --all flag
    if (flags.all) {
      return {
        listName: args.listName || null,
        todoIdentifier: null,
        deleteAll: true,
      };
    }

    // Handle legacy flag syntax: --id
    if (flags.id) {
      return {
        listName: args.listName || null,
        todoIdentifier: flags.id,
        deleteAll: false,
      };
    }

    // Handle positional syntax
    if (args.todoId) {
      // Two args: listName and todoId
      return {
        listName: args.listName,
        todoIdentifier: args.todoId,
        deleteAll: false,
      };
    }

    if (args.listName) {
      // Check if listName might actually be a todo ID (when no second arg)
      // This handles: waltodo delete 12345
      if (this.looksLikeTodoId(args.listName)) {
        return {
          listName: null, // Search all lists
          todoIdentifier: args.listName,
          deleteAll: false,
        };
      }
      
      // Single arg that looks like a list name
      return {
        listName: args.listName,
        todoIdentifier: null,
        deleteAll: false,
      };
    }

    // No arguments provided
    return {
      listName: null,
      todoIdentifier: null,
      deleteAll: false,
    };
  }

  /**
   * Check if a string looks like a todo ID (numeric or UUID-like)
   */
  private looksLikeTodoId(str: string): boolean {
    // Check if it's numeric
    if (/^\d+$/.test(str)) {
      return true;
    }
    
    // Check if it's UUID-like
    if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(str)) {
      return true;
    }
    
    // Check if it's a short hash-like ID
    if (/^[a-f0-9]{6,}$/i.test(str)) {
      return true;
    }
    
    return false;
  }

  /**
   * Delete an entire list
   */
  private async deleteEntireList(listName: string, force: boolean): Promise<void> {
    const list = await this.todoService.getList(listName);
    if (!list) {
      throw new CLIError(
        `List "${listName}" not found`,
        'LIST_NOT_FOUND'
      );
    }

    if (!force) {
      const shouldDelete = await confirm({
        message: chalk.red(`⚠️  Delete entire list "${chalk.bold(listName)}"?`) + '\n' +
                 chalk.dim(`   This will permanently delete ${list.todos.length} todo${list.todos.length !== 1 ? 's' : ''}.\n`) +
                 chalk.dim(`   This action cannot be undone.`),
        default: false,
      });
      if (!shouldDelete) {
        this.log(chalk.yellow('✗ Delete operation cancelled'));
        return;
      }
    }

    await this.todoService.deleteList(listName);
    
    this.log(chalk.green('✓'), chalk.green('Successfully deleted list'));
    this.log('  ', chalk.bold(listName));
    this.log('  ', chalk.dim(`${list.todos.length} todo${list.todos.length !== 1 ? 's' : ''} removed`));
    if (list.todos.length > 0 && list.todos.length <= 5) {
      this.log(chalk.dim('\n  Deleted todos:'));
      list.todos.forEach((todo: any) => {
        this.log(chalk.dim(`  • ${todo.title}`));
      });
    }
  }

  /**
   * Delete a specific todo
   */
  private async deleteTodo(listName: string | null, todoIdentifier: string, force: boolean): Promise<void> {
    let todo: any;
    let actualListName: string;

    if (listName) {
      // Search in specific list
      const list = await this.todoService.getList(listName);
      if (!list) {
        throw new CLIError(
          `List "${listName}" not found`,
          'LIST_NOT_FOUND'
        );
      }

      // First try exact match
      todo = await this.todoService.getTodoByTitleOrId(todoIdentifier, listName);
      
      // If not found, try partial ID match
      if (!todo && this.looksLikeTodoId(todoIdentifier)) {
        const partialMatches = list.todos.filter((t: any) => 
          t.id.toLowerCase().startsWith(todoIdentifier.toLowerCase())
        );
        
        if (partialMatches.length === 1) {
          todo = partialMatches[0];
        } else if (partialMatches.length > 1) {
          this.log(chalk.yellow(`⚠️  Multiple todos found matching "${todoIdentifier}" in list "${listName}":`));
          partialMatches.forEach((t: any, index: number) => {
            this.log(`  ${index + 1}. ${chalk.bold(t.title)} (${chalk.dim(t.id)})`);
          });
          throw new CLIError(
            'Multiple matches found. Please use a more specific ID or the full title.',
            'AMBIGUOUS_MATCH'
          );
        }
      }
      
      if (!todo) {
        // Provide helpful error with suggestions
        const availableTodos = list.todos.slice(0, 5);
        if (availableTodos.length > 0) {
          this.log(chalk.yellow(`⚠️  Todo "${todoIdentifier}" not found in list "${listName}"`));
          this.log(chalk.dim('\nAvailable todos in this list:'));
          availableTodos.forEach((t: any) => {
            this.log(`  • ${t.title} ${chalk.dim(`(${t.id.substring(0, 8)}...)`)}`);
          });
          if (list.todos.length > 5) {
            this.log(chalk.dim(`  ... and ${list.todos.length - 5} more`));
          }
        }
        throw new CLIError(
          `Todo "${todoIdentifier}" not found in list "${listName}"`,
          'TODO_NOT_FOUND'
        );
      }
      actualListName = listName;
    } else {
      // Search all lists
      const result = await this.findTodoInAllLists(todoIdentifier);
      if (!result) {
        throw new CLIError(
          `Todo "${todoIdentifier}" not found in any list`,
          'TODO_NOT_FOUND'
        );
      }
      todo = result.todo;
      actualListName = result.listName;
    }

    if (!force) {
      const shouldDelete = await confirm({
        message: chalk.yellow(`⚠️  Delete todo "${chalk.bold(todo.title)}"${listName ? '' : ` from list "${actualListName}"`}?`) + '\n' +
                 chalk.dim(`   ID: ${todo.id}\n`) +
                 chalk.dim(`   This action cannot be undone.`),
        default: false,
      });
      if (!shouldDelete) {
        this.log(chalk.yellow('✗ Delete operation cancelled'));
        return;
      }
    }

    await this.todoService.deleteTodo(actualListName, todo.id);

    this.log(chalk.green('✓'), chalk.green('Successfully deleted todo'));
    this.log('  ', chalk.bold(todo.title));
    this.log('  ', chalk.dim('List:'), actualListName);
    this.log('  ', chalk.dim('ID:'), todo.id);
    if (todo.priority) {
      this.log('  ', chalk.dim('Priority:'), getColoredPriority(todo.priority));
    }
  }

  /**
   * Find a todo across all lists with support for partial ID matching
   */
  private async findTodoInAllLists(todoIdentifier: string): Promise<{ todo: any; listName: string } | null> {
    const lists = await this.todoService.getAllListsWithContent();
    const matches: Array<{ todo: any; listName: string }> = [];
    
    for (const [listName, list] of Object.entries(lists)) {
      // First try exact match
      const exactMatch = list.todos.find((t: any) => 
        t.id === todoIdentifier || t.title === todoIdentifier
      );
      if (exactMatch) {
        return { todo: exactMatch, listName };
      }
      
      // Collect partial ID matches
      const partialMatches = list.todos.filter((t: any) => 
        t.id.toLowerCase().startsWith(todoIdentifier.toLowerCase())
      );
      partialMatches.forEach((todo: any) => {
        matches.push({ todo, listName });
      });
    }
    
    // Handle partial matches
    if (matches.length === 1) {
      // Single match found, use it
      return matches[0];
    } else if (matches.length > 1) {
      // Multiple matches, show them to user
      this.log(chalk.yellow(`⚠️  Multiple todos found matching "${todoIdentifier}":`));
      matches.forEach(({ todo, listName }, index) => {
        this.log(`  ${index + 1}. ${chalk.bold(todo.title)} (${chalk.dim(todo.id)}) in list "${listName}"`);
      });
      throw new CLIError(
        'Multiple matches found. Please use a more specific ID or the full title.',
        'AMBIGUOUS_MATCH'
      );
    }
    
    return null;
  }

  /**
   * Show interactive help when no specific action is provided
   */
  private async showInteractiveHelp(listName: string | null): Promise<void> {
    if (listName) {
      // List was provided but no todo ID or --all flag
      const list = await this.todoService.getList(listName);
      if (!list) {
        throw new CLIError(
          `List "${listName}" not found`,
          'LIST_NOT_FOUND'
        );
      }

      this.log(
        chalk.yellow('⚠️'),
        `Please specify what to delete from list "${listName}"`
      );

      this.log(chalk.dim('\nExamples:'));
      this.log(chalk.dim(`  ${this.config.bin} delete ${listName} <todo-id>     # Delete specific todo`));
      this.log(chalk.dim(`  ${this.config.bin} delete ${listName} --all        # Delete entire list`));

      if (list.todos.length > 0) {
        this.log(chalk.blue('\nTodos in this list:'));
        const maxToShow = 10;
        list.todos.slice(0, maxToShow).forEach((todo: any, index: number) => {
          const status = todo.completed ? chalk.green('✓') : chalk.yellow('○');
          const priority = todo.priority ? ` ${chalk.dim(`[${getColoredPriority(todo.priority)}]`)}` : '';
          this.log(`  ${status} ${todo.title}${priority}`);
          this.log(`    ${chalk.dim('ID:')} ${chalk.cyan(todo.id.substring(0, 8))}...`);
          if (index < Math.min(maxToShow - 1, list.todos.length - 1)) {
            this.log('');
          }
        });
        
        if (list.todos.length > maxToShow) {
          this.log(chalk.dim(`\n  ... and ${list.todos.length - maxToShow} more todos`));
        }

        const shouldDeleteAll = await confirm({
          message: chalk.yellow(`\nDo you want to delete the entire "${listName}" list?`),
          default: false,
        });

        if (shouldDeleteAll) {
          await this.deleteEntireList(listName, false);
        } else {
          this.log(chalk.blue('\n💡 To delete a specific todo:'));
          this.log(chalk.dim(`   ${this.config.bin} delete ${listName} <todo-id>`));
          this.log(chalk.dim(`   ${this.config.bin} delete ${listName} "<todo-title>"`));
        }
      } else {
        this.log(chalk.dim('\n(This list is empty)'));
        
        const shouldDelete = await confirm({
          message: chalk.yellow(`Delete the empty list "${listName}"?`),
          default: false,
        });
        
        if (shouldDelete) {
          await this.deleteEntireList(listName, false);
        }
      }
    } else {
      // No arguments provided
      this.log(
        chalk.yellow('⚠️'),
        'Please specify what to delete'
      );

      this.log(chalk.dim('\nExamples:'));
      this.log(chalk.dim(`  ${this.config.bin} delete <list-name> <todo-id>     # Delete from specific list`));
      this.log(chalk.dim(`  ${this.config.bin} delete <todo-id>                 # Delete from any list`));
      this.log(chalk.dim(`  ${this.config.bin} delete <list-name> --all         # Delete entire list`));

      const lists = await this.todoService.getAllListsWithContent();
      if (Object.keys(lists).length > 0) {
        this.log(chalk.blue('\nYour todo lists:'));
        let totalTodos = 0;
        Object.entries(lists).forEach(([listName, list]: [string, any]) => {
          const todoCount = list.todos.length;
          totalTodos += todoCount;
          const icon = todoCount === 0 ? chalk.gray('○') : chalk.green('●');
          this.log(`  ${icon} ${chalk.bold(listName)} ${chalk.dim(`(${todoCount} todo${todoCount !== 1 ? 's' : ''})`)}`);
        });
        
        if (totalTodos > 0) {
          this.log(chalk.dim(`\nTotal: ${totalTodos} todo${totalTodos !== 1 ? 's' : ''} across ${Object.keys(lists).length} list${Object.keys(lists).length !== 1 ? 's' : ''}`));
        }
      } else {
        this.log(chalk.dim('\nNo todo lists found. Create one with:'));
        this.log(chalk.dim(`  ${this.config.bin} add "Your first todo" --list mylist`));
      }
    }
  }
}
