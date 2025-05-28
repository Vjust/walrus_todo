"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateId = exports.validate = exports.schemas = void 0;
const zod_1 = require("zod");
const logger_1 = require("../utils/logger");
// Zod schemas for validation
exports.schemas = {
    createTodo: zod_1.z.object({
        content: zod_1.z.string().min(1).max(1000),
        priority: zod_1.z.enum(['high', 'medium', 'low']).optional(),
        category: zod_1.z.string().max(100).optional(),
        tags: zod_1.z.array(zod_1.z.string().max(50)).max(10).optional()
    }),
    updateTodo: zod_1.z.object({
        content: zod_1.z.string().min(1).max(1000).optional(),
        completed: zod_1.z.boolean().optional(),
        priority: zod_1.z.enum(['high', 'medium', 'low']).optional(),
        category: zod_1.z.string().max(100).optional(),
        tags: zod_1.z.array(zod_1.z.string().max(50)).max(10).optional()
    }),
    pagination: zod_1.z.object({
        page: zod_1.z.string().regex(/^\d+$/).optional(),
        limit: zod_1.z.string().regex(/^\d+$/).optional(),
        wallet: zod_1.z.string().optional()
    }),
    batchOperations: zod_1.z.object({
        operations: zod_1.z.array(zod_1.z.object({
            action: zod_1.z.enum(['create', 'update', 'delete', 'complete']),
            id: zod_1.z.string().optional(),
            data: zod_1.z.union([
                zod_1.z.object({
                    content: zod_1.z.string().min(1).max(1000),
                    priority: zod_1.z.enum(['high', 'medium', 'low']).optional(),
                    category: zod_1.z.string().max(100).optional(),
                    tags: zod_1.z.array(zod_1.z.string().max(50)).max(10).optional()
                }),
                zod_1.z.object({
                    content: zod_1.z.string().min(1).max(1000).optional(),
                    completed: zod_1.z.boolean().optional(),
                    priority: zod_1.z.enum(['high', 'medium', 'low']).optional(),
                    category: zod_1.z.string().max(100).optional(),
                    tags: zod_1.z.array(zod_1.z.string().max(50)).max(10).optional()
                })
            ]).optional()
        })).min(1).max(50)
    })
};
// Generic validation middleware factory
const validate = (schema) => {
    return (req, res, next) => {
        try {
            if (schema.body) {
                req.body = schema.body.parse(req.body);
            }
            if (schema.query) {
                req.query = schema.query.parse(req.query);
            }
            if (schema.params) {
                req.params = schema.params.parse(req.params);
            }
            next();
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                const errorMessages = error.errors.map((err) => ({
                    field: err.path.join('.'),
                    message: err.message,
                    received: err.input
                }));
                logger_1.logger.warn('Validation error', { errors: errorMessages, body: req.body });
                res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errorMessages,
                    timestamp: new Date().toISOString()
                });
                return;
            }
            logger_1.logger.error('Unexpected validation error', error);
            res.status(500).json({
                success: false,
                error: 'Internal validation error',
                timestamp: new Date().toISOString()
            });
        }
    };
};
exports.validate = validate;
// ID parameter validation
const validateId = () => {
    return (req, res, next) => {
        const { id } = req.params;
        if (!id || typeof id !== 'string' || id.length < 1) {
            res.status(400).json({
                success: false,
                error: 'Valid ID parameter required',
                timestamp: new Date().toISOString()
            });
            return;
        }
        // Basic UUID format check (optional)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            res.status(400).json({
                success: false,
                error: 'Invalid ID format',
                timestamp: new Date().toISOString()
            });
            return;
        }
        next();
    };
};
exports.validateId = validateId;
