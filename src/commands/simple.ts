import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../base-command';
import { TodoService } from '../services/todoService';
import { CLIError } from '../types/error';
// Removed unused Todo import
import chalk from 'chalk';

/**
 * @class SimpleCommand
 * @description This command provides a simplified interface for managing todos with basic operations.
 * It supports creating lists, adding todos, listing todos with filtering and sorting options, and marking todos as complete.
 * The command is designed for quick and straightforward interactions with the todo system without advanced features.
 *
 * @param {string} action - The action to perform: 'create' a new list, 'add' a todo, 'list' todos, or 'complete' a todo. (Required argument)
 * @param {string} list - The name of the todo list to operate on. (Required argument)
 * @param {string} [title] - The title of the todo item to add. Required for 'add' action. (Optional argument)
 * @param {string} [priority='medium'] - The priority level of the todo item ('high', 'medium', 'low'). Used with 'add' action. (Optional flag: -p, --priority)
 * @param {string} [tags] - Comma-separated tags to associate with the todo item. Used with 'add' action. (Optional flag: -t, --tags)
 * @param {string} [id] - The ID of the todo item to mark as complete. Required for 'complete' action. (Optional flag: -i, --id)
 * @param {string} [sort] - Sort the listed todos by 'priority' or 'title'. Used with 'list' action. (Optional flag: -s, --sort)
 * @param {string} [filter] - Filter the listed todos by status ('completed' or 'incomplete'). Used with 'list' action. (Optional flag: -f, --filter)
 */
export default class SimpleCommand extends BaseCommand {
  static description = 'Manage todos with simplified commands for basic operations';

  static examples = [
    'waltodo simple create shopping-list',
    'waltodo simple add shopping-list "Buy milk" -p high -t grocery,important',
    'waltodo simple list shopping-list',
    'waltodo simple complete shopping-list --id todo-123'
  ];

  static flags = {
    ...BaseCommand.flags,
    priority: Flags.string({
      char: 'p',
      description: 'Priority (high, medium, low)',
      options: ['high', 'medium', 'low'],
      default: 'medium'
    }),
    tags: Flags.string({
      char: 't',
      description: 'Comma-separated tags'
    }),
    id: Flags.string({
      char: 'i',
      description: 'Todo ID (for complete command)'
    }),
    sort: Flags.string({
      char: 's',
      description: 'Sort by field (e.g., priority, title)',
      options: ['priority', 'title']
    }),
    filter: Flags.string({
      char: 'f',
      description: 'Filter by status (e.g., completed, incomplete)',
      options: ['completed', 'incomplete']
    })
  };

  static args = {
    action: Args.string({
      description: 'Action to perform',
      required: true,
      options: ['create', 'add', 'list', 'complete']
    }),
    list: Args.string({
      description: 'List name',
      required: true
    }),
    title: Args.string({
      description: 'Todo title (for add command)',
      required: false
    })
  };

  private todoService = new TodoService();

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SimpleCommand);

    try {
      switch (args.action) {
        case 'create': {
          await this.todoService.createList(args.list, 'local-user'); // Removed unused list variable assignment
          this.log("✅ Todo list \"" + args.list + "\" created successfully");
          break;
        }

        case 'add': {
          if (!args.title) {
            throw new Error('Title is required for add command');
          }
          const todo = await this.todoService.addTodo(args.list, {
            title: args.title,
            completed: false,
            priority: flags.priority as 'high' | 'medium' | 'low',
            tags: flags.tags ? flags.tags.split(',').map(t => t.trim()) : [],
            private: true
          });
          this.log("✅ Added todo \"" + todo.title + "\" to list \"" + args.list + "\"");  // Changed to double quotes for consistency
          break;
        }

        case 'list': {
          const todoList = await this.todoService.getList(args.list);
          if (!todoList) {
            this.log(`List "${args.list}" not found`);
            return;
          }
          this.log(`\n${chalk.bold(todoList.name)} (${todoList.todos.length} todos):`);
          let filteredTodos = todoList.todos;
          
          // Apply filter if specified
          if (flags.filter) {
            if (flags.filter === 'completed') {
              filteredTodos = filteredTodos.filter(todo => todo.completed);
            } else if (flags.filter === 'incomplete') {
              filteredTodos = filteredTodos.filter(todo => !todo.completed);
            } else {
              this.warn(`Unknown filter: ${flags.filter}. Ignoring.`);
            }
          }
          
          // Apply sort if specified
          if (flags.sort) {
            if (flags.sort === 'priority') {
              filteredTodos.sort((a, b) => {
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                return priorityOrder[b.priority] - priorityOrder[a.priority];
              });
            } else if (flags.sort === 'title') {
              filteredTodos.sort((a, b) => a.title.localeCompare(b.title));
            } else {
              this.warn(`Unknown sort field: ${flags.sort}. Ignoring.`);
            }
          }
          
          // Display the todos
          filteredTodos.forEach(todo => {
            const status = todo.completed ? chalk.green('✓') : chalk.gray('☐');
            const priority = todo.priority === 'high' ? chalk.red('⚠️') :
                           todo.priority === 'medium' ? chalk.yellow('•') :
                           chalk.green('○');
            this.log(`${status} ${priority} ${todo.title} (${todo.id})`);
            if (todo.tags.length > 0) {
              this.log(`   ${chalk.dim("Tags: " + todo.tags.join(', '))}`);  // Changed to double quotes for consistency
            }
          });
          break;
        }

        case 'complete': {
          if (!flags.id) {
            throw new Error('Todo ID is required for complete command (use --id)');
          }
          await this.todoService.toggleItemStatus(args.list, flags.id, true);
          this.log("✅ Marked todo as completed");  // Changed to double quotes for consistency
          break;
        }

        default:
          this.error(`Unknown action: ${args.action}`);
      }
    } catch (_error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed in simple command: ${error instanceof Error ? error.message : String(error)}`,
        'SIMPLE_FAILED'
      );
    }
  }
}
