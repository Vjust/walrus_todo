import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import { TodoService } from '../services/todoService';
import { aiService } from '../services/ai';
import { AIProviderFactory } from '../services/ai/AIProviderFactory';
import { Todo, StorageLocation } from '../types/todo';
import { CLIError } from '../types/errors/consolidated';
import { createWalrusStorage } from '../utils/walrus-storage';
import BaseCommand, { ICONS } from '../base-command';
import { InputValidator, CommonValidationRules } from '../utils/InputValidator';
import { CommandSanitizer } from '../utils/CommandSanitizer';
import { AIProvider } from '../types/adapters/AIModelAdapter';
import {
  addCommandValidation,
  validateAIApiKey,
  validateBlockchainConfig,
} from '../utils/CommandValidationMiddleware';
import {
  NetworkError,
  ValidationError,
  ValidationErrorOptions,
} from '../types/errors/consolidated';
import { jobManager, BackgroundJob } from '../utils/PerformanceMonitor';
import {
  createBackgroundOperationsManager,
  BackgroundOperations,
} from '../utils/background-operations';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * @class AddCommand
 * @description This command allows users to add new todo items to a specified list.
 * It supports various options such as setting priority, due date, tags, and storage location.
 * If the specified list does not exist, it will be created automatically.
 * AI features can suggest appropriate tags and priority levels based on todo content.
 */
class AddCommand extends BaseCommand {
  static description = 'Add one or more todo items to a specified list';

  static examples = [
    `# Positional syntax (recommended):`,
    `<%= config.bin %> <%= command.id %> "Buy groceries"                                # Add to default list`,
    `<%= config.bin %> <%= command.id %> mylist "Buy groceries"                        # Add to specific list`,
    `<%= config.bin %> <%= command.id %> mylist "Important task" -p high               # Add with high priority`,
    `<%= config.bin %> <%= command.id %> "Meeting" --due 2024-05-01                    # Add with due date`,
    `<%= config.bin %> <%= command.id %> "Plan project" --ai                           # Use AI to suggest tags/priority`,
    `<%= config.bin %> <%= command.id %> "Multiple tasks" --background                  # Run in background`,
    `<%= config.bin %> <%= command.id %> "Big task" --background --watch               # Run in background with progress`,
    ``,
    `# Legacy flag syntax (still supported):`,
    `<%= config.bin %> <%= command.id %> -t "Buy groceries"                            # Add to default list`,
    `<%= config.bin %> <%= command.id %> -t "Buy groceries" -l mylist                  # Add to specific list`,
    `<%= config.bin %> <%= command.id %> -t "Task 1" -t "Task 2"                       # Add multiple todos`,
    `<%= config.bin %> <%= command.id %> -t "High priority" -p high -t "Low" -p low    # Add multiple todos with different priorities`,
  ];

  static flags = {
    ...BaseCommand.flags,
    task: Flags.string({
      char: 't',
      description: 'Task description (legacy flag - prefer positional args)',
      required: false,
      multiple: true,
    }),
    priority: Flags.string({
      char: 'p',
      description:
        'Task priority (high, medium, low) - can be specified multiple times for multiple todos',
      options: ['high', 'medium', 'low'],
      multiple: true,
    }),
    due: Flags.string({
      char: 'd',
      description:
        'Due date (YYYY-MM-DD) - can be specified multiple times for multiple todos',
      multiple: true,
    }),
    tags: Flags.string({
      char: 'g',
      description:
        'Comma-separated tags (e.g., "work,urgent") - can be specified multiple times for multiple todos',
      multiple: true,
    }),
    private: Flags.boolean({
      description: 'Mark todo as private',
      default: false,
    }),
    list: Flags.string({
      char: 'l',
      description: 'Name of the todo list',
      default: 'default',
    }),
    storage: Flags.string({
      char: 's',
      description: 'Storage location (local, blockchain, both)',
      options: ['local', 'blockchain', 'both'],
      default: 'local',
      helpGroup: 'Storage Options',
    }),
    // AI-related flags
    ai: Flags.boolean({
      description: 'Use AI to suggest tags and priority',
      default: false,
      helpGroup: 'AI Options',
    }),
    apiKey: Flags.string({
      description: 'XAI API key (defaults to XAI_API_KEY environment variable)',
      required: false,
      helpGroup: 'AI Options',
    }),
    background: Flags.boolean({
      char: 'b',
      description: 'Run the operation in background without blocking terminal',
      default: false,
      helpGroup: 'Background Options',
    }),
    watch: Flags.boolean({
      description: 'Watch background job progress (only with --background)',
      default: false,
      dependsOn: ['background'],
      helpGroup: 'Background Options',
    }),
  };

  static args = {
    titleOrList: Args.string({
      name: 'titleOrList',
      description: 'Todo title (if only one arg) or list name (if two args)',
      required: false,
    }),
    title: Args.string({
      name: 'title',
      description: 'Todo title (when two args are provided)',
      required: false,
    }),
  };

  // Register the validation middleware
  static hooks = {
    prerun: [addCommandValidation],
  } as const;

  private todoService = new TodoService();
  private walrusStorage = createWalrusStorage('testnet', false); // Use real Walrus storage
  private aiServiceInstance = aiService;
  private backgroundOps: BackgroundOperations | undefined;
  /**
   * Tracks whether the command is creating a new list or adding to an existing one.
   * Used to provide appropriate success messaging to the user.
   */
  private isNewList = false;

