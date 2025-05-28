"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitHandler = exports.notFoundHandler = exports.errorHandler = exports.asyncHandler = exports.ApiError = void 0;
const logger_1 = require("../utils/logger");
class ApiError extends Error {
    constructor(message, statusCode = 500, code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = 'ApiError';
    }
}
exports.ApiError = ApiError;
// Async handler wrapper to catch async errors
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
// Global error handler
const errorHandler = (error, req, res, next) => {
    let statusCode = 500;
    let message = 'Internal Server Error';
    let code = 'INTERNAL_ERROR';
    if (error instanceof ApiError) {
        statusCode = error.statusCode;
        message = error.message;
        code = error.code || 'API_ERROR';
    }
    else if (error.name === 'ValidationError') {
        statusCode = 400;
        message = error.message;
        code = 'VALIDATION_ERROR';
    }
    else if (error.name === 'UnauthorizedError') {
        statusCode = 401;
        message = 'Unauthorized';
        code = 'UNAUTHORIZED';
    }
    else if (error.name === 'CastError') {
        statusCode = 400;
        message = 'Invalid ID format';
        code = 'INVALID_ID';
    }
    // Log error
    logger_1.logger.error('API Error', {
        error: {
            message: error.message,
            stack: error.stack,
            statusCode,
            code
        },
        request: {
            method: req.method,
            url: req.url,
            headers: req.headers,
            body: req.body,
            ip: req.ip
        }
    });
    // Send error response
    res.status(statusCode).json({
        success: false,
        error: message,
        code,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && {
            stack: error.stack,
            details: error
        })
    });
};
exports.errorHandler = errorHandler;
// 404 handler
const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        error: `Route ${req.method} ${req.path} not found`,
        code: 'NOT_FOUND',
        timestamp: new Date().toISOString()
    });
};
exports.notFoundHandler = notFoundHandler;
// Rate limit error handler
const rateLimitHandler = (req, res) => {
    res.status(429).json({
        success: false,
        error: 'Too many requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED',
        timestamp: new Date().toISOString()
    });
};
exports.rateLimitHandler = rateLimitHandler;
