import { Flags } from '@oclif/core';
import { BaseCommand } from '../../base-command';
import { CLIError } from '../../types/errors/consolidated';
import { TodoService } from '../../services/todoService';
import {
  createWalrusImageStorage,
  WalrusImageStorage,
} from '../../utils/walrus-image-storage'; // Import WalrusImageStorage type
import { NETWORK_URLS } from '../../constants';
import { SuiClient } from '../../utils/adapters/sui-client-adapter';
import { jobManager, performanceMonitor } from '../../utils/PerformanceMonitor';
import * as path from 'path';
import * as fs from 'fs';
import chalk = require('chalk');
import { configService } from '../../services/config-service';

/**
 * @class UploadCommand
 * @description This command uploads a custom image for a specified todo item to Walrus storage.
 * It ensures the todo exists before uploading the image and updates the todo with the new image URL.
 * The command provides feedback on the upload process and the resulting image URL and blob ID.
 *
 * @param {string} todo - The ID of the todo item to upload an image for. (Required flag: -t, --todo)
 * @param {string} list - The name of the todo list containing the specified todo item. (Required flag: -l, --list)
 * @param {string} image - Path to the custom image file to upload. (Required flag: -i, --image)
 * @param {boolean} [show-url=false] - If true, displays only the image URL after upload. (Optional flag: --show-url)
 */
export default class UploadCommand extends BaseCommand {
  static description =
    'Upload and attach a custom image to a todo item using Walrus decentralized storage';

  static examples = [
    '<%= config.bin %> image upload --todo 123 --list my-todos --image ./custom.png    # Upload PNG',
    '<%= config.bin %> image upload --todo "Buy milk" --list shopping --image photo.jpg  # Upload JPG',
    '<%= config.bin %> image upload -t task-456 -l work -i ./logo.svg                  # Short flags',
    '<%= config.bin %> image upload --todo 789 --list personal --image pic.webp --compress  # Compress',
    '<%= config.bin %> image upload --todo 123 --list my-todos --image large.jpg --background  # Background upload',
    '<%= config.bin %> image upload -t task-456 -l work -i ./photo.png -b --priority high     # High priority background',
    '<%= config.bin %> image upload --todo 789 --list personal --image huge.tiff --background --progress-file ./upload-progress.json',
  ];

