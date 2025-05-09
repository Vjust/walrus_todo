import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';  // Changed from import * as chalk
import { TodoService } from '../services/todoService';
import { AiService } from '../services/ai';
import { Todo, StorageLocation } from '../types/todo';
import { CLIError } from '../types/error';
import { createWalrusStorage } from '../utils/walrus-storage';
// Removed unused configService import

/**
 * @class AddCommand
 * @description This command allows users to add new todo items to a specified list.
 * It supports various options such as setting priority, due date, tags, and storage location (local, blockchain, or both).
 * If the specified list does not exist, it will be created automatically.
 * When 'blockchain' or 'both' storage is selected, the todo item is stored on the Walrus/Sui blockchain,
 * making the data publicly accessible.
 */
export default class AddCommand extends Command {
  static description = 'Add a new todo item to a specified list';

  static examples = [
    '<%= config.bin %> add "Buy groceries"',
    '<%= config.bin %> add "Important task" -p high',
    '<%= config.bin %> add "Meeting" --due 2024-05-01',
    '<%= config.bin %> add my-list -t "Buy groceries"',
    '<%= config.bin %> add -t "Task 1" -t "Task 2"',
    '<%= config.bin %> add "Blockchain task" -s blockchain',
    '<%= config.bin %> add "Hybrid task" -s both',
    '<%= config.bin %> add "Plan project" --ai',
    '<%= config.bin %> add "Fix bug in login" --ai --apiKey YOUR_XAI_API_KEY'
  ];

  static flags = {
    task: Flags.string({
      char: 't',
      description: 'Task description (can be used multiple times)',
      required: false,
      multiple: true
    }),
    priority: Flags.string({
      char: 'p',
      description: 'Task priority (high, medium, low)',
      options: ['high', 'medium', 'low'],
      default: 'medium'
    }),
    due: Flags.string({
      char: 'd',
      description: 'Due date (YYYY-MM-DD)'
    }),
    tags: Flags.string({
      char: 'g',
      description: 'Comma-separated tags'
    }),
    private: Flags.boolean({
      description: 'Mark todo as private',
      default: false
    }),
    list: Flags.string({
      char: 'l',
      description: 'Name of the todo list',
      default: 'default'
    }),
    storage: Flags.string({
      char: 's',
      description: `Storage location for the todo:
        local: Store only in local JSON files
        blockchain: Store on Walrus/Sui blockchain (data will be publicly accessible)
        both: Keep both local copy and blockchain storage
      NOTE: Blockchain storage uses Walrus for data and can be publicly accessed.`,
      options: ['local', 'blockchain', 'both'],
      default: 'local',
      helpGroup: 'Storage Options'
    }),
    // AI-related flags
    ai: Flags.boolean({
      description: 'Use AI to suggest tags and priority',
      default: false,
      helpGroup: 'AI Options'
    }),
    apiKey: Flags.string({
      description: 'XAI API key (defaults to XAI_API_KEY environment variable)',
      required: false,
      helpGroup: 'AI Options'
    })
  };

  static args = {
    title: Args.string({
      name: 'title',
      description: 'Todo title (alternative to -t flag)',
      required: false
    })
  };

  private todoService = new TodoService();
  private walrusStorage = createWalrusStorage(false); // Use real Walrus storage
  private aiService: AiService | null = null;

  private validateDate(date: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(date)) return false;

