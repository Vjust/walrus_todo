import { Router } from 'express';
import { TodoController } from '../controllers/todo-controller';
import { validate, schemas, validateId } from '../middleware/validation';
import { asyncHandler } from '../middleware/error-handler';

const router = Router();
const controller = new TodoController();

// GET /todos - List all todos with pagination
router.get(
  '/',
  validate({ query: schemas.pagination }),
  asyncHandler(controller.list)
);

// GET /todos/:id - Get specific todo
router.get('/:id', validateId(), asyncHandler(controller.get));

// POST /todos - Create new todo
router.post(
  '/',
  validate({ body: schemas.createTodo }),
  asyncHandler(controller.create)
);

// PUT /todos/:id - Update todo
router.put(
  '/:id',
  validateId(),
  validate({ body: schemas.updateTodo }),
  asyncHandler(controller.update)
);

// PATCH /todos/:id - Partial update
router.patch(
  '/:id',
  validateId(),
  validate({ body: schemas.updateTodo }),
  asyncHandler(controller.update)
);

// DELETE /todos/:id - Delete todo
router.delete('/:id', validateId(), asyncHandler(controller.delete));

// POST /todos/:id/complete - Mark todo as complete
router.post('/:id/complete', validateId(), asyncHandler(controller.complete));

// POST /todos/:id/store - Store todo on blockchain
router.post('/:id/store', validateId(), asyncHandler(controller.store));

// GET /todos/:id/retrieve - Retrieve todo from blockchain
router.get('/:id/retrieve', validateId(), asyncHandler(controller.retrieve));

// POST /todos/batch - Batch operations
router.post('/batch', asyncHandler(controller.batch));

export default router;
