import { Router } from 'express';
import { TodoController } from '../controllers/todoController';
import { TodoService } from '../services/todoService';
import { WebSocketService } from '../services/websocketService';
import { validate, validateId, schemas } from '../middleware/validation';
import { extractWallet } from '../middleware/auth';

export function createTodoRoutes(websocketService?: WebSocketService): Router {
  const router = Router();
  const todoService = new TodoService();
  const todoController = new TodoController(todoService, websocketService);

  // Apply wallet extraction middleware to all routes
  router.use(extractWallet);

  // GET /api/v1/todos - List all todos with pagination
  router.get(
    '/',
    validate({ query: schemas.pagination }),
    todoController.listTodos
  );

  // GET /api/v1/todos/categories - Get all categories for wallet
  router.get(
    '/categories',
    todoController.getCategories
  );

  // GET /api/v1/todos/tags - Get all tags for wallet
  router.get(
    '/tags',
    todoController.getTags
  );

  // GET /api/v1/todos/stats - Get todo statistics for wallet
  router.get(
    '/stats',
    todoController.getStats
  );

  // GET /api/v1/todos/:id - Get specific todo
  router.get(
    '/:id',
    validateId(),
    todoController.getTodo
  );

  // POST /api/v1/todos - Create new todo
  router.post(
    '/',
    validate({ body: schemas.createTodo }),
    todoController.createTodo
  );

  // POST /api/v1/todos/batch - Batch operations
  router.post(
    '/batch',
    validate({ body: schemas.batchOperations }),
    todoController.batchOperations
  );

  // POST /api/v1/todos/:id/complete - Mark todo as complete
  router.post(
    '/:id/complete',
    validateId(),
    todoController.completeTodo
  );

  // PUT /api/v1/todos/:id - Update todo
  router.put(
    '/:id',
    validateId(),
    validate({ body: schemas.updateTodo }),
    todoController.updateTodo
  );

  // PATCH /api/v1/todos/:id - Partial update
  router.patch(
    '/:id',
    validateId(),
    validate({ body: schemas.updateTodo }),
    todoController.updateTodo
  );

  // DELETE /api/v1/todos/:id - Delete todo
  router.delete(
    '/:id',
    validateId(),
    todoController.deleteTodo
  );

  return router;
}