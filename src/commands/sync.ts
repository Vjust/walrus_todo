import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import { suiService } from '../services/sui-service';
import { walrusService } from '../services/walrus-service';
import { CLIError } from '../utils/error-handler';

export default class SyncCommand extends Command {
  static description = 'Synchronize local todo list with blockchain state';

  static examples = [
    '<%= config.bin %> sync my-list',
    '<%= config.bin %> sync my-list --force'
  ];

  static flags = {
    force: Flags.boolean({
      char: 'f',
      description: 'Force sync even if local changes exist',
      default: false
    })
  };

  static args = {
    listName: Args.string({
      name: 'listName',
      description: 'Name of the todo list to sync',
      required: true
    })
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SyncCommand);

    try {
      console.log(chalk.blue('\nSyncing list:'), chalk.bold(args.listName));

      // Get on-chain list state
      const onChainList = await suiService.getListState(args.listName);
      if (!onChainList) {
        throw new CLIError(`List "${args.listName}" not found on blockchain`, 'INVALID_LIST');
      }

      // Get local list
      const localList = await walrusService.getTodoList(args.listName);
      if (!localList) {
        console.log(chalk.yellow('No local list found, creating from blockchain state...'));
      } else if (!flags.force && localList.version > onChainList.version) {
        throw new CLIError(
          'Local list is ahead of blockchain state. Use --force to override local changes.',
          'SYNC_CONFLICT'
        );
      }

      // Sync Walrus data with blockchain state
      await walrusService.syncWithBlockchain(args.listName, onChainList);
      
      console.log(chalk.green('\n✓ List synchronized with blockchain state'));
      console.log(chalk.dim('List:'), args.listName);
      console.log(chalk.dim('Version:'), onChainList.version);
      console.log(chalk.dim('Items:'), onChainList.todos.length);
      console.log(chalk.dim('Last synced:'), new Date().toISOString());

    } catch (error) {
      throw error;
    }
  }
}