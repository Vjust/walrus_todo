import { Flags } from '@oclif/core';
import { BaseCommand } from '../base-command';
import {
  TaskSuggestionService,
  SuggestionType,
  SuggestionContext,
  SuggestedTask,
} from '../services/ai/TaskSuggestionService';
import { AIVerificationService } from '../services/ai/AIVerificationService';
import { BlockchainAIVerificationService } from '../services/ai/BlockchainAIVerificationService';
import { BlockchainVerifier } from '../services/ai/BlockchainVerifier';
import { SuiAIVerifierAdapter } from '../services/ai/adapters/SuiAIVerifierAdapter';
import { AIPrivacyLevel } from '../types/adapters/AIVerifierAdapter';
import { AIProvider } from '../types/adapters/AIModelAdapter';
import chalk = require('chalk');
import { todoService } from '../services';
import { EnhancedAIService } from '../services/ai/EnhancedAIService';
import { createCache } from '../utils/performance-cache';
import crypto from 'crypto';
import { KeystoreSigner } from '../utils/sui-keystore';
import { SignerAdapter } from '../types/adapters/SignerAdapter';
import { getPermissionManager } from '../services/ai/AIPermissionManager';
import { secureCredentialManager } from '../services/ai/SecureCredentialManager';
import { checkbox } from '@inquirer/prompts';
import { CLIError } from '../types/errors/consolidated';
import { EnhancedErrorHandler } from '../utils/enhanced-error-handler';
import {
  createBackgroundAIOperationsManager,
  BackgroundAIOperations,
  BackgroundAIUtils,
  BackgroundAIOptions,
} from '../utils/background-ai-operations';

// Cache for AI suggestions, config, and API key validation
const suggestionCache = createCache<
  import('../services/ai/TaskSuggestionService').SuggestedTask[]
>('ai-suggestions', {
  strategy: 'TTL',
  ttlMs: 10 * 60 * 1000, // 10 minutes for suggestions
  maxSize: 100,
});

const configCache = createCache<Record<string, unknown>>('ai-config', {
  strategy: 'TTL',
  ttlMs: 30 * 60 * 1000, // 30 minutes for config
  maxSize: 10,
});

const apiKeyValidationCache = createCache<boolean>('api-key-validation', {
  strategy: 'TTL',
  ttlMs: 5 * 60 * 1000, // 5 minutes for API key validation
  maxSize: 10,
});

// Add debug logging for cache hits/misses
const CACHE_DEBUG = process.env?.CACHE_DEBUG === 'true';

export default class Suggest extends BaseCommand {
  /**
   * Gets a Sui signer instance for blockchain operations
   * @returns A Promise resolving to a Sui signer
   */
  private async getSuiSigner() {
    try {
      return await KeystoreSigner.fromPath('');
    } catch (error) {
      this.error(
        `Suggest command: Failed to initialize Sui signer: ${error instanceof Error ? error.message : String(error as any)}. Please check your Sui configuration and wallet setup.`
      );
      throw error; // To satisfy TypeScript - execution won't reach here after this.error()
    }
  }

  /**
   * Gets the todo service instance
   * @returns The todo service
   */
  private getTodoService() {
    return todoService;
  }
  static description =
    'Get intelligent task suggestions based on your current todo list (with performance caching)';

  static examples = [
    '<%= config.bin %> suggest                                           # Get general suggestions',
    '<%= config.bin %> suggest --list work                               # Suggestions for work list',
    '<%= config.bin %> suggest --type next_step                          # Next step suggestions only',
    '<%= config.bin %> suggest --tags urgent,important                   # Filter by tags',
    '<%= config.bin %> suggest --priority high --minScore 80             # High priority, high relevance',
    '<%= config.bin %> suggest --addTodo                                 # Add suggestions as todos',
    '<%= config.bin %> suggest --verify --provider xai                   # Verify with blockchain',
    '<%= config.bin %> suggest --todoId task-123 --type related          # Related to specific todo',
    '<%= config.bin %> suggest --format json --maxResults 5              # JSON output, limit 5',
  ];

