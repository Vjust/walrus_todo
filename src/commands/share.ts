import { Command } from 'commander';
import { todoService } from '../services';
import { handleError } from '../utils/error-handler';

export const shareCommand = new Command('share')
  .description('Share a todo list with another address')
  .option('-l, --list <list-name>', 'Name of the todo list to share')
  .requiredOption('-r, --recipient <address>', 'Recipient address to share with')
  .action(async (options) => {
    try {
      const { list, recipient } = options;
      if (!list) {
        throw new Error('List name is required. Use --list <list-name>');
      }
      
      await todoService.shareList(list, recipient);
      console.log(`✅ Todo list "${list}" shared successfully with ${recipient}`);
    } catch (error) {
      handleError(error);
    }
  });
