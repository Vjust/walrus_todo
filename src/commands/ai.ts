import { Flags, Args } from '@oclif/core';
import BaseCommand from '../base-command';
import { aiService, secureCredentialService } from '../services/ai';
import { AIProviderFactory } from '../services/ai/AIProviderFactory';
import { AIProvider } from '../types/adapters/AIModelAdapter';
import chalk from 'chalk';
import {
  requireEnvironment,
  aiFlags,
  setEnvFromFlags
} from '../utils/CommandValidationMiddleware';
import { getEnv, hasEnv } from '../utils/environment-config';

/**
 * AI commands for todo management
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

  async run() {
    const { args, flags } = await this.parse(AI);

    // Always set AI features flag for AI command
    AIProviderFactory.setAIFeatureRequested(true);

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
   * Show AI service status
   */
  private async showStatus(flags: any) {
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
      const hasKey = hasEnv(`${provider}_API_KEY` as any);
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
   * Show help for AI commands
   */
  private showHelp(flags: any) {
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
   * Get todo data for AI operations
   */
  private async getTodos(listName?: string) {
    // Import TodoService here to avoid circular dependencies
    const { TodoService } = require('../services/todoService');
    const todoService = new TodoService();

    const todos = await todoService.listTodos(listName);

    if (todos.length === 0) {
      this.error('No todos found. Add some todos first with "walrus_todo add"', { exit: 1 });
    }

    return todos;
  }

  /**
   * Summarize todos
   */
  private async summarizeTodos(flags: any) {
    const todos = await this.getTodos(flags.list);
    
    this.log(chalk.bold('Generating AI summary...'));
    
    try {
      const summary = await aiService.summarize(todos);
      
      if (flags.json) {
        this.log(JSON.stringify({ summary }, null, 2));
      } else {
        this.log('');
        this.log(chalk.cyan('📝 Summary of your todos:'));
        this.log(chalk.yellow(summary));
      }
    } catch (error) {
      this.error(`AI summarization failed: ${error.message}`, { exit: 1 });
    }
  }

  /**
   * Categorize todos
   */
  private async categorizeTodos(flags: any) {
    const todos = await this.getTodos(flags.list);
    
    this.log(chalk.bold('Categorizing todos...'));
    
    try {
      const categories = await aiService.categorize(todos);
      
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
      this.error(`AI categorization failed: ${error.message}`, { exit: 1 });
    }
  }

  /**
   * Prioritize todos
   */
  private async prioritizeTodos(flags: any) {
    const todos = await this.getTodos(flags.list);
    
    this.log(chalk.bold('Prioritizing todos...'));
    
    try {
      const priorities = await aiService.prioritize(todos);
      
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
      this.error(`AI prioritization failed: ${error.message}`, { exit: 1 });
    }
  }

  /**
   * Suggest new todos
   */
  private async suggestTodos(flags: any) {
    const todos = await this.getTodos(flags.list);
    
    this.log(chalk.bold('Generating todo suggestions...'));
    
    try {
      const suggestions = await aiService.suggest(todos);
      
      if (flags.json) {
        this.log(JSON.stringify({ suggestions }, null, 2));
        return;
      }
      
      this.log('');
      this.log(chalk.cyan('💡 Suggested Todos:'));
      
      suggestions.forEach((suggestion, i) => {
        this.log(`${i + 1}. ${suggestion}`);
      });
      
      this.log('');
      this.log(`To add a suggested todo: ${chalk.cyan('walrus_todo add "Suggested Todo Title"')}`);
    } catch (error) {
      this.error(`AI suggestion failed: ${error.message}`, { exit: 1 });
    }
  }

  /**
   * Analyze todos
   */
  private async analyzeTodos(flags: any) {
    const todos = await this.getTodos(flags.list);
    
    this.log(chalk.bold('Analyzing todos...'));
    
    try {
      const analysis = await aiService.analyze(todos);
      
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
        } else if (typeof details === 'object') {
          for (const [key, value] of Object.entries(details)) {
            this.log(`  ${key}: ${value}`);
          }
        } else {
          this.log(`  ${details}`);
        }
      }
    } catch (error) {
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