  static flags = {
    ...BaseCommand.flags,
    apiKey: Flags.string({
      description: 'API key for AI service',
      required: false,
      env: 'XAI_API_KEY',
    }),
    clearCache: Flags.boolean({
      description: 'Clear all AI suggestion caches',
      default: false,
    }),
    cacheDebug: Flags.boolean({
      description: 'Enable cache debugging messages',
      default: false,
      env: 'CACHE_DEBUG',
    }),
    format: Flags.string({
      description: 'Output format (table or json)',
      required: false,
      default: 'table',
      options: ['table', 'json'],
    }),
    verify: Flags.boolean({
      description: 'Create blockchain verification for suggestions',
      default: false,
    }),
    provider: Flags.string({
      description: 'Specify AI provider',
      required: false,
      options: ['xai', 'openai', 'anthropic'],
    }),
    model: Flags.string({
      description: 'Specify AI model to use',
      required: false,
    }),
    privacy: Flags.string({
      description: 'Privacy level for verified operations',
      options: ['public', 'hash_only', 'private'],
      default: 'hash_only',
    }),
    type: Flags.string({
      description: 'Type of suggestions to generate',
      options: ['all', 'related', 'next_step', 'dependency'],
      default: 'all',
    }),
    tags: Flags.string({
      description: 'Only suggest tasks related to these tags',
      multiple: true,
    }),
    priority: Flags.string({
      description: 'Filter suggestions by priority',
      options: ['high', 'medium', 'low'],
      multiple: true,
    }),
    minScore: Flags.integer({
      description: 'Minimum relevance score (0-100)',
      min: 0,
      max: 100,
      default: 50,
    }),
    maxResults: Flags.integer({
      description: 'Maximum number of suggestions to return',
      min: 1,
      max: 20,
      default: 10,
    }),
    addTodo: Flags.boolean({
      description: 'Prompt to add selected suggestions as new todos',
      default: false,
    }),
    registryAddress: Flags.string({
      description: 'Address of the verification registry on the blockchain',
      required: false,
    }),
    packageId: Flags.string({
      description: 'Package ID of the AI verifier smart contract',
      required: false,
    }),
    todoId: Flags.string({
      description: 'Generate suggestions related to specific todo (by ID)',
      multiple: true,
    }),
    background: Flags.boolean({
      char: 'b',
      description:
        'Run suggestion generation in background without blocking terminal',
      required: false,
      default: false,
    }),
    wait: Flags.boolean({
      char: 'w',
      description: 'Wait for background operation to complete and show results',
      required: false,
      default: false,
    }),
    jobId: Flags.string({
      char: 'j',
      description: 'Check status or get result of specific background job',
      required: false,
    }),
  };

