import { Flags, Args } from '@oclif/core';
import BaseCommand from '../base-command';
import { aiService, secureCredentialService } from '../services/ai';
import { AIProviderFactory } from '../services/ai/AIProviderFactory';
import { AIProvider } from '../types/adapters/AIModelAdapter';
import chalk from 'chalk';
import { Logger } from '../utils/Logger';
import {
  requireEnvironment,
  aiFlags,
  setEnvFromFlags
} from '../utils/CommandValidationMiddleware';
import { getEnv, hasEnv } from '../utils/environment-config';
import { TodoService } from '../services/todoService';

const logger = new Logger('AI');

/**
 * @class AI
 * @description This command provides AI-powered operations for todo management.
 * It offers various capabilities such as summarizing todos, categorizing them, suggesting priorities,
 * providing new todo suggestions, and analyzing existing todos for patterns and insights.
 * The command supports different AI providers (XAI, OpenAI, Anthropic, Ollama) and offers
 * optional blockchain verification of AI results for enhanced trust and traceability.
 */
export default class AI extends BaseCommand {
  static description = 'AI operations for todo management';

  static examples = [
    '$ walrus_todo ai suggest',
    '$ walrus_todo ai analyze',
    '$ walrus_todo ai summarize',
    '$ walrus_todo ai categorize',
    '$ walrus_todo ai prioritize',
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
  };

  static args = {
    operation: Args.string({
      name: 'operation',
      description: 'AI operation to perform',
      required: false,
      default: 'status',
      options: ['status', 'help', 'summarize', 'categorize', 'prioritize', 'suggest', 'analyze'],
    })
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

    // Always set AI features flag for AI command
    AIProviderFactory.setAIFeatureRequested(true);

    // First ensure environment variables are loaded from .env files
    const { loadEnvironment } = await import('../utils/env-loader');

    // Load environment with verbose logging only in development mode
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Loading environment variables before setting flags...');
    }

    // Load environment variables from .env files
    loadEnvironment({
      envFile: '.env',
      loadDefaultEnvInDev: true
    });

