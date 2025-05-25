import type { Request, Response, NextFunction } from 'express';
import { getApiConfig } from '../config';
import { AuthorizationError } from '../../types/errors/consolidated/AuthorizationError';

export interface AuthenticatedRequest extends Request {
  apiKey?: string;
  userId?: string;
}

export function validateApiKey(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const config = getApiConfig();

  // Skip auth in development if no keys are configured
  if (config.isDevelopment() && config.auth.apiKeys.length === 0) {
    return next();
  }

  // Extract API key from header or query param
  const apiKey =
    (req.headers['x-api-key'] as string) ||
    req.headers['authorization']?.replace('Bearer ', '') ||
    (req.query.apiKey as string);

  if (!apiKey) {
    return next(new AuthorizationError('API key required', {
      code: 'AUTHORIZATION_UNAUTHENTICATED',
      isLoginRequired: true
    }));
  }

  // Validate API key
  if (!config.auth.apiKeys.includes(apiKey)) {
    return next(new AuthorizationError('Invalid API key', {
      code: 'AUTHORIZATION_INVALID_CREDENTIALS'
    }));
  }

  // Attach API key to request for logging
  req.apiKey = apiKey;

  next();
}

// Optional middleware for specific routes that require user authentication
export function requireUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.userId) {
    return next(new AuthorizationError('User authentication required', {
      code: 'AUTHORIZATION_UNAUTHENTICATED',
      isLoginRequired: true
    }));
  }
  next();
}