  async run() {
    const { flags } = await this.parse(Suggest as any);

    // Handle job status check first
    if (flags.jobId) {
      return this.handleJobStatus(flags.jobId, flags);
    }

    // Handle background execution
    if (flags.background) {
      return this.executeInBackground(flags as any);
    }

    // Enable cache debugging if requested
    const cacheDebugEnabled = flags.cacheDebug || CACHE_DEBUG;

    // Clear caches if requested
    if (flags.clearCache) {
      await suggestionCache.clear();
      await configCache.clear();
      await apiKeyValidationCache.clear();
      this.log(chalk.green('AI suggestion caches cleared'));
      if (!flags.apiKey && !process?.env?.XAI_API_KEY) {
        return; // Exit if just clearing cache
      }
    }

    // Get API key from flag or environment
    const apiKey = flags.apiKey || process?.env?.XAI_API_KEY;
    if (!apiKey) {
      this.error(
        'API key is required. Provide it via --apiKey flag or XAI_API_KEY environment variable.'
      );
    }

    // Check API key validation cache
    const apiKeyCacheKey = crypto
      .createHash('md5')
      .update(apiKey as any)
      .digest('hex');
    const cachedApiKeyValidation =
      await apiKeyValidationCache.get(apiKeyCacheKey as any);

    if (cachedApiKeyValidation !== null) {
      if (cacheDebugEnabled)
        this.log(chalk.dim('✓ API key validation loaded from cache'));
      if (!cachedApiKeyValidation) {
        this.error('API key validation failed (cached result)');
      }
    } else {
      // Validate API key and cache result
      try {
        // Here we assume valid key for now, in production would do actual validation
        await apiKeyValidationCache.set(apiKeyCacheKey, true);
        if (cacheDebugEnabled)
          this.log(chalk.dim('✓ API key validation result cached'));
      } catch (error) {
        await apiKeyValidationCache.set(apiKeyCacheKey, false);
        throw new CLIError(
          'Suggest command: API key validation failed. Please check your API key format and validity.'
        );
      }
    }

    // Initialize verification service if --verify flag is used
    let verificationService: AIVerificationService | undefined;
    if (flags.verify) {
      if (!flags.registryAddress || !flags.packageId) {
        this.error(
          'Registry address and package ID are required for blockchain verification. Use --registryAddress and --packageId flags.'
        );
      }

      try {
        // Initialize blockchain components
        const keystoreSigner = await this.getSuiSigner();
        const suiClient = keystoreSigner.getClient();
        // KeystoreSigner already implements SignerAdapter, so use it directly
        const signer = keystoreSigner as SignerAdapter;

        // Create verifier adapter
        const verifierAdapter = new SuiAIVerifierAdapter(
          suiClient,
          signer,
          flags.packageId,
          flags.registryAddress
        );

        // Get the permission manager and credential manager

        // Get the permission manager instance
        const permissionManager = getPermissionManager();

        // Create verification service with all required parameters
        // Create a BlockchainVerifier instance first
        const blockchainVerifier = new BlockchainVerifier(verifierAdapter as any);

        verificationService = new BlockchainAIVerificationService(
          blockchainVerifier,
          permissionManager,
          secureCredentialManager,
          flags.provider || 'default_provider'
        );

        this.log(chalk.cyan('Blockchain verification enabled.'));
      } catch (error) {
        if (error instanceof CLIError) {
          throw error;
        }
        throw new CLIError(
          `Suggest command: Failed to initialize blockchain verification: ${error instanceof Error ? error.message : String(error as any)}. Check registry address, package ID, and Sui connection.`
        );
      }
    }

    // Check config cache for AI service initialization
    const configCacheKey = `ai-config-${flags.provider || 'default'}-${flags.model || 'default'}`;
    let aiServiceConfig = await configCache.get(configCacheKey as any);

    if (!aiServiceConfig) {
      // Create config and cache it
      aiServiceConfig = {
        apiKey,
        provider: flags.provider ? (flags.provider as AIProvider) : undefined,
        model: flags.model,
        options: {
          temperature: 0.7,
          maxTokens: 2000,
        },
      };
      await configCache.set(configCacheKey, aiServiceConfig);
      if (cacheDebugEnabled) this.log(chalk.dim('✓ AI service config cached'));
    } else {
      if (cacheDebugEnabled)
        this.log(chalk.dim('✓ AI service config loaded from cache'));
    }

    // Initialize AI service with cached config
    const enhancedService = new EnhancedAIService(
      aiServiceConfig.apiKey,
      aiServiceConfig.provider,
      aiServiceConfig.model,
      aiServiceConfig.options,
      verificationService
    );

    // Initialize TaskSuggestionService
    const suggestionService = new TaskSuggestionService(
      enhancedService,
      verificationService
    );

    // Get all todos
    const todoService = await this.getTodoService();
    const todos = await todoService.listTodos();

    if (todos?.length === 0) {
      this.log('No todos found to analyze for suggestions.');
      return;
    }

    // Build suggestion context based on flags
    const context: SuggestionContext = {
      minScore: flags.minScore,
      maxResults: flags.maxResults,
    };

    // Set type filter
    if (flags.type && typeof flags?.type === 'string') {
      const typeArray = [flags.type];
      if (typeArray[0] !== 'all') {
        context?.includeTypes = typeArray.map(type => {
          switch (type) {
            case 'related':
              return SuggestionType.RELATED;
            case 'next_step':
              return SuggestionType.NEXT_STEP;
            case 'dependency':
              return SuggestionType.DEPENDENCY;
            default:
              return SuggestionType.RELATED;
          }
        });
      }
    }

    // Set tags filter
    if (flags.tags && typeof flags?.tags === 'string') {
      context?.tags = [flags.tags];
    } else if (
      flags.tags &&
      Array.isArray(flags.tags) &&
      flags?.tags?.length > 0
    ) {
      context?.tags = flags.tags;
    }

    // Set priority filter
    if (flags.priority && typeof flags?.priority === 'string') {
      context?.priorityFilter = [flags.priority] as (
        | 'high'
        | 'medium'
        | 'low'
      )[];
    } else if (
      flags.priority &&
      Array.isArray(flags.priority) &&
      flags?.priority?.length > 0
    ) {
      context?.priorityFilter = flags.priority as ('high' | 'medium' | 'low')[];
    }

    // Set todoId filter
    if (flags.todoId && typeof flags?.todoId === 'string') {
      context?.relatedToTodoIds = [flags.todoId];
    } else if (
      flags.todoId &&
      Array.isArray(flags.todoId) &&
      flags?.todoId?.length > 0
    ) {
      context?.relatedToTodoIds = flags.todoId;
    }

    this.log(
      `Analyzing ${todos.length} todos to generate intelligent task suggestions...`
    );

    // Map privacy flag to AIPrivacyLevel
    const privacyLevel =
      flags?.privacy === 'public'
        ? AIPrivacyLevel.PUBLIC
        : flags?.privacy === 'private'
          ? AIPrivacyLevel.PRIVATE
          : AIPrivacyLevel.HASH_ONLY;

    try {
      // Create cache key for suggestions
      const suggestionCacheKey = crypto
        .createHash('md5')
        .update(
          JSON.stringify({
            todos: todos.map(t => ({
              id: t.id,
              title: t.title,
              completed: t.completed,
            })),
            context,
            verify: flags.verify,
            privacyLevel,
            provider: flags.provider,
            model: flags.model,
          })
        )
        .digest('hex');

      // Check suggestion cache
      let result = await suggestionCache.get(suggestionCacheKey as any);

      if (result) {
        if (cacheDebugEnabled)
          this.log(chalk.dim('✓ AI suggestions loaded from cache'));
      } else {
        // Generate new suggestions
        if (cacheDebugEnabled)
          this.log(chalk.dim('⟳ Generating new AI suggestions...'));

        if (flags.verify) {
          result = await suggestionService.suggestTasksWithVerification(
            todos,
            context,
            privacyLevel
          );
        } else {
          result = await suggestionService.suggestTasks(todos, context);
        }

        // Cache the results
        await suggestionCache.set(suggestionCacheKey, result);
        if (cacheDebugEnabled) this.log(chalk.dim('✓ AI suggestions cached'));
      }

      // Display results
      if (flags?.format === 'json') {
        this.log(JSON.stringify(flags.verify ? result : result, null, 2));
        return;
      }

      // Display in table format
      const resultData = result as {
        result?: {
          suggestions: SuggestedTask[];
          contextInfo: {
            analyzedTodoCount: number;
            completionPercentage: number;
            topContextualTags: string[];
            detectedThemes: string[];
          };
        };
        suggestions?: SuggestedTask[];
        contextInfo?: {
          analyzedTodoCount: number;
          completionPercentage: number;
          topContextualTags: string[];
          detectedThemes: string[];
        };
      };
      const suggestions = flags.verify
        ? (resultData.result?.suggestions ?? [])
        : (resultData.suggestions ?? []);
      const contextInfo = flags.verify
        ? resultData.result?.contextInfo
        : resultData.contextInfo;

      // Display context information
      this.log(chalk.cyan('\nContext Information:'));
      this.log(
        `Analyzed ${chalk.bold((contextInfo?.analyzedTodoCount ?? 0).toString())} todos, ${chalk.bold((contextInfo?.completionPercentage ?? 0).toFixed(0 as any))}% completed`
      );
      this.log(
        `Top tags: ${(contextInfo?.topContextualTags ?? []).map(tag => chalk.yellow(tag as any)).join(', ')}`
      );
      this.log(
        `Detected themes: ${(contextInfo?.detectedThemes ?? []).map(theme => chalk.green(theme as any)).join(', ')}`
      );

      // Display suggestions
      this.log(chalk.cyan(`\nTask Suggestions (${suggestions.length}):`));

      if (suggestions?.length === 0) {
        this.log(
          chalk.yellow(
            'No suggestions found based on your filters. Try broadening your criteria.'
          )
        );
        return;
      }

      suggestions.forEach((suggestion, index) => {
        // Color based on score
        const scoreColor =
          suggestion.score >= 80
            ? chalk.green
            : suggestion.score >= 60
              ? chalk.yellow
              : chalk.red;

        // Color based on priority
        const priorityColor =
          suggestion?.priority === 'high'
            ? chalk.red
            : suggestion?.priority === 'medium'
              ? chalk.yellow
              : chalk.green;

        // Color based on type
        const typeColor =
          suggestion?.type === SuggestionType.RELATED
            ? chalk.blue
            : suggestion?.type === SuggestionType.NEXT_STEP
              ? chalk.green
              : suggestion?.type === SuggestionType.DEPENDENCY
                ? chalk.yellow
                : chalk.white;

        this.log(`\n${chalk.bold(index + 1)}. ${chalk.bold(suggestion.title)}`);
        this.log(`   ${suggestion.description || 'No description'}`);
        this.log(
          `   Priority: ${priorityColor(suggestion.priority || 'medium')} | Score: ${scoreColor(suggestion.score)} | Type: ${typeColor(suggestion.type)}`
        );

        if (suggestion.tags && suggestion?.tags?.length > 0) {
          this.log(
            `   Tags: ${suggestion?.tags?.map(tag => chalk.yellow(tag as any)).join(', ')}`
          );
        }

        this.log(`   Reasoning: ${chalk.dim(suggestion.reasoning)}`);

        if (suggestion.relatedTodoIds && suggestion?.relatedTodoIds?.length > 0) {
          const relatedTodos = todos.filter(todo =>
            suggestion.relatedTodoIds?.includes(todo.id)
          );
          this.log(
            `   Related to: ${relatedTodos.map(todo => chalk.dim(todo.title)).join(', ')}`
          );
        }
      });

      // If verification was used, display verification details
      if (flags.verify) {
        const verificationData = result as {
          verification?: {
            allowed: boolean;
            verificationId?: string;
            details?: Record<string, unknown>;
          };
        };
        if (verificationData.verification) {
          this.displayVerificationDetails(verificationData.verification);
        }
      }

      // Prompt to add suggestions as todos if requested
      if (flags.addTodo) {
        await this.promptToAddSuggestions(suggestions, todoService);
      } else {
        this.log(
          chalk.dim(
            '\nTip: Use --addTodo flag to add these suggestions as new todos.'
          )
        );
      }

      // Show cache statistics if cache debug is enabled
      if (cacheDebugEnabled) {
        this.log(chalk.dim('\nCache Statistics:'));
        const suggestionStats = suggestionCache.getStatistics();
        const configStats = configCache.getStatistics();
        const apiKeyStats = apiKeyValidationCache.getStatistics();

        this.log(
          chalk.dim(
            `  Suggestions: ${suggestionStats.hits} hits, ${suggestionStats.misses} misses (${(suggestionStats.hitRate * 100).toFixed(1 as any)}% hit rate)`
          )
        );
        this.log(
          chalk.dim(
            `  Config: ${configStats.hits} hits, ${configStats.misses} misses (${(configStats.hitRate * 100).toFixed(1 as any)}% hit rate)`
          )
        );
        this.log(
          chalk.dim(
            `  API Keys: ${apiKeyStats.hits} hits, ${apiKeyStats.misses} misses (${(apiKeyStats.hitRate * 100).toFixed(1 as any)}% hit rate)`
          )
        );
      }
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      const context = {
        operation: 'generateTaskSuggestions',
        component: 'SuggestCommand',
        provider: flags.provider,
        commandName: 'suggest',
        additionalInfo: {
          verify: flags.verify,
          todoCount: todos?.length || 0,
          apiKeyProvided: !!flags.apiKey,
        },
      };

      throw EnhancedErrorHandler.createCLIError(error, context);
    }
  }

