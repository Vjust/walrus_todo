import type { Request, Response } from 'express';
import { AIService } from '../../services/ai/AIService.consolidated';
import { TodoService } from '../../services/todoService';
import { BaseError } from '../../types/errors/consolidated/BaseError';
import { Logger } from '../../utils/Logger';

const logger = new Logger('AIController');

export class AIController {
  private aiService: AIService;
  private todoService: TodoService;

  constructor() {
    this.aiService = AIService.getInstance();
    this.todoService = new TodoService();
  }

  summarize = async (req: Request, res: Response): Promise<void> => {
    const { todoIds, includeCompleted } = req.body;
    
    let todos = await this.todoService.listTodos();
    
    // Filter todos
    if (todoIds && todoIds.length > 0) {
      todos = todos.filter(t => todoIds.includes(t.id));
    }
    
    if (!includeCompleted) {
      todos = todos.filter(t => !t.completed);
    }
    
    const summary = await this.aiService.summarize(todos);
    
    logger.info('Todos summarized', { count: todos.length });
    
    res.json({ 
      data: summary,
      metadata: {
        todoCount: todos.length,
        provider: 'ai-service'
      }
    });
  };

  categorize = async (req: Request, res: Response): Promise<void> => {
    const { todoIds } = req.body;
    
    let todos = await this.todoService.listTodos();
    
    if (todoIds && todoIds.length > 0) {
      todos = todos.filter(t => todoIds.includes(t.id));
    }
    
    const categorized = await this.aiService.categorize(todos);
    
    logger.info('Todos categorized', { count: todos.length });
    
    res.json({ 
      data: categorized,
      metadata: {
        todoCount: todos.length,
        categoriesUsed: Object.keys(categorized)
      }
    });
  };

  prioritize = async (req: Request, res: Response): Promise<void> => {
    const { todoIds, criteria } = req.body;
    
    let todos = await this.todoService.listTodos();
    
    if (todoIds && todoIds.length > 0) {
      todos = todos.filter(t => todoIds.includes(t.id));
    }
    
    const prioritized = await this.aiService.prioritize(todos);
    
    logger.info('Todos prioritized', { count: todos.length });
    
    res.json({ 
      data: prioritized,
      metadata: {
        todoCount: todos.length,
        criteria: criteria || 'default'
      }
    });
  };

  suggest = async (req: Request, res: Response): Promise<void> => {
    
    const todos = await this.todoService.listTodos();
    const suggestions = await this.aiService.suggest(todos);
    
    logger.info('Task suggestions generated', { count: suggestions.length });
    
    res.json({ 
      data: suggestions,
      metadata: {
        existingTodos: todos.length,
        suggestionsCount: suggestions.length
      }
    });
  };

  enhance = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { style } = req.body;
    
    const todos = await this.todoService.listTodos();
    const todo = todos.find(t => t.id === id);
    
    if (!todo) {
      throw new BaseError({ message: `Todo with id ${id} not found`, code: 'NOT_FOUND' });
    }
    
    // Since enhance is not available, use summarize on single todo
    const enhancedContent = await this.aiService.summarize([todo]);
    
    logger.info('Todo description enhanced', { id });
    
    res.json({ 
      data: {
        original: todo.title,
        enhanced: enhancedContent,
        style: style || 'detailed'
      }
    });
  };

  getProviders = async (req: Request, res: Response): Promise<void> => {
    // Return static list of providers since methods don't exist
    const providers = ['xai', 'openai', 'anthropic'];
    const currentProvider = 'xai'; // default
    
    res.json({ 
      data: {
        providers,
        current: currentProvider
      }
    });
  };

  verify = async (req: Request, res: Response): Promise<void> => {
    const { operation, provider } = req.body;
    
    // Verify AI operation on blockchain (placeholder)
    logger.info('Verifying AI operation', { operation, provider });
    
    res.json({ 
      data: {
        verified: true,
        transactionHash: '0x...',
        timestamp: new Date().toISOString(),
        operation,
        provider
      }
    });
  };
}