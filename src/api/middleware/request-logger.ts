import type { Request, Response, NextFunction } from 'express';
import { Logger } from '../../utils/Logger';

const logger = new Logger('ApiRequestLogger');

export interface RequestLog extends Record<string, unknown> {
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
  const resWithEnd = res as unknown as { end: (chunk?: unknown, encoding?: BufferEncoding, cb?: () => void) => Response };
  const originalEnd = resWithEnd.end;
  const chunks: Buffer[] = [];

  // Override end function to capture response details
  resWithEnd.end = function (chunk?: unknown, encoding?: BufferEncoding, cb?: () => void): Response {
    // Restore original
    resWithEnd.end = originalEnd;

    // Calculate duration
    const duration = Date.now() - startTime;

    // Get response size
    let size = 0;
    if (chunks.length > 0) {
      size = Buffer.concat(chunks).length;
    } else if (chunk) {
      size = Buffer.isBuffer(chunk)
        ? chunk.length
        : Buffer.byteLength(String(chunk));
    }

    // Create log entry
    const logEntry: RequestLog = {
      method: req.method || 'UNKNOWN',
      url: req.originalUrl || req.url || 'UNKNOWN',
      ip: req.ip || (req.socket && 'remoteAddress' in req.socket ? req.socket.remoteAddress as string : 'unknown'),
      userAgent: (req.headers && req.headers['user-agent'] as string) || undefined,
      timestamp,
      duration,
      status: res.statusCode || 0,
      size,
    };

    // Log based on status code
    const statusCode = res.statusCode || 0;
    if (statusCode >= 500) {
      logger.error('Request failed', undefined, logEntry);
    } else if (statusCode >= 400) {
      logger.warn('Request error', logEntry);
    } else {
      logger.info('Request completed', logEntry);
    }

    // Call original end
    return originalEnd.call(res, chunk, encoding, cb);
  };

  // Capture response chunks for size calculation
  const resWithWrite = res as unknown as { write: (chunk: unknown, encoding?: BufferEncoding, cb?: (error?: Error | null) => void) => boolean };
  const originalWrite = resWithWrite.write;
  resWithWrite.write = function (chunk: unknown, encoding?: BufferEncoding, cb?: (error?: Error | null) => void): boolean {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    return originalWrite.call(res, chunk, encoding, cb);
  };

  next();
  return;
}
