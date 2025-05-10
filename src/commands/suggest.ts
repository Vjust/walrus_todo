import { Flags, Args } from '@oclif/core';
import BaseCommand from '../base-command';
import { aiService } from '../services/ai';
import { TaskSuggestionService, SuggestionType, SuggestionContext } from '../services/ai/TaskSuggestionService';
import { AIVerificationService } from '../services/ai/AIVerificationService';
import { BlockchainAIVerificationService } from '../services/ai/BlockchainAIVerificationService';
import { BlockchainVerifier } from '../services/ai/BlockchainVerifier';
import { SuiAIVerifierAdapter } from '../services/ai/adapters/SuiAIVerifierAdapter';
import { AIPrivacyLevel } from '../types/adapters/AIVerifierAdapter';
import { AIProvider } from '../types/adapters/AIModelAdapter';
import { Todo } from '../types/todo';
import chalk from 'chalk';
import { TodoService } from '../services/todoService';
import { EnhancedAIService } from '../services/ai/EnhancedAIService';

export default class Suggest extends BaseCommand {
  /**
   * Gets a Sui signer instance for blockchain operations
   * @returns A Promise resolving to a Sui signer
   */
  private async getSuiSigner() {
    try {
      const { KeystoreSigner } = require('../utils/sui-keystore');
      return await KeystoreSigner.fromPath('');
    } catch (error) {
      this.error(`Failed to initialize Sui signer: ${error instanceof Error ? error.message : String(error)}`);
      throw error; // To satisfy TypeScript - execution won't reach here after this.error()
    }
  }

  /**
   * Gets the todo service instance
   * @returns The todo service
   */
  private getTodoService() {
    return new TodoService();
  }
  static description = 'Get intelligent task suggestions based on your current todo list';

  static flags = {
    ...BaseCommand.flags,
    apiKey: Flags.string({
      description: 'API key for AI service',
      required: false,
      env: 'XAI_API_KEY'
    }),
    format: Flags.string({
      description: 'Output format (table or json)',
      required: false,
      default: 'table',
      options: ['table', 'json']
    }),
    verify: Flags.boolean({
      description: 'Create blockchain verification for suggestions',
      default: false
    }),
    provider: Flags.string({
      description: 'Specify AI provider',
      required: false,
      options: ['xai', 'openai', 'anthropic']
    }),
    model: Flags.string({
      description: 'Specify AI model to use',
      required: false
    }),
    privacy: Flags.string({
      description: 'Privacy level for verified operations',
      options: ['public', 'hash_only', 'private'],
      default: 'hash_only'
    }),
    type: Flags.string({
      description: 'Type of suggestions to generate',
      options: ['all', 'related', 'next_step', 'dependency'],
      default: 'all',
    }),
    tags: Flags.string({
      description: 'Only suggest tasks related to these tags',
      multiple: true
    }),
    priority: Flags.string({
      description: 'Filter suggestions by priority',
      options: ['high', 'medium', 'low'],
      multiple: true
    }),
    minScore: Flags.integer({
      description: 'Minimum relevance score (0-100)',
      min: 0,
      max: 100,
      default: 50
    }),
    maxResults: Flags.integer({
      description: 'Maximum number of suggestions to return',
      min: 1,
      max: 20,
      default: 10
    }),
    addTodo: Flags.boolean({
      description: 'Prompt to add selected suggestions as new todos',
      default: false
    }),
    registryAddress: Flags.string({
      description: 'Address of the verification registry on the blockchain',
      required: false
    }),
    packageId: Flags.string({
      description: 'Package ID of the AI verifier smart contract',
      required: false
    }),
    todoId: Flags.string({
      description: 'Generate suggestions related to specific todo (by ID)',
      multiple: true
    })
  };

