import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import { TodoService } from '../services/todoService';
import { CLIError } from '../types/error';

export default class CompleteCommand extends Command {
  static description = 'Mark a todo as completed';

  static examples = [
    '<%= config.bin %> complete my-list -i todo-123'
  ];

  static flags = {
    id: Flags.string({
      char: 'i',
      description: 'Todo ID to mark as completed',
      required: true
    })
  };

  static args = {
    list: Args.string({
      name: 'list',
      description: 'List name',
      default: 'default'
    })
  };

  private todoService = new TodoService();

  async run(): Promise<void> {
    try {
      const { args, flags } = await this.parse(CompleteCommand);

      const list = await this.todoService.getList(args.list);
      if (!list) {
        throw new CLIError(`List "${args.list}" not found`, 'LIST_NOT_FOUND');
      }

      const todo = list.todos.find(t => t.id === flags.id);
      if (!todo) {
        throw new CLIError(`Todo "${flags.id}" not found in list "${args.list}"`, 'TODO_NOT_FOUND');
      }

      await this.todoService.toggleItemStatus(args.list, flags.id, true);
      
      this.log(chalk.green(`\n✓ Marked todo as completed`));
      this.log(chalk.dim('Details:'));
      this.log(`  ${chalk.bold(todo.title)}`);
      
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to complete todo: ${error instanceof Error ? error.message : String(error)}`,
        'COMPLETE_FAILED'
      );
    }
  }
}