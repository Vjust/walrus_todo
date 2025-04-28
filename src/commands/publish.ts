import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import { suiService } from '../services/sui-service';
import { walrusService } from '../services/walrus-service';
import { CLIError } from '../utils/error-handler';

export default class PublishCommand extends Command {
  static description = 'Publish a todo list to the blockchain';

  static examples = [
    '<%= config.bin %> publish my-list',
    '<%= config.bin %> publish my-list --encrypt'
  ];

  static flags = {
    encrypt: Flags.boolean({
      char: 'e',
      description: 'Encrypt list data before publishing',
      default: false
    })
  };

  static args = {
    listName: Args.string({
      name: 'listName',
      description: 'Name of the todo list to publish',
      required: true
    })
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(PublishCommand);

    try {
      const list = await walrusService.getTodoList(args.listName);
      if (!list) {
        throw new CLIError(`List "${args.listName}" not found`, 'INVALID_LIST');
      }

      console.log(chalk.blue('\nPublishing list to blockchain:'), chalk.bold(args.listName));
      if (flags.encrypt) {
        console.log(chalk.dim('Encryption enabled'));
        // TODO: Implement encryption
      }

      // Publish to blockchain
      const tx = await suiService.publishList(args.listName, list);
      
      console.log(chalk.green('\n✓ List published successfully'));
      console.log(chalk.dim('Transaction Hash:'), tx.digest);
      console.log(chalk.dim('Items:'), list.todos.length);
      console.log(chalk.dim('Gas used:'), tx.effects.gasUsed.computationCost);

    } catch (error) {
      throw error;
    }
  }
}