  async run(): Promise<void> {
    try {
      this.debugLog('Running add command...');
      this.startUnifiedSpinner('Processing add command...');

      // Parse and validate input
      const { args, flags } = await this.parse(AddCommand);

      // Enhanced input validation using unified validators
      this.performPreExecutionValidation(args, this.cleanFlags(flags));

      this.debugLog('Parsed and validated arguments:', JSON.stringify(args));
      this.debugLog('Parsed and validated flags:', JSON.stringify(flags));

      // If JSON output is requested, handle it separately
      if (this.isJson) {
        return this.handleJsonOutput(args, this.cleanFlags(flags));
      }

      // Handle background execution
      if (flags.background) {
        return this.runInBackground(args, this.cleanFlags(flags));
      }

      // Additional conditional validations
      // Only validate AI key when AI features are being used
      if (flags.ai) {
        // Set flag to indicate AI features are requested
        AIProviderFactory.setAIFeatureRequested(true);
        validateAIApiKey(flags);
      } else {
        // Make sure to reset flag when AI features are not requested
        AIProviderFactory.setAIFeatureRequested(false);
      }
      validateBlockchainConfig(flags);

      // Determine the list name and titles based on arguments and flags
      const { listName, todoTitles } = this.parseInputArguments(
        args,
        this.cleanFlags(flags)
      );

      // Validate title lengths
      for (const title of todoTitles) {
        InputValidator.validate(title, [
          {
            test: value => value.length <= 100,
            message: 'Todo title must be 100 characters or less',
            code: 'TITLE_TOO_LONG',
          },
        ]);
      }

      // Extract attribute arrays for the todos
      const storageLocation = flags.storage as StorageLocation;
      const priorities = Array.isArray(flags.priority)
        ? flags.priority
        : flags.priority
          ? [flags.priority]
          : ['medium']; // Default to medium priority if not specified
      const dueDates = Array.isArray(flags.due)
        ? flags.due
        : flags.due
          ? [flags.due]
          : [];
      const tagSets = Array.isArray(flags.tags)
        ? flags.tags
        : flags.tags
          ? [flags.tags]
          : [];

      // Create warning messages for attribute mismatches
      if (todoTitles.length > 1) {
        // Warn if there's a mismatch between number of titles and other attributes
        if (priorities.length > 1 && priorities.length < todoTitles.length) {
          this.warning(
            `You provided ${todoTitles.length} todos but only ${priorities.length} priorities. The last priority will be used for the remaining todos.`
          );
        }

        if (dueDates.length > 1 && dueDates.length < todoTitles.length) {
          this.warning(
            `You provided ${todoTitles.length} todos but only ${dueDates.length} due dates. The remaining todos will have no due date.`
          );
        }

        if (tagSets.length > 1 && tagSets.length < todoTitles.length) {
          this.warning(
            `You provided ${todoTitles.length} todos but only ${tagSets.length} tag sets. The remaining todos will have no tags.`
          );
        }
      }

      // Create spinner for list creation/check
      const listSpinner = this.startSpinner(
        `Processing todo${todoTitles.length > 1 ? 's' : ''} for list "${listName}"...`
      );

      // Check if list exists first
      const listExists = await this.todoService.getList(listName);

      // If list doesn't exist, create it and set the flag
      if (!listExists) {
        await this.todoService.createList(listName, 'default-owner');
        this.isNewList = true; // Set flag for new list creation
        this.stopSpinnerSuccess(
          listSpinner,
          `Created new list: ${chalk.cyan(listName)}`
        );
      } else {
        this.isNewList = false; // Reset flag for existing list
        this.stopSpinnerSuccess(
          listSpinner,
          `Found list: ${chalk.cyan(listName)}`
        );
      }

      const addedTodos: Todo[] = [];

      /**
       * Process each todo, mapping appropriate attributes to each.
       * For multiple todos, we handle attribute distribution as follows:
       * - If there are more todos than attributes, the last attribute value is reused
       * - Only the first todo shows "New List Created" message when creating a new list
       */
      for (let i = 0; i < todoTitles.length; i++) {
        const todoTitle = todoTitles[i];

        // Only the first task gets "New List" text if a new list was created
        // After the first task, always use "New Task Added" even if the list is new
        if (i > 0) {
          this.isNewList = false;
        }

        // Map attributes to this todo using intelligent distribution pattern:
        // 1. Use attribute at same index as todo if available
        // 2. Fall back to last attribute value if there are fewer attributes than todos (for priorities)
        // 3. Fall back to empty/undefined for other attributes if no value at index
        const priority =
          priorities[i] !== undefined
            ? priorities[i]
            : priorities[priorities.length - 1];
        const dueDate =
          dueDates[i] !== undefined
            ? CommandSanitizer.sanitizeDate(dueDates[i] || '')
            : undefined;
        const tags =
          tagSets[i] !== undefined
            ? CommandSanitizer.sanitizeTags(tagSets[i] || '')
            : [];

        // Initialize todo object with sanitized inputs
        const todo: Partial<Todo> = {
          title: todoTitle,
          priority: priority as 'high' | 'medium' | 'low',
          dueDate: dueDate,
          tags: tags,
          private: flags.private as boolean,
          storageLocation: storageLocation,
        };

        // Use AI if requested
        if (flags.ai) {
          await this.enhanceWithAI(
            todo,
            todoTitle || '',
            this.cleanFlags(flags)
          );
        }

        // Add todo to the list
        this.debugLog('Adding todo to list:', { listName, todo });
        const addedTodo = await this.todoService.addTodo(
          listName,
          todo as Todo
        );
        this.debugLog('Todo added:', addedTodo);
        addedTodos.push(addedTodo);

        // If storage is blockchain or both, store on blockchain
        if (storageLocation === 'blockchain' || storageLocation === 'both') {
          await this.storeOnBlockchain(addedTodo, listName, storageLocation);
        }

        // Display success information in a nicely formatted box
        await this.displaySuccessInfo(addedTodo, listName);
      }
    } catch (error) {
      this.debugLog(`Error: ${error}`);
      // Add stack trace for debugging
      if (error instanceof Error) {
        this.debugLog(`Stack: ${error.stack}`);
      }

      // Handle specific error types with helpful messages
      if (error instanceof CLIError && error.code === 'TITLE_TOO_LONG') {
        this.errorWithHelp(
          'Invalid title',
          'Todo title must be 100 characters or less',
          'Please provide a shorter title'
        );
      }

      if (error instanceof CLIError && error.code === 'MISSING_TITLE') {
        this.errorWithHelp(
          'Missing title',
          'Todo title is required',
          'Provide a title using one of these formats:\n' +
            `  ${this.config.bin} add "Buy groceries"              # Add to default list\n` +
            `  ${this.config.bin} add mylist "Buy groceries"      # Add to specific list\n` +
            `  ${this.config.bin} add -t "Buy groceries"          # Legacy flag syntax`
        );
      }

      if (
        error instanceof CLIError &&
        error.code === 'BLOCKCHAIN_CONNECTION_FAILED'
      ) {
        this.detailedError(
          'Blockchain connection failed',
          'Failed to connect to the blockchain storage service',
          [
            'Verify your network connection is working properly',
            'Check if the blockchain service is available',
            'Verify your environment configuration with `waltodo config`',
            'Try using local storage instead with `-s local` flag',
          ]
        );
      }

      // Handle multi-flag specific errors
      if (
        error instanceof Error &&
        error.message &&
        error.message.includes('Flag --priority can only be specified once')
      ) {
        this.errorWithHelp(
          'Flag usage error',
          'This version of the CLI now supports multiple flag instances',
          'You can now use multiple instances of -t, -p, -d, and -g flags to create multiple todos:\n' +
            `${this.config.bin} add -t "Task 1" -p high -t "Task 2" -p low\n` +
            `This will create two todos with different priorities.`
        );
      }

      if (
        error instanceof Error &&
        error.message &&
        error.message.includes('Flag --due can only be specified once')
      ) {
        this.errorWithHelp(
          'Flag usage error',
          'This version of the CLI now supports multiple flag instances',
          'You can now use multiple instances of -t, -p, -d, and -g flags to create multiple todos:\n' +
            `${this.config.bin} add -t "Task 1" -d 2023-01-01 -t "Task 2" -d 2023-02-01\n` +
            `This will create two todos with different due dates.`
        );
      }

      if (
        error instanceof Error &&
        error.message &&
        error.message.includes('Flag --tags can only be specified once')
      ) {
        this.errorWithHelp(
          'Flag usage error',
          'This version of the CLI now supports multiple flag instances',
          'You can now use multiple instances of -t, -p, -d, and -g flags to create multiple todos:\n' +
            `${this.config.bin} add -t "Task 1" -g "work,urgent" -t "Task 2" -g "home,later"\n` +
            `This will create two todos with different tag sets.`
        );
      }

      if (error instanceof CLIError) {
        throw error;
      }

      throw new CLIError(
        `Failed to add todo: ${error instanceof Error ? error.message : String(error)}`,
        'ADD_FAILED'
      );
    }
  }

  /**
   * Handle JSON output format for programmatic CLI usage
   * Replicates the core functionality of the main run method,
   * but returns structured JSON instead of formatted console output.
   * @param args Command arguments
   * @param flags Command flags
   */
  private async handleJsonOutput(
    args: { titleOrList?: string; title?: string },
    flags: Record<string, string | boolean | string[] | undefined>
  ): Promise<void> {
    // Determine the list name and titles based on arguments and flags
    const { listName, todoTitles } = this.parseInputArguments(args, flags);

    // Get attribute arrays
    const priorities = Array.isArray(flags.priority)
      ? flags.priority
      : flags.priority
        ? [flags.priority]
        : ['medium'];
    const dueDates = Array.isArray(flags.due)
      ? flags.due
      : flags.due
        ? [flags.due]
        : [];
    const tagSets = Array.isArray(flags.tags)
      ? flags.tags
      : flags.tags
        ? [flags.tags]
        : [];
    const storageLocation = flags.storage as StorageLocation;

    // Create list if it doesn't exist
    const listExists = await this.todoService.getList(listName);
    if (!listExists) {
      await this.todoService.createList(listName, 'default-owner');
      this.isNewList = true; // Set flag for new list creation
    } else {
      this.isNewList = false; // Reset flag for existing list
    }

    const addedTodos: Todo[] = [];

    // Process each todo
    for (let i = 0; i < todoTitles.length; i++) {
      const todoTitle = todoTitles[i];

      // Only the first task gets "New List" text if a new list was created
      // After the first task, always use "New Task Added" even if the list is new
      if (i > 0) {
        this.isNewList = false;
      }

      // Map attributes to this todo
      const priority =
        priorities[i] !== undefined && typeof priorities[i] === 'string'
          ? (priorities[i] as string)
          : typeof priorities[priorities.length - 1] === 'string'
            ? (priorities[priorities.length - 1] as string)
            : 'medium';
      const dueDate =
        dueDates[i] !== undefined && typeof dueDates[i] === 'string'
          ? CommandSanitizer.sanitizeDate(dueDates[i] as string)
          : undefined;
      const tags =
        tagSets[i] !== undefined && typeof tagSets[i] === 'string'
          ? CommandSanitizer.sanitizeTags(tagSets[i] as string)
          : [];

      // Prepare the todo object
      const todo: Partial<Todo> = {
        title: todoTitle,
        priority: priority as 'high' | 'medium' | 'low',
        dueDate: dueDate,
        tags: tags,
        private: flags.private as boolean,
        storageLocation: storageLocation,
      };

      // Add todo to the list
      const addedTodo = await this.todoService.addTodo(listName, todo as Todo);
      addedTodos.push(addedTodo);
    }

    // Output as JSON
    await this.jsonOutput({
      success: true,
      message:
        todoTitles.length === 1
          ? 'Todo added successfully'
          : `${todoTitles.length} todos added successfully`,
      todos: addedTodos,
      list: listName,
      count: addedTodos.length,
    });
  }

  /**
   * Enhance todo with AI suggestions for tags and priority
   * Uses the configured AI service to analyze the todo content and provide intelligent suggestions.
   * If AI enhancement fails, it will gracefully fall back to user-provided values.
   * @param todo Partial todo object to enhance
   * @param todoTitle Title of the todo for AI analysis
   * @param flags Command flags including AI configuration options
   */
  private async enhanceWithAI(
    todo: Partial<Todo>,
    todoTitle: string,
    flags: Record<string, string | boolean | string[] | undefined>
  ): Promise<void> {
    let aiSpinner: ReturnType<typeof this.startSpinner> | undefined;
    const isBackground = process.env.WALTODO_BACKGROUND === 'true';

    try {
      this.debugLog('AI flag detected in add command');

      // Start AI spinner only if not in background mode
      if (!isBackground) {
        aiSpinner = this.startSpinner(`Using AI to enhance your todo...`);
      } else {
        this.debugLog('Running AI enhancement in background mode');
      }

      // Sanitize API key before using
      const sanitizedApiKey = flags.apiKey
        ? CommandSanitizer.sanitizeApiKey(flags.apiKey as string)
        : undefined;
      if (sanitizedApiKey) {
        process.env.XAI_API_KEY = sanitizedApiKey;
        await this.aiServiceInstance.setProvider(AIProvider.XAI);
      }
      this.debugLog('AiService configured successfully');

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
        storageLocation: todo.storageLocation || 'local',
      };

      // Get AI suggestions with retry for network errors
      const [suggestedTags, suggestedPriority] = await this.executeWithRetry(
        async (): Promise<[string[], 'high' | 'medium' | 'low']> => {
          if (isBackground) {
            console.log('Progress: 25%'); // Report progress for background job
          }
          const results = await Promise.all([
            this.aiServiceInstance.suggestTags(tempTodo),
            this.aiServiceInstance.suggestPriority(tempTodo),
          ]);
          if (isBackground) {
            console.log('Progress: 50%'); // Report progress for background job
          }
          return results;
        },
        {
          maxRetries: 3,
          baseDelay: 1000,
          retryMessage: isBackground ? undefined : 'Retrying AI enhancement...',
          operationName: 'ai_suggest',
        }
      );

      this.debugLog('Received AI suggestions:', {
        tags: suggestedTags,
        priority: suggestedPriority,
      });

      // Stop spinner with success only if not in background
      if (!isBackground && aiSpinner !== undefined) {
        this.stopSpinnerSuccess(aiSpinner, `AI enhancement complete`);
      }

      // Display enhanced information only if not in background
      if (!isBackground) {
        this.section(
          'AI Suggestions',
          [
            `${ICONS.tag} ${chalk.bold('Suggested Tags:')} ${chalk.cyan(suggestedTags.join(', ') || 'None')}`,
            `${ICONS.priority} ${chalk.bold('Suggested Priority:')} ${chalk.cyan(suggestedPriority)}`,
          ].join('\n')
        );
      } else {
        // Log for background job
        console.log(
          `AI suggestions: tags=[${suggestedTags.join(', ')}], priority=${suggestedPriority}`
        );
      }

      // Merge existing and suggested tags
      const existingTags = todo.tags || [];
      const uniqueTags = new Set([...existingTags, ...suggestedTags]);
      const allTags = Array.from(uniqueTags);

      // Update todo with AI suggestions
      todo.tags = allTags;
      todo.priority = suggestedPriority;

      this.debugLog('Todo updated with AI suggestions');

      if (isBackground) {
        console.log('Progress: 75%'); // Report progress for background job
      }
    } catch (aiError) {
      // Stop the AI spinner if it was started
      if (aiSpinner !== undefined) {
        this.stopSpinner(false, 'AI enhancement unavailable');
      }

      this.debugLog('AI error details:', aiError);

      // Handle different error types with specific messaging
      if (aiError instanceof NetworkError) {
        this.warning(
          'AI service is temporarily unavailable due to network issues'
        );
        this.info(
          'Check your network connection and try again later with the --ai flag'
        );
      } else if (aiError instanceof Error) {
        // Check for specific AI configuration issues
        if (
          aiError.message.includes('API key') ||
          aiError.message.includes('unauthorized') ||
          aiError.message.includes('authentication')
        ) {
          this.warning('AI service authentication failed');
          this.info('Please verify your XAI API key configuration:');
          this.info('• Set XAI_API_KEY environment variable, or');
          this.info('• Use --apiKey flag to provide your API key');
          this.info('• Get your API key from: https://console.x.ai/');
        } else if (
          aiError.message.includes('quota') ||
          aiError.message.includes('rate limit') ||
          aiError.message.includes('limit exceeded')
        ) {
          this.warning('AI service rate limit exceeded');
          this.info(
            'Your API quota has been reached. Please try again later or upgrade your plan'
          );
        } else if (
          aiError.message.includes('timeout') ||
          aiError.message.includes('request timed out')
        ) {
          this.warning('AI service request timed out');
          this.info(
            'The AI service is responding slowly. Try again with a simpler todo description'
          );
        } else {
          this.warning(`AI enhancement failed: ${aiError.message}`);
          this.info('AI configuration help:');
          this.info('• Verify your API key with: waltodo ai credentials');
          this.info('• Check service status: waltodo ai verify');
          this.info('• View AI configuration: waltodo config');
        }
      } else {
        this.warning('AI enhancement encountered an unexpected error');
        this.info('Please check your AI configuration with: waltodo ai verify');
      }

      // Always provide fallback guidance
      this.info('Todo created successfully using your provided values');
      if (!todo.tags || todo.tags.length === 0) {
        this.info('Tip: You can add tags manually with: --tags "work,urgent"');
      }
      if (!todo.priority) {
        this.info(
          'Tip: You can set priority manually with: --priority high|medium|low'
        );
      }
    }
  }

  /**
   * Store todo on blockchain using Walrus decentralized storage
   * This process involves several steps:
   * 1. Connect to blockchain storage
   * 2. Store todo on Walrus to get a blob ID
   * 3. Update local copy with blockchain reference (if using hybrid storage)
   * 4. Remove local copy if using blockchain-only storage
   * 5. Display blockchain storage information to the user
   *
   * @param todo The todo object to store
   * @param listName Name of the list containing the todo
   * @param storageLocation Storage strategy (local, blockchain, or both)
   */
  private async storeOnBlockchain(
    todo: Todo,
    listName: string,
    storageLocation: StorageLocation
  ): Promise<void> {
    let blobId: string = '';
    const isBackground = process.env.WALTODO_BACKGROUND === 'true';

    // Show blockchain storage warning only if not in background
    if (!isBackground) {
      this.section(
        'Blockchain Storage',
        [
          `${chalk.yellow(ICONS.warning)} ${chalk.yellow('Public Access Warning')}`,
          `Blockchain storage will make the todo data publicly accessible.`,
          `This cannot be undone once the data is stored on the blockchain.`,
        ].join('\n')
      );
    } else {
      console.log('Starting blockchain storage...');
    }

    // Start blockchain storage spinner only if not in background
    const blockchainSpinner = !isBackground
      ? this.startSpinner('Connecting to blockchain storage...')
      : undefined;

    try {
      // Initialize Walrus storage with retry
      await this.executeWithRetry(
        async () => {
          await this.walrusStorage.connect();
          if (!isBackground && blockchainSpinner !== undefined) {
            this.stopSpinnerSuccess(
              blockchainSpinner,
              'Connected to blockchain storage'
            );
          } else if (isBackground) {
            console.log('Connected to blockchain storage');
            console.log('Progress: 85%');
          }
        },
        {
          maxRetries: 5,
          baseDelay: 2000,
          retryMessage: isBackground
            ? undefined
            : 'Retrying blockchain connection...',
          operationName: 'walrus_connect',
        }
      );

      // Start storage spinner only if not in background
      const storeSpinner = !isBackground
        ? this.startSpinner('Storing todo on blockchain...')
        : undefined;

      // Store todo on Walrus with retry and transaction handling
      blobId = await this.executeTransaction(
        async () => {
          return await this.executeWithRetry(
            async () => {
              const result = await this.walrusStorage.storeTodo(todo);
              if (isBackground) {
                console.log('Progress: 95%');
              }
              return result;
            },
            {
              maxRetries: 5,
              baseDelay: 2000,
              retryMessage: isBackground
                ? undefined
                : 'Retrying blockchain storage...',
              operationName: 'walrus_store_todo',
            }
          );
        },
        {
          operation: 'store-todo',
          rollbackFn: async () => {
            // If storage fails, we might need to clean up any partial state
            this.debugLog('Rolling back blockchain storage attempt');
          },
        }
      );

      if (!isBackground && storeSpinner !== undefined) {
        this.stopSpinnerSuccess(storeSpinner, 'Todo stored on blockchain');
      } else if (isBackground) {
        console.log('Todo stored on blockchain');
        console.log('Progress: 100%');
      }

      // Update local todo with Walrus blob ID if we're keeping a local copy
      if (storageLocation === 'both') {
        const updateSpinner = !isBackground
          ? this.startSpinner(
              'Updating local copy with blockchain reference...'
            )
          : undefined;
        try {
          await this.todoService.updateTodo(listName, todo.id, {
            walrusBlobId: blobId,
            updatedAt: new Date().toISOString(),
          });
          if (!isBackground && updateSpinner !== undefined) {
            this.stopSpinnerSuccess(
              updateSpinner,
              'Local copy updated with blockchain reference'
            );
          } else if (isBackground) {
            console.log('Local copy updated with blockchain reference');
          }
        } catch (_error) {
          if (!isBackground) {
            this.warning(
              'Successfully stored on blockchain but failed to update local copy'
            );
          } else {
            console.log('Warning: Failed to update local copy');
          }
        }
      }

      // If storage is blockchain only, remove from local storage
      if (storageLocation === 'blockchain') {
        const cleanupSpinner = !isBackground
          ? this.startSpinner('Removing local copy...')
          : undefined;
        try {
          await this.todoService.deleteTodo(listName, todo.id);
          if (!isBackground && cleanupSpinner !== undefined) {
            this.stopSpinnerSuccess(cleanupSpinner, 'Local copy removed');
          } else if (isBackground) {
            console.log('Local copy removed');
          }
        } catch (_error) {
          if (!isBackground) {
            this.warning(
              'Failed to remove local copy after blockchain storage'
            );
          } else {
            console.log('Warning: Failed to remove local copy');
          }
        }
      }

      // Display blockchain information only if not in background
      if (!isBackground) {
        this.section(
          'Blockchain Storage Info',
          [
            `${ICONS.blockchain} ${chalk.bold('Blob ID:')} ${chalk.dim(blobId)}`,
            `${ICONS.info} ${chalk.bold('Public URL:')} ${chalk.cyan(`https://testnet.wal.app/blob/${blobId}`)}`,
          ].join('\n')
        );
      } else {
        console.log(`Stored on blockchain: ${blobId}`);
        console.log(`Public URL: https://testnet.wal.app/blob/${blobId}`);
      }

      // Save the blob mapping
      this.saveBlobMapping(todo.id, blobId);

      // Cleanup connection
      await this.walrusStorage.disconnect();
    } catch (error) {
      if (error instanceof CLIError) throw error;

      // If blockchain-only storage failed, keep it locally
      if (storageLocation === 'blockchain') {
        this.warning('Storage failed - keeping todo locally instead');
        todo.storageLocation = 'local';
      } else {
        throw new CLIError(
          `Failed to store todo on blockchain: ${error instanceof Error ? error.message : String(error)}`,
          'BLOCKCHAIN_STORE_FAILED'
        );
      }
    }
  }

  /**
   * Save a mapping between todo ID and blob ID
   * @param todoId Todo ID
   * @param blobId Blob ID
   */
  private saveBlobMapping(todoId: string, blobId: string): void {
    try {
      const configDir = this.getConfigDir();
      const blobMappingsFile = path.join(configDir, 'blob-mappings.json');

      // Read existing mappings or create empty object
      let mappings: Record<string, string> = {};
      if (fs.existsSync(blobMappingsFile)) {
        try {
          const content = fs.readFileSync(blobMappingsFile, 'utf8');
          try {
            mappings = JSON.parse(content.toString());
          } catch (parseError) {
            if (parseError instanceof SyntaxError) {
              this.warning(
                `Invalid JSON format in blob mappings file: ${parseError.message}`
              );
            } else {
              this.warning(
                `Error parsing blob mappings file: ${parseError instanceof Error ? parseError.message : String(parseError)}`
              );
            }
            // Continue with empty mappings
          }
        } catch (readError) {
          this.warning(
            `Error reading blob mappings file: ${readError instanceof Error ? readError.message : String(readError)}`
          );
          // Continue with empty mappings
        }
      }

      // Add or update mapping
      mappings[todoId] = blobId;

      // Write mappings back to file using centralized method (handles directory creation)
      this.writeFileSafe(
        blobMappingsFile,
        JSON.stringify(mappings, null, 2),
        'utf8'
      );
      this.debugLog(`Saved blob mapping: ${todoId} -> ${blobId}`);
    } catch (saveError) {
      this.warning(
        `Failed to save blob mapping: ${saveError instanceof Error ? saveError.message : String(saveError)}`
      );
    }
  }

  /**
   * Display success information after adding a todo
   */
  private async displaySuccessInfo(
    todo: Todo,
    listName: string
  ): Promise<void> {
    const isBackground = process.env.WALTODO_BACKGROUND === 'true';

    // Choose appropriate header based on whether this is a new list or just a new task
    const headerText = this.isNewList ? `New List Created` : `New Task Added`;

    if (!isBackground) {
      // Create a more compact display format
      this.log(
        `${chalk.green(ICONS.success)} ${chalk.bold.green(headerText)}: ${chalk.bold(todo.title)}`
      );

      // Display essential details in a compact single-line format
      const compactDetails = [
        `${ICONS.list} List: ${chalk.cyan(listName)}`,
        `${ICONS.priority} Priority: ${this.formatPriority(todo.priority)}`,
        todo.dueDate && `${ICONS.date} Due: ${chalk.blue(todo.dueDate)}`,
        todo.tags &&
          todo.tags.length > 0 &&
          `${ICONS.tag} Tags: ${chalk.cyan(todo.tags.join(', '))}`,
        `${ICONS.storage} Storage: ${this.formatStorage(todo.storageLocation || 'local')}`,
      ].filter(Boolean);

      // Display compact details on a single line
      this.log(`  ${compactDetails.join(' | ')}`);

      // Provide helpful next steps
      const nextSteps = [
        `${chalk.cyan(`${this.config.bin} list ${listName}`)} - View all tasks`,
        `${chalk.cyan(`${this.config.bin} complete --id ${todo.id.slice(-6)}`)} - Mark as completed`,
      ];

      // Display next steps on same line
      this.log(`  ${chalk.bold('Next:')} ${nextSteps.join(' | ')}`);
      this.log(''); // Add an empty line for spacing
    } else {
      // Simple log for background mode
      console.log(`${headerText}: ${todo.title}`);
      console.log(`Added to list: ${listName}`);
      console.log(`Priority: ${todo.priority}`);
      if (todo.tags && todo.tags.length > 0) {
        console.log(`Tags: ${todo.tags.join(', ')}`);
      }
      if (todo.dueDate) {
        console.log(`Due: ${todo.dueDate}`);
      }
      console.log(`Storage: ${todo.storageLocation || 'local'}`);
    }
  }

  /**
   * Parse input arguments and flags to determine list name and todo titles
   * Supports multiple input patterns while maintaining backward compatibility
   * @param args Command arguments
   * @param flags Command flags
   * @returns Object containing listName and todoTitles
   */
  private parseInputArguments(
    args: { titleOrList?: string; title?: string },
    flags: Record<string, string | boolean | string[] | undefined>
  ): { listName: string; todoTitles: string[] } {
    let listName: string;
    let todoTitles: string[] = [];

    /**
     * Input parsing logic:
     * 1. Positional syntax: `add <list> <title>` or `add <title>`
     * 2. Legacy flag syntax: `add -t <title> -l <list>`
     * 3. Mixed syntax: `add <list> -t <title>`
     */

    // Pattern 1: Two positional arguments (list and title)
    if (args.titleOrList && args.title) {
      listName = CommandSanitizer.sanitizeString(args.titleOrList);
      todoTitles = [CommandSanitizer.sanitizeString(args.title)];
    }
    // Pattern 2: One positional argument - determine if it's a list name or title
    else if (args.titleOrList && !args.title) {
      const firstArg = args.titleOrList;

      // If we have task flags, treat the first argument as a list name
      if (
        flags.task &&
        (Array.isArray(flags.task) ? flags.task : [flags.task]).length > 0
      ) {
        listName = CommandSanitizer.sanitizeString(firstArg);
        const tasks = Array.isArray(flags.task) ? flags.task : [flags.task];
        todoTitles = tasks
          .filter((t): t is string => typeof t === 'string')
          .map((t: string) => CommandSanitizer.sanitizeString(t));
      }
      // Otherwise, treat as title with explicit list flag or default list
      else {
        listName = flags.list
          ? CommandSanitizer.sanitizeString(flags.list as string)
          : 'default';
        todoTitles = [CommandSanitizer.sanitizeString(firstArg)];
      }
    }
    // Pattern 3: No positional args - use task flags
    else if (
      flags.task &&
      (Array.isArray(flags.task) ? flags.task : [flags.task]).length > 0
    ) {
      listName = flags.list
        ? CommandSanitizer.sanitizeString(flags.list as string)
        : 'default';
      const tasks = Array.isArray(flags.task) ? flags.task : [flags.task];
      todoTitles = tasks
        .filter((t): t is string => typeof t === 'string')
        .map((t: string) => CommandSanitizer.sanitizeString(t));
    }
    // Pattern 4: No title provided anywhere
    else {
      this.showHelpfulErrorMessage();
      // This will never be reached due to the error above, but TypeScript needs it
      return { listName: 'default', todoTitles: [] };
    }

    return { listName, todoTitles };
  }

  /**
   * Show a helpful error message with examples and available lists
   */
  private showHelpfulErrorMessage(): never {
    const availableLists = this.todoService.getAllListsSync();

    let errorMessage = 'Todo title is required. Use one of these formats:\n\n';
    errorMessage += '📝 Positional syntax (recommended):\n';
    errorMessage += `  ${this.config.bin} add "Buy groceries"              # Add to default list\n`;
    errorMessage += `  ${this.config.bin} add mylist "Buy groceries"      # Add to specific list\n`;
    errorMessage += `  ${this.config.bin} add "Meeting at 3pm" -p high    # Add with priority\n\n`;
    errorMessage += '🏷️  Legacy flag syntax (still supported):\n';
    errorMessage += `  ${this.config.bin} add -t "Buy groceries"           # Add to default list\n`;
    errorMessage += `  ${this.config.bin} add -t "Buy groceries" -l mylist # Add to specific list\n`;

    if (availableLists.length > 0) {
      errorMessage += `\n📋 Available lists: ${chalk.cyan(availableLists.join(', '))}`;
    } else {
      errorMessage += `\n💡 No lists exist yet - a ${chalk.cyan('default')} list will be created`;
    }

    this.errorWithHelp('Missing title', 'Todo title is required', errorMessage);
  }

  /**
   * Display available lists when showing error messages
   */
  private async displayAvailableListsForError(): Promise<void> {
    try {
      const availableLists = await this.todoService.getAllLists();
      if (availableLists.length > 0) {
        this.info(`Available lists: ${availableLists.join(', ')}`);
      } else {
        this.info('No lists exist yet - a "default" list will be created');
      }
    } catch (error) {
      // Silently ignore errors when fetching lists for error display
      this.debugLog(`Error fetching lists for error display: ${error}`);
    }
  }

  /**
   * Perform enhanced pre-execution validation
   * @param args Command arguments
   * @param flags Command flags
   * @throws ValidationError if validation fails
   */
  private performPreExecutionValidation(
    args: { titleOrList?: string; title?: string },
    flags: Record<string, string | boolean | string[] | undefined>
  ): void {
    // Validate that we have either positional args or task flags, but not conflicting combinations
    if (args.titleOrList && args.title && flags.task) {
      throw new ValidationError(
        'Cannot use both positional arguments and --task flag simultaneously',
        {
          constraint: 'CONFLICTING_INPUT',
          recoverable: false,
        } as ValidationErrorOptions
      );
    }

    // Validate task titles using unified validators
    if (flags.task) {
      const tasks = Array.isArray(flags.task) ? flags.task : [flags.task];
      tasks
        .filter((task): task is string => typeof task === 'string')
        .forEach((task: string) => {
          this.validateFlag.nonEmpty(task, 'Task title');
        });
    }

    // Validate priority using unified validators
    if (flags.priority) {
      const priorities = Array.isArray(flags.priority)
        ? flags.priority
        : [flags.priority as string];
      priorities.forEach((priority: string) => {
        this.validateFlag.enum(priority, ['high', 'medium', 'low'], 'priority');
      });
    }

    // Validate AI provider using unified validators
    if (flags.provider) {
      this.validateFlag.enum(
        flags.provider as string,
        ['xai', 'openai', 'anthropic', 'ollama'],
        'provider'
      );
    }

    // Validate list name if provided
    if (flags.list) {
      this.validateFlag.nonEmpty(flags.list as string, 'list');
    }

    // Validate list name
    if (flags.list) {
      const listName: string = String(flags.list || 'default');
      const rules = [
        InputValidator.requiredRule('List name'),
        InputValidator.custom(
          (value: string) => /^[a-zA-Z0-9-_]+$/.test(value),
          'List name can only contain letters, numbers, hyphens, and underscores',
          'INVALID_LIST_NAME'
        ),
      ];
      InputValidator.validate(listName, rules, 'List name');
    }

    // Validate priority values
    if (flags.priority) {
      const priorities = Array.isArray(flags.priority)
        ? flags.priority
        : [flags.priority as string];
      priorities.forEach((priority: string, index: number) => {
        InputValidator.validate(
          priority,
          [CommonValidationRules.priority],
          `Priority ${index + 1}`
        );
      });
    }

    // Validate due dates
    if (flags.due) {
      const dueDates = Array.isArray(flags.due)
        ? flags.due
        : [flags.due as string];
      dueDates.forEach((dueDate: string, index: number) => {
        InputValidator.validate(
          dueDate,
          [CommonValidationRules.dateFormat],
          `Due date ${index + 1}`
        );
      });
    }

    // Validate tags
    if (flags.tags) {
      const tagSets = Array.isArray(flags.tags)
        ? flags.tags
        : [flags.tags as string];
      tagSets.forEach((tagSet: string, index: number) => {
        InputValidator.validate(
          tagSet,
          [
            {
              test: (value: string) =>
                value.split(',').every(tag => tag.trim().length > 0),
              message: 'Tags cannot be empty',
              code: 'EMPTY_TAG',
            },
            {
              test: (value: string) =>
                value.split(',').every(tag => tag.length <= 50),
              message: 'Tag too long (max 50 characters)',
              code: 'TAG_TOO_LONG',
            },
          ],
          `Tag set ${index + 1}`
        );
      });
    }

    // Validate storage location
    if (flags.storage) {
      const storageLocation: string = String(flags.storage || 'local');
      const rules = [CommonValidationRules.storageLocation];
      InputValidator.validate(storageLocation, rules, 'Storage location');
    }
  }

  /**
   * Run the add command in background without blocking the terminal
   */
  private async runInBackground(
    args: { titleOrList?: string; title?: string },
    flags: Record<string, string | boolean | string[] | undefined>
  ): Promise<void> {
    const { listName, todoTitles } = this.parseInputArguments(args, flags);

    // Create background job
    const commandArgs = [];
    if (args.titleOrList) commandArgs.push(args.titleOrList);
    if (args.title) commandArgs.push(args.title);

    const jobFlags = { ...flags };
    delete jobFlags.background; // Remove background flag to prevent recursion
    delete jobFlags.watch; // Remove watch flag

    const job = jobManager.createJob('add', commandArgs, jobFlags);

    this.log(chalk.green(`🚀 Background job started: ${chalk.bold(job.id)}`));
    this.log(chalk.gray(`   Command: add ${commandArgs.join(' ')}`));
    this.log(chalk.gray(`   Todos: ${todoTitles.length} item(s)`));
    this.log(chalk.gray(`   List: ${listName}`));
    this.log('');

    // Start the background process
    this.startBackgroundProcess(job, args, flags);

    if (flags.watch) {
      // Watch progress if requested
      this.log(
        chalk.blue('📊 Watching progress... (Press Ctrl+C to stop watching)')
      );
      this.log('');
      await this.watchBackgroundJob(job.id);
    } else {
      // Show how to track progress
      this.log(chalk.cyan('💡 Track progress with:'));
      this.log(chalk.gray(`   ${this.config.bin} status ${job.id}`));
      this.log(chalk.gray(`   ${this.config.bin} jobs --active`));
      this.log('');

      // Show brief status
      setTimeout(async () => {
        const currentJob = jobManager.getJob(job.id);
        if (currentJob && currentJob.status === 'running') {
          this.log(chalk.green(`✓ Job ${job.id} is running in background`));
        }
      }, 1000);
    }
  }

  /**
   * Start background process for add command
   */
  private startBackgroundProcess(
    job: BackgroundJob,
    args: { titleOrList?: string; title?: string },
    flags: Record<string, string | boolean | string[] | undefined>
  ): void {
    const { listName, todoTitles } = this.parseInputArguments(args, flags);

    // For complex operations with AI or blockchain, use internal processing
    if (
      flags.ai ||
      flags.storage === 'blockchain' ||
      flags.storage === 'both'
    ) {
      this.startAdvancedBackgroundProcess(job, args, flags);
      return;
    }

    // Build command arguments for spawning
    const spawnArgs = ['run', 'add'];

    if (args.titleOrList) spawnArgs.push(args.titleOrList);
    if (args.title) spawnArgs.push(args.title);

    // Add flags
    Object.entries(flags).forEach(([key, value]) => {
      if (key === 'background' || key === 'watch') return; // Skip these flags

      if (typeof value === 'boolean' && value) {
        spawnArgs.push(`--${key}`);
      } else if (typeof value === 'string') {
        spawnArgs.push(`--${key}`, value);
      } else if (Array.isArray(value)) {
        value.forEach(v => {
          spawnArgs.push(`--${key}`, v);
        });
      }
    });

    const childProcess = spawn('node', spawnArgs, {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, WALTODO_BACKGROUND: 'true' },
    });

    // Update job with PID
    jobManager.startJob(job.id, childProcess.pid);
    jobManager.updateProgress(job.id, 0, 0, todoTitles.length);

    // Handle process events
    let output = '';
    let errorOutput = '';

    childProcess.stdout?.on('data', data => {
      output += data.toString();
      jobManager.writeJobLog(job.id, `STDOUT: ${data.toString()}`);

      // Parse progress if available
      const progressMatch = data.toString().match(/Progress: (\d+)%/);
      if (progressMatch) {
        const progress = parseInt(progressMatch[1]);
        jobManager.updateProgress(job.id, progress);
      }
    });

    childProcess.stderr?.on('data', data => {
      errorOutput += data.toString();
      jobManager.writeJobLog(job.id, `STDERR: ${data.toString()}`);
    });

    childProcess.on('close', code => {
      if (code === 0) {
        jobManager.completeJob(job.id, {
          output,
          todosAdded: todoTitles.length,
          listName,
        });
      } else {
        jobManager.failJob(job.id, `Process exited with code ${code}`);
      }
    });

    childProcess.on('error', error => {
      jobManager.failJob(job.id, error.message);
    });

    // Detach the child process so it can run independently
    childProcess.unref();
  }

  /**
   * Advanced background processing for AI and blockchain operations
   */
  private async startAdvancedBackgroundProcess(
    job: BackgroundJob,
    args: { titleOrList?: string; title?: string },
    flags: Record<string, string | boolean | string[] | undefined>
  ): Promise<void> {
    jobManager.startJob(job.id);

    try {
      // Initialize background operations if needed
      if (!this.backgroundOps) {
        this.backgroundOps = await createBackgroundOperationsManager();
      }

      const { listName, todoTitles } = this.parseInputArguments(args, flags);
      jobManager.updateProgress(job.id, 5, 0, todoTitles.length);

      // Create todos data for background processing
      const todosToProcess = todoTitles.map((title, index) => {
        const priorities = Array.isArray(flags.priority)
          ? flags.priority
          : flags.priority
            ? [flags.priority]
            : ['medium'];
        const dueDates = Array.isArray(flags.due)
          ? flags.due
          : flags.due
            ? [flags.due]
            : [];
        const tagSets = Array.isArray(flags.tags)
          ? flags.tags
          : flags.tags
            ? [flags.tags]
            : [];

        return {
          title,
          priority: (typeof priorities[index] === 'string'
            ? priorities[index]
            : typeof priorities[priorities.length - 1] === 'string'
              ? priorities[priorities.length - 1]
              : 'medium') as 'high' | 'medium' | 'low',
          dueDate:
            dueDates[index] && typeof dueDates[index] === 'string'
              ? CommandSanitizer.sanitizeDate(dueDates[index] as string)
              : undefined,
          tags:
            tagSets[index] && typeof tagSets[index] === 'string'
              ? CommandSanitizer.sanitizeTags(tagSets[index] as string)
              : [],
          private: flags.private as boolean,
          storageLocation: (flags.storage as StorageLocation) || 'local',
          useAI: flags.ai as boolean,
        };
      });

      jobManager.updateProgress(job.id, 10, 0, todoTitles.length);

      // Process todos in the background using BackgroundOperations
      const operationId = await this.backgroundOps.processBatchInBackground(
        todosToProcess.map(todo => ({
          type: 'add-todo',
          listName,
          todo,
          metadata: { jobId: job.id },
        })),
        'normal'
      );

      // Monitor the background operation and update job progress
      const monitorInterval = setInterval(async () => {
        try {
          const status =
            await this.backgroundOps!.getOperationStatus(operationId);
          if (status) {
            const progress = Math.min(95, 10 + (status.progress || 0) * 0.85);
            jobManager.updateProgress(job.id, progress);

            if (status.status === 'completed') {
              clearInterval(monitorInterval);
              const result =
                await this.backgroundOps!.getOperationResult(operationId);
              jobManager.completeJob(job.id, {
                todosAdded: todoTitles.length,
                listName,
                operationId,
                result,
              });
            } else if (status.status === 'failed') {
              clearInterval(monitorInterval);
              jobManager.failJob(
                job.id,
                status.error || 'Background operation failed'
              );
            }
          }
        } catch (error) {
          clearInterval(monitorInterval);
          jobManager.failJob(
            job.id,
            `Monitoring error: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }, 2000);

      // Set a timeout to prevent infinite monitoring
      setTimeout(() => {
        clearInterval(monitorInterval);
        const currentJob = jobManager.getJob(job.id);
        if (
          currentJob &&
          (currentJob.status === 'pending' || currentJob.status === 'running')
        ) {
          jobManager.failJob(job.id, 'Operation timeout');
        }
      }, 600000); // 10 minutes timeout
    } catch (error) {
      jobManager.failJob(
        job.id,
        `Failed to start background operation: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Watch background job progress with live updates
   */
  private async watchBackgroundJob(jobId: string): Promise<void> {
    return new Promise(resolve => {
      const updateInterval = setInterval(() => {
        const job = jobManager.getJob(jobId);
        if (!job) {
          clearInterval(updateInterval);
          this.log(chalk.red('❌ Job not found'));
          resolve();
          return;
        }

        // Clear previous line and show current status
        process.stdout.write('\r\x1b[K'); // Clear line

        const statusIcon = this.getJobStatusIcon(job.status);
        const progressBar = this.createProgressBarVisual(job.progress);
        const duration = Date.now() - job.startTime;
        const durationStr = this.formatAddCommandDuration(duration);

        process.stdout.write(
          `${statusIcon} ${progressBar} ${chalk.yellow(job.progress + '%')} | ` +
            `${chalk.gray(durationStr)} | ` +
            `${job.processedItems || 0}/${job.totalItems || 0} items`
        );

        if (job.status === 'completed') {
          process.stdout.write('\n');
          this.log(chalk.green(`\n✅ Background job completed successfully!`));
          this.log(chalk.gray(`   Duration: ${durationStr}`));
          if (job.metadata?.todosAdded) {
            this.log(
              chalk.gray(
                `   Added ${job.metadata.todosAdded} todo(s) to list '${job.metadata.listName}'`
              )
            );
          }
          clearInterval(updateInterval);
          resolve();
        } else if (job.status === 'failed') {
          process.stdout.write('\n');
          this.log(
            chalk.red(`\n❌ Background job failed: ${job.errorMessage}`)
          );
          clearInterval(updateInterval);
          resolve();
        } else if (job.status === 'cancelled') {
          process.stdout.write('\n');
          this.log(chalk.yellow('\n⚪ Background job was cancelled'));
          clearInterval(updateInterval);
          resolve();
        }
      }, 1000);

      // Handle Ctrl+C to stop watching
      const handleExit = () => {
        clearInterval(updateInterval);
        process.stdout.write('\n');
        this.log(
          chalk.yellow('\n👋 Stopped watching. Job continues in background.')
        );
        this.log(
          chalk.gray(`   Check status with: ${this.config.bin} status ${jobId}`)
        );
        resolve();
      };

      process.once('SIGINT', handleExit);
    });
  }

  /**
   * Get status icon for job status
   */
  private getJobStatusIcon(status: string): string {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'running':
        return '🔄';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      case 'cancelled':
        return '⚪';
      default:
        return '❓';
    }
  }

  /**
   * Create a progress bar visualization
   */
  private createProgressBarVisual(
    progress: number,
    width: number = 20
  ): string {
    const filled = Math.floor((progress / 100) * width);
    const empty = width - filled;
    return (
      chalk.green('[') +
      chalk.green('█'.repeat(filled)) +
      chalk.gray('░'.repeat(empty)) +
      chalk.green(']')
    );
  }

  /**
   * Format duration in human readable format
   */
  private formatAddCommandDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000)
      return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  }

  /**
   * Format priority with appropriate color
   */
  private formatPriority(priority: string): string {
    switch (priority) {
      case 'high':
        return chalk.red('HIGH');
      case 'medium':
        return chalk.yellow('MEDIUM');
      case 'low':
        return chalk.green('LOW');
      default:
        return chalk.gray(priority.toUpperCase());
    }
  }

  /**
   * Clean flags to remove help property for compatibility
   */
  private cleanFlags(
    flags: any
  ): Record<string, string | boolean | string[] | undefined> {
    const { help, ...cleanedFlags } = flags;
    return cleanedFlags;
  }
}

// Export both named and default for compatibility
export { AddCommand };
export default AddCommand;
