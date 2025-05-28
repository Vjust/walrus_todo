import type { Request, Response, NextFunction } from 'express';
import { BaseError } from '../../types/errors/consolidated/BaseError';
import { ValidationError } from '../../types/errors/consolidated/ValidationError';
import { NetworkError } from '../../types/errors/consolidated/NetworkError';
import { Logger } from '../../utils/Logger';

const logger = new Logger('ApiErrorHandler');

/**
 * Discriminated union for API error details
 */
export type ApiErrorDetails =
  | { kind: 'object'; data: Record<string, unknown> }
  | { kind: 'array'; data: string[] }
  | { kind: 'string'; data: string };

/**
 * API Error interface with better type safety
 */
export interface ApiError {
  error: string;
  message: string;
  code?: string;
  status?: number;
  details?: ApiErrorDetails;
  stack?: string;
}

/**
 * Legacy interface for backward compatibility
 */
export interface LegacyApiError {
  error: string;
  message: string;
  code?: string;
  status?: number;
  details?: Record<string, unknown> | string[] | string;
  stack?: string;
}

/**
 * Type guards for error details
 */
export function isObjectDetails(
  details: ApiErrorDetails
): details is { kind: 'object'; data: Record<string, unknown> } {
  return details.kind === 'object';
}

export function isArrayDetails(
  details: ApiErrorDetails
): details is { kind: 'array'; data: string[] } {
  return details.kind === 'array';
}

export function isStringDetails(
  details: ApiErrorDetails
): details is { kind: 'string'; data: string } {
  return details.kind === 'string';
}

/**
 * Factory functions for creating error details
 */
export function createObjectDetails(
  data: Record<string, unknown>
): ApiErrorDetails {
  return { kind: 'object', data };
}

export function createArrayDetails(data: string[]): ApiErrorDetails {
  return { kind: 'array', data };
}

export function createStringDetails(data: string): ApiErrorDetails {
  return { kind: 'string', data };
}

/**
 * Normalize legacy details to discriminated union
 */
export function normalizeErrorDetails(
  details: Record<string, unknown> | string[] | string
): ApiErrorDetails {
  if (Array.isArray(details)) {
    return createArrayDetails(details);
  }
  if (typeof details === 'string') {
    return createStringDetails(details);
  }
  return createObjectDetails(details);
}

export function errorHandler(
  err: Error | BaseError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log the error
  logger.error('API Error:', err, {
    requestMethod: req.method || 'UNKNOWN',
    requestPath: req.path || req.url || 'UNKNOWN',
  });

  // Determine status code
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let details: ApiErrorDetails | undefined = undefined;

  if (err instanceof ValidationError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    const validationErrors = (
      err as ValidationError & {
        validationErrors?: Record<string, unknown> | string[];
      }
    ).validationErrors;
    if (validationErrors) {
      details = normalizeErrorDetails(validationErrors);
    }
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
  fn: (
    req: Request,
    res: Response,
    next: NextFunction
  ) => Promise<void | Response>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error: unknown) => {
      const typedError =
        error instanceof Error ? error : new Error(String(error));
      return next(typedError);
    });
  };
}
