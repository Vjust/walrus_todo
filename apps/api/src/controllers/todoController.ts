import { Request, Response } from 'express';
import { TodoService } from '../services/todoService';
import { WebSocketService } from '../services/websocketService';
import { asyncHandler } from '../middleware/error';
import { ApiError } from '../middleware/error';
import { logger } from '../utils/logger';

export class TodoController {
  constructor(
    private todoService: TodoService,
    private websocketService?: WebSocketService
  ) {}

  // GET /api/v1/todos
  public listTodos = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { page = '1', limit = '10', wallet } = req.query;
    const targetWallet = wallet || req.wallet;

    if (!targetWallet) {
      throw new ApiError('Wallet address required', 400, 'WALLET_REQUIRED');
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = Math.min(parseInt(limit, 10) || 10, 100); // Max 100 items per page

    const { todos, total } = await this.todoService.getTodos(targetWallet, {
      page: pageNum,
      limit: limitNum
    });

    const response = {
      data: todos,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    };

    res.json({
      success: true,
      ...response,
      timestamp: new Date().toISOString()
    });
  });

  // GET /api/v1/todos/:id
  public getTodo = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const wallet = req.wallet;

    if (!wallet) {
      throw new ApiError('Wallet address required', 400, 'WALLET_REQUIRED');
    }

    const todo = await this.todoService.getTodoById(id, wallet);

    if (!todo) {
      throw new ApiError('Todo not found', 404, 'TODO_NOT_FOUND');
    }

    res.json({
      success: true,
      data: todo,
      timestamp: new Date().toISOString()
    });
  });

  // POST /api/v1/todos
  public createTodo = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const todoData = req.body;
    const wallet = req.wallet;

    if (!wallet) {
      throw new ApiError('Wallet address required', 400, 'WALLET_REQUIRED');
    }

    const todo = await this.todoService.createTodo(todoData, wallet);

    // Broadcast to WebSocket clients
    if (this.websocketService) {
      this.websocketService.broadcastTodoCreated(todo);
    }

    res.status(201).json({
      success: true,
      data: todo,
      message: 'Todo created successfully',
      timestamp: new Date().toISOString()
    });
  });

  // PUT /api/v1/todos/:id
  public updateTodo = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const updateData = req.body;
    const wallet = req.wallet;

    if (!wallet) {
      throw new ApiError('Wallet address required', 400, 'WALLET_REQUIRED');
    }

    const todo = await this.todoService.updateTodo(id, updateData, wallet);

    // Broadcast to WebSocket clients
    if (this.websocketService) {
      this.websocketService.broadcastTodoUpdated(todo);
    }

    res.json({
      success: true,
      data: todo,
      message: 'Todo updated successfully',
      timestamp: new Date().toISOString()
    });
  });

  // DELETE /api/v1/todos/:id
  public deleteTodo = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const wallet = req.wallet;

    if (!wallet) {
      throw new ApiError('Wallet address required', 400, 'WALLET_REQUIRED');
    }

    const deletedTodo = await this.todoService.deleteTodo(id, wallet);

    // Broadcast to WebSocket clients
    if (this.websocketService) {
      this.websocketService.broadcastTodoDeleted(id, wallet);
    }

    res.json({
      success: true,
      data: deletedTodo,
      message: 'Todo deleted successfully',
      timestamp: new Date().toISOString()
    });
  });

  // POST /api/v1/todos/:id/complete
  public completeTodo = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const wallet = req.wallet;

    if (!wallet) {
      throw new ApiError('Wallet address required', 400, 'WALLET_REQUIRED');
    }

    const todo = await this.todoService.completeTodo(id, wallet);

    // Broadcast to WebSocket clients
    if (this.websocketService) {
      this.websocketService.broadcastTodoCompleted(todo);
    }

    res.json({
      success: true,
      data: todo,
      message: 'Todo marked as complete',
      timestamp: new Date().toISOString()
    });
  });

  // POST /api/v1/todos/batch
  public batchOperations = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { operations } = req.body;
    const wallet = req.wallet;

    if (!wallet) {
      throw new ApiError('Wallet address required', 400, 'WALLET_REQUIRED');
    }

    const results: any[] = [];

    for (const operation of operations) {
      try {
        let result;

        switch (operation.action) {
          case 'create':
            if (!operation.data) {
              throw new ApiError('Data required for create operation', 400);
            }
            result = await this.todoService.createTodo(
              operation.data, 
              wallet
            );
            if (this.websocketService) {
              this.websocketService.broadcastTodoCreated(result);
            }
            break;

          case 'update':
            if (!operation.id || !operation.data) {
              throw new ApiError('ID and data required for update operation', 400);
            }
            result = await this.todoService.updateTodo(
              operation.id, 
              operation.data, 
              wallet
            );
            if (this.websocketService) {
              this.websocketService.broadcastTodoUpdated(result);
            }
            break;

          case 'delete':
            if (!operation.id) {
              throw new ApiError('ID required for delete operation', 400);
            }
            result = await this.todoService.deleteTodo(operation.id, wallet);
            if (this.websocketService) {
              this.websocketService.broadcastTodoDeleted(operation.id, wallet);
            }
            break;

          case 'complete':
            if (!operation.id) {
              throw new ApiError('ID required for complete operation', 400);
            }
            result = await this.todoService.completeTodo(operation.id, wallet);
            if (this.websocketService) {
              this.websocketService.broadcastTodoCompleted(result);
            }
            break;

          default:
            throw new ApiError(`Unknown operation: ${operation.action}`, 400);
        }

        results.push({
          success: true,
          data: result,
          operation
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          success: false,
          error: errorMessage,
          operation
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      success: true,
      data: {
        results,
        summary: {
          total: operations.length,
          successful,
          failed
        }
      },
      timestamp: new Date().toISOString()
    });
  });

  // GET /api/v1/todos/categories
  public getCategories = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const wallet = req.wallet;

    if (!wallet) {
      throw new ApiError('Wallet address required', 400, 'WALLET_REQUIRED');
    }

    const categories = await this.todoService.getCategories(wallet);

    res.json({
      success: true,
      data: categories,
      timestamp: new Date().toISOString()
    });
  });

  // GET /api/v1/todos/tags
  public getTags = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const wallet = req.wallet;

    if (!wallet) {
      throw new ApiError('Wallet address required', 400, 'WALLET_REQUIRED');
    }

    const tags = await this.todoService.getTags(wallet);

    res.json({
      success: true,
      data: tags,
      timestamp: new Date().toISOString()
    });
  });

  // GET /api/v1/todos/stats
  public getStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const wallet = req.wallet;

    if (!wallet) {
      throw new ApiError('Wallet address required', 400, 'WALLET_REQUIRED');
    }

    const stats = await this.todoService.getStats(wallet);

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  });
}