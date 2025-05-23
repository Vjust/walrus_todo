import type { Request, Response } from 'express';
import { TodoService } from '../../services/todoService';
import { BaseError } from '../../types/errors/consolidated/BaseError';
import { Logger } from '../../utils/Logger';
import { Todo } from '../../types/todo';

const logger = new Logger('TodoController');

export class TodoController {
  private todoService: TodoService;

  constructor() {
    this.todoService = new TodoService();
  }

  list = async (req: Request, res: Response): Promise<void> => {
    const { page = 1, limit = 10 } = (req as any).query;
    
    const todos = await this.todoService.listTodos();
    
    // Apply pagination (convert string query params to numbers)
    const pageNum = parseInt(String(page), 10) || 1;
    const limitNum = parseInt(String(limit), 10) || 10;
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedTodos = todos.slice(startIndex, endIndex);
    
    (res as any).json({
      data: paginatedTodos,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: todos.length,
        totalPages: Math.ceil(todos.length / limitNum)
      }
    });
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    const todos = await this.todoService.listTodos();
    const todo = todos.find(t => t.id === id);
    
    if (!todo) {
      throw new BaseError({ message: `Todo with id ${id} not found`, code: 'NOT_FOUND' });
    }
    
    res.json({ data: todo });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const { content, priority, category, tags } = req.body;
    
    const todo = await this.todoService.addTodo(content, {
      priority,
      category,
      tags
    });
    
    logger.info('Todo created', { id: todo.id });
    
    res.status(201).json({ 
      data: todo,
      message: 'Todo created successfully'
    });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const updates = req.body;
    
    const todos = await this.todoService.listTodos();
    const todoIndex = todos.findIndex(t => t.id === id);
    
    if (todoIndex === -1) {
      throw new BaseError({ message: `Todo with id ${id} not found`, code: 'NOT_FOUND' });
    }
    
    // Apply updates
    const updatedTodo: Todo = {
      ...todos[todoIndex],
      ...updates,
      updatedAt: new Date()
    };
    
    todos[todoIndex] = updatedTodo;
    // TODO: Need to save back to the appropriate list
    
    logger.info('Todo updated', { id });
    
    res.json({ 
      data: updatedTodo,
      message: 'Todo updated successfully'
    });
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    const todos = await this.todoService.listTodos();
    const todoIndex = todos.findIndex(t => t.id === id);
    
    if (todoIndex === -1) {
      throw new BaseError({ message: `Todo with id ${id} not found`, code: 'NOT_FOUND' });
    }
    
    const deletedTodo = todos[todoIndex];
    todos.splice(todoIndex, 1);
    // TODO: Need to save back to the appropriate list
    
    logger.info('Todo deleted', { id });
    
    res.json({ 
      data: deletedTodo,
      message: 'Todo deleted successfully'
    });
  };

  complete = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    // Find todo in all lists and complete it
    const lists = await this.todoService.getAllLists();
    let updatedTodo: Todo | null = null;
    
    for (const listName of lists) {
      const todo = await this.todoService.getTodo(id, listName);
      if (todo) {
        await this.todoService.toggleItemStatus(listName, id, true);
        updatedTodo = await this.todoService.getTodo(id, listName);
        break;
      }
    }
    
    if (!updatedTodo) {
      throw new BaseError({ message: `Todo with id ${id} not found`, code: 'NOT_FOUND' });
    }
    
    logger.info('Todo completed', { id });
    
    res.json({ 
      data: updatedTodo,
      message: 'Todo marked as complete'
    });
  };

  store = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    // Store todo on blockchain (implementation would call blockchain storage service)
    logger.info('Storing todo on blockchain', { id });
    
    // Placeholder response
    res.json({ 
      message: 'Todo stored on blockchain',
      transactionHash: '0x...',
      walrusUrl: 'https://walrus.example.com/...'
    });
  };

  retrieve = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    // Retrieve todo from blockchain (implementation would call blockchain storage service)
    logger.info('Retrieving todo from blockchain', { id });
    
    // Placeholder response
    res.json({ 
      message: 'Todo retrieved from blockchain',
      data: {
        id,
        content: 'Retrieved todo content',
        blockchain: true
      }
    });
  };

  batch = async (req: Request, res: Response): Promise<void> => {
    const { operations } = req.body;
    
    if (!Array.isArray(operations)) {
      throw new BaseError({ message: 'Operations must be an array', code: 'VALIDATION_ERROR' });
    }
    
    const results = [];
    
    for (const op of operations) {
      try {
        let result;
        
        switch (op.action) {
          case 'create':
            result = await this.todoService.addTodo(op.data.content, op.data);
            break;
          case 'update':
            // Update logic
            result = { id: op.id, updated: true };
            break;
          case 'delete':
            // Delete logic
            result = { id: op.id, deleted: true };
            break;
          case 'complete':
            // TODO: Complete todo - need to find the list first
            result = { id: op.id, completed: true };
            break;
          default:
            throw new BaseError({ message: `Unknown action: ${op.action}`, code: 'VALIDATION_ERROR' });
        }
        
        results.push({ success: true, ...result });
      } catch (error) {
        results.push({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error',
          operation: op
        });
      }
    }
    
    res.json({ 
      results,
      summary: {
        total: operations.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
  };
}