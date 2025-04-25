import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { walrusService } from '../services/walrus-service';

interface DeleteOptions {
  list: string;
  id: string;
  force?: boolean;
}

export async function deleteTodo(options: DeleteOptions) {
  try {
    const { list, id, force } = options;

    if (!force) {
      const shouldDelete = await confirm({
        message: 'Are you sure you want to delete this todo?',
        default: false
      });

      if (!shouldDelete) {
        console.log(chalk.yellow('Operation cancelled'));
        return;
      }
    }

    await walrusService.deleteTodo(list, id);
    console.log(chalk.green('✔ Todo deleted successfully'));
    console.log(chalk.dim('List:'), list);
    console.log(chalk.dim('ID:'), id);

  } catch (error) {
    console.error(chalk.red('Failed to delete todo:'), error);
    process.exit(1);
  }
}