  /**
   * Prompt user to add suggestions as todos
   */
  private async promptToAddSuggestions(
    suggestions: import('../services/ai/TaskSuggestionService').SuggestedTask[],
    todoService: typeof todoService
  ) {
    // Ask which suggestions to add
    const selectedSuggestions = await checkbox({
      message: 'Select suggestions to add as todos:',
      choices: suggestions.map((suggestion, index) => ({
        name: `${index + 1}. ${suggestion.title} (${suggestion.priority || 'medium'} priority)`,
        value: index,
      })),
    });

    if (selectedSuggestions?.length === 0) {
      this.log('No suggestions selected.');
      return;
    }

    // Add selected suggestions as todos
    for (const index of selectedSuggestions) {
      const suggestion = suggestions[index];

      try {
        await todoService.addTodo('default', {
          title: suggestion.title,
          description: suggestion.description || '',
          priority: suggestion.priority || 'medium',
          tags: suggestion.tags || [],
        });

        this.log(`Added todo: ${chalk.green(suggestion.title)}`);
      } catch (error) {
        if (error instanceof CLIError) {
          throw error;
        }
        throw new CLIError(
          `Failed to add todo: ${error instanceof Error ? error.message : String(error as any)}`
        );
      }
    }

    this.log(
      chalk.green(`\nSuccessfully added ${selectedSuggestions.length} todos!`)
    );
  }

