/**
 * High-performance API server with optimizations
 */

import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { APICache, performanceOptimizations } from '../utils/performance-optimizations';
import { CLIPerformanceOptimizer } from '../utils/cli-performance-optimizer';

interface ServerConfig {
  port: number;
  host: string;
  cors: {
    origin: string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  compression: {
    level: number;
    threshold: number;
  };
}

export class PerformanceOptimizedServer {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private cache: APICache;
  private config: ServerConfig;
  private performanceOptimizer: CLIPerformanceOptimizer;

  constructor(config: ServerConfig) {
    this.config = config;
    this.app = express();
    this.cache = APICache.getInstance();
    this.performanceOptimizer = CLIPerformanceOptimizer.getInstance();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // Compression middleware
    this.app.use(compression({
      level: this.config.compression.level,
      threshold: this.config.compression.threshold,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: this.config.rateLimit.windowMs,
      max: this.config.rateLimit.max,
      message: {
        error: 'Too many requests from this IP, please try again later.',
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // JSON parsing with size limit
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // CORS
    this.app.use((req, res, next) => {
      const origin = req.headers.origin;
      if (this.config.cors.origin.includes(origin || '')) {
        res.setHeader('Access-Control-Allow-Origin', origin || '');
      }
      res.setHeader('Access-Control-Allow-Credentials', this.config.cors.credentials.toString());
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }
      
      next();
    });

    // Performance monitoring middleware
    this.app.use((req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        this.performanceOptimizer.endCommand(`${req.method} ${req.path}`);
        
        // Log slow requests
        if (duration > 1000) {
          console.warn(`Slow request: ${req.method} ${req.path} took ${duration}ms`);
        }
      });
      
      this.performanceOptimizer.startCommand(`${req.method} ${req.path}`);
      next();
    });

    // Cache middleware
    this.app.use('/api/cache', this.createCacheMiddleware());
  }

  private createCacheMiddleware() {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      // Only cache GET requests
      if (req.method !== 'GET') {
        return next();
      }

      const cacheKey = this.cache.generateKey(req.path, req.query);
      const cachedData = this.cache.get(req.path, req.query);

      if (cachedData) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.json(cachedData);
      }

      // Capture the original send method
      const originalSend = res.json;
      res.json = function(data: any) {
        // Cache successful responses
        if (res.statusCode === 200) {
          const ttl = req.path.includes('/todos') ? 60000 : 300000; // 1min for todos, 5min for others
          this.cache.set(req.path, req.query, data, ttl);
        }
        
        res.setHeader('X-Cache', 'MISS');
        return originalSend.call(this, data);
      }.bind(this);

      next();
    };
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const metrics = this.performanceOptimizer.generateReport();
      res.json({
        status: 'healthy',
        timestamp: Date.now(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        performance: {
          startupTime: metrics.startupTime,
          cacheHitRate: metrics.cacheHitRate,
        },
      });
    });

    // Performance metrics endpoint
    this.app.get('/api/metrics', (req, res) => {
      const metrics = this.performanceOptimizer.generateReport();
      const cacheStats = this.cache.getStats();
      
      res.json({
        ...metrics,
        cache: cacheStats,
        recommendations: this.performanceOptimizer.getRecommendations(),
      });
    });

    // Optimized todo endpoints
    this.app.get('/api/v1/todos', this.optimizedGetTodos.bind(this));
    this.app.post('/api/v1/todos', this.optimizedCreateTodo.bind(this));
    this.app.put('/api/v1/todos/:id', this.optimizedUpdateTodo.bind(this));
    this.app.delete('/api/v1/todos/:id', this.optimizedDeleteTodo.bind(this));

    // Batch operations endpoint
    this.app.post('/api/v1/todos/batch', this.batchTodoOperations.bind(this));

    // Cache control endpoints
    this.app.delete('/api/cache', (req, res) => {
      this.cache.invalidate();
      res.json({ message: 'Cache cleared successfully' });
    });

    // Static file serving with caching
    this.app.use('/static', express.static('public', {
      maxAge: '1d',
      etag: true,
      lastModified: true,
    }));

