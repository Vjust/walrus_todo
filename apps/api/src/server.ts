import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer, Server } from 'http';
import { config } from './config';
import { logger } from './utils/logger';
import { WebSocketService } from './services/websocketService';
import { createTodoRoutes } from './routes/todos';
import { createHealthRoutes } from './routes/health';
import { validateApiKey } from './middleware/auth';
import { requestLogger, securityHeaders } from './middleware/logging';
import {
  errorHandler,
  notFoundHandler,
  rateLimitHandler,
} from './middleware/error';

export class ApiServer {
  private app: Application;
  private httpServer: Server;
  private websocketService?: WebSocketService;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);

    this.setupMiddleware();
    this.setupWebSocket();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'ws:', 'wss:'],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        },
        crossOriginEmbedderPolicy: false, // Allow WebSocket connections
      })
    );

    this.app.use(securityHeaders);

    // CORS configuration
    this.app.use(
      cors({
        origin: config.cors.origins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-API-Key',
          'X-Wallet-Address',
          'Origin',
          'Accept',
        ],
        exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
      })
    );

    // Rate limiting
    if (config.rateLimit.max > 0) {
      const limiter = rateLimit({
        windowMs: config.rateLimit.windowMs,
        max: config.rateLimit.max,
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
        handler: rateLimitHandler,
      });
      this.app.use(limiter);
    }

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(
      express.json({
        limit: '10mb',
        strict: true,
      })
    );
    this.app.use(
      express.urlencoded({
        extended: true,
        limit: '10mb',
      })
    );

    // Request logging
    if (config.logging.enabled) {
      this.app.use(requestLogger);
    }

    // API key validation (optional)
    if (config.auth.required) {
      this.app.use('/api', validateApiKey);
    }
  }

  private setupWebSocket(): void {
    if (config.websocket.enabled) {
      this.websocketService = new WebSocketService(this.httpServer);
      logger.info('WebSocket service enabled');
    } else {
      logger.info('WebSocket service disabled');
    }
  }

  private setupRoutes(): void {
    // Health check routes (no auth required)
    this.app.use(createHealthRoutes(this.websocketService));

    // API routes
    this.app.use('/api/v1/todos', createTodoRoutes(this.websocketService));

    // API documentation endpoint
    this.app.get(
      '/api',
      (req: express.Request, res: express.Response): void => {
        res.json({
          name: 'WalTodo API',
          version: '1.0.0',
          description: 'REST API for WalTodo with WebSocket support',
          endpoints: {
            health: {
              'GET /healthz': 'Basic health check',
              'GET /health': 'Detailed health information',
              'GET /ready': 'Readiness probe',
              'GET /live': 'Liveness probe',
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
              'GET /api/v1/todos/stats': 'Get statistics',
            },
            websocket: {
              events: config.websocket.enabled
                ? [
                    'todo-created',
                    'todo-updated',
                    'todo-deleted',
                    'todo-completed',
                    'sync-requested',
                    'error',
                  ]
                : ['WebSocket disabled'],
            },
          },
          authentication: config.auth.required
            ? 'API Key required'
            : 'Optional',
          timestamp: new Date().toISOString(),
        });
      }
    );

    // 404 handler for unknown routes
    this.app.use(notFoundHandler);
  }

  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  public async start(port?: number): Promise<void> {
    const serverPort = port || config.port;

    return new Promise((resolve, reject) => {
      this.httpServer
        .listen(serverPort, () => {
          logger.info(`WalTodo API Server started`, {
            port: serverPort,
            environment: config.env,
            websocket: config.websocket.enabled,
            authentication: config.auth.required,
            rateLimit:
              config.rateLimit.max > 0
                ? `${config.rateLimit.max} requests per ${config.rateLimit.windowMs}ms`
                : 'disabled',
          });

          if (config.env === 'development') {
            logger.info(
              `API Documentation available at: http://localhost:${serverPort}/api`
            );
            logger.info(
              `Health check available at: http://localhost:${serverPort}/healthz`
            );
          }

          resolve();
        })
        .on('error', error => {
          logger.error('Failed to start server', error);
          reject(error);
        });
    });
  }

  public async stop(): Promise<void> {
    return new Promise(resolve => {
      this.httpServer.close(() => {
        logger.info('WalTodo API Server stopped');
        resolve();
      });
    });
  }

  public getApp(): Application {
    return this.app;
  }

  public getHttpServer(): Server {
    return this.httpServer;
  }

  public getWebSocketService(): WebSocketService | undefined {
    return this.websocketService;
  }
}