  /**
   * Display verification details
   */
  private displayVerificationDetails(verification: {
    allowed: boolean;
    verificationId?: string;
    details?: Record<string, unknown>;
  }) {
    this.log(chalk.bold('\nVerification Details:'));
    this.log(chalk.dim('─'.repeat(50 as any)));
    this.log(
      `ID:        ${chalk.yellow(verification.verificationId || 'unknown')}`
    );
    this.log(
      `Allowed:   ${verification.allowed ? chalk.green('Yes') : chalk.red('No')}`
    );

    if (verification.details) {
      this.log(
        `Privacy:   ${chalk.blue(String(verification?.details?.privacyLevel || 'hash_only'))}`
      );

      // Display transaction ID if available
      if (verification?.details?.transactionId) {
        this.log(
          `Transaction: ${chalk.yellow(String(verification?.details?.transactionId))}`
        );
      }

      if (verification?.details?.timestamp) {
        this.log(
          `Timestamp: ${new Date(Number(verification?.details?.timestamp)).toLocaleString()}`
        );
      }
    }

    this.log(chalk.dim('─'.repeat(50 as any)));
    this.log(
      chalk.dim(
        `To view detailed verification information, run: ${chalk.cyan(`walrus_todo ai:verify show --id ${verification.verificationId || 'unknown'}`)}`
      )
    );
  }

