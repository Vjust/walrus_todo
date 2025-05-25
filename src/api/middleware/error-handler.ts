import type { Request, Response, NextFunction } from 'express';
import { BaseError } from '../../types/errors/consolidated/BaseError';
import { ValidationError } from '../../types/errors/consolidated/ValidationError';
import { NetworkError } from '../../types/errors/consolidated/NetworkError';
import { Logger } from '../../utils/Logger';

const logger = new Logger('ApiErrorHandler');

export interface ApiError {
  error: string;
  message: string;
  code?: string;
  status?: number;
  details?: any;
  stack?: string;
}

export function errorHandler(
  err: Error | BaseError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log the error
  logger.error('API Error:', {
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack,
  });

  // Determine status code
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let details: any = undefined;

  if (err instanceof ValidationError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    details = (err as any).validationErrors;
  } else if (err instanceof NetworkError) {
    status = 503;
    code = 'NETWORK_ERROR';
  } else if (err instanceof BaseError) {
    // Handle other custom errors
    const baseError = err as BaseError;
    if (baseError.code === 'NOT_FOUND') {
      status = 404;
    } else if (baseError.code === 'UNAUTHORIZED') {
      status = 401;
    } else if (baseError.code === 'FORBIDDEN') {
      status = 403;
    }
    code = baseError.code;
  } else if (err.name === 'ValidationError') {
    // Handle validation errors from libraries
    status = 400;
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'UnauthorizedError') {
    status = 401;
    code = 'UNAUTHORIZED';
  }

  // Create error response
  const errorResponse: ApiError = {
    error: err.name || 'Error',
    message: err.message || 'An unexpected error occurred',
    code,
    status,
  };

  // Add details if available
  if (details) {
    errorResponse.details = details;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development' && err.stack) {
    errorResponse.stack = err.stack;
  }

  // Send response
  res.status(status).json(errorResponse);
}

// Async error wrapper
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
