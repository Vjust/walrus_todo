"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiServer = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const http_1 = require("http");
const config_1 = require("./config");
const logger_1 = require("./utils/logger");
const websocketService_1 = require("./services/websocketService");
const todos_1 = require("./routes/todos");
const health_1 = require("./routes/health");
const auth_1 = require("./middleware/auth");
const logging_1 = require("./middleware/logging");
const error_1 = require("./middleware/error");
class ApiServer {
    constructor() {
        this.app = (0, express_1.default)();
        this.httpServer = (0, http_1.createServer)(this.app);
        this.setupMiddleware();
        this.setupWebSocket();
        this.setupRoutes();
        this.setupErrorHandling();
    }
    setupMiddleware() {
        // Security middleware
        this.app.use((0, helmet_1.default)({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "ws:", "wss:"],
                    fontSrc: ["'self'"],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'"],
                    frameSrc: ["'none'"],
                },
            },
            crossOriginEmbedderPolicy: false // Allow WebSocket connections
        }));
        this.app.use(logging_1.securityHeaders);
        // CORS configuration
        this.app.use((0, cors_1.default)({
            origin: config_1.config.cors.origins,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: [
                'Content-Type',
                'Authorization',
                'X-API-Key',
                'X-Wallet-Address',
                'Origin',
                'Accept'
            ],
            exposedHeaders: ['X-Total-Count', 'X-Page-Count']
        }));
        // Rate limiting
        if (config_1.config.rateLimit.max > 0) {
            const limiter = (0, express_rate_limit_1.default)({
                windowMs: config_1.config.rateLimit.windowMs,
                max: config_1.config.rateLimit.max,
                message: 'Too many requests from this IP, please try again later.',
                standardHeaders: true,
                legacyHeaders: false,
                handler: error_1.rateLimitHandler
            });
            this.app.use(limiter);
        }
        // Compression
        this.app.use((0, compression_1.default)());
        // Body parsing
        this.app.use(express_1.default.json({
            limit: '10mb',
            strict: true
        }));
        this.app.use(express_1.default.urlencoded({
            extended: true,
            limit: '10mb'
        }));
        // Request logging
        if (config_1.config.logging.enabled) {
            this.app.use(logging_1.requestLogger);
        }
        // API key validation (optional)
        if (config_1.config.auth.required) {
            this.app.use('/api', auth_1.validateApiKey);
        }
    }
    setupWebSocket() {
        if (config_1.config.websocket.enabled) {
            this.websocketService = new websocketService_1.WebSocketService(this.httpServer);
            logger_1.logger.info('WebSocket service enabled');
        }
        else {
            logger_1.logger.info('WebSocket service disabled');
        }
    }
    setupRoutes() {
        // Health check routes (no auth required)
        this.app.use((0, health_1.createHealthRoutes)(this.websocketService));
        // API routes
        this.app.use('/api/v1/todos', (0, todos_1.createTodoRoutes)(this.websocketService));
        // API documentation endpoint
        this.app.get('/api', (req, res) => {
            res.json({
                name: 'WalTodo API',
                version: '1.0.0',
                description: 'REST API for WalTodo with WebSocket support',
                endpoints: {
                    health: {
                        'GET /healthz': 'Basic health check',
                        'GET /health': 'Detailed health information',
                        'GET /ready': 'Readiness probe',
                        'GET /live': 'Liveness probe'
                    },
                    todos: {
                        'GET /api/v1/todos': 'List todos with pagination',
                        'GET /api/v1/todos/:id': 'Get specific todo',
                        'POST /api/v1/todos': 'Create new todo',
                        'PUT /api/v1/todos/:id': 'Update todo',
                        'PATCH /api/v1/todos/:id': 'Partial update todo',
                        'DELETE /api/v1/todos/:id': 'Delete todo',
                        'POST /api/v1/todos/:id/complete': 'Mark todo as complete',
                        'POST /api/v1/todos/batch': 'Batch operations',
                        'GET /api/v1/todos/categories': 'Get categories',
                        'GET /api/v1/todos/tags': 'Get tags',
                        'GET /api/v1/todos/stats': 'Get statistics'
                    },
                    websocket: {
                        events: config_1.config.websocket.enabled ? [
                            'todo-created',
                            'todo-updated',
                            'todo-deleted',
                            'todo-completed',
                            'sync-requested',
                            'error'
                        ] : ['WebSocket disabled']
                    }
                },
                authentication: config_1.config.auth.required ? 'API Key required' : 'Optional',
                timestamp: new Date().toISOString()
            });
        });
        // 404 handler for unknown routes
        this.app.use(error_1.notFoundHandler);
    }
    setupErrorHandling() {
        this.app.use(error_1.errorHandler);
    }
    async start(port) {
        const serverPort = port || config_1.config.port;
        return new Promise((resolve, reject) => {
            this.httpServer.listen(serverPort, () => {
                logger_1.logger.info(`WalTodo API Server started`, {
                    port: serverPort,
                    environment: config_1.config.env,
                    websocket: config_1.config.websocket.enabled,
                    authentication: config_1.config.auth.required,
                    rateLimit: config_1.config.rateLimit.max > 0 ? `${config_1.config.rateLimit.max} requests per ${config_1.config.rateLimit.windowMs}ms` : 'disabled'
                });
                if (config_1.config.env === 'development') {
                    logger_1.logger.info(`API Documentation available at: http://localhost:${serverPort}/api`);
                    logger_1.logger.info(`Health check available at: http://localhost:${serverPort}/healthz`);
                }
                resolve();
            }).on('error', (error) => {
                logger_1.logger.error('Failed to start server', error);
                reject(error);
            });
        });
    }
    async stop() {
        return new Promise((resolve) => {
            this.httpServer.close(() => {
                logger_1.logger.info('WalTodo API Server stopped');
                resolve();
            });
        });
    }
    getApp() {
        return this.app;
    }
    getHttpServer() {
        return this.httpServer;
    }
    getWebSocketService() {
        return this.websocketService;
    }
}
exports.ApiServer = ApiServer;