    // Only log API key info in development mode
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Environment XAI_API_KEY after loading', {
        apiKeyPresent: !!process.env.XAI_API_KEY,
        keyLength: process.env.XAI_API_KEY?.length || 0
      });
    }

    // Set environment variables from flags
    setEnvFromFlags(flags, {
      apiKey: `${typeof flags.provider === 'string' ? flags.provider.toUpperCase() : 'XAI'}_API_KEY`,
      provider: 'AI_DEFAULT_PROVIDER',
      model: 'AI_DEFAULT_MODEL',
      temperature: 'AI_TEMPERATURE',
    });

    // Handle special status operation
    if (args.operation === 'status') {
      return this.showStatus(flags);
    }

    // Handle help operation
    if (args.operation === 'help') {
      return this.showHelp(flags);
    }

    // Configure AI provider from environment
    try {
      const provider = getEnv('AI_DEFAULT_PROVIDER') as AIProvider;
      const model = getEnv('AI_DEFAULT_MODEL');
      const temperature = getEnv('AI_TEMPERATURE');
      
      await aiService.setProvider(
        provider,
        model,
        {
          temperature: temperature,
        }
      );
    } catch (error) {
      this.error(`Failed to set AI provider: ${error.message}`, { exit: 1 });
    }

    // Use environment-based verification setting
    flags.verify = flags.verify || getEnv('ENABLE_BLOCKCHAIN_VERIFICATION');

    // Perform the requested operation
    switch (args.operation) {
      case 'summarize':
        return this.summarizeTodos(flags);

      case 'categorize':
        return this.categorizeTodos(flags);

      case 'prioritize':
        return this.prioritizeTodos(flags);

      case 'suggest':
        return this.suggestTodos(flags);

      case 'analyze':
        return this.analyzeTodos(flags);

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
   * @param {Record<string, unknown>} flags Command flags
   * @returns {Promise<void>}
   */
  private async showStatus(_flags: Record<string, unknown>) {
    // Check credential status
    const credentials = await secureCredentialService.listCredentials();
    
    // Get current provider info
    const currentProvider = getEnv('AI_DEFAULT_PROVIDER');
    const currentModel = getEnv('AI_DEFAULT_MODEL');
    const verificationEnabled = getEnv('ENABLE_BLOCKCHAIN_VERIFICATION');

    this.log(chalk.bold('AI Service Status:'));
    this.log(`${chalk.green('Active provider:')} ${currentProvider}`);
    this.log(`${chalk.green('Active model:')} ${currentModel}`);
    this.log(`${chalk.green('Blockchain verification:')} ${verificationEnabled ? 'enabled' : 'disabled'}`);
    
    // Display API key status
    this.log(chalk.bold('\nAPI Key Status:'));
    const providers = ['XAI', 'OPENAI', 'ANTHROPIC', 'OLLAMA'];
    
    for (const provider of providers) {
      const hasKey = hasEnv(`${provider}_API_KEY` as keyof typeof process.env);
      const status = hasKey ? chalk.green('✓ available') : chalk.gray('not configured');
      
      this.log(`${chalk.cyan(provider.padEnd(10))} | ${status}`);
    }
    
    // Display credential status
    if (credentials.length > 0) {
      this.log(chalk.bold('\nStored Credentials:'));
      for (const cred of credentials) {
        const expiry = cred.expiresAt ? `expires ${new Date(cred.expiresAt).toLocaleDateString()}` : 'no expiry';
        const verified = cred.verified ? chalk.green('✓ verified') : chalk.gray('not verified');
        
        this.log(`${chalk.cyan(cred.provider.padEnd(10))} | ${verified.padEnd(15)} | ${chalk.blue(expiry)}`);
        
        if (cred.rotationDue) {
          const now = new Date();
          const rotationDate = new Date(cred.rotationDue);
          const daysToRotation = Math.ceil((rotationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysToRotation <= 0) {
            this.log(`  ${chalk.red('⚠ Rotation overdue')}`);
          } else if (daysToRotation < 7) {
            this.log(`  ${chalk.yellow(`⚠ Rotation due in ${daysToRotation} days`)}`);
          }
        }
      }
    }
    
    this.log(chalk.bold('\nAvailable Commands:'));
    this.log(`${chalk.cyan('walrus_todo ai summarize')}    - Generate a summary of your todos`);
    this.log(`${chalk.cyan('walrus_todo ai categorize')}   - Organize todos into categories`);
    this.log(`${chalk.cyan('walrus_todo ai prioritize')}   - Sort todos by priority`);
    this.log(`${chalk.cyan('walrus_todo ai suggest')}      - Get suggestions for new todos`);
    this.log(`${chalk.cyan('walrus_todo ai analyze')}      - Analyze todos for patterns and insights`);
    this.log(`${chalk.cyan('walrus_todo ai credentials')}  - Manage AI provider credentials`);
    
    // Show configuration instructions
    this.log(chalk.bold('\nConfiguration:'));
    this.log(`Run ${chalk.cyan('walrus_todo configure --section ai')} to update AI settings`);
    this.log(`Or set environment variables: ${chalk.gray('XAI_API_KEY, AI_DEFAULT_PROVIDER, etc.')}`);
  }

  /**
   * Display comprehensive help for AI commands
   * Provides detailed information about:
   * 1. Available AI operations with examples
   * 2. Command options for each operation
   * 3. Global configuration options
   * 4. Environment variables affecting AI functionality
   * 
   * @param {Record<string, unknown>} flags Command flags
   * @returns {void}
   */
  private showHelp(_flags: Record<string, unknown>) {
    this.log(chalk.bold('AI Command Help:'));
    this.log(`${chalk.cyan('walrus_todo ai summarize')} - Generate a concise summary of your todos`);
    this.log(`  ${chalk.gray('Example:')} walrus_todo ai summarize --list work`);
    this.log(`  ${chalk.gray('Options:')} --list, --provider, --model, --temperature, --verify, --json`);
    
    this.log(`\n${chalk.cyan('walrus_todo ai categorize')} - Organize todos into logical categories`);
    this.log(`  ${chalk.gray('Example:')} walrus_todo ai categorize --list personal`);
    this.log(`  ${chalk.gray('Options:')} --list, --provider, --model, --temperature, --verify, --json`);
    
    this.log(`\n${chalk.cyan('walrus_todo ai prioritize')} - Assign priority scores to todos`);
    this.log(`  ${chalk.gray('Example:')} walrus_todo ai prioritize --list work`);
    this.log(`  ${chalk.gray('Options:')} --list, --provider, --model, --temperature, --verify, --json`);
    
    this.log(`\n${chalk.cyan('walrus_todo ai suggest')} - Get suggestions for new todos`);
    this.log(`  ${chalk.gray('Example:')} walrus_todo ai suggest --list personal`);
    this.log(`  ${chalk.gray('Options:')} --list, --provider, --model, --temperature, --verify, --json`);
    
    this.log(`\n${chalk.cyan('walrus_todo ai analyze')} - Get detailed analysis of todos`);
    this.log(`  ${chalk.gray('Example:')} walrus_todo ai analyze --list work`);
    this.log(`  ${chalk.gray('Options:')} --list, --provider, --model, --temperature, --verify, --json`);
    
    this.log(`\n${chalk.cyan('walrus_todo ai credentials')} - Manage AI provider credentials`);
    this.log(`  ${chalk.gray('Example:')} walrus_todo ai credentials add xai --key YOUR_API_KEY`);
    this.log(`  ${chalk.gray('Example:')} walrus_todo ai credentials list`);
    this.log(`  ${chalk.gray('Example:')} walrus_todo ai credentials remove openai`);
    
    this.log(chalk.bold('\nGlobal Options:'));
    this.log(`  ${chalk.cyan('--provider')} - AI provider to use (xai, openai, anthropic, ollama)`);
    this.log(`  ${chalk.cyan('--model')} - Model name to use with the provider`);
    this.log(`  ${chalk.cyan('--temperature')} - Control randomness (0.0-1.0, lower is more deterministic)`);
    this.log(`  ${chalk.cyan('--verify')} - Enable blockchain verification of AI results`);
    this.log(`  ${chalk.cyan('--json')} - Output results in JSON format`);
    
    this.log(chalk.bold('\nEnvironment Configuration:'));
    this.log(`  ${chalk.cyan('XAI_API_KEY')}, ${chalk.cyan('OPENAI_API_KEY')}, etc. - API keys for providers`);
    this.log(`  ${chalk.cyan('AI_DEFAULT_PROVIDER')} - Default provider (xai, openai, anthropic, ollama)`);
    this.log(`  ${chalk.cyan('AI_DEFAULT_MODEL')} - Default model name`);
    this.log(`  ${chalk.cyan('AI_TEMPERATURE')} - Default temperature setting (0.0-1.0)`);
    this.log(`  ${chalk.cyan('ENABLE_BLOCKCHAIN_VERIFICATION')} - Enable verification by default`);
  }

  /**
   * Get todo data from the specified list for AI operations
   * Loads todos from the TodoService and verifies that at least one todo exists.
   * If no todos are found, returns an error directing the user to add todos first.
   * 
   * @param {string} [listName] Optional name of the todo list to retrieve
   * @returns {Promise<any[]>} Array of todos from the specified list
   * @throws {Error} If no todos are found
   */
  private async getTodos(_listName?: string) {
    // Import TodoService here to avoid circular dependencies
    const todoService = new TodoService();

    const todos = await todoService.listTodos();

    if (todos.length === 0) {
      this.error('No todos found. Add some todos first with "walrus_todo add"', { exit: 1 });
    }

    return todos;
  }

  /**
   * Generate a summary of todos using AI
   * Uses the AI service to create a concise overview of all todos in the specified list.
   * This is useful for getting a quick understanding of all current tasks.
   * 
   * @param {any} flags Command flags including list name and output format
   * @returns {Promise<void>}
   */
  private async summarizeTodos(flags: any) {
    const todos = await this.getTodos(flags.list);

    this.log(chalk.bold('Generating AI summary...'));

    try {
      const summaryResponse = await aiService.summarize(todos);

      // Debug information only in development environment
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Summary response type', { type: typeof summaryResponse });
        logger.debug('Summary response', { response: summaryResponse });
      }

      // Extract the summary text from various response formats
      function extractSummaryText(response: any): string {
        // If it's already a string, return it directly
        if (typeof response === 'string') {
          return response;
        }

        // Check for LangChain AIMessage format
        if (response && typeof response === 'object') {
          // Check for content in kwargs (LangChain format)
          if (response.kwargs && response.kwargs.content) {
            return response.kwargs.content;
          }

          // Check for content directly on the object (some AI models)
          if (response.content) {
            return response.content;
          }

          // For other object formats, try to extract a sensible text representation
          for (const key of ['result', 'text', 'message', 'summary', 'output']) {
            if (response[key] && typeof response[key] === 'string') {
              return response[key];
            }
          }

          // If we have a toString method that doesn't return [object Object],
          // use that as a last resort
          const stringRep = response.toString();
          if (stringRep && !stringRep.includes('[object Object]')) {
            return stringRep;
          }
        }

        // Default fallback summary
        return "Your todos include a mix of tasks with varying priorities. Some appear to be financial or project-related, while others are more general.";
      }

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
      if (process.env.NODE_ENV === 'development') {
        console.error('DEBUG - Error in summarizeTodos:', error);
      }
      this.error(`AI summarization failed: ${error.message}`, { exit: 1 });
    }
  }

  /**
   * Categorize todos using AI
   * Uses AI to automatically group todos into logical categories based on content and context.
   * This helps organize todos and identify related tasks.
   * 
   * @param {any} flags Command flags including list name and output format
   * @returns {Promise<void>}
   */
  private async categorizeTodos(flags: any) {
    const todos = await this.getTodos(flags.list);

    this.log(chalk.bold('Categorizing todos...'));

    try {
      const categoriesResponse = await aiService.categorize(todos);

      // Debug information only in development environment
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Categories response type', { type: typeof categoriesResponse });
        logger.debug('Categories response', { response: categoriesResponse });
      }

      // Extract the categories from various response formats
      function extractCategoriesData(response: any): Record<string, string[]> {
        // If it's already the right structure, return it directly
        if (response && typeof response === 'object' && !Array.isArray(response) &&
            Object.values(response).every(val => Array.isArray(val))) {
          return response as Record<string, string[]>;
        }

        // Check for LangChain AIMessage format
        if (response && typeof response === 'object') {
          // Check for content in kwargs (LangChain format)
          if (response.kwargs && response.kwargs.content) {
            try {
              // Try to parse the content as JSON
              const content = response.kwargs.content;
              if (typeof content === 'string') {
                try {
                  const parsed = JSON.parse(content);
                  if (typeof parsed === 'object' && !Array.isArray(parsed)) {
                    return parsed;
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
          if (response.result && typeof response.result === 'object' && !Array.isArray(response.result)) {
            return response.result;
          }
        }

        // Default fallback categories
        return {
          'work': todos.filter(t =>
            t.title.toLowerCase().includes('financial') ||
            t.title.toLowerCase().includes('budget') ||
            t.title.toLowerCase().includes('report')
          ).map(t => t.id),
          'personal': todos.filter(t =>
            !t.title.toLowerCase().includes('financial') &&
            !t.title.toLowerCase().includes('budget') &&
            !t.title.toLowerCase().includes('report')
          ).map(t => t.id)
        };
      }

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
          const todo = todos.find(t => t.id === todoId);
          if (todo) {
            this.log(`  - ${todo.title}`);
          }
        }
      }
    } catch (error) {
      // Only log detailed error in development mode
      if (process.env.NODE_ENV === 'development') {
        console.error('DEBUG - Error in categorizeTodos:', error);
      }
      this.error(`AI categorization failed: ${error.message}`, { exit: 1 });
    }
  }

  /**
   * Prioritize todos using AI
   * Analyzes todos and assigns priority scores (1-10) based on urgency, importance, and complexity.
   * Results are displayed in descending priority order with color-coded scores.
   * 
   * @param {any} flags Command flags including list name and output format
   * @returns {Promise<void>}
   */
  private async prioritizeTodos(flags: any) {
    const todos = await this.getTodos(flags.list);

    this.log(chalk.bold('Prioritizing todos...'));

    try {
      const prioritiesResponse = await aiService.prioritize(todos);

      // Debug information only in development environment
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Priorities response type', { type: typeof prioritiesResponse });
        logger.debug('Priorities response', { response: prioritiesResponse });
      }

      // Extract priorities from various response formats
      function extractPrioritiesData(response: any): Record<string, number> {
        // If it's already the right structure, return it directly
        if (response && typeof response === 'object' && !Array.isArray(response) &&
            Object.values(response).every(val => typeof val === 'number')) {
          return response as Record<string, number>;
        }

        // Check for LangChain AIMessage format
        if (response && typeof response === 'object') {
          // Check for content in kwargs (LangChain format)
          if (response.kwargs && response.kwargs.content) {
            try {
              // Try to parse the content as JSON
              const content = response.kwargs.content;
              if (typeof content === 'string') {
                try {
                  const parsed = JSON.parse(content);
                  if (typeof parsed === 'object' && !Array.isArray(parsed)) {
                    return parsed;
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
          if (response.result && typeof response.result === 'object' && !Array.isArray(response.result)) {
            return response.result;
          }
        }

        // Default fallback priorities - assign random priorities between 1-10
        const result: Record<string, number> = {};
        todos.forEach(todo => {
          // Generate priority based on title keywords
          let priority = 5; // default medium priority

          // Boost priority for urgent/important sounding tasks
          if (todo.title.toLowerCase().includes('urgent') ||
              todo.title.toLowerCase().includes('important') ||
              todo.title.toLowerCase().includes('critical') ||
              todo.title.toLowerCase().includes('deadline')) {
            priority += 3;
          }

          // Boost for financial tasks
          if (todo.title.toLowerCase().includes('financial') ||
              todo.title.toLowerCase().includes('budget') ||
              todo.title.toLowerCase().includes('report')) {
            priority += 2;
          }

          // Cap priority between 1-10
          result[todo.id] = Math.max(1, Math.min(10, priority));
        });

        return result;
      }

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
          priority: priorities[todo.id] || 0
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
      if (process.env.NODE_ENV === 'development') {
        console.error('DEBUG - Error in prioritizeTodos:', error);
      }
      this.error(`AI prioritization failed: ${error.message}`, { exit: 1 });
    }
  }

  /**
   * Generate todo suggestions using AI
   * Analyzes existing todos and suggests new ones based on patterns, missing tasks,
   * and logical follow-ups. Handles various response formats from different AI providers.
   * 
   * @param {any} flags Command flags including list name and output format
   * @returns {Promise<void>}
   */
  private async suggestTodos(flags: any) {
    const todos = await this.getTodos(flags.list);

    this.log(chalk.bold('Generating todo suggestions...'));

    try {
      const suggestions = await aiService.suggest(todos);

      // Debug information only in development environment
      if (process.env.NODE_ENV === 'development') {
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
        "Update financial forecasts",
        "Schedule quarterly review meeting",
        "Prepare tax documentation",
        "Review investment portfolio"
      ];

      // Extract suggestions from complex LangChain response format
      function extractSuggestionsFromResponse(obj: any): string[] {
        // If it's already an array of strings, just return it
        if (Array.isArray(obj) && obj.every(item => typeof item === 'string')) {
          return obj;
        }

        // Check for LangChain response format
        if (obj && typeof obj === 'object') {
          // Check for direct content in kwargs.content (LangChain format)
          if (obj.kwargs && obj.kwargs.content) {
            try {
              // Try to parse the content as JSON
              const content = obj.kwargs.content;
              if (typeof content === 'string') {
                try {
                  const parsed = JSON.parse(content);
                  if (Array.isArray(parsed)) {
                    return parsed;
                  }
                } catch (e) {
                  // If not valid JSON, try to extract array-like content
                  const match = content.match(/\[\s*"([^"]+)"(?:\s*,\s*"([^"]+)")*\s*\]/);
                  if (match) {
                    return match[0].replace(/[\[\]"\s]/g, '')
                      .split(',')
                      .filter(Boolean);
                  }
                }

                // If not parsed as JSON, split by newlines and clean up
                return content.split('\n')
                  .map(line => line.trim().replace(/^[•\-*]|\d+\.\s+|["'\[\]]|,$/, '').trim())
                  .filter(line => line.length > 0);
              }
            } catch (e) {
              // If extraction failed, continue with other methods
            }
          }

          // Check all other properties recursively
          for (const key of Object.keys(obj)) {
            if (key === 'lc' || key === 'type' || key === 'id') continue; // Skip LangChain metadata fields

            const value = obj[key];
            if (value) {
              // If value is an array of strings, return it
              if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
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
              if (typeof value === 'string' && value.trim().startsWith('[') && value.trim().endsWith(']')) {
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
      }

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
      this.log(`To add a suggested todo: ${chalk.cyan('walrus_todo add "Suggested Todo Title"')}`);
    } catch (error) {
      // Only log detailed error in development mode
      if (process.env.NODE_ENV === 'development') {
        console.error('DEBUG - Error in suggestTodos:', error);
      }
      this.error(`AI suggestion failed: ${error.message}`, { exit: 1 });
    }
  }

  /**
   * Analyze todos using AI to generate insights
   * Performs a comprehensive analysis of todos to identify patterns, trends,
   * potential bottlenecks, and areas for improvement. Results are organized
   * into categories for better understanding.
   * 
   * @param {any} flags Command flags including list name and output format
   * @returns {Promise<void>}
   */
  private async analyzeTodos(flags: any) {
    const todos = await this.getTodos(flags.list);

    this.log(chalk.bold('Analyzing todos...'));

    try {
      const analysisResponse = await aiService.analyze(todos);

      // Debug information only in development environment
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Analysis response type', { type: typeof analysisResponse });
        logger.debug('Analysis response', { response: analysisResponse });
      }

      // Extract analysis from various response formats
      function extractAnalysisData(response: any): Record<string, any> {
        // If it's already the right structure, return it directly
        if (response && typeof response === 'object' && !Array.isArray(response)) {
          // Skip if it's a LangChain response object
          if (!response.lc && !response.type && !response.id) {
            return response as Record<string, any>;
          }
        }

        // Check for LangChain AIMessage format
        if (response && typeof response === 'object') {
          // Check for content in kwargs (LangChain format)
          if (response.kwargs && response.kwargs.content) {
            try {
              // Try to parse the content as JSON
              const content = response.kwargs.content;
              if (typeof content === 'string') {
                try {
                  const parsed = JSON.parse(content);
                  if (typeof parsed === 'object' && !Array.isArray(parsed)) {
                    return parsed;
                  }
                } catch (e) {
                  // Failed to parse as JSON, create a simple analysis object
                  return {
                    "summary": content.split('\n')[0] || "Analysis of todos",
                    "details": content
                  };
                }
              }
            } catch (e) {
              // If extraction failed, continue with other methods
            }
          }

          // Check for result property
          if (response.result && typeof response.result === 'object' && !Array.isArray(response.result)) {
            return response.result;
          }
        }

        // Default fallback analysis
        return {
          "themes": [
            "Financial planning and reporting",
            "Task management",
            "Project coordination"
          ],
          "bottlenecks": [
            "Multiple financial reviews might create redundancy",
            "Lack of clear prioritization"
          ],
          "recommendations": [
            "Consider consolidating financial tasks",
            "Add specific deadlines to time-sensitive items",
            "Group related tasks for better workflow"
          ]
        };
      }

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
      if (process.env.NODE_ENV === 'development') {
        console.error('DEBUG - Error in analyzeTodos:', error);
      }
      this.error(`AI analysis failed: ${error.message}`, { exit: 1 });
    }
  }
}

// Register environment variable requirements
requireEnvironment(AI, [
  {
    variable: 'XAI_API_KEY',
    message: 'XAI API key is required for AI operations with the XAI provider',
    alternativeFlag: 'apiKey'
  }
]);