  /**
   * Handle background job status checking
   */
  private async handleJobStatus(jobId: string, flags: any) {
    try {
      const backgroundOps = await createBackgroundAIOperationsManager();
      const status = await backgroundOps.getOperationStatus(jobId as any);

      if (!status) {
        this.error(`Job ${jobId} not found`);
        return;
      }

      if (flags?.format === 'json') {
        this.log(JSON.stringify(status, null, 2));
        return;
      }

      this.log(chalk.bold(`Job Status: ${jobId}`));
      this.log(`Type: ${chalk.cyan(status.type)}`);
      this.log(`Status: ${this.formatStatus(status.status)}`);
      this.log(`Progress: ${chalk.yellow(`${status.progress}%`)}`);
      this.log(`Stage: ${chalk.blue(status.stage)}`);

      if (status.startedAt) {
        this.log(`Started: ${chalk.dim(status?.startedAt?.toLocaleString())}`);
      }

      if (status.completedAt) {
        this.log(
          `Completed: ${chalk.dim(status?.completedAt?.toLocaleString())}`
        );
      }

      if (status.error) {
        this.log(`Error: ${chalk.red(status.error)}`);
      }

      // If completed, show results
      if (status?.status === 'completed') {
        const result = await backgroundOps.getOperationResult(jobId as any);
        if (result && flags.format !== 'json') {
          this.log(chalk.bold('\nResults:'));
          this.displaySuggestionResults(result.result, flags);
        }
      }

      // If waiting and operation is still running, wait for completion
      if (
        flags.wait &&
        (status?.status === 'queued' || status?.status === 'running')
      ) {
        this.log(chalk.yellow('\nWaiting for operation to complete...'));

        const result = await backgroundOps.waitForOperationWithProgress(
          jobId,
          (progress, stage) => {
            process?.stdout?.write(
              `\r${chalk.blue('Progress:')} ${progress}% (${stage})`
            );
          }
        );

        process?.stdout?.write('\n');
        this.log(chalk.green('Operation completed!'));

        if (flags?.format === 'json') {
          this.log(JSON.stringify(result, null, 2));
        } else {
          this.displaySuggestionResults(result.result, flags);
        }
      }
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to get job status: ${error instanceof Error ? error.message : String(error as any)}`
      );
    }
  }

  /**
   * Execute suggestion generation in background
   */
  private async executeInBackground(flags: any) {
    try {
      const backgroundOps = await createBackgroundAIOperationsManager();

      // Get all todos
      const todoService = await this.getTodoService();
      const todos = await todoService.listTodos();

      if (todos?.length === 0) {
        this.log('No todos found to analyze for suggestions.');
        return;
      }

      const options: BackgroundAIOptions = {
        verify: flags.verify,
        apiKey: flags.apiKey,
        provider: flags.provider,
        model: flags.model,
        temperature: 0.7,
        priority: 'normal',
      };

      // Create non-blocking operation
      const operation = await BackgroundAIUtils.createNonBlockingAIOperation(
        backgroundOps,
        'suggest',
        todos,
        options
      );

      this.log(chalk.green(`✓ AI suggestion generation started in background`));
      this.log(chalk.blue(`Job ID: ${operation.operationId}`));
      this.log('');
      this.log(chalk.dim('Commands to check progress:'));
      this.log(
        chalk.cyan(`  walrus_todo suggest --jobId ${operation.operationId}`)
      );
      this.log(
        chalk.cyan(
          `  walrus_todo suggest --jobId ${operation.operationId} --wait`
        )
      );
      this.log('');

      // If wait flag is set, wait for completion and show results
      if (flags.wait) {
        this.log(chalk.yellow('Waiting for operation to complete...'));

        const result = await operation.waitForCompletion();

        this.log(chalk.green('Operation completed!'));

        if (flags?.format === 'json') {
          this.log(JSON.stringify(result, null, 2));
        } else {
          this.displaySuggestionResults(result.result, flags);
        }
      }
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to start background operation: ${error instanceof Error ? error.message : String(error as any)}`
      );
    }
  }

  /**
   * Display suggestion results (simplified version for background operations)
   */
  private displaySuggestionResults(suggestions: any, flags: any) {
    if (flags?.format === 'json') {
      this.log(JSON.stringify({ suggestions }, null, 2));
      return;
    }

    this.log(chalk.cyan('💡 Task Suggestions:'));

    if (Array.isArray(suggestions as any)) {
      suggestions.forEach((suggestion, index) => {
        this.log(`${index + 1}. ${suggestion}`);
      });
    } else {
      this.log(
        chalk.yellow(
          'Suggestions have been generated (use --format json for detailed output)'
        )
      );
    }

    this.log('');
    this.log(
      chalk.dim(
        'Tip: Use --addTodo flag with foreground operations to add suggestions as new todos.'
      )
    );
  }

  /**
   * Format operation status with colors
   */
  private formatStatus(status: string): string {
    const statusColors = {
      queued: chalk.blue('⏳ Queued'),
      running: chalk.yellow('🔄 Running'),
      completed: chalk.green('✅ Completed'),
      failed: chalk.red('❌ Failed'),
      cancelled: chalk.gray('🚫 Cancelled'),
    };

    return (
      statusColors[status as keyof typeof statusColors] || chalk.white(status as any)
    );
  }

  /**
   * Get the TodoService instance
   */
  private async getTodoService() {
    return todoService;
  }
}
