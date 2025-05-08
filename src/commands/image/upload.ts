import { Command, Flags } from '@oclif/core';
import { CLIError } from '../../utils/error-handler';
import { TodoService } from '../../services/todoService';
import { createWalrusImageStorage, WalrusImageStorage } from '../../utils/walrus-image-storage'; // Import WalrusImageStorage type
import { NETWORK_URLS } from '../../constants';
import { SuiClient } from '@mysten/sui.js/client';
// Removed unused chalk import
import * as path from 'path';
import { configService } from '../../services/config-service';

export default class UploadCommand extends Command {
  static description = 'Upload a custom image for a todo to Walrus storage';

  static examples = [
    '<%= config.bin %> image upload --todo 123 --list my-todos --image ./custom.png',
  ];

  static flags = {
    todo: Flags.string({
      char: 't',
      description: 'ID of the todo to upload image for',
      required: true,
    }),
    list: Flags.string({
      char: 'l',
      description: 'Name of the todo list',
      required: true,
    }),
    image: Flags.string({
      char: 'i',
      description: 'Path to a custom image file',
      required: true,
    }),
    'show-url': Flags.boolean({
      description: 'Display only the image URL',
    }),
  };

  async run(): Promise<void> {
    const config = await configService.getConfig();
    const { flags } = await this.parse(UploadCommand);
    const todoService = new TodoService();
    let walrusImageStorage: WalrusImageStorage | undefined; // Use correct type and allow undefined initially

    try {
      // Get the todo item
      const todoItem = await todoService.getTodo(flags.todo, flags.list);
      if (!todoItem) {
        throw new CLIError(`Todo with ID ${flags.todo} not found in list ${flags.list}`);
      }

      // Setup SuiClient with type assertion for network
      const suiClient = new SuiClient({ url: NETWORK_URLS[config.network as keyof typeof NETWORK_URLS] });

      // Initialize WalrusImageStorage - ensuring variable is defined and assigned correctly
      walrusImageStorage = createWalrusImageStorage(suiClient);  // No change, but confirming assignment

      // Connect to Walrus
      this.log('Connecting to Walrus storage...');
      await walrusImageStorage.connect();
      this.log('Connected to Walrus storage');

      // Upload image
      this.log('Uploading image to Walrus...');
      const imageUrl = await walrusImageStorage.uploadTodoImage(path.resolve(process.cwd(), flags.image), todoItem.title, todoItem.completed);

      // Extract blob ID from URL
      const blobId = imageUrl.split('/').pop() || '';

      // Update todo with image URL
      const updatedTodo = { ...todoItem, imageUrl };
      await todoService.updateTodo(flags.list, flags.todo, updatedTodo);

      if (flags['show-url']) {
        this.log(imageUrl);
        return;
      }

      this.log(`✅ Image uploaded successfully to Walrus`);
      this.log(`📝 Image URL: ${imageUrl}`);
      this.log(`📝 Blob ID: ${blobId}`);
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(`Failed to upload image: ${error instanceof Error ? error.message : String(error)}`, 'IMAGE_UPLOAD_FAILED');
    } finally {
      // Check if walrusImageStorage was initialized before trying to use it
      if (walrusImageStorage) {
        // No disconnect method exists on WalrusImageStorage, so no action needed here.
        // If cleanup is required in the future, add it here.
        this.log('Walrus storage cleanup (if any) would happen here.');
      } else {
        this.log('Walrus storage was not initialized, skipping cleanup.');
      }
    }
  }
}