    const d = new Date(date);
    return d instanceof Date && !isNaN(d.getTime());
  }

  async run(): Promise<void> {
    try {
      console.log("Running add command...");
      process.stdout.write("Starting add command...\n");
      
      const { args, flags } = await this.parse(AddCommand);
      console.log("Parsed arguments:", args);
      console.log("Parsed flags:", flags);

      if (flags.due && !this.validateDate(flags.due)) {
        throw new CLIError("Invalid date format. Use YYYY-MM-DD", 'INVALID_DATE');  // No change, already fixed
      }

      // Determine the list name - either from the list flag or default
      const listName = flags.list || 'default';

      // Determine the todo title - either from the title argument or task flag
      let todoTitle: string;
      if (args.title) {
        // Use the title argument directly
        todoTitle = args.title;
      } else if (flags.task && flags.task.length > 0) {
        // Use the task flag(s)
        todoTitle = flags.task.join(' ');
      } else {
        throw new CLIError('Todo title is required. Provide it as an argument or with -t flag', 'MISSING_TITLE');
      }

      const storageLocation = flags.storage as StorageLocation;

      // Initialize todo object
      const todo: Partial<Todo> = {
        title: todoTitle,
        priority: flags.priority as 'high' | 'medium' | 'low',
        dueDate: flags.due,
        tags: flags.tags ? flags.tags.split(',').map(t => t.trim()) : [],
        private: flags.private,
        storageLocation: storageLocation
      };

      // Use AI if requested
      if (flags.ai) {
        try {
          console.log('AI flag detected in add command');
          console.log('API Key from flag:', flags.apiKey ? '[provided]' : '[not provided]');
          console.log('Environment XAI_API_KEY:', process.env.XAI_API_KEY ? '[found]' : '[not found]');
          
          this.aiService = new AiService(flags.apiKey);
          console.log('AiService created successfully');
          
          // Create a temporary todo object for AI processing
          const tempTodo: Todo = {
            id: 'temp-id',
            title: todoTitle,
            description: '',
            completed: false,
            priority: todo.priority || 'medium',
            tags: todo.tags || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            private: todo.private !== undefined ? todo.private : true,
            storageLocation: todo.storageLocation || 'local'
          };

          this.log(chalk.blue('🧠') + ' Using AI to enhance your todo...');
          console.log('Calling suggestTags and suggestPriority...');
          
          // Get AI suggestions in parallel
          const [suggestedTags, suggestedPriority] = await Promise.all([
            this.aiService.suggestTags(tempTodo),
            this.aiService.suggestPriority(tempTodo)
          ]);
          
          console.log('Received AI suggestions:', suggestedTags, suggestedPriority);
          
          // Merge existing and suggested tags
          const existingTags = todo.tags || [];
          const allTags = [...new Set([...existingTags, ...suggestedTags])];
          
          this.log(chalk.blue('🏷️') + ' AI suggested tags: ' + chalk.cyan(suggestedTags.join(', ')));
          this.log(chalk.blue('🔄') + ' AI suggested priority: ' + chalk.cyan(suggestedPriority));
          
          // Update todo with AI suggestions
          todo.tags = allTags;
          todo.priority = suggestedPriority;
          
          console.log('Todo updated with AI suggestions');
          
        } catch (aiError) {
          // If AI fails, just log a warning and continue with user-provided values
          console.error('AI error:', aiError);
          this.log(chalk.yellow('⚠') + ' AI enhancement failed: ' + chalk.dim(aiError instanceof Error ? aiError.message : String(aiError)));
          this.log(chalk.yellow('⚠') + ' Continuing with provided values');
        }
      }

      // Check if list exists first
      const listExists = await this.todoService.getList(listName);

      // If list doesn't exist, create it
      if (!listExists) {
        await this.todoService.createList(listName, 'default-owner');
        this.log(chalk.blue('ℹ') + ' Created new list: ' + chalk.cyan(listName));
      }

      // Add todo to the list
      console.log('Adding todo to list:', listName, todo);
      const addedTodo = await this.todoService.addTodo(listName, todo as Todo);
      console.log('Todo added:', addedTodo);

      // If storage is blockchain or both, store on blockchain
      if (storageLocation === 'blockchain' || storageLocation === 'both') {
        // Warn about public access
        this.log(chalk.yellow('⚠') + ' Note: Blockchain storage will make the todo data publicly accessible');
        this.log(chalk.blue('ℹ') + ' Storing todo on blockchain...');

        try {
          // Initialize Walrus storage
          try {
            await this.walrusStorage.connect();
          } catch (error) {
            throw new CLIError(
              `Failed to connect to blockchain storage: ${error instanceof Error ? error.message : String(error)}`,
              'BLOCKCHAIN_CONNECTION_FAILED'
            );
          }

          let blobId: string;
          try {
            // Store todo on Walrus
            blobId = await this.walrusStorage.storeTodo(addedTodo);
          } catch (error) {
            throw new CLIError(
              `Failed to store todo on blockchain: ${error instanceof Error ? error.message : String(error)}`,
              'BLOCKCHAIN_STORE_FAILED'
            );
          }

          // Update local todo with Walrus blob ID if we're keeping a local copy
          if (storageLocation === 'both') {
            try {
              await this.todoService.updateTodo(listName, addedTodo.id, {
                walrusBlobId: blobId,
                updatedAt: new Date().toISOString()
              });
            } catch (error) {
              this.log(chalk.yellow('⚠') + ' Warning: Successfully stored on blockchain but failed to update local copy');
            }
          }

          // If storage is blockchain only, remove from local storage
          if (storageLocation === 'blockchain') {
            try {
              await this.todoService.deleteTodo(listName, addedTodo.id);
            } catch (error) {
              this.log(chalk.yellow('⚠') + ' Warning: Failed to remove local copy after blockchain storage');
            }
          }

          this.log(chalk.green('✓') + ' Todo stored on blockchain with blob ID: ' + chalk.dim(blobId));
          this.log(chalk.dim('  Public URL: https://testnet.wal.app/blob/' + blobId));

          // Cleanup
          await this.walrusStorage.disconnect();
        } catch (error) {
          if (error instanceof CLIError) throw error;

          // If blockchain-only storage failed, keep it locally
          if (storageLocation === 'blockchain') {
            this.log(chalk.yellow('⚠') + ' Storage failed - keeping todo locally instead');
            todo.storageLocation = 'local';
          } else {
            throw new CLIError(
              `Failed to store todo on blockchain: ${error instanceof Error ? error.message : String(error)}`,
              'BLOCKCHAIN_STORE_FAILED'
            );
          }
        }
      }

      // Get priority color
      const priorityColor = {
        high: chalk.red,
        medium: chalk.yellow,
        low: chalk.green
      }[todo.priority || 'medium'];

      // Get storage location color and icon
      const storageInfo = {
        local: { color: chalk.green, icon: '💻', text: 'Local only' },
        blockchain: { color: chalk.blue, icon: '🔗', text: 'Blockchain only' },
        both: { color: chalk.magenta, icon: '🔄', text: 'Local & Blockchain' }
      }[addedTodo.storageLocation || 'local'];

      // Build output
      const outputLines = [
        chalk.green('✓') + ' Added todo: ' + chalk.bold(todoTitle),
        `  📋 List: ${chalk.cyan(listName)}`,
        `  🔄 Priority: ${priorityColor(todo.priority || 'medium')}`,
      ];
      if (todo.dueDate) {
        outputLines.push(`  📅 Due: ${chalk.blue(todo.dueDate)}`);
      }
      if (todo.tags && todo.tags.length > 0) {
        outputLines.push(`  🏷️  Tags: ${todo.tags.join(', ')}`);
      }
      outputLines.push(`  🔒 Private: ${todo.private ? chalk.yellow('Yes') : chalk.green('No')}`);
      outputLines.push(`  ${storageInfo.icon} Storage: ${storageInfo.color(storageInfo.text)}`);
      
      const output = outputLines.join('\n');
      console.log("Output:", output);
      this.log(output);
      
      // Also write directly to stdout to ensure output is shown
      process.stdout.write(output + '\n');

    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to add todo: ${error instanceof Error ? error.message : String(error)}`,
        'ADD_FAILED'
      );
    }
  }
}