    // Error handling
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Server error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.originalUrl} not found`,
      });
    });
  }

  private setupWebSocket(): void {
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: this.config.cors.origin,
        credentials: this.config.cors.credentials,
      },
      transports: ['websocket'],
    });

    // WebSocket performance optimizations
    const { throttler, batchProcessor } = performanceOptimizations;

    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Throttled todo updates
      const throttledTodoUpdate = throttler.throttle(
        `todo-update-${socket.id}`,
        (data: any) => {
          socket.emit('todo-updated', data);
        },
        100 // 100ms throttle
      );

      // Batched notifications
      socket.on('todo-change', (data) => {
        batchProcessor.add('notifications', data, (notifications) => {
          this.io.emit('batch-todo-changes', notifications);
        });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        throttler.clear(`todo-update-${socket.id}`);
      });
    });
  }

  // Optimized API methods
  private async optimizedGetTodos(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { limit = 50, offset = 0, filter } = req.query;
      
      // Mock todo fetching with performance optimization
      const todos = await this.fetchTodosOptimized({
        limit: Number(limit),
        offset: Number(offset),
        filter: filter as string,
      });
      
      res.json({
        todos,
        pagination: {
          limit: Number(limit),
          offset: Number(offset),
          total: todos.length,
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch todos' });
    }
  }

  private async optimizedCreateTodo(req: express.Request, res: express.Response): Promise<void> {
    try {
      const todoData = req.body;
      
      // Validate and create todo
      const newTodo = await this.createTodoOptimized(todoData);
      
      // Invalidate relevant cache entries
      this.cache.invalidate('/api/v1/todos');
      
      // Notify via WebSocket
      this.io.emit('todo-created', newTodo);
      
      res.status(201).json(newTodo);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create todo' });
    }
  }

  private async optimizedUpdateTodo(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const updatedTodo = await this.updateTodoOptimized(id, updateData);
      
      // Invalidate cache
      this.cache.invalidate('/api/v1/todos');
      
      // Notify via WebSocket
      this.io.emit('todo-updated', updatedTodo);
      
      res.json(updatedTodo);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update todo' });
    }
  }

  private async optimizedDeleteTodo(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;
      
      await this.deleteTodoOptimized(id);
      
      // Invalidate cache
      this.cache.invalidate('/api/v1/todos');
      
      // Notify via WebSocket
      this.io.emit('todo-deleted', { id });
      
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete todo' });
    }
  }

  private async batchTodoOperations(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { operations } = req.body;
      
      const results = await Promise.allSettled(
        operations.map((op: any) => this.processBatchOperation(op))
      );
      
      // Invalidate cache once for all operations
      this.cache.invalidate('/api/v1/todos');
      
      // Batch notify via WebSocket
      this.io.emit('batch-todos-updated', results);
      
      res.json({ results });
    } catch (error) {
      res.status(400).json({ error: 'Failed to process batch operations' });
    }
  }

  // Mock optimized database operations
  private async fetchTodosOptimized(params: any): Promise<any[]> {
    // Simulate optimized database query
    await new Promise(resolve => setTimeout(resolve, 50));
    return [];
  }

  private async createTodoOptimized(data: any): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 30));
    return { id: Date.now().toString(), ...data, createdAt: new Date() };
  }

  private async updateTodoOptimized(id: string, data: any): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 30));
    return { id, ...data, updatedAt: new Date() };
  }

  private async deleteTodoOptimized(id: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 20));
  }

  private async processBatchOperation(operation: any): Promise<any> {
    switch (operation.type) {
      case 'create':
        return this.createTodoOptimized(operation.data);
      case 'update':
        return this.updateTodoOptimized(operation.id, operation.data);
      case 'delete':
        return this.deleteTodoOptimized(operation.id);
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.config.port, this.config.host, () => {
        console.log(`🚀 Performance-optimized server running on http://${this.config.host}:${this.config.port}`);
        console.log(`📊 Metrics available at http://${this.config.host}:${this.config.port}/api/metrics`);
        resolve();
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log('Server stopped');
        resolve();
      });
    });
  }

  public getApp(): express.Application {
    return this.app;
  }
}

// Create default server instance
export function createOptimizedServer(customConfig?: Partial<ServerConfig>): PerformanceOptimizedServer {
  const defaultConfig: ServerConfig = {
    port: 8080,
    host: '0.0.0.0',
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true,
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
    },
    compression: {
      level: 6,
      threshold: 1024,
    },
  };

  const config = { ...defaultConfig, ...customConfig };
  return new PerformanceOptimizedServer(config);
}

export default PerformanceOptimizedServer;