import { Args, Command, Flags } from '@oclif/core';
import { TodoService } from '../services/todoService';
import chalk from 'chalk';

export default class SimpleCommand extends Command {
  static description = 'Simple todo management';

  static examples = [
    'waltodo simple create shopping-list',
    'waltodo simple add shopping-list "Buy milk" -p high -t grocery,important',
    'waltodo simple list shopping-list',
    'waltodo simple complete shopping-list --id todo-123'
  ];

  static flags = {
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
          const list = await this.todoService.createList(args.list, 'local-user');
          this.log(`✅ Todo list "${args.list}" created successfully`);
          break;
        }

        case 'add': {
          if (!args.title) {
            throw new Error('Title is required for add command');
          }
          const todo = await this.todoService.addTodo(args.list, {
            title: args.title,
            task: args.title,
            priority: flags.priority as 'high' | 'medium' | 'low',
            tags: flags.tags ? flags.tags.split(',').map(t => t.trim()) : [],
            private: true
          });
          this.log(`✅ Added todo "${todo.title}" to list "${args.list}"`);
          break;
        }

        case 'list': {
          const todoList = await this.todoService.getList(args.list);
          if (!todoList) {
            this.log(`List "${args.list}" not found`);
            return;
          }
          this.log(`\n${chalk.bold(todoList.name)} (${todoList.todos.length} todos):`);
          todoList.todos.forEach(todo => {
            const status = todo.completed ? chalk.green('✓') : chalk.gray('☐');
            const priority = todo.priority === 'high' ? chalk.red('⚠️') :
                           todo.priority === 'medium' ? chalk.yellow('•') :
                           chalk.green('○');
            this.log(`${status} ${priority} ${todo.title} (${todo.id})`);
            if (todo.tags.length > 0) {
              this.log(`   ${chalk.dim(`Tags: ${todo.tags.join(', ')}`)}`);
            }
          });
          break;
        }

        case 'complete': {
          if (!flags.id) {
            throw new Error('Todo ID is required for complete command (use --id)');
          }
          await this.todoService.toggleItemStatus(args.list, flags.id, true);
          this.log(`✅ Marked todo as completed`);
          break;
        }

        default:
          this.error(`Unknown action: ${args.action}`);
      }
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error));
    }
  }
}