"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTodoRoutes = createTodoRoutes;
const express_1 = require("express");
const todoController_1 = require("../controllers/todoController");
const todoService_1 = require("../services/todoService");
const validation_1 = require("../middleware/validation");
const auth_1 = require("../middleware/auth");
function createTodoRoutes(websocketService) {
    const router = (0, express_1.Router)();
    const todoService = new todoService_1.TodoService();
    const todoController = new todoController_1.TodoController(todoService, websocketService);
    // Apply wallet extraction middleware to all routes
    router.use(auth_1.extractWallet);
    // GET /api/v1/todos - List all todos with pagination
    router.get('/', (0, validation_1.validate)({ query: validation_1.schemas.pagination }), todoController.listTodos);
    // GET /api/v1/todos/categories - Get all categories for wallet
    router.get('/categories', todoController.getCategories);
    // GET /api/v1/todos/tags - Get all tags for wallet
    router.get('/tags', todoController.getTags);
    // GET /api/v1/todos/stats - Get todo statistics for wallet
    router.get('/stats', todoController.getStats);
    // GET /api/v1/todos/:id - Get specific todo
    router.get('/:id', (0, validation_1.validateId)(), todoController.getTodo);
    // POST /api/v1/todos - Create new todo
    router.post('/', (0, validation_1.validate)({ body: validation_1.schemas.createTodo }), todoController.createTodo);
    // POST /api/v1/todos/batch - Batch operations
    router.post('/batch', (0, validation_1.validate)({ body: validation_1.schemas.batchOperations }), todoController.batchOperations);
    // POST /api/v1/todos/:id/complete - Mark todo as complete
    router.post('/:id/complete', (0, validation_1.validateId)(), todoController.completeTodo);
    // PUT /api/v1/todos/:id - Update todo
    router.put('/:id', (0, validation_1.validateId)(), (0, validation_1.validate)({ body: validation_1.schemas.updateTodo }), todoController.updateTodo);
    // PATCH /api/v1/todos/:id - Partial update
    router.patch('/:id', (0, validation_1.validateId)(), (0, validation_1.validate)({ body: validation_1.schemas.updateTodo }), todoController.updateTodo);
    // DELETE /api/v1/todos/:id - Delete todo
    router.delete('/:id', (0, validation_1.validateId)(), todoController.deleteTodo);
    return router;
}
