import chalk from 'chalk';
import { suiService } from '../services/sui-service';
import { walrusService } from '../services/walrus-service';

interface PublishOptions {
  list: string;
}

export async function publish(options: PublishOptions): Promise<void> {
  try {
    const { list } = options;
    const todoList = await walrusService.getTodoList(list);
    
    if (!todoList) {
      console.error(chalk.red(`Todo list '${list}' not found`));
      process.exit(1);
    }

    // Publish to blockchain - store only references
    await suiService.publishList(list, todoList);
    
    console.log(chalk.green('✔ List published successfully to blockchain'));
    console.log(chalk.dim('List:'), list);

  } catch (error) {
    console.error(chalk.red('Failed to publish list:'), error);
    process.exit(1);
  }
}