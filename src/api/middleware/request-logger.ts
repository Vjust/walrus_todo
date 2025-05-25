import type { Request, Response, NextFunction } from 'express';
import { Logger } from '../../utils/Logger';

const logger = new Logger('ApiRequestLogger');

export interface RequestLog {
  method: string;
  url: string;
  ip: string;
  userAgent?: string;
  timestamp: string;
  duration?: number;
  status?: number;
  size?: number;
}

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  // Capture original end function
  const originalEnd = res.end;
  const chunks: Buffer[] = [];

  // Override end function to capture response details
  res.end = function (...args: any[]): any {
    // Restore original
    res.end = originalEnd;

    // Calculate duration
    const duration = Date.now() - startTime;

    // Get response size
    let size = 0;
    if (chunks.length > 0) {
      size = Buffer.concat(chunks).length;
    } else if (args[0]) {
      size = Buffer.isBuffer(args[0])
        ? args[0].length
        : Buffer.byteLength(args[0]);
    }

    // Create log entry
    const logEntry: RequestLog = {
      method: req.method,
      url: req.originalUrl || req.url,
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'],
      timestamp,
      duration,
      status: res.statusCode,
      size,
    };

    // Log based on status code
    if (res.statusCode >= 500) {
      logger.error('Request failed', logEntry);
    } else if (res.statusCode >= 400) {
      logger.warn('Request error', logEntry);
    } else {
      logger.info('Request completed', logEntry);
    }

    // Call original end
    return originalEnd.apply(res, args as any);
  };

  // Capture response chunks for size calculation
  const originalWrite = res.write;
  res.write = function (...args: any[]): any {
    if (args[0]) {
      chunks.push(Buffer.isBuffer(args[0]) ? args[0] : Buffer.from(args[0]));
    }
    return originalWrite.apply(res, args as any);
  };

  next();
}
