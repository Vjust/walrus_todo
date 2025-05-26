import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { validateApiKey } from './middleware/auth';
import todoRoutes from './routes/todos';
import syncRoutes from './routes/sync';
import { ApiConfig } from './config';
import { Logger } from '../utils/Logger';

const logger = new Logger('server');

export class ApiServer {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private config: ApiConfig;

  constructor(config: ApiConfig) {
    this.config = config;
    this.app = express();
    this.server = createServer(this.app);
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    (this.app as any).use(helmet());

    // CORS configuration
    (this.app as any).use(
      cors({
        origin: this.config.cors.origins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
      })
    );

    // Compression
    (this.app as any).use(compression());

    // Body parsing
    (this.app as any).use(express.json({ limit: this.config.bodyLimit }));
    (this.app as any).use(
      express.urlencoded({ extended: true, limit: this.config.bodyLimit })
    );

    // Request logging
    if (this.config.logging.enabled) {
      (this.app as any).use(requestLogger);
    }

    // API key validation (can be disabled for development)
    if (this.config.auth.required) {
      (this.app as any).use(validateApiKey);
    }
  }

  private setupRoutes(): void {
    // Health check
    (this.app as any).get('/health', (req: express.Request, res: express.Response) => {
      (res as any).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: this.config.version,
      });
    });

    // API routes
    (this.app as any).use('/api/v1/todos', todoRoutes);
    (this.app as any).use('/api/v1/sync', syncRoutes);

    // 404 handler
    (this.app as any).use((req: express.Request, res: express.Response) => {
      (res as any).status(404).json({
        error: 'Not Found',
        message: `Route ${(req as any).method} ${(req as any).path} not found`,
      });
    });
  }

  private setupErrorHandling(): void {
    (this.app as any).use(errorHandler);
  }

  public async start(): Promise<void> {
    return new Promise(resolve => {
      this.server.listen(this.config.port, () => {
        logger.info(`API Server started on port ${this.config.port}`);
        logger.info(`Environment: ${this.config.env}`);
        if (this.config.env === 'development') {
          logger.info(
            `API Documentation: http://localhost:${this.config.port}/api-docs`
          );
        }
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise(resolve => {
      this.server.close(() => {
        logger.info('API Server stopped');
        resolve();
      });
    });
  }

  public getApp(): express.Application {
    return this.app;
  }
}

// Export function to create and start server
export async function createApiServer(
  config?: Partial<ApiConfig>
): Promise<ApiServer> {
  const fullConfig = new ApiConfig(config);
  const server = new ApiServer(fullConfig);
  await server.start();
  return server;
}
