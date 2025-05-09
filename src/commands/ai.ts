import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import { TodoService } from '../services/todoService';
import { AiService, TodoAIOperation } from '../services/ai/aiService';
import { CLIError } from '../types/error';
import { Todo } from '../types/todo';

/**
 * @class AiCommand
 * @description Command for AI-powered todo operations.
 * Provides AI capabilities for todo management including:
 * - Summarizing todo lists
 * - Categorizing todos by adding tags
 * - Suggesting priority levels
 * - Recommending new tasks based on existing ones
 * - Analyzing completion patterns and productivity insights
 */
export default class AiCommand extends Command {
  static description = 'Apply AI to your todos for insights and suggestions';

  static examples = [
    '<%= config.bin %> ai summarize',
    '<%= config.bin %> ai categorize -i todo123',
    '<%= config.bin %> ai prioritize -i "Buy groceries"',
    '<%= config.bin %> ai suggest -l work',
    '<%= config.bin %> ai analyze -l personal'
  ];

  static flags = {
    list: Flags.string({
      char: 'l',
      description: 'Name of the todo list',
      default: 'default'
    }),
    id: Flags.string({
      char: 'i',
      description: 'Todo ID or title to apply AI operations on',
      required: false
    }),
    count: Flags.integer({
      char: 'c',
      description: 'Number of items to generate (for suggestions)',
      default: 3
    }),
    apiKey: Flags.string({
      char: 'k',
      description: 'XAI API key (defaults to XAI_API_KEY environment variable)',
      required: false
    }),
    apply: Flags.boolean({
      char: 'a',
      description: 'Apply AI suggestions automatically',
      default: false
    })
  };

  static args = {
    operation: Args.string({
      name: 'operation',
      description: 'AI operation to perform',
      required: true,
      options: ['summarize', 'categorize', 'prioritize', 'suggest', 'analyze']
    })
  };

  private todoService = new TodoService();
  private aiService: AiService | null = null;

  async run(): Promise<void> {
    // Ensure environment is properly configured
    process.env.FORCE_COLOR = '1'; 
    
    try {
      const { args, flags } = await this.parse(AiCommand);
      
      // Initialize AI service with better error handling
      try {
        const apiKey = flags.apiKey || process.env.XAI_API_KEY;
        if (!apiKey) {
          console.error(chalk.red('XAI API key is required. Set XAI_API_KEY environment variable or use --apiKey flag.'));
          this.error(chalk.red('XAI API key is required. Set XAI_API_KEY environment variable or use --apiKey flag.'));
          return;
        }
        
        this.aiService = new AiService(apiKey);
      } catch (error) {
        if (error instanceof CLIError && error.code === 'MISSING_API_KEY') {
          console.error(chalk.red('XAI API key is required. Set XAI_API_KEY environment variable or use --apiKey flag.'));
          this.error(chalk.red('XAI API key is required. Set XAI_API_KEY environment variable or use --apiKey flag.'));
          return;
        }
        throw error;
      }
      
      const operation = args.operation as TodoAIOperation;
      const listName = flags.list;
      const todoId = flags.id;

      // Check if the list exists
      const list = await this.todoService.getList(listName);
      if (!list) {
        console.error(chalk.red(`List "${listName}" not found`));
        throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
      }

      // Ensure output is visible through multiple channels
      const messageText = `Applying AI (${operation}) to your todos...`;
      console.log(chalk.blue(messageText));
      process.stdout.write(chalk.blue(messageText + '\n'));
      this.log(chalk.blue(messageText));

      switch (operation) {
        case 'summarize':
          await this.runSummarize(list.name);
          break;
        case 'categorize':
          if (!todoId) {
            console.error(chalk.red('Todo ID or title is required for categorize operation'));
            throw new CLIError('Todo ID or title is required for categorize operation', 'MISSING_TODO_ID');
          }
          await this.runCategorize(list.name, todoId, flags.apply);
          break;
        case 'prioritize':
          if (!todoId) {
            console.error(chalk.red('Todo ID or title is required for prioritize operation'));
            throw new CLIError('Todo ID or title is required for prioritize operation', 'MISSING_TODO_ID');
          }
          await this.runPrioritize(list.name, todoId, flags.apply);
          break;
        case 'suggest':
          await this.runSuggest(list.name, flags.count, flags.apply);
          break;
        case 'analyze':
          await this.runAnalyze(list.name);
          break;
        default:
          console.error(chalk.red(`Unknown operation: ${operation}`));
          throw new CLIError(`Unknown operation: ${operation}`, 'INVALID_OPERATION');
      }
    } catch (error) {
      // Enhanced error handling with multi-channel output
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (error instanceof CLIError) {
        console.error(chalk.red(`Error: ${errorMessage}`));
        throw error;
      }
      
      console.error(chalk.red(`AI operation failed: ${errorMessage}`));
      throw new CLIError(
        `AI operation failed: ${errorMessage}`,
        'AI_OPERATION_FAILED'
      );
    }
  }