  async run() {
    const { flags } = await this.parse(Suggest);
    
    // Get API key from flag or environment
    const apiKey = flags.apiKey || process.env.XAI_API_KEY;
    if (!apiKey) {
      this.error('API key is required. Provide it via --apiKey flag or XAI_API_KEY environment variable.');
    }
    
    // Initialize verification service if --verify flag is used
    let verificationService: AIVerificationService | undefined;
    if (flags.verify) {
      if (!flags.registryAddress || !flags.packageId) {
        this.error('Registry address and package ID are required for blockchain verification. Use --registryAddress and --packageId flags.');
      }

      try {
        // Initialize blockchain components
        const signer = await this.getSuiSigner();
        const suiClient = await signer.getClient();

        // Create verifier adapter
        const verifierAdapter = new SuiAIVerifierAdapter(
          suiClient,
          signer,
          flags.packageId,
          flags.registryAddress
        );

        // Get the permission manager and credential manager
        const { getPermissionManager } = require('../services/ai/AIPermissionManager');
        const { secureCredentialManager } = require('../services/ai/SecureCredentialManager');

        // Get the permission manager instance
        const permissionManager = getPermissionManager();

        // Create verification service with all required parameters
        // Create a BlockchainVerifier instance first
        const blockchainVerifier = new BlockchainVerifier(verifierAdapter);

        verificationService = new BlockchainAIVerificationService(
          blockchainVerifier,
          permissionManager,
          secureCredentialManager,
          flags.provider || 'default_provider'
        );

        this.log(chalk.cyan('Blockchain verification enabled.'));
      } catch (error) {
        this.error(`Failed to initialize blockchain verification: ${error}`);
      }
    }
    
    // Initialize AI service with enhanced functionality
    const enhancedService = new EnhancedAIService(
      apiKey,
      flags.provider ? (flags.provider as AIProvider) : undefined, // Convert string to AIProvider enum
      flags.model,
      {
        temperature: 0.7,
        maxTokens: 2000
      },
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
    
    if (todos.length === 0) {
      this.log('No todos found to analyze for suggestions.');
      return;
    }
    
    // Build suggestion context based on flags
    const context: SuggestionContext = {
      minScore: flags.minScore,
      maxResults: flags.maxResults
    };
    
    // Set type filter
    if (flags.type && typeof flags.type === 'string') {
      const typeArray = [flags.type];
      if (typeArray[0] !== 'all') {
        context.includeTypes = typeArray.map(type => {
        switch (type) {
          case 'related': return SuggestionType.RELATED;
          case 'next_step': return SuggestionType.NEXT_STEP;
          case 'dependency': return SuggestionType.DEPENDENCY;
          default: return SuggestionType.RELATED;
        }
      });
      }
    }

    // Set tags filter
    if (flags.tags && typeof flags.tags === 'string') {
      context.tags = [flags.tags];
    } else if (flags.tags && Array.isArray(flags.tags) && flags.tags.length > 0) {
      context.tags = flags.tags;
    }
    
    // Set priority filter
    if (flags.priority && typeof flags.priority === 'string') {
      context.priorityFilter = [flags.priority] as ('high' | 'medium' | 'low')[];
    } else if (flags.priority && Array.isArray(flags.priority) && flags.priority.length > 0) {
      context.priorityFilter = flags.priority as ('high' | 'medium' | 'low')[];
    }
    
    // Set todoId filter
    if (flags.todoId && typeof flags.todoId === 'string') {
      context.relatedToTodoIds = [flags.todoId];
    } else if (flags.todoId && Array.isArray(flags.todoId) && flags.todoId.length > 0) {
      context.relatedToTodoIds = flags.todoId;
    }
    
    this.log(`Analyzing ${todos.length} todos to generate intelligent task suggestions...`);
    
    // Map privacy flag to AIPrivacyLevel
    const privacyLevel = flags.privacy === 'public' 
      ? AIPrivacyLevel.PUBLIC 
      : flags.privacy === 'private' 
        ? AIPrivacyLevel.PRIVATE 
        : AIPrivacyLevel.HASH_ONLY;
    
    try {
      // Generate suggestions
      let result;
      if (flags.verify) {
        result = await suggestionService.suggestTasksWithVerification(todos, context, privacyLevel);
      } else {
        result = await suggestionService.suggestTasks(todos, context);
      }
      
      // Display results
      if (flags.format === 'json') {
        this.log(JSON.stringify(flags.verify ? result : result.suggestions, null, 2));
        return;
      }
      
      // Display in table format
      const suggestions = flags.verify ? result.result.suggestions : result.suggestions;
      const contextInfo = flags.verify ? result.result.contextInfo : result.contextInfo;
      
      // Display context information
      this.log(chalk.cyan('\nContext Information:'));
      this.log(`Analyzed ${chalk.bold(contextInfo.analyzedTodoCount.toString())} todos, ${chalk.bold(contextInfo.completionPercentage.toFixed(0))}% completed`);
      this.log(`Top tags: ${contextInfo.topContextualTags.map(tag => chalk.yellow(tag)).join(', ')}`);
      this.log(`Detected themes: ${contextInfo.detectedThemes.map(theme => chalk.green(theme)).join(', ')}`);
      
      // Display suggestions
      this.log(chalk.cyan(`\nTask Suggestions (${suggestions.length}):`));
      
      if (suggestions.length === 0) {
        this.log(chalk.yellow('No suggestions found based on your filters. Try broadening your criteria.'));
        return;
      }
      
      suggestions.forEach((suggestion, index) => {
        // Color based on score
        const scoreColor = suggestion.score >= 80 ? chalk.green :
                          suggestion.score >= 60 ? chalk.yellow :
                          chalk.red;
        
        // Color based on priority
        const priorityColor = suggestion.priority === 'high' ? chalk.red :
                             suggestion.priority === 'medium' ? chalk.yellow :
                             chalk.green;
        
        // Color based on type
        const typeColor = suggestion.type === SuggestionType.RELATED ? chalk.blue :
                         suggestion.type === SuggestionType.NEXT_STEP ? chalk.green :
                         suggestion.type === SuggestionType.DEPENDENCY ? chalk.yellow :
                         chalk.white;
        
        this.log(`\n${chalk.bold(index + 1)}. ${chalk.bold(suggestion.title)}`);
        this.log(`   ${suggestion.description || 'No description'}`);
        this.log(`   Priority: ${priorityColor(suggestion.priority || 'medium')} | Score: ${scoreColor(suggestion.score)} | Type: ${typeColor(suggestion.type)}`);
        
        if (suggestion.tags && suggestion.tags.length > 0) {
          this.log(`   Tags: ${suggestion.tags.map(tag => chalk.yellow(tag)).join(', ')}`);
        }
        
        this.log(`   Reasoning: ${chalk.dim(suggestion.reasoning)}`);
        
        if (suggestion.relatedTodoIds && suggestion.relatedTodoIds.length > 0) {
          const relatedTodos = todos.filter(todo => suggestion.relatedTodoIds?.includes(todo.id));
          this.log(`   Related to: ${relatedTodos.map(todo => chalk.dim(todo.title)).join(', ')}`);
        }
      });
      
      // If verification was used, display verification details
      if (flags.verify) {
        this.displayVerificationDetails(result.verification);
      }
      
      // Prompt to add suggestions as todos if requested
      if (flags.addTodo) {
        await this.promptToAddSuggestions(suggestions, todoService);
      } else {
        this.log(chalk.dim('\nTip: Use --addTodo flag to add these suggestions as new todos.'));
      }
    } catch (error) {
      this.error(`Failed to generate task suggestions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Prompt user to add suggestions as todos
   */
  private async promptToAddSuggestions(
    suggestions: any[],
    todoService: any
  ) {
    const { prompt } = require('inquirer');
    
    // Ask which suggestions to add
    const response = await prompt([
      {
        type: 'checkbox',
        name: 'selectedSuggestions',
        message: 'Select suggestions to add as todos:',
        choices: suggestions.map((suggestion, index) => ({
          name: `${index + 1}. ${suggestion.title} (${suggestion.priority || 'medium'} priority)`,
          value: index
        }))
      }
    ]);
    
    if (response.selectedSuggestions.length === 0) {
      this.log('No suggestions selected.');
      return;
    }
    
    // Add selected suggestions as todos
    for (const index of response.selectedSuggestions) {
      const suggestion = suggestions[index];
      
      try {
        await todoService.addTodo({
          title: suggestion.title,
          description: suggestion.description || '',
          priority: suggestion.priority || 'medium',
          tags: suggestion.tags || []
        });
        
        this.log(`Added todo: ${chalk.green(suggestion.title)}`);
      } catch (error) {
        this.error(`Failed to add todo: ${error}`);
      }
    }
    
    this.log(chalk.green(`\nSuccessfully added ${response.selectedSuggestions.length} todos!`));
  }
  
  /**
   * Display verification details
   */
  private displayVerificationDetails(verification: any) {
    this.log(chalk.bold('\nVerification Details:'));
    this.log(chalk.dim('─'.repeat(50)));
    this.log(`ID:        ${chalk.yellow(verification.id)}`);
    this.log(`Provider:  ${verification.provider}`);
    this.log(`Timestamp: ${new Date(verification.timestamp).toLocaleString()}`);
    this.log(`Privacy:   ${chalk.blue(verification.metadata.privacyLevel || 'hash_only')}`);

    // Display transaction ID if available
    if (verification.transactionId) {
      this.log(`Transaction: ${chalk.yellow(verification.transactionId)}`);
    }

    this.log(chalk.dim('─'.repeat(50)));
    this.log(chalk.dim(`To view detailed verification information, run: ${chalk.cyan(`walrus_todo ai:verify show --id ${verification.id}`)}`));
  }
}