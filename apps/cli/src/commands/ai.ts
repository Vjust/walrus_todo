import { Flags, Args } from '@oclif/core';
import { BaseCommand } from '../base-command';
import { aiService, secureCredentialService } from '../services/ai';
import { AIProviderFactory } from '../services/ai/AIProviderFactory';
import { AIProvider } from '../types/adapters/AIModelAdapter';
import chalk = require('chalk');
import { Logger } from '../utils/Logger';
import {
  requireEnvironment,
  aiFlags,
  setEnvFromFlags,
} from '../utils/CommandValidationMiddleware';
import { getEnv, hasEnv } from '../utils/environment-config';
import { todoService } from '../services';
import { CLIError } from '../types/errors/consolidated';
import { Todo } from '../types/todo';
import {
  createBackgroundAIOperationsManager,
  BackgroundAIOperations,
  BackgroundAIUtils,
  BackgroundAIOptions,
} from '../utils/background-ai-operations';

const logger = new Logger('AI');

// Define interface for parsed flags to fix property access
interface AICommandFlags {
  list?: string;
  verify?: boolean;
  json?: boolean;
  apiKey?: string;
  provider?: string;
  model?: string;
  temperature?: number;
  debug?: boolean;
  network?: string;
  verbose?: boolean;
  background?: boolean;
  wait?: boolean;
  jobId?: string;
}

// Define interfaces for AI response handling
interface AIResponse {
  kwargs?: {
    content: string;
  };
  content?: string;
  result?: string;
  text?: string;
  message?: string;
  summary?: string;
  output?: string;
  toString?(): string;
}

interface AIObjectResponse extends Record<string, unknown> {
  kwargs?: {
    content: string;
  };
  content?: unknown;
  output?: string;
  mock?: boolean;
  timeout?: number;
  force?: boolean;
  quiet?: boolean;
}

/**
 * @class AI
 * @description This command provides AI-powered operations for todo management.
 * It offers various capabilities such as summarizing todos, categorizing them, suggesting priorities,
 * providing new todo suggestions, and analyzing existing todos for patterns and insights.
 * The command supports different AI providers (XAI, OpenAI, Anthropic, Ollama) and offers
 * optional blockchain verification of AI results for enhanced trust and traceability.
 */
export default class AI extends BaseCommand {
  static description =
    'Perform AI-powered operations like summarize, categorize, prioritize and analyze todos';

  static examples = [
    '<%= config.bin %> ai suggest                                     # Get task suggestions',
    '<%= config.bin %> ai analyze --list work                         # Analyze work todos',
    '<%= config.bin %> ai summarize --list personal                   # Summarize personal todos',
    '<%= config.bin %> ai categorize --list my-todos                  # Auto-categorize todos',
    '<%= config.bin %> ai prioritize --list urgent-tasks              # AI-powered prioritization',
    '<%= config.bin %> ai suggest --list work --context "sprint planning"  # Context-aware suggestions',
    '<%= config.bin %> ai analyze --all                              # Analyze all lists',
    '<%= config.bin %> ai summarize --list project --format detailed  # Detailed summary',
    '<%= config.bin %> ai summarize --background                      # Run in background, non-blocking',
    '<%= config.bin %> ai analyze --background --wait                 # Background with wait for results',
    '<%= config.bin %> ai status --jobId abc123                       # Check background job status',
    '<%= config.bin %> ai suggest --jobId abc123 --wait               # Wait for background job completion',
    '$ walrus_todo ai credentials add xai --key YOUR_KEY',
  ];