  private async runSummarize(listName: string): Promise<void> {
    if (!this.aiService) return;
    
    const list = await this.todoService.getList(listName);
    if (!list) {
      throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
    }

    console.log(chalk.dim('Generating summary...'));
    process.stdout.write(chalk.dim('Generating summary...\n'));
    this.log(chalk.dim('Generating summary...'));
    
    try {
      const summary = await this.aiService.summarizeTodoList(list);
      
      const headerText = '\n📋 Todo List Summary';
      const dividerText = '──────────────────────';
      
      // Use multiple output methods to ensure visibility
      console.log(chalk.cyan(headerText));
      console.log(dividerText);
      console.log(summary);
      
      process.stdout.write(chalk.cyan(headerText) + '\n');
      process.stdout.write(dividerText + '\n');
      process.stdout.write(summary + '\n');
      
      this.log('\n' + chalk.cyan('📋 Todo List Summary'));
      this.log('──────────────────────');
      this.log(summary);
    } catch (error) {
      console.error('Error generating summary:', error);
      this.error(`Failed to generate summary: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async runCategorize(listName: string, todoId: string, apply: boolean): Promise<void> {
    if (!this.aiService) return;
    
    const todo = await this.todoService.getTodoByTitleOrId(todoId, listName);
    if (!todo) {
      throw new CLIError(`Todo "${todoId}" not found in list "${listName}"`, 'TODO_NOT_FOUND');
    }

    this.log(chalk.dim('Generating tag suggestions...'));
    const suggestedTags = await this.aiService.suggestTags(todo);
    
    this.log('\n' + chalk.cyan('🏷️  Suggested Tags'));
    this.log('──────────────────────');
    suggestedTags.forEach(tag => this.log(`- ${tag}`));

    if (apply) {
      // Merge existing and suggested tags, removing duplicates
      const existingTags = todo.tags || [];
      const allTags = [...new Set([...existingTags, ...suggestedTags])];
      
      await this.todoService.updateTodo(listName, todo.id, {
        tags: allTags,
        updatedAt: new Date().toISOString()
      });
      
      this.log(chalk.green('\n✓ Tags applied to todo'));
    } else {
      this.log(chalk.yellow('\nTags not applied. Use --apply flag to add these tags automatically.'));
    }
  }

  private async runPrioritize(listName: string, todoId: string, apply: boolean): Promise<void> {
    if (!this.aiService) return;
    
    const todo = await this.todoService.getTodoByTitleOrId(todoId, listName);
    if (!todo) {
      throw new CLIError(`Todo "${todoId}" not found in list "${listName}"`, 'TODO_NOT_FOUND');
    }

    this.log(chalk.dim('Generating priority suggestion...'));
    const suggestedPriority = await this.aiService.suggestPriority(todo);
    
    // Color based on priority
    const priorityColor = {
      high: chalk.red,
      medium: chalk.yellow,
      low: chalk.green
    }[suggestedPriority];

    this.log('\n' + chalk.cyan('🔄 Suggested Priority'));
    this.log('──────────────────────');
    this.log(`${priorityColor(suggestedPriority)}`);

    if (apply) {
      await this.todoService.updateTodo(listName, todo.id, {
        priority: suggestedPriority,
        updatedAt: new Date().toISOString()
      });
      
      this.log(chalk.green('\n✓ Priority applied to todo'));
    } else {
      this.log(chalk.yellow('\nPriority not applied. Use --apply flag to update priority automatically.'));
    }
  }

  private async runSuggest(listName: string, count: number, apply: boolean): Promise<void> {
    if (!this.aiService) return;
    
    const list = await this.todoService.getList(listName);
    if (!list) {
      throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
    }

    this.log(chalk.dim(`Generating ${count} task suggestions...`));
    const suggestedTasks = await this.aiService.suggestRelatedTasks(list, count);
    
    this.log('\n' + chalk.cyan('✨ Suggested Tasks'));
    this.log('──────────────────────');
    suggestedTasks.forEach((task, i) => this.log(`${i + 1}. ${task}`));

    if (apply) {
      this.log(chalk.dim('\nAdding suggested tasks to list...'));
      
      const addedTodos: Todo[] = [];
      for (const taskTitle of suggestedTasks) {
        const newTodo = await this.todoService.addTodo(listName, {
          title: taskTitle,
          priority: 'medium',
          tags: ['ai-suggested'],
          private: true,
          storageLocation: 'local'
        });
        addedTodos.push(newTodo);
      }
      
      this.log(chalk.green(`\n✓ Added ${addedTodos.length} new todos to list "${listName}"`));
    } else {
      this.log(chalk.yellow('\nSuggestions not added. Use --apply flag to add these tasks automatically.'));
    }
  }

  private async runAnalyze(listName: string): Promise<void> {
    if (!this.aiService) return;
    
    const list = await this.todoService.getList(listName);
    if (!list) {
      throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
    }

    this.log(chalk.dim('Analyzing productivity patterns...'));
    const analysis = await this.aiService.analyzeProductivity(list);
    
    this.log('\n' + chalk.cyan('📊 Productivity Analysis'));
    this.log('──────────────────────');
    this.log(analysis);
  }
}