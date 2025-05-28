import { Router, Request, Response } from 'express';
import '../types/express';
import { WebSocketService } from '../services/websocketService';
import { asyncHandler } from '../middleware/error';
import { config } from '../config';

export function createHealthRoutes(
  websocketService?: WebSocketService
): Router {
  const router = Router();

  // Basic health check
  router.get('/healthz', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      service: 'waltodo-api',
    });
  });

  // Detailed health check
  router.get(
    '/health',
    asyncHandler(async (req: Request, res: Response) => {
      const healthData = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        service: 'waltodo-api',
        environment: config.env,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        websocket: {
          enabled: config.websocket.enabled,
          ...(websocketService && {
            stats: websocketService.getStats(),
          }),
        },
        features: {
          authentication: config.auth.required,
          rateLimit: config.rateLimit.max > 0,
          logging: config.logging.enabled,
        },
      };

      res.json(healthData);
    })
  );

  // Readiness probe
  router.get('/ready', (req: Request, res: Response) => {
    // Add any readiness checks here (database connections, etc.)
    res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  });

  // Liveness probe
  router.get('/live', (req: Request, res: Response) => {
    res.json({
      status: 'alive',
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
