import { Args, Flags } from '@oclif/core';
import chalk from 'chalk';
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
import { addCommandValidation, validateAIApiKey, validateBlockchainConfig } from '../utils/CommandValidationMiddleware';
import { NetworkError, ValidationError } from '../types/errors/consolidated';
import * as fs from 'fs';
import * as path from 'path';

/**
 * @class AddCommand
 * @description This command allows users to add new todo items to a specified list.
 * It supports various options such as setting priority, due date, tags, and storage location.
 * If the specified list does not exist, it will be created automatically.
 * AI features can suggest appropriate tags and priority levels based on todo content.
 */
export default class AddCommand extends BaseCommand {
  static description = 'Add one or more todo items to a specified list';

  static examples = [
    `<%= config.bin %> add "Buy groceries"                                # Add a single todo to the default list`,
    `<%= config.bin %> add "Important task" -p high                       # Add with high priority`,
    `<%= config.bin %> add "Meeting" --due 2024-05-01                     # Add with due date`,
    `<%= config.bin %> add my-list -t "Buy groceries"                     # Add to a specific list`,
    `<%= config.bin %> add -t "Task 1" -t "Task 2"                        # Add multiple todos`,
    `<%= config.bin %> add -t "High priority" -p high -t "Low" -p low     # Add multiple todos with different priorities`,
    `<%= config.bin %> add -t "Due soon" -d 2023-05-15 -t "Later" -d 2023-06-15  # Add with different due dates`,
    `<%= config.bin %> add -t "Work" -g "job,urgent" -t "Home" -g "personal"     # Add with different tags`,
    `<%= config.bin %> add "Plan project" --ai                            # Use AI to suggest tags/priority`,
    `<%= config.bin %> add -t "Task 1" -t "Task 2" -p high                # Multiple todos with same priority`
  ];