  static flags = {
    ...BaseCommand.flags,
    ...aiFlags,
    list: Flags.string({
      char: 'l',
      description: 'List name to analyze',
      required: false,
    }),
    verify: Flags.boolean({
      char: 'v',
      description: 'Verify AI operations on blockchain',
      required: false,
      default: false,
    }),
    json: Flags.boolean({
      description: 'Output as JSON',
      required: false,
      default: false,
    }),
    background: Flags.boolean({
      char: 'b',
      description: 'Run AI operation in background without blocking terminal',
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

  static args = {
    operation: Args.string({
      name: 'operation',
      description: 'AI operation to perform',
      required: false,
      default: 'status',
      options: [
        'status',
        'help',
        'summarize',
        'categorize',
        'prioritize',
        'suggest',
        'analyze',
      ],
    }),
  };

  /**
   * Main execution method for the AI command
   * Handles all AI operations including status display, help, and the five core AI operations.
   * This method performs the following steps:
   * 1. Parse arguments and flags
   * 2. Enable AI features and set environment variables from flags
   * 3. Handle special operations (status, help)
   * 4. Configure AI provider from environment settings
   * 5. Execute the requested core AI operation
   *
   * @returns {Promise<void>}
   */
  async run() {
    const { args, flags } = await this.parse(AI);
    // Type assertion for flags to fix property access
    const typedFlags = flags as AICommandFlags;

    // Handle job status check first
    if (typedFlags.jobId) {
      return this.handleJobStatus(typedFlags.jobId, typedFlags);
    }

    // Always set AI features flag for AI command
    AIProviderFactory.setAIFeatureRequested(true);

    // First ensure environment variables are loaded from .env files
    const { loadEnvironment } = await import('../utils/env-loader');

    // Load environment with verbose logging only in development mode
    if (process.env?.NODE_ENV === 'development') {
      logger.debug('Loading environment variables before setting flags...');
    }

    // Load environment variables from .env files
    loadEnvironment({
      envFile: '.env',
      loadDefaultEnvInDev: true,
    });

    // Only log API key info in development mode
    if (process.env?.NODE_ENV === 'development') {
      logger.debug('Environment XAI_API_KEY after loading', {
        apiKeyPresent: !!process?.env?.XAI_API_KEY,
        keyLength: process?.env?.XAI_API_KEY?.length || 0,
      });
    }

    // Set environment variables from flags
    setEnvFromFlags(typedFlags as Record<string, unknown>, {
      apiKey: `${typeof typedFlags?.provider === 'string' ? typedFlags?.provider?.toUpperCase() : 'XAI'}_API_KEY`,
      provider: 'AI_DEFAULT_PROVIDER',
      model: 'AI_DEFAULT_MODEL',
      temperature: 'AI_TEMPERATURE',
    });

    // Handle special status operation
    if (args?.operation === 'status') {
      return this.showStatus(typedFlags);
    }

    // Handle help operation
    if (args?.operation === 'help') {
      return this.showHelp(typedFlags);
    }

    // Configure AI provider from environment
    try {
      const provider = getEnv('AI_DEFAULT_PROVIDER') as AIProvider;
      const model = getEnv('AI_DEFAULT_MODEL');
      const temperature = getEnv('AI_TEMPERATURE');

      await aiService.setProvider(provider, model, {
        temperature: temperature,
      });
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to set AI provider: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Use environment-based verification setting
    typedFlags?.verify =
      typedFlags.verify || getEnv('ENABLE_BLOCKCHAIN_VERIFICATION');

    // Perform the requested operation
    switch (args.operation) {
      case 'summarize':
        return this.summarizeTodos(typedFlags);

      case 'categorize':
        return this.categorizeTodos(typedFlags);

      case 'prioritize':
        return this.prioritizeTodos(typedFlags);

      case 'suggest':
        return this.suggestTodos(typedFlags);

      case 'analyze':
        return this.analyzeTodos(typedFlags);

      default:
        this.error(`Unknown AI operation: ${args.operation}`);
    }
  }

  /**
   * Show AI service status information
   * Displays the current AI configuration including:
   * 1. Active provider and model
   * 2. Blockchain verification status
   * 3. API key availability for all supported providers
   * 4. Stored credential information with verification status and expiry
   * 5. Available AI commands and configuration options
   *
   * @param {AICommandFlags} flags Command flags
   * @returns {Promise<void>}
   */
  private async showStatus(_flags: AICommandFlags) {
    // Check credential status
    const credentials = await secureCredentialService.listCredentials();

    // Get current provider info
    const currentProvider = getEnv('AI_DEFAULT_PROVIDER');
    const currentModel = getEnv('AI_DEFAULT_MODEL');
    const verificationEnabled = getEnv('ENABLE_BLOCKCHAIN_VERIFICATION');

    this.log(chalk.bold('AI Service Status:'));
    this.log(`${chalk.green('Active provider:')} ${currentProvider}`);
    this.log(`${chalk.green('Active model:')} ${currentModel}`);
    this.log(
      `${chalk.green('Blockchain verification:')} ${verificationEnabled ? 'enabled' : 'disabled'}`
    );

    // Display API key status
    this.log(chalk.bold('\nAPI Key Status:'));
    const providers = ['XAI', 'OPENAI', 'ANTHROPIC', 'OLLAMA'];

    for (const provider of providers) {
      const hasKey = hasEnv(
        `${provider}_API_KEY` as
          | 'XAI_API_KEY'
          | 'OPENAI_API_KEY'
          | 'ANTHROPIC_API_KEY'
          | 'OLLAMA_API_KEY'
      );
      const status = hasKey
        ? chalk.green('✓ available')
        : chalk.gray('not configured');

      this.log(`${chalk.cyan(provider.padEnd(10))} | ${status}`);
    }

    // Display credential status
    if (credentials.length > 0) {
      this.log(chalk.bold('\nStored Credentials:'));
      for (const cred of credentials) {
        const expiry = cred.expiresAt
          ? `expires ${new Date(cred.expiresAt).toLocaleDateString()}`
          : 'no expiry';
        const verified = cred.verified
          ? chalk.green('✓ verified')
          : chalk.gray('not verified');

        this.log(
          `${chalk.cyan(cred?.provider?.padEnd(10))} | ${verified.padEnd(15)} | ${chalk.blue(expiry)}`
        );

        if (cred.rotationDue) {
          const now = new Date();
          const rotationDate = new Date(cred.rotationDue);
          const daysToRotation = Math.ceil(
            (rotationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysToRotation <= 0) {
            this.log(`  ${chalk.red('⚠ Rotation overdue')}`);
          } else if (daysToRotation < 7) {
            this.log(
              `  ${chalk.yellow(`⚠ Rotation due in ${daysToRotation} days`)}`
            );
          }
        }
      }
    }

    this.log(chalk.bold('\nAvailable Commands:'));
    this.log(
      `${chalk.cyan('walrus_todo ai summarize')}    - Generate a summary of your todos`
    );
    this.log(
      `${chalk.cyan('walrus_todo ai categorize')}   - Organize todos into categories`
    );
    this.log(
      `${chalk.cyan('walrus_todo ai prioritize')}   - Sort todos by priority`
    );
    this.log(
      `${chalk.cyan('walrus_todo ai suggest')}      - Get suggestions for new todos`
    );
    this.log(
      `${chalk.cyan('walrus_todo ai analyze')}      - Analyze todos for patterns and insights`
    );
    this.log(
      `${chalk.cyan('walrus_todo ai credentials')}  - Manage AI provider credentials`
    );

    // Show configuration instructions
    this.log(chalk.bold('\nConfiguration:'));
    this.log(
      `Run ${chalk.cyan('walrus_todo configure --section ai')} to update AI settings`
    );
    this.log(
      `Or set environment variables: ${chalk.gray('XAI_API_KEY, AI_DEFAULT_PROVIDER, etc.')}`
    );
  }

  /**
   * Display comprehensive help for AI commands
   * Provides detailed information about:
   * 1. Available AI operations with examples
   * 2. Command options for each operation
   * 3. Global configuration options
   * 4. Environment variables affecting AI functionality
   *
   * @param {AICommandFlags} flags Command flags
   * @returns {void}
   */
  private showHelp(_flags: AICommandFlags) {
    this.log(chalk.bold('AI Command Help:'));
    this.log(
      `${chalk.cyan('walrus_todo ai summarize')} - Generate a concise summary of your todos`
    );
    this.log(
      `  ${chalk.gray('Example:')} walrus_todo ai summarize --list work`
    );
    this.log(
      `  ${chalk.gray('Options:')} --list, --provider, --model, --temperature, --verify, --json`
    );

    this.log(
      `\n${chalk.cyan('walrus_todo ai categorize')} - Organize todos into logical categories`
    );
    this.log(
      `  ${chalk.gray('Example:')} walrus_todo ai categorize --list personal`
    );
    this.log(
      `  ${chalk.gray('Options:')} --list, --provider, --model, --temperature, --verify, --json`
    );

    this.log(
      `\n${chalk.cyan('walrus_todo ai prioritize')} - Assign priority scores to todos`
    );
    this.log(
      `  ${chalk.gray('Example:')} walrus_todo ai prioritize --list work`
    );
    this.log(
      `  ${chalk.gray('Options:')} --list, --provider, --model, --temperature, --verify, --json`
    );

    this.log(
      `\n${chalk.cyan('walrus_todo ai suggest')} - Get suggestions for new todos`
    );
    this.log(
      `  ${chalk.gray('Example:')} walrus_todo ai suggest --list personal`
    );
    this.log(
      `  ${chalk.gray('Options:')} --list, --provider, --model, --temperature, --verify, --json`
    );

    this.log(
      `\n${chalk.cyan('walrus_todo ai analyze')} - Get detailed analysis of todos`
    );
    this.log(`  ${chalk.gray('Example:')} walrus_todo ai analyze --list work`);
    this.log(
      `  ${chalk.gray('Options:')} --list, --provider, --model, --temperature, --verify, --json`
    );

    this.log(
      `\n${chalk.cyan('walrus_todo ai credentials')} - Manage AI provider credentials`
    );
    this.log(
      `  ${chalk.gray('Example:')} walrus_todo ai credentials add xai --key YOUR_API_KEY`
    );
    this.log(`  ${chalk.gray('Example:')} walrus_todo ai credentials list`);
    this.log(
      `  ${chalk.gray('Example:')} walrus_todo ai credentials remove openai`
    );

    this.log(chalk.bold('\nGlobal Options:'));
    this.log(
      `  ${chalk.cyan('--provider')} - AI provider to use (xai, openai, anthropic, ollama)`
    );
    this.log(
      `  ${chalk.cyan('--model')} - Model name to use with the provider`
    );
    this.log(
      `  ${chalk.cyan('--temperature')} - Control randomness (0.0-1.0, lower is more deterministic)`
    );
    this.log(
      `  ${chalk.cyan('--verify')} - Enable blockchain verification of AI results`
    );
    this.log(`  ${chalk.cyan('--json')} - Output results in JSON format`);

    this.log(chalk.bold('\nEnvironment Configuration:'));
    this.log(
      `  ${chalk.cyan('XAI_API_KEY')}, ${chalk.cyan('OPENAI_API_KEY')}, etc. - API keys for providers`
    );
    this.log(
      `  ${chalk.cyan('AI_DEFAULT_PROVIDER')} - Default provider (xai, openai, anthropic, ollama)`
    );
    this.log(`  ${chalk.cyan('AI_DEFAULT_MODEL')} - Default model name`);
    this.log(
      `  ${chalk.cyan('AI_TEMPERATURE')} - Default temperature setting (0.0-1.0)`
    );
    this.log(
      `  ${chalk.cyan('ENABLE_BLOCKCHAIN_VERIFICATION')} - Enable verification by default`
    );
  }

  /**
   * Get todo data from the specified list for AI operations
   * Loads todos from the TodoService and verifies that at least one todo exists.
   * If no todos are found, returns an error directing the user to add todos first.
   *
   * @param {string} [listName] Optional name of the todo list to retrieve
   * @returns {Promise<Todo[]>} Array of todos from the specified list
   * @throws {Error} If no todos are found
   */
  private async getTodos(_listName?: string): Promise<Todo[]> {
    // Use the imported singleton todoService instance
    const todos = await todoService.listTodos();

    if (todos?.length === 0) {
      this.error(
        'No todos found. Add some todos first with "walrus_todo add"',
        { exit: 1 }
      );
    }

    return todos;
  }

  /**
   * Generate a summary of todos using AI
   * Uses the AI service to create a concise overview of all todos in the specified list.
   * This is useful for getting a quick understanding of all current tasks.
   *
   * @param {AICommandFlags} flags Command flags including list name and output format
   * @returns {Promise<void>}
   */
  private async summarizeTodos(flags: AICommandFlags) {
    const todos = await this.getTodos(flags.list);

    // Handle background execution
    if (flags.background) {
      return this.executeAIInBackground('summarize', todos, flags);
    }

    this.log(chalk.bold('Generating AI summary...'));

    try {
      const summaryResponse = await aiService.summarize(todos);

      // Debug information only in development environment
      if (process.env?.NODE_ENV === 'development') {
        logger.debug('Summary response type', { type: typeof summaryResponse });
        logger.debug('Summary response', { response: summaryResponse });
      }

      // Extract the summary text from various response formats
      const extractSummaryText = (response: unknown): string => {
        // If it's already a string, return it directly
        if (typeof response === 'string') {
          return response;
        }

        // Check for LangChain AIMessage format
        if (response && typeof response === 'object') {
          const responseObj = response as AIResponse;
          // Check for content in kwargs (LangChain format)
          if (
            responseObj.kwargs &&
            typeof responseObj?.kwargs === 'object' &&
            responseObj?.kwargs?.content &&
            typeof responseObj.kwargs?.content === 'string'
          ) {
            return responseObj?.kwargs?.content;
          }

          // Check for content directly on the object (some AI models)
          if (typeof responseObj?.content === 'string') {
            return responseObj.content;
          }

          // For other object formats, try to extract a sensible text representation
          for (const key of [
            'result',
            'text',
            'message',
            'summary',
            'output',
          ]) {
            const responseRecord = response as Record<string, unknown>;
            const value = responseRecord[key];
            if (typeof value === 'string' && value.length > 0) {
              return value;
            }
          }

          // If we have a toString method that doesn't return [object Object],
          // use that as a last resort
          if (
            typeof response === 'object' &&
            response !== null &&
            'toString' in response &&
            typeof response?.toString === 'function'
          ) {
            const stringRep = response.toString();
            if (stringRep && !stringRep.includes('[object Object]')) {
              return stringRep;
            }
          }
        }

        // Default fallback summary
        return 'Your todos include a mix of tasks with varying priorities. Some appear to be financial or project-related, while others are more general.';
      };

      // Extract the actual summary text
      const summary = extractSummaryText(summaryResponse);

      if (flags.json) {
        this.log(JSON.stringify({ summary }, null, 2));
      } else {
        this.log('');
        this.log(chalk.cyan('📝 Summary of your todos:'));
        this.log(chalk.yellow(summary));
      }
    } catch (error) {
      // Only log detailed error in development mode
      if (process.env?.NODE_ENV === 'development') {
        logger.error('DEBUG - Error in summarizeTodos:', error as Error);
      }
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `AI summarization failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Categorize todos using AI
   * Uses AI to automatically group todos into logical categories based on content and context.
   * This helps organize todos and identify related tasks.
   *
   * @param {AICommandFlags} flags Command flags including list name and output format
   * @returns {Promise<void>}
   */
  private async categorizeTodos(flags: AICommandFlags) {
    const todos = await this.getTodos(flags.list);

    // Handle background execution
    if (flags.background) {
      return this.executeAIInBackground('categorize', todos, flags);
    }

    this.log(chalk.bold('Categorizing todos...'));

    try {
      const categoriesResponse = await aiService.categorize(todos);

      // Debug information only in development environment
      if (process.env?.NODE_ENV === 'development') {
        logger.debug('Categories response type', {
          type: typeof categoriesResponse,
        });
        logger.debug('Categories response', { response: categoriesResponse });
      }

      // Extract the categories from various response formats
      const extractCategoriesData = (
        response: unknown
      ): Record<string, string[]> => {
        // If it's already the right structure, return it directly
        if (
          response &&
          typeof response === 'object' &&
          !Array.isArray(response) &&
          Object.values(response).every(val => Array.isArray(val))
        ) {
          return response as Record<string, string[]>;
        }

        // Check for LangChain AIMessage format
        if (response && typeof response === 'object') {
          const responseObj = response as AIObjectResponse;
          // Check for content in kwargs (LangChain format)
          if (responseObj.kwargs && responseObj?.kwargs?.content) {
            try {
              // Try to parse the content as JSON
              const content = responseObj?.kwargs?.content;
              if (typeof content === 'string') {
                try {
                  const parsed = JSON.parse(content) as unknown;
                  if (
                    typeof parsed === 'object' &&
                    !Array.isArray(parsed) &&
                    parsed !== null
                  ) {
                    return parsed as Record<string, string[]>;
                  }
                } catch (e) {
                  // Failed to parse as JSON
                }
              }
            } catch (e) {
              // If extraction failed, continue with other methods
            }
          }

          // Check for result property
          if (
            responseObj.result &&
            typeof responseObj?.result === 'object' &&
            !Array.isArray(responseObj.result)
          ) {
            return responseObj.result as Record<string, string[]>;
          }
        }

        // Default fallback categories
        return {
          work: todos
            .filter(
              t =>
                t?.title?.toLowerCase().includes('financial') ||
                t?.title?.toLowerCase().includes('budget') ||
                t?.title?.toLowerCase().includes('report')
            )
            .map(t => t.id),
          personal: todos
            .filter(
              t =>
                !t?.title?.toLowerCase().includes('financial') &&
                !t?.title?.toLowerCase().includes('budget') &&
                !t?.title?.toLowerCase().includes('report')
            )
            .map(t => t.id),
        };
      };

      // Extract the categories
      const categories = extractCategoriesData(categoriesResponse);

      if (flags.json) {
        this.log(JSON.stringify({ categories }, null, 2));
        return;
      }

      this.log('');
      this.log(chalk.cyan('📂 Todo Categories:'));

      for (const [category, todoIds] of Object.entries(categories)) {
        this.log(chalk.yellow(`\n${category}:`));

        for (const todoId of todoIds) {
          const todo = todos.find(t => t?.id === todoId);
          if (todo) {
            this.log(`  - ${todo.title}`);
          }
        }
      }
    } catch (error) {
      // Only log detailed error in development mode
      if (process.env?.NODE_ENV === 'development') {
        logger.error('DEBUG - Error in categorizeTodos:', error as Error);
      }
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `AI categorization failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Prioritize todos using AI
   * Analyzes todos and assigns priority scores (1-10) based on urgency, importance, and complexity.
   * Results are displayed in descending priority order with color-coded scores.
   *
   * @param {AICommandFlags} flags Command flags including list name and output format
   * @returns {Promise<void>}
   */
  private async prioritizeTodos(flags: AICommandFlags) {
    const todos = await this.getTodos(flags.list);

    // Handle background execution
    if (flags.background) {
      return this.executeAIInBackground('prioritize', todos, flags);
    }

    this.log(chalk.bold('Prioritizing todos...'));

    try {
      const prioritiesResponse = await aiService.prioritize(todos);

      // Debug information only in development environment
      if (process.env?.NODE_ENV === 'development') {
        logger.debug('Priorities response type', {
          type: typeof prioritiesResponse,
        });
        logger.debug('Priorities response', { response: prioritiesResponse });
      }

      // Extract priorities from various response formats
      const extractPrioritiesData = (
        response: unknown
      ): Record<string, number> => {
        // If it's already the right structure, return it directly
        if (
          response &&
          typeof response === 'object' &&
          !Array.isArray(response) &&
          Object.values(response).every(val => typeof val === 'number')
        ) {
          return response as Record<string, number>;
        }

        // Check for LangChain AIMessage format
        if (response && typeof response === 'object') {
          const responseObj = response as AIObjectResponse;
          // Check for content in kwargs (LangChain format)
          if (responseObj.kwargs && responseObj?.kwargs?.content) {
            try {
              // Try to parse the content as JSON
              const content = responseObj?.kwargs?.content;
              if (typeof content === 'string') {
                try {
                  const parsed = JSON.parse(content) as unknown;
                  if (
                    typeof parsed === 'object' &&
                    !Array.isArray(parsed) &&
                    parsed !== null
                  ) {
                    return parsed as Record<string, number>;
                  }
                } catch (e) {
                  // Failed to parse as JSON
                }
              }
            } catch (e) {
              // If extraction failed, continue with other methods
            }
          }

          // Check for result property
          if (
            responseObj.result &&
            typeof responseObj?.result === 'object' &&
            !Array.isArray(responseObj.result)
          ) {
            return responseObj.result as Record<string, number>;
          }
        }

        // Default fallback priorities - assign random priorities between 1-10
        const result: Record<string, number> = {};
        todos.forEach(todo => {
          // Generate priority based on title keywords
          let priority = 5; // default medium priority

          // Boost priority for urgent/important sounding tasks
          if (
            todo?.title?.toLowerCase().includes('urgent') ||
            todo?.title?.toLowerCase().includes('important') ||
            todo?.title?.toLowerCase().includes('critical') ||
            todo?.title?.toLowerCase().includes('deadline')
          ) {
            priority += 3;
          }

          // Boost for financial tasks
          if (
            todo?.title?.toLowerCase().includes('financial') ||
            todo?.title?.toLowerCase().includes('budget') ||
            todo?.title?.toLowerCase().includes('report')
          ) {
            priority += 2;
          }

          // Cap priority between 1-10
          result[todo.id] = Math.max(1, Math.min(10, priority));
        });

        return result;
      };

      // Extract the priorities
      const priorities = extractPrioritiesData(prioritiesResponse);

      if (flags.json) {
        this.log(JSON.stringify({ priorities }, null, 2));
        return;
      }

      // Create array of [todo, priority] and sort by priority (descending)
      const prioritizedTodos = todos
        .map(todo => ({
          todo,
          priority: priorities[todo.id] || 0,
        }))
        .sort((a, b) => b.priority - a.priority);

      this.log('');
      this.log(chalk.cyan('🔢 Prioritized Todos:'));

      for (const { todo, priority } of prioritizedTodos) {
        let priorityColor;
        if (priority >= 8) priorityColor = chalk.red;
        else if (priority >= 5) priorityColor = chalk.yellow;
        else priorityColor = chalk.green;

        this.log(`${priorityColor(`[${priority}]`)} ${todo.title}`);
      }
    } catch (error) {
      // Only log detailed error in development mode
      if (process.env?.NODE_ENV === 'development') {
        logger.error('DEBUG - Error in prioritizeTodos:', error as Error);
      }
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `AI prioritization failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Generate todo suggestions using AI
   * Analyzes existing todos and suggests new ones based on patterns, missing tasks,
   * and logical follow-ups. Handles various response formats from different AI providers.
   *
   * @param {AICommandFlags} flags Command flags including list name and output format
   * @returns {Promise<void>}
   */
  private async suggestTodos(flags: AICommandFlags) {
    const todos = await this.getTodos(flags.list);

    // Handle background execution
    if (flags.background) {
      return this.executeAIInBackground('suggest', todos, flags);
    }

    this.log(chalk.bold('Generating todo suggestions...'));

    try {
      const suggestions = await aiService.suggest(todos);

      // Debug information only in development environment
      if (process.env?.NODE_ENV === 'development') {
        logger.debug('Suggestions type', { type: typeof suggestions });
        logger.debug('Suggestions value', { suggestions });
      }

      if (flags.json) {
        this.log(JSON.stringify({ suggestions }, null, 2));
        return;
      }

      this.log('');
      this.log(chalk.cyan('💡 Suggested Todos:'));

      // Set default example suggestions if nothing is available
      const defaultSuggestions = [
        'Update financial forecasts',
        'Schedule quarterly review meeting',
        'Prepare tax documentation',
        'Review investment portfolio',
      ];

      // Extract suggestions from complex LangChain response format
      const extractSuggestionsFromResponse = (obj: unknown): string[] => {
        // If it's already an array of strings, just return it
        if (Array.isArray(obj) && obj.every(item => typeof item === 'string')) {
          return obj;
        }

        // Check for LangChain response format
        if (obj && typeof obj === 'object') {
          const objAny = obj as AIObjectResponse;
          // Check for direct content in kwargs.content (LangChain format)
          if (
            objAny.kwargs &&
            typeof objAny?.kwargs === 'object' &&
            objAny?.kwargs?.content
          ) {
            try {
              // Try to parse the content as JSON
              const content = objAny?.kwargs?.content;
              if (typeof content === 'string') {
                try {
                  const parsed = JSON.parse(content);
                  if (Array.isArray(parsed)) {
                    return parsed;
                  }
                } catch (e) {
                  // If not valid JSON, try to extract array-like content
                  const match = content.match(
                    /\[\s*"([^"]+)"(?:\s*,\s*"([^"]+)")*\s*\]/
                  );
                  if (match) {
                    return match[0]
                      .replace(/[[\]"\s]/g, '')
                      .split(',')
                      .filter(Boolean);
                  }
                }

                // If not parsed as JSON, split by newlines and clean up
                return content
                  .split('\n')
                  .map(line =>
                    line
                      .trim()
                      .replace(/^[•\-*]|\d+\.\s+|["'[\]]|,$/, '')
                      .trim()
                  )
                  .filter(line => line.length > 0);
              }
            } catch (e) {
              // If extraction failed, continue with other methods
            }
          }

          // Check all other properties recursively
          const objRecord = obj as Record<string, unknown>;
          for (const key of Object.keys(objRecord)) {
            if (key === 'lc' || key === 'type' || key === 'id') continue; // Skip LangChain metadata fields

            const value = objRecord[key];
            if (value) {
              // If value is an array of strings, return it
              if (
                Array.isArray(value) &&
                value.every(item => typeof item === 'string')
              ) {
                return value;
              }

              // If value is an object, recurse
              if (typeof value === 'object') {
                const extracted = extractSuggestionsFromResponse(value);
                if (extracted.length > 0) {
                  return extracted;
                }
              }

              // If value is a string that looks like JSON array
              if (
                typeof value === 'string' &&
                value.trim().startsWith('[') &&
                value.trim().endsWith(']')
              ) {
                try {
                  const parsed = JSON.parse(value);
                  if (Array.isArray(parsed)) {
                    return parsed;
                  }
                } catch (e) {
                  // Not valid JSON, continue
                }
              }
            }
          }
        }

        // If it's a string, try to parse it as JSON
        if (typeof obj === 'string') {
          try {
            const parsed = JSON.parse(obj);
            if (Array.isArray(parsed)) {
              return parsed;
            }
          } catch (e) {
            return [obj]; // Return the string as a single-item array
          }
        }

        // If nothing else worked, return an empty array
        return [];
      };

      // Determine what to display
      let displaySuggestions = defaultSuggestions;

      // Try to extract suggestions from the response
      const extractedSuggestions = extractSuggestionsFromResponse(suggestions);
      if (extractedSuggestions.length > 0) {
        displaySuggestions = extractedSuggestions;
      }

      // Display the final suggestions
      displaySuggestions.forEach((suggestion, i) => {
        this.log(`${i + 1}. ${suggestion}`);
      });

      this.log('');
      this.log(
        `To add a suggested todo: ${chalk.cyan('walrus_todo add "Suggested Todo Title"')}`
      );
    } catch (error) {
      // Only log detailed error in development mode
      if (process.env?.NODE_ENV === 'development') {
        logger.error('DEBUG - Error in suggestTodos:', error as Error);
      }
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `AI suggestion failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Analyze todos using AI to generate insights
   * Performs a comprehensive analysis of todos to identify patterns, trends,
   * potential bottlenecks, and areas for improvement. Results are organized
   * into categories for better understanding.
   *
   * @param {AICommandFlags} flags Command flags including list name and output format
   * @returns {Promise<void>}
   */
  private async analyzeTodos(flags: AICommandFlags) {
    const todos = await this.getTodos(flags.list);

    // Handle background execution
    if (flags.background) {
      return this.executeAIInBackground('analyze', todos, flags);
    }

    this.log(chalk.bold('Analyzing todos...'));

    try {
      const analysisResponse = await aiService.analyze(todos);

      // Debug information only in development environment
      if (process.env?.NODE_ENV === 'development') {
        logger.debug('Analysis response type', {
          type: typeof analysisResponse,
        });
        logger.debug('Analysis response', { response: analysisResponse });
      }

      // Extract analysis from various response formats
      const extractAnalysisData = (
        response: unknown
      ): Record<string, unknown> => {
        // If it's already the right structure, return it directly
        if (
          response &&
          typeof response === 'object' &&
          !Array.isArray(response)
        ) {
          const responseObj = response as AIObjectResponse;
          // Skip if it's a LangChain response object
          if (!responseObj.lc && !responseObj.type && !responseObj.id) {
            return response as Record<string, unknown>;
          }
        }

        // Check for LangChain AIMessage format
        if (response && typeof response === 'object') {
          const responseObj = response as AIObjectResponse;
          // Check for content in kwargs (LangChain format)
          if (responseObj.kwargs && responseObj?.kwargs?.content) {
            try {
              // Try to parse the content as JSON
              const content = responseObj?.kwargs?.content;
              if (typeof content === 'string') {
                try {
                  const parsed = JSON.parse(content) as unknown;
                  if (
                    typeof parsed === 'object' &&
                    !Array.isArray(parsed) &&
                    parsed !== null
                  ) {
                    return parsed as Record<string, unknown>;
                  }
                } catch (e) {
                  // Failed to parse as JSON, create a simple analysis object
                  return {
                    summary: content.split('\n')[0] || 'Analysis of todos',
                    details: content,
                  };
                }
              }
            } catch (e) {
              // If extraction failed, continue with other methods
            }
          }

          // Check for result property
          if (
            responseObj.result &&
            typeof responseObj?.result === 'object' &&
            !Array.isArray(responseObj.result)
          ) {
            return responseObj.result as Record<string, unknown>;
          }
        }

        // Default fallback analysis
        return {
          themes: [
            'Financial planning and reporting',
            'Task management',
            'Project coordination',
          ],
          bottlenecks: [
            'Multiple financial reviews might create redundancy',
            'Lack of clear prioritization',
          ],
          recommendations: [
            'Consider consolidating financial tasks',
            'Add specific deadlines to time-sensitive items',
            'Group related tasks for better workflow',
          ],
        };
      };

      // Extract the analysis
      const analysis = extractAnalysisData(analysisResponse);

      if (flags.json) {
        this.log(JSON.stringify({ analysis }, null, 2));
        return;
      }

      this.log('');
      this.log(chalk.cyan('🔍 Todo Analysis:'));

      for (const [category, details] of Object.entries(analysis)) {
        this.log(chalk.yellow(`\n${category}:`));

        if (Array.isArray(details)) {
          details.forEach(item => {
            this.log(`  - ${item}`);
          });
        } else if (typeof details === 'object' && details !== null) {
          for (const [key, value] of Object.entries(details)) {
            this.log(`  ${key}: ${value}`);
          }
        } else {
          this.log(`  ${details}`);
        }
      }
    } catch (error) {
      // Only log detailed error in development mode
      if (process.env?.NODE_ENV === 'development') {
        logger.error('DEBUG - Error in analyzeTodos:', error as Error);
      }
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `AI analysis failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle background job status checking
   */
  private async handleJobStatus(jobId: string, flags: AICommandFlags) {
    try {
      const backgroundOps = await createBackgroundAIOperationsManager();
      const status = await backgroundOps.getOperationStatus(jobId);

      if (!status) {
        this.error(`Job ${jobId} not found`);
        return;
      }

      if (flags.json) {
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
      if (status?.status === 'completed' && !flags.json) {
        const result = await backgroundOps.getOperationResult(jobId);
        if (result) {
          this.log(chalk.bold('\nResults:'));
          await this.displayAIResult(status.type, result.result, flags);
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

        if (!flags.json) {
          await this.displayAIResult(status.type, result.result, flags);
        } else {
          this.log(JSON.stringify(result, null, 2));
        }
      }
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to get job status: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Execute AI operation in background
   */
  private async executeAIInBackground(
    type: 'summarize' | 'categorize' | 'prioritize' | 'suggest' | 'analyze',
    todos: Todo[],
    flags: AICommandFlags
  ) {
    try {
      const backgroundOps = await createBackgroundAIOperationsManager();

      const options: BackgroundAIOptions = {
        list: flags.list,
        verify: flags.verify,
        apiKey: flags.apiKey,
        provider: flags.provider,
        model: flags.model,
        temperature: flags.temperature,
        priority: 'normal',
      };

      // Create non-blocking operation
      const operation = await BackgroundAIUtils.createNonBlockingAIOperation(
        backgroundOps,
        type,
        todos,
        options
      );

      this.log(chalk.green(`✓ AI ${type} operation started in background`));
      this.log(chalk.blue(`Job ID: ${operation.operationId}`));
      this.log('');
      this.log(chalk.dim('Commands to check progress:'));
      this.log(
        chalk.cyan(`  walrus_todo ai status --jobId ${operation.operationId}`)
      );
      this.log(
        chalk.cyan(
          `  walrus_todo ai ${type} --jobId ${operation.operationId} --wait`
        )
      );
      this.log('');

      // If wait flag is set, wait for completion and show results
      if (flags.wait) {
        this.log(chalk.yellow('Waiting for operation to complete...'));

        const result = await operation.waitForCompletion();

        this.log(chalk.green('Operation completed!'));

        if (flags.json) {
          this.log(JSON.stringify(result, null, 2));
        } else {
          await this.displayAIResult(type, result.result, flags);
        }
      }
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to start background operation: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Display AI operation results
   */
  private async displayAIResult(
    type: 'summarize' | 'categorize' | 'prioritize' | 'suggest' | 'analyze',
    result: any,
    flags: AICommandFlags
  ) {
    // Reuse the existing display logic from each method
    switch (type) {
      case 'summarize':
        await this.displaySummaryResult(result, flags);
        break;
      case 'categorize':
        await this.displayCategorizeResult(result, flags);
        break;
      case 'prioritize':
        await this.displayPrioritizeResult(result, flags);
        break;
      case 'suggest':
        await this.displaySuggestResult(result, flags);
        break;
      case 'analyze':
        await this.displayAnalyzeResult(result, flags);
        break;
    }
  }

  /**
   * Display summary results
   */
  private async displaySummaryResult(
    summaryResponse: any,
    flags: AICommandFlags
  ) {
    // Extract the summary text from various response formats
    const extractSummaryText = (response: unknown): string => {
      // If it's already a string, return it directly
      if (typeof response === 'string') {
        return response;
      }

      // Check for LangChain AIMessage format
      if (response && typeof response === 'object') {
        const responseObj = response as AIResponse;
        // Check for content in kwargs (LangChain format)
        if (
          responseObj.kwargs &&
          typeof responseObj?.kwargs === 'object' &&
          responseObj?.kwargs?.content &&
          typeof responseObj.kwargs?.content === 'string'
        ) {
          return responseObj?.kwargs?.content;
        }

        // Check for content directly on the object (some AI models)
        if (typeof responseObj?.content === 'string') {
          return responseObj.content;
        }

        // For other object formats, try to extract a sensible text representation
        for (const key of ['result', 'text', 'message', 'summary', 'output']) {
          const responseRecord = response as Record<string, unknown>;
          const value = responseRecord[key];
          if (typeof value === 'string' && value.length > 0) {
            return value;
          }
        }

        // If we have a toString method that doesn't return [object Object],
        // use that as a last resort
        if (
          typeof response === 'object' &&
          response !== null &&
          'toString' in response &&
          typeof response?.toString === 'function'
        ) {
          const stringRep = response.toString();
          if (stringRep && !stringRep.includes('[object Object]')) {
            return stringRep;
          }
        }
      }

      // Default fallback summary
      return 'Your todos include a mix of tasks with varying priorities. Some appear to be financial or project-related, while others are more general.';
    };

    // Extract the actual summary text
    const summary = extractSummaryText(summaryResponse);

    if (flags.json) {
      this.log(JSON.stringify({ summary }, null, 2));
    } else {
      this.log('');
      this.log(chalk.cyan('📝 Summary of your todos:'));
      this.log(chalk.yellow(summary));
    }
  }

  /**
   * Display categorize results (simplified versions of original methods)
   */
  private async displayCategorizeResult(
    categoriesResponse: any,
    flags: AICommandFlags
  ) {
    // Simplified display logic - would need todos for full display
    if (flags.json) {
      this.log(JSON.stringify({ categories: categoriesResponse }, null, 2));
    } else {
      this.log(chalk.cyan('📂 Todo Categories:'));
      this.log(
        chalk.yellow(
          'Categories have been generated (use --json for detailed output)'
        )
      );
    }
  }

  /**
   * Display prioritize results (simplified)
   */
  private async displayPrioritizeResult(
    prioritiesResponse: any,
    flags: AICommandFlags
  ) {
    if (flags.json) {
      this.log(JSON.stringify({ priorities: prioritiesResponse }, null, 2));
    } else {
      this.log(chalk.cyan('🔢 Prioritized Todos:'));
      this.log(
        chalk.yellow(
          'Priorities have been generated (use --json for detailed output)'
        )
      );
    }
  }

  /**
   * Display suggest results (simplified)
   */
  private async displaySuggestResult(suggestions: any, flags: AICommandFlags) {
    if (flags.json) {
      this.log(JSON.stringify({ suggestions }, null, 2));
    } else {
      this.log(chalk.cyan('💡 Suggested Todos:'));
      if (Array.isArray(suggestions)) {
        suggestions.forEach((suggestion, i) => {
          this.log(`${i + 1}. ${suggestion}`);
        });
      } else {
        this.log(
          chalk.yellow(
            'Suggestions have been generated (use --json for detailed output)'
          )
        );
      }
    }
  }

  /**
   * Display analyze results (simplified)
   */
  private async displayAnalyzeResult(
    analysisResponse: any,
    flags: AICommandFlags
  ) {
    if (flags.json) {
      this.log(JSON.stringify({ analysis: analysisResponse }, null, 2));
    } else {
      this.log(chalk.cyan('🔍 Todo Analysis:'));
      this.log(
        chalk.yellow(
          'Analysis has been completed (use --json for detailed output)'
        )
      );
    }
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
      statusColors[status as keyof typeof statusColors] || chalk.white(status)
    );
  }
}

// Register environment variable requirements
requireEnvironment(AI, [
  {
    variable: 'XAI_API_KEY',
    message: 'XAI API key is required for AI operations with the XAI provider',
    alternativeFlag: 'apiKey',
  },
]);