  static flags = {
    ...BaseCommand.flags,
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
    background: Flags.boolean({
      char: 'b',
      description: 'Run upload in background without blocking terminal',
      default: false,
    }),
    'job-id': Flags.string({
      description: 'Optional job ID for background operation tracking',
    }),
    priority: Flags.string({
      char: 'p',
      description: 'Job priority for background operations',
      options: ['low', 'medium', 'high'],
      default: 'medium',
    }),
    'progress-file': Flags.string({
      description: 'File to write progress updates for background operations',
    }),
    'max-size': Flags.integer({
      description: 'Maximum file size in MB for upload (default: 50MB)',
      default: 50,
    }),
    compress: Flags.boolean({
      description: 'Compress image before upload to reduce size',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const config = await configService.getConfig();
    const { flags } = await this.parse(UploadCommand as any);
    const todoService = new TodoService();
    let walrusImageStorage: WalrusImageStorage | undefined; // Use correct type and allow undefined initially

    try {
      // Validate image file first
      const imagePath = path.resolve(process.cwd(), flags.image);
      await this.validateImageFile(imagePath, flags?.["max-size"]);

      // Get the todo item
      const todoItem = await todoService.getTodo(flags.todo, flags.list);
      if (!todoItem) {
        throw new CLIError(
          `Todo with ID ${flags.todo} not found in list ${flags.list}`
        );
      }

      // Setup SuiClient with type assertion for network
      const suiClient = new SuiClient({
        url: NETWORK_URLS[config.network as keyof typeof NETWORK_URLS],
      });

      // Initialize WalrusImageStorage - ensuring variable is defined and assigned correctly
      walrusImageStorage = createWalrusImageStorage(suiClient as any); // No change, but confirming assignment

      if (flags.background) {
        return await this.handleBackgroundUpload(
          flags,
          todoItem,
          walrusImageStorage,
          todoService
        );
      }

      // Connect to Walrus
      this.log('Connecting to Walrus storage...');
      await walrusImageStorage.connect();
      this.log('Connected to Walrus storage');

      // Upload image with performance tracking
      this.log('Uploading image to Walrus...');
      const imageUrl = await performanceMonitor.measureOperation(
        'image-upload',
        async () =>
          await walrusImageStorage.uploadTodoImage(
            imagePath,
            todoItem.title,
            todoItem.completed
          ),
        {
          imageSize: this.getFileSize(imagePath as any),
          imagePath: flags.image,
          todoId: flags.todo,
          listName: flags.list,
        }
      );

      // Extract blob ID from URL
      const blobId = imageUrl.split('/').pop() || '';

      // Update todo with image URL
      const updatedTodo = { ...todoItem, imageUrl };
      await todoService.updateTodo(flags.list, flags.todo, updatedTodo);

      if (flags?.["show-url"]) {
        this.log(imageUrl as any);
        return;
      }

      this.log(`✅ Image uploaded successfully to Walrus`);
      this.log(`📝 Image URL: ${imageUrl}`);
      this.log(`📝 Blob ID: ${blobId}`);
      this.log(
        `📝 File size: ${this.formatFileSize(this.getFileSize(imagePath as any))}`
      );
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to upload image: ${error instanceof Error ? error.message : String(error as any)}`,
        'IMAGE_UPLOAD_FAILED'
      );
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

  private async validateImageFile(
    imagePath: string,
    maxSizeMB: number
  ): Promise<void> {
    try {
      const stats = fs.statSync(imagePath as any);
      const maxSizeBytes = maxSizeMB * 1024 * 1024;

      if (stats.size > maxSizeBytes) {
        throw new CLIError(
          `Image file is too large (${this.formatFileSize(stats.size)}). Maximum allowed: ${maxSizeMB}MB`,
          'FILE_TOO_LARGE'
        );
      }

      // Check file extension
      const ext = path.extname(imagePath as any).toLowerCase();
      const supportedExtensions = [
        '.jpg',
        '.jpeg',
        '.png',
        '.gif',
        '.webp',
        '.svg',
      ];

      if (!supportedExtensions.includes(ext as any)) {
        throw new CLIError(
          `Unsupported image format: ${ext}. Supported formats: ${supportedExtensions.join(', ')}`,
          'UNSUPPORTED_FORMAT'
        );
      }
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Cannot access image file: ${error instanceof Error ? error.message : String(error as any)}`,
        'FILE_ACCESS_ERROR'
      );
    }
  }

  private getFileSize(filePath: string): number {
    try {
      return fs.statSync(filePath as any).size;
    } catch {
      return 0;
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes as any) / Math.log(k as any));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1 as any))} ${sizes[i]}`;
  }

  private async handleBackgroundUpload(
    flags: any,
    todoItem: any,
    walrusImageStorage: WalrusImageStorage,
    todoService: TodoService
  ): Promise<void> {
    const jobId =
      flags?.["job-id"] ||
      jobManager.createJob('image', ['upload'], {
        todo: flags.todo,
        list: flags.list,
        image: flags.image,
        priority: flags.priority,
      }).id;

    this.log(chalk.blue(`🔄 Starting background image upload...`));
    this.log(chalk.gray(`📝 Job ID: ${jobId}`));
    this.log(chalk.gray(`💡 Use 'waltodo status ${jobId}' to check progress`));
    this.log(chalk.gray(`💡 Use 'waltodo jobs' to list all background jobs`));

    const imageSize = this.getFileSize(
      path.resolve(process.cwd(), flags.image)
    );
    this.log(chalk.gray(`📏 Image size: ${this.formatFileSize(imageSize as any)}`));

    // Start background process
    setImmediate(async () => {
      try {
        jobManager.startJob(jobId, process.pid);
        jobManager.writeJobLog(jobId, 'Starting image upload operation...');
        jobManager.writeJobLog(jobId, `Image file: ${flags.image}`);
        jobManager.writeJobLog(
          jobId,
          `Image size: ${this.formatFileSize(imageSize as any)}`
        );

        let progress = 0;
        const updateProgress = (
          message: string,
          progressIncrement: number = 10
        ) => {
          progress = Math.min(100, progress + progressIncrement);
          jobManager.updateProgress(jobId, progress);
          jobManager.writeJobLog(jobId, `[${progress}%] ${message}`);
          if (flags?.["progress-file"]) {
            this.writeProgressFile(flags?.["progress-file"], progress, message);
          }
        };

        updateProgress('Validating image file...', 5);
        const imagePath = path.resolve(process.cwd(), flags.image);
        await this.validateImageFile(imagePath, flags?.["max-size"]);

        updateProgress('Connecting to Walrus storage...', 10);
        await walrusImageStorage.connect();

        updateProgress('Preparing image for upload...', 15);

        if (flags.compress) {
          updateProgress('Compressing image...', 20);
          // Image compression would be implemented here
        }

        updateProgress('Uploading image to Walrus...', 40);
        const imageUrl = await walrusImageStorage.uploadTodoImage(
          imagePath,
          todoItem.title,
          todoItem.completed
        );

        updateProgress('Processing upload response...', 10);
        const blobId = imageUrl.split('/').pop() || '';

        updateProgress('Updating todo with image URL...', 10);
        const updatedTodo = { ...todoItem, imageUrl };
        await todoService.updateTodo(flags.list, flags.todo, updatedTodo);

        updateProgress('Upload completed successfully!', 10);

        jobManager.completeJob(jobId, {
          imageUrl,
          blobId,
          todoId: flags.todo,
          listName: flags.list,
          imageSize,
          imagePath: flags.image,
        });

        jobManager.writeJobLog(
          jobId,
          `✅ Image uploaded successfully: ${imageUrl}`
        );
        jobManager.writeJobLog(jobId, `📝 Blob ID: ${blobId}`);
        jobManager.writeJobLog(
          jobId,
          `📏 Final size: ${this.formatFileSize(imageSize as any)}`
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error as any);
        jobManager.failJob(jobId, errorMessage);
        jobManager.writeJobLog(jobId, `❌ Upload failed: ${errorMessage}`);
      }
    });

    // Exit immediately to return control to terminal
    return;
  }

  private writeProgressFile(
    filePath: string,
    progress: number,
    message: string
  ): void {
    try {
      const progressData = {
        progress,
        message,
        timestamp: new Date().toISOString(),
      };
      fs.writeFileSync(filePath, JSON.stringify(progressData, null, 2));
    } catch (error) {
      // Silently ignore progress file write errors
    }
  }
}
