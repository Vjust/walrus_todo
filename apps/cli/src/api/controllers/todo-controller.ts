import type { Request, Response } from 'express';
import {
  ListQueryParams,
  ListResponse,
  GetResponse,
  CreateResponse,
  UpdateResponse,
  DeleteResponse,
  CompleteResponse,
  StoreResponse,
  RetrieveResponse,
  BatchRequestBody,
  BatchResponse,
} from '../../types/express';
import { TodoService } from '../../services/todoService';
import { BaseError } from '../../types/errors/consolidated/BaseError';
import { Logger } from '../../utils/Logger';
import { Todo } from '../../types/todo';

// Define interface for todo creation body
interface CreateTodoBody {
  content: string;
  priority?: 'high' | 'medium' | 'low';
  category?: string;
  tags?: string[];
}

// Define interface for batch operations - reserved for future use
// interface BatchOperation {
//   action: 'create' | 'update' | 'delete' | 'complete';
//   id?: string;
//   data?: CreateTodoBody;
// }

// interface BatchOperationResult {
//   success: boolean;
//   [key: string]: unknown;
// }

const logger = new Logger('TodoController');

export class TodoController {
  private todoService: TodoService;

  constructor() {
    this.todoService = new TodoService();
  }

  list = async (
    req: Request<
      Record<string, never>,
      ListResponse,
      Record<string, never>,
      ListQueryParams
    >,
    res: Response<ListResponse>
  ): Promise<void> => {
    const { page = '1', limit = '10' } = req.query;

    const todos = await this.todoService.listTodos();

    // Apply pagination (convert string query params to numbers)
    const pageNum = parseInt(String(page), 10) || 1;
    const limitNum = parseInt(String(limit), 10) || 10;
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedTodos = todos.slice(startIndex, endIndex);

    res.json({
      data: paginatedTodos,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: todos.length,
        totalPages: Math.ceil(todos.length / limitNum),
      },
    });
  };

  get = async (
    req: Request<{ id: string }, GetResponse>,
    res: Response<GetResponse>
  ): Promise<void> => {
    const { id } = req.params;

    const todos = await this.todoService.listTodos();
    const todo = todos.find(t => t.id === id);

    if (!todo) {
      throw new BaseError({
        message: `Todo with id ${id} not found`,
        code: 'NOT_FOUND',
      });
    }

    res.json({ data: todo });
  };

  create = async (
    req: Request<Record<string, never>, CreateResponse, CreateTodoBody>,
    res: Response<CreateResponse>
  ): Promise<void> => {
    const { content, priority, category, tags } = req.body;

    const todo = await this.todoService.addTodo(content, {
      priority,
      category,
      tags,
    });

    logger.info('Todo created', { id: todo.id });

    res.status(201).json({
      data: todo,
      message: 'Todo created successfully',
    });
  };

  update = async (
    req: Request<{ id: string }, UpdateResponse, Partial<CreateTodoBody>>,
    res: Response<UpdateResponse>
  ): Promise<void> => {
    const { id } = req.params;
    const updates = req.body;

    const todos = await this.todoService.listTodos();
    const todoIndex = todos.findIndex(t => t.id === id);

    if (todoIndex === -1) {
      throw new BaseError({
        message: `Todo with id ${id} not found`,
        code: 'NOT_FOUND',
      });
    }

    // Apply updates
    const updatedTodo: Todo = {
      ...todos[todoIndex],
      ...(updates as Partial<Todo>),
      updatedAt: new Date().toISOString(),
    } as Todo;

    todos[todoIndex] = updatedTodo;
    // TODO: Need to save back to the appropriate list

    logger.info('Todo updated', { id });

    res.json({
      data: updatedTodo,
      message: 'Todo updated successfully',
    });
  };

  delete = async (
    req: Request<{ id: string }, DeleteResponse>,
    res: Response<DeleteResponse>
  ): Promise<void> => {
    const { id } = req.params;

    const todos = await this.todoService.listTodos();
    const todoIndex = todos.findIndex(t => t.id === id);

    if (todoIndex === -1) {
      throw new BaseError({
        message: `Todo with id ${id} not found`,
        code: 'NOT_FOUND',
      });
    }

    const deletedTodo = todos[todoIndex];
    todos.splice(todoIndex, 1);
    // TODO: Need to save back to the appropriate list

    logger.info('Todo deleted', { id });

    res.json({
      data: deletedTodo,
      message: 'Todo deleted successfully',
    });
  };

  complete = async (
    req: Request<{ id: string }, CompleteResponse>,
    res: Response<CompleteResponse>
  ): Promise<void> => {
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
      throw new BaseError({
        message: `Todo with id ${id} not found`,
        code: 'NOT_FOUND',
      });
    }

    logger.info('Todo completed', { id });

    res.json({
      data: updatedTodo,
      message: 'Todo marked as complete',
    });
  };

  store = async (
    req: Request<{ id: string }, StoreResponse>,
    res: Response<StoreResponse>
  ): Promise<void> => {
    const { id } = req.params;

    // Store todo on blockchain (implementation would call blockchain storage service)
    logger.info('Storing todo on blockchain', { id });

    // Placeholder response
    res.json({
      message: 'Todo stored on blockchain',
      transactionHash: '0x...',
      walrusUrl: 'https://walrus.example.com/...',
    });
  };

  retrieve = async (
    req: Request<{ id: string }, RetrieveResponse>,
    res: Response<RetrieveResponse>
  ): Promise<void> => {
    const { id } = req.params;

    // Retrieve todo from blockchain (implementation would call blockchain storage service)
    logger.info('Retrieving todo from blockchain', { id });

    // Placeholder response
    res.json({
      message: 'Todo retrieved from blockchain',
      data: {
        id,
        content: 'Retrieved todo content',
        blockchain: true,
      },
    });
  };

  batch = async (
    req: Request<Record<string, never>, BatchResponse, BatchRequestBody>,
    res: Response<BatchResponse>
  ): Promise<void> => {
    const { operations } = req.body;

    if (!Array.isArray(operations)) {
      throw new BaseError({
        message: 'Operations must be an array',
        code: 'VALIDATION_ERROR',
      });
    }

    const results = [];

    for (const op of operations) {
      try {
        let result;

        switch (op.action) {
          case 'create': {
            if (!op.data) {
              throw new BaseError({
                message: 'Missing data for create operation',
                code: 'VALIDATION_ERROR',
              });
            }
            // Convert CreateTodoBody to Partial<Todo>
            const todoData: Partial<Todo> = {
              title: op.data.content,
              priority: op.data.priority,
              category: op.data.category,
              tags: op.data.tags,
            };
            result = await this.todoService.addTodo(op.data.content, todoData);
            break;
          }
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
            throw new BaseError({
              message: `Unknown action: ${op.action}`,
              code: 'VALIDATION_ERROR',
            });
        }

        results.push({ success: true, ...result });
      } catch (error: unknown) {
        const typedError =
          error instanceof Error ? error : new Error(String(error));
        results.push({
          success: false,
          error: typedError.message,
          operation: op,
        });
      }
    }

    res.json({
      results,
      summary: {
        total: operations.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      },
    });
  };
}
