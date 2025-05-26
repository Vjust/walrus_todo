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
  const originalEnd = (res as any).end;
  const chunks: Buffer[] = [];

  // Override end function to capture response details
  (res as any).end = function (chunk?: unknown, encoding?: BufferEncoding, cb?: () => void): Response {
    // Restore original
    (res as any).end = originalEnd;

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
      method: (req as any).method,
      url: (req as any).originalUrl || (req as any).url,
      ip: (req as any).ip || (req as any).socket?.remoteAddress || 'unknown',
      userAgent: (req as any).headers['user-agent'],
      timestamp,
      duration,
      status: (res as any).statusCode,
      size,
    };

    // Log based on status code
    if ((res as any).statusCode >= 500) {
      logger.error('Request failed', undefined, logEntry);
    } else if ((res as any).statusCode >= 400) {
      logger.warn('Request error', logEntry);
    } else {
      logger.info('Request completed', logEntry);
    }

    // Call original end
    return originalEnd.call(res, chunk, encoding, cb);
  };

  // Capture response chunks for size calculation
  const originalWrite = (res as any).write;
  (res as any).write = function (chunk: unknown, encoding?: BufferEncoding, cb?: (error?: Error | null) => void): boolean {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    return originalWrite.call(res, chunk, encoding, cb);
  };

  (next as any)();
}