  static flags = {
    ...BaseCommand.flags,
    task: Flags.string({
      char: 't',
      description: 'Task description (can be used multiple times)',
      required: false,
      multiple: true
    }),
    priority: Flags.string({
      char: 'p',
      description: 'Task priority (high, medium, low) - can be specified multiple times for multiple todos',
      options: ['high', 'medium', 'low'],
      multiple: true
    }),
    due: Flags.string({
      char: 'd',
      description: 'Due date (YYYY-MM-DD) - can be specified multiple times for multiple todos',
      multiple: true
    }),
    tags: Flags.string({
      char: 'g',
      description: 'Comma-separated tags (e.g., "work,urgent") - can be specified multiple times for multiple todos',
      multiple: true
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
      description: 'Storage location (local, blockchain, both)',
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
    listOrTitle: Args.string({
      name: 'listOrTitle',
      description: 'List name or todo title (if list flag is provided, this is treated as the title)',
      required: false
    })
  };

  // Register the validation middleware
  static hooks = {
    prerun: [addCommandValidation],
  } as const;

  private todoService = new TodoService();
  private walrusStorage = createWalrusStorage('testnet', false); // Use real Walrus storage
  private aiServiceInstance = aiService;
  /**
   * Tracks whether the command is creating a new list or adding to an existing one.
   * Used to provide appropriate success messaging to the user.
   */
  private isNewList = false;

  async run(): Promise<void> {
    try {
      this.debugLog("Running add command...");
      this.startUnifiedSpinner('Processing add command...');

      // Parse and validate input
      const { args, flags } = await this.parse(AddCommand);
      
      // Enhanced input validation using unified validators
      this.performPreExecutionValidation(args, flags);
      
      this.debugLog("Parsed and validated arguments:", JSON.stringify(args));
      this.debugLog("Parsed and validated flags:", JSON.stringify(flags));

      // If JSON output is requested, handle it separately
      if (this.isJson) {
        return this.handleJsonOutput(args, flags);
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
      let listName: string;
      let todoTitles: string[] = [];

      /**
       * Logic to determine list name and todo titles based on argument patterns:
       * 1. If there's an argument + task flags: argument is list name, tasks from flags
       * 2. If there's an argument but no task flags:
       *    a. With explicit list flag: argument is title, list from flag
       *    b. Without list flag: argument is title, list is default
       * 3. If only task flags: use list flag or default, tasks from flags
       * 4. No title provided: error
       */

      // Pattern 1: argument + task flags = argument is list name
      if (args.listOrTitle && flags.task && (flags.task as string[]).length > 0) {
        // First argument is treated as the list name when tasks are provided with -t
        listName = CommandSanitizer.sanitizeString(args.listOrTitle);
        todoTitles = (flags.task as string[]).map(t => CommandSanitizer.sanitizeString(t));
      }
      // Pattern 2: argument but no task flags
      else if (args.listOrTitle && (!flags.task || (flags.task as string[]).length === 0)) {
        // Pattern 2a: With explicit list flag - argument is title
        if (flags.list) {
          listName = CommandSanitizer.sanitizeString(flags.list as string);
          todoTitles = [CommandSanitizer.sanitizeString(args.listOrTitle)];
        }
        // Pattern 2b: No list flag - argument is title, list is default
        else {
          listName = 'default';
          todoTitles = [CommandSanitizer.sanitizeString(args.listOrTitle)];
        }
      }
      // Pattern 3: Only task flags, no argument
      else if (flags.task && (flags.task as string[]).length > 0) {
        // Use the list flag if provided, otherwise default
        listName = CommandSanitizer.sanitizeString((flags.list as string) || 'default');
        todoTitles = (flags.task as string[]).map(t => CommandSanitizer.sanitizeString(t));
      }
      // Pattern 4: No title provided in any form
      else {
        this.errorWithHelp(
          'Missing title',
          'Todo title is required',
          'Provide a title as an argument or with the -t flag:\n' +
          `${this.config.bin} add "Buy groceries"\n` +
          `${this.config.bin} add -t "Buy groceries"\n` +
          `${this.config.bin} add "list-name" -t "Buy groceries"`
        );
      }

      // Validate title lengths
      for (const title of todoTitles) {
        InputValidator.validate(title, [
          {
            test: (value) => value.length <= 100,
            message: 'Todo title must be 100 characters or less',
            code: 'TITLE_TOO_LONG'
          }
        ]);
      }

      // Extract attribute arrays for the todos
      const storageLocation = flags.storage as StorageLocation;
      const priorities = flags.priority || ['medium']; // Default to medium priority if not specified
      const dueDates = flags.due || [];
      const tagSets = flags.tags || [];

      // Create warning messages for attribute mismatches
      if (todoTitles.length > 1) {
        // Warn if there's a mismatch between number of titles and other attributes
        if (priorities.length > 1 && priorities.length < todoTitles.length) {
          this.warning(`You provided ${todoTitles.length} todos but only ${priorities.length} priorities. The last priority will be used for the remaining todos.`);
        }

        if (dueDates.length > 1 && dueDates.length < todoTitles.length) {
          this.warning(`You provided ${todoTitles.length} todos but only ${dueDates.length} due dates. The remaining todos will have no due date.`);
        }

        if (tagSets.length > 1 && tagSets.length < todoTitles.length) {
          this.warning(`You provided ${todoTitles.length} todos but only ${tagSets.length} tag sets. The remaining todos will have no tags.`);
        }
      }

      // Create spinner for list creation/check
      const listSpinner = this.startSpinner(`Processing todo${todoTitles.length > 1 ? 's' : ''} for list "${listName}"...`);

      // Check if list exists first
      const listExists = await this.todoService.getList(listName);

      // If list doesn't exist, create it and set the flag
      if (!listExists) {
        await this.todoService.createList(listName, 'default-owner');
        this.isNewList = true; // Set flag for new list creation
        this.stopSpinnerSuccess(listSpinner, `Created new list: ${chalk.cyan(listName)}`);
      } else {
        this.isNewList = false; // Reset flag for existing list
        this.stopSpinnerSuccess(listSpinner, `Found list: ${chalk.cyan(listName)}`);
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
        const priority = priorities[i] !== undefined ? priorities[i] : priorities[priorities.length - 1];
        const dueDate = dueDates[i] !== undefined ? CommandSanitizer.sanitizeDate(dueDates[i]) : undefined;
        const tags = tagSets[i] !== undefined ? CommandSanitizer.sanitizeTags(tagSets[i]) : [];

        // Initialize todo object with sanitized inputs
        const todo: Partial<Todo> = {
          title: todoTitle,
          priority: priority as 'high' | 'medium' | 'low',
          dueDate: dueDate,
          tags: tags,
          private: flags.private as boolean,
          storageLocation: storageLocation
        };

        // Use AI if requested
        if (flags.ai) {
          await this.enhanceWithAI(todo, todoTitle, flags);
        }

        // Add todo to the list
        this.debugLog('Adding todo to list:', { listName, todo });
        const addedTodo = await this.todoService.addTodo(listName, todo as Todo);
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
          'Provide a title as an argument or with the -t flag:\n' +
          `${this.config.bin} add "Buy groceries"\n` +
          `${this.config.bin} add -t "Buy groceries"`
        );
      }

      if (error instanceof CLIError && error.code === 'BLOCKCHAIN_CONNECTION_FAILED') {
        this.detailedError(
          'Blockchain connection failed',
          'Failed to connect to the blockchain storage service',
          [
            'Verify your network connection is working properly',
            'Check if the blockchain service is available',
            'Verify your environment configuration with `waltodo config`',
            'Try using local storage instead with `-s local` flag'
          ]
        );
      }

      // Handle multi-flag specific errors
      if (error instanceof Error && error.message && error.message.includes('Flag --priority can only be specified once')) {
        this.errorWithHelp(
          'Flag usage error',
          'This version of the CLI now supports multiple flag instances',
          'You can now use multiple instances of -t, -p, -d, and -g flags to create multiple todos:\n' +
          `${this.config.bin} add -t "Task 1" -p high -t "Task 2" -p low\n` +
          `This will create two todos with different priorities.`
        );
      }

      if (error instanceof Error && error.message && error.message.includes('Flag --due can only be specified once')) {
        this.errorWithHelp(
          'Flag usage error',
          'This version of the CLI now supports multiple flag instances',
          'You can now use multiple instances of -t, -p, -d, and -g flags to create multiple todos:\n' +
          `${this.config.bin} add -t "Task 1" -d 2023-01-01 -t "Task 2" -d 2023-02-01\n` +
          `This will create two todos with different due dates.`
        );
      }

      if (error instanceof Error && error.message && error.message.includes('Flag --tags can only be specified once')) {
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
  private async handleJsonOutput(args: { listOrTitle?: string }, flags: Record<string, unknown>): Promise<void> {
    // Determine the list name and titles based on arguments and flags
    let todoTitles: string[] = [];
    let listName: string;

    // Check if there's an argument and task flags
    if (args.listOrTitle && flags.task && (flags.task as string[]).length > 0) {
      // First argument is the list name
      listName = CommandSanitizer.sanitizeString(args.listOrTitle);
      todoTitles = (flags.task as string[]).map((t: string) => CommandSanitizer.sanitizeString(t));
    }
    // Check if there's an argument but no task flags
    else if (args.listOrTitle && (!flags.task || (flags.task as string[]).length === 0)) {
      if (flags.list) {
        // Explicit list flag, argument is title
        listName = CommandSanitizer.sanitizeString(flags.list as string);
        todoTitles = [CommandSanitizer.sanitizeString(args.listOrTitle)];
      } else {
        // No list flag, argument is title
        listName = 'default';
        todoTitles = [CommandSanitizer.sanitizeString(args.listOrTitle)];
      }
    }
    // Only task flags
    else if (flags.task && (flags.task as string[]).length > 0) {
      listName = CommandSanitizer.sanitizeString((flags.list as string) || 'default');
      todoTitles = (flags.task as string[]).map((t: string) => CommandSanitizer.sanitizeString(t));
    }
    // Nothing provided
    else {
      throw new CLIError('Todo title is required. Provide it as an argument or with -t flag', 'MISSING_TITLE');
    }

    // Get attribute arrays
    const priorities = (flags.priority as string[]) || ['medium'];
    const dueDates = (flags.due as string[]) || [];
    const tagSets = (flags.tags as string[]) || [];
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
      const priority = priorities[i] !== undefined ? priorities[i] : priorities[priorities.length - 1];
      const dueDate = dueDates[i] !== undefined ? CommandSanitizer.sanitizeDate(dueDates[i] as string) : undefined;
      const tags = tagSets[i] !== undefined ? CommandSanitizer.sanitizeTags(tagSets[i] as string) : [];

      // Prepare the todo object
      const todo: Partial<Todo> = {
        title: todoTitle,
        priority: priority as 'high' | 'medium' | 'low',
        dueDate: dueDate,
        tags: tags,
        private: flags.private as boolean,
        storageLocation: storageLocation
      };

      // Add todo to the list
      const addedTodo = await this.todoService.addTodo(listName, todo as Todo);
      addedTodos.push(addedTodo);
    }

    // Output as JSON
    await this.jsonOutput({
      success: true,
      message: todoTitles.length === 1 ? 'Todo added successfully' : `${todoTitles.length} todos added successfully`,
      todos: addedTodos,
      list: listName,
      count: addedTodos.length
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
  private async enhanceWithAI(todo: Partial<Todo>, todoTitle: string, flags: Record<string, unknown>): Promise<void> {
    let aiSpinner: unknown;
    
    try {
      this.debugLog('AI flag detected in add command');

      // Start AI spinner
      aiSpinner = this.startSpinner(`Using AI to enhance your todo...`);

      // Sanitize API key before using
      const sanitizedApiKey = flags.apiKey ? CommandSanitizer.sanitizeApiKey(flags.apiKey as string) : undefined;
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
        storageLocation: todo.storageLocation || 'local'
      };

      // Get AI suggestions with retry for network errors
      const [suggestedTags, suggestedPriority] = await this.executeWithRetry(
        async () => Promise.all([
          this.aiServiceInstance.suggestTags(tempTodo),
          this.aiServiceInstance.suggestPriority(tempTodo)
        ]),
        {
          maxRetries: 3,
          baseDelay: 1000,
          retryMessage: 'Retrying AI enhancement...',
          operationName: 'ai_suggest'
        }
      );

      this.debugLog('Received AI suggestions:', { tags: suggestedTags, priority: suggestedPriority });

      // Stop spinner with success
      this.stopSpinnerSuccess(aiSpinner, `AI enhancement complete`);

      // Display enhanced information
      this.section('AI Suggestions', [
        `${ICONS.tag} ${chalk.bold('Suggested Tags:')} ${chalk.cyan(suggestedTags.join(', ') || 'None')}`,
        `${ICONS.priority} ${chalk.bold('Suggested Priority:')} ${chalk.cyan(suggestedPriority)}`
      ].join('\n'));

      // Merge existing and suggested tags
      const existingTags = todo.tags || [];
      const allTags = [...new Set([...existingTags, ...suggestedTags])];

      // Update todo with AI suggestions
      todo.tags = allTags;
      todo.priority = suggestedPriority;

      this.debugLog('Todo updated with AI suggestions');

    } catch (aiError) {
      // Stop the AI spinner if it was started
      if (aiSpinner) {
        this.stopSpinner(false, 'AI enhancement unavailable');
      }

      this.debugLog('AI error details:', aiError);

      // Handle different error types with specific messaging
      if (aiError instanceof NetworkError) {
        this.warning('AI service is temporarily unavailable due to network issues');
        this.info('Check your network connection and try again later with the --ai flag');
      } else if (aiError instanceof Error) {
        // Check for specific AI configuration issues
        if (aiError.message.includes('API key') || aiError.message.includes('unauthorized') || aiError.message.includes('authentication')) {
          this.warning('AI service authentication failed');
          this.info('Please verify your XAI API key configuration:');
          this.info('• Set XAI_API_KEY environment variable, or');
          this.info('• Use --apiKey flag to provide your API key');
          this.info('• Get your API key from: https://console.x.ai/');
        } else if (aiError.message.includes('quota') || aiError.message.includes('rate limit') || aiError.message.includes('limit exceeded')) {
          this.warning('AI service rate limit exceeded');
          this.info('Your API quota has been reached. Please try again later or upgrade your plan');
        } else if (aiError.message.includes('timeout') || aiError.message.includes('request timed out')) {
          this.warning('AI service request timed out');
          this.info('The AI service is responding slowly. Try again with a simpler todo description');
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
        this.info('Tip: You can set priority manually with: --priority high|medium|low');
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
  private async storeOnBlockchain(todo: Todo, listName: string, storageLocation: StorageLocation): Promise<void> {
    let blobId: string = '';
    // Show blockchain storage warning
    this.section('Blockchain Storage', [
      `${chalk.yellow(ICONS.warning)} ${chalk.yellow('Public Access Warning')}`,
      `Blockchain storage will make the todo data publicly accessible.`,
      `This cannot be undone once the data is stored on the blockchain.`
    ].join('\n'));

    // Start blockchain storage spinner
    const blockchainSpinner = this.startSpinner('Connecting to blockchain storage...');

    try {
      // Initialize Walrus storage with retry
      await this.executeWithRetry(
        async () => {
          await this.walrusStorage.connect();
          this.stopSpinnerSuccess(blockchainSpinner, 'Connected to blockchain storage');
        },
        {
          maxRetries: 5,
          baseDelay: 2000,
          retryMessage: 'Retrying blockchain connection...',
          operationName: 'walrus_connect'
        }
      );

      // Start storage spinner
      const storeSpinner = this.startSpinner('Storing todo on blockchain...');

      // Variable already declared at method level
      
      // Store todo on Walrus with retry and transaction handling
      blobId = await this.executeTransaction(
        async () => {
          return await this.executeWithRetry(
            async () => this.walrusStorage.storeTodo(todo),
            {
              maxRetries: 5,
              baseDelay: 2000,
              retryMessage: 'Retrying blockchain storage...',
              operationName: 'walrus_store_todo'
            }
          );
        },
        {
          operation: 'store-todo',
          rollbackFn: async () => {
            // If storage fails, we might need to clean up any partial state
            this.debugLog('Rolling back blockchain storage attempt');
          }
        }
      );
      
      this.stopSpinnerSuccess(storeSpinner, 'Todo stored on blockchain');

      // Update local todo with Walrus blob ID if we're keeping a local copy
      if (storageLocation === 'both') {
        const updateSpinner = this.startSpinner('Updating local copy with blockchain reference...');
        try {
          await this.todoService.updateTodo(listName, todo.id, {
            walrusBlobId: blobId,
            updatedAt: new Date().toISOString()
          });
          this.stopSpinnerSuccess(updateSpinner, 'Local copy updated with blockchain reference');
        } catch (_error) {
          this.warning('Successfully stored on blockchain but failed to update local copy');
        }
      }

      // If storage is blockchain only, remove from local storage
      if (storageLocation === 'blockchain') {
        const cleanupSpinner = this.startSpinner('Removing local copy...');
        try {
          await this.todoService.deleteTodo(listName, todo.id);
          this.stopSpinnerSuccess(cleanupSpinner, 'Local copy removed');
        } catch (_error) {
          this.warning('Failed to remove local copy after blockchain storage');
        }
      }

      // Display blockchain information
      this.section('Blockchain Storage Info', [
        `${ICONS.blockchain} ${chalk.bold('Blob ID:')} ${chalk.dim(blobId)}`,
        `${ICONS.info} ${chalk.bold('Public URL:')} ${chalk.cyan(`https://testnet.wal.app/blob/${blobId}`)}`
      ].join('\n'));
      
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
            mappings = JSON.parse(content);
          } catch (parseError) {
            if (parseError instanceof SyntaxError) {
              this.warning(`Invalid JSON format in blob mappings file: ${parseError.message}`);
            } else {
              this.warning(`Error parsing blob mappings file: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
            }
            // Continue with empty mappings
          }
        } catch (readError) {
          this.warning(`Error reading blob mappings file: ${readError instanceof Error ? readError.message : String(readError)}`);
          // Continue with empty mappings
        }
      }
      
      // Add or update mapping
      mappings[todoId] = blobId;
      
      // Write mappings back to file using centralized method (handles directory creation)
      this.writeFileSafe(blobMappingsFile, JSON.stringify(mappings, null, 2), 'utf8');
      this.debugLog(`Saved blob mapping: ${todoId} -> ${blobId}`);
    } catch (saveError) {
      this.warning(`Failed to save blob mapping: ${saveError instanceof Error ? saveError.message : String(saveError)}`);
    }
  }

  /**
   * Display success information after adding a todo
   */
  private async displaySuccessInfo(todo: Todo, listName: string): Promise<void> {

    // Choose appropriate header based on whether this is a new list or just a new task
    const headerText = this.isNewList ? `New List Created` : `New Task Added`;

    // Create a more compact display format
    this.log(`${chalk.green(ICONS.success)} ${chalk.bold.green(headerText)}: ${chalk.bold(todo.title)}`);

    // Display essential details in a compact single-line format
    const compactDetails = [
      `${ICONS.list} List: ${chalk.cyan(listName)}`,
      `${ICONS.priority} Priority: ${this.formatPriority(todo.priority)}`,
      todo.dueDate && `${ICONS.date} Due: ${chalk.blue(todo.dueDate)}`,
      todo.tags && todo.tags.length > 0 && `${ICONS.tag} Tags: ${chalk.cyan(todo.tags.join(', '))}`,
      `${ICONS.storage} Storage: ${this.formatStorage(todo.storageLocation)}`
    ].filter(Boolean);

    // Display compact details on a single line
    this.log(`  ${compactDetails.join(' | ')}`);

    // Provide helpful next steps
    const nextSteps = [
      `${chalk.cyan(`${this.config.bin} list ${listName}`)} - View all tasks`,
      `${chalk.cyan(`${this.config.bin} complete --id ${todo.id.slice(-6)}`)} - Mark as completed`
    ];

    // Display next steps on same line
    this.log(`  ${chalk.bold('Next:')} ${nextSteps.join(' | ')}`);
    this.log(''); // Add an empty line for spacing
  }

  /**
   * Perform enhanced pre-execution validation
   * @param args Command arguments
   * @param flags Command flags
   * @throws ValidationError if validation fails
   */
  private performPreExecutionValidation(args: { listOrTitle?: string }, flags: Record<string, unknown>): void {
    // Validate mutually exclusive flags
    if (flags.task && args.listOrTitle) {
      const hasMultipleTasks = Array.isArray(flags.task) && flags.task.length > 1;
      if (!hasMultipleTasks && !flags.list) {
        // If single task flag and argument, but no explicit list - it's ambiguous
        throw new ValidationError(
          'Ambiguous input: use --list flag to specify list name when using both argument and --task flag',
          {
            constraint: 'AMBIGUOUS_INPUT',
            recoverable: false
          }
        );
      }
    }

    // Validate task titles using unified validators
    if (flags.task) {
      const tasks = Array.isArray(flags.task) ? flags.task : [flags.task];
      tasks.forEach((task: string) => {
        this.validateFlag.nonEmpty(task, 'Task title');
      });
    }

    // Validate priority using unified validators
    if (flags.priority) {
      const priorities = Array.isArray(flags.priority) ? flags.priority : [flags.priority];
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
      InputValidator.validate(flags.list, [
        InputValidator.requiredRule('List name'),
        InputValidator.custom(
          (value: string) => /^[a-zA-Z0-9-_]+$/.test(value),
          'List name can only contain letters, numbers, hyphens, and underscores',
          'INVALID_LIST_NAME'
        )
      ], 'List name');
    }

    // Validate priority values
    if (flags.priority) {
      const priorities = Array.isArray(flags.priority) ? flags.priority : [flags.priority];
      priorities.forEach((priority: string, index: number) => {
        InputValidator.validate(priority, [
          CommonValidationRules.priority
        ], `Priority ${index + 1}`);
      });
    }

    // Validate due dates
    if (flags.due) {
      const dueDates = Array.isArray(flags.due) ? flags.due : [flags.due];
      dueDates.forEach((dueDate: string, index: number) => {
        InputValidator.validate(dueDate, [
          CommonValidationRules.dateFormat
        ], `Due date ${index + 1}`);
      });
    }

    // Validate tags
    if (flags.tags) {
      const tagSets = Array.isArray(flags.tags) ? flags.tags : [flags.tags];
      tagSets.forEach((tagSet: string, index: number) => {
        InputValidator.validate(tagSet, [
          {
            test: (value: string) => value.split(',').every(tag => tag.trim().length > 0),
            message: 'Tags cannot be empty',
            code: 'EMPTY_TAG'
          },
          {
            test: (value: string) => value.split(',').every(tag => tag.length <= 50),
            message: 'Tag too long (max 50 characters)',
            code: 'TAG_TOO_LONG'
          }
        ], `Tag set ${index + 1}`);
      });
    }

    // Validate storage location
    if (flags.storage) {
      InputValidator.validate(flags.storage, [
        CommonValidationRules.storageLocation
      ], 'Storage location');
    }
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
}
