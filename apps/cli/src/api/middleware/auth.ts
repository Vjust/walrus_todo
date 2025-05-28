import type { Request, Response, NextFunction } from 'express';
import { getApiConfig } from '../config';
import { AuthorizationError } from '../../types/errors/consolidated/AuthorizationError';

export interface AuthenticatedRequest extends Request {
  apiKey?: string;
  userId?: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
}

export function validateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const config = getApiConfig();

  // Skip auth in development if no keys are configured
  if (config.isDevelopment() && config.auth.apiKeys.length === 0) {
    next();
    return;
  }

  // Extract API key from header or query param
  const apiKey =
    (req.headers['x-api-key'] as string) ||
    (req.headers['authorization'] as string)?.replace('Bearer ', '') ||
    (req.query.apiKey as string);

  if (!apiKey) {
    next(
      new AuthorizationError('API key required', {
        code: 'AUTHORIZATION_UNAUTHENTICATED',
        isLoginRequired: true,
      })
    );
    return;
  }

  // Validate API key
  if (!config.auth.apiKeys.includes(apiKey)) {
    next(
      new AuthorizationError('Invalid API key', {
        code: 'AUTHORIZATION_INVALID_CREDENTIALS',
      })
    );
    return;
  }

  // Attach API key to request for logging
  (req as AuthenticatedRequest).apiKey = apiKey;

  next();
  return;
}

// Optional middleware for specific routes that require user authentication
export function requireUser(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!(req as AuthenticatedRequest).userId) {
    next(
      new AuthorizationError('User authentication required', {
        code: 'AUTHORIZATION_UNAUTHENTICATED',
        isLoginRequired: true,
      })
    );
    return;
  }
  next();
  return;
}
