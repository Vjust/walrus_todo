import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';
import '../types/express';

export interface JWTPayload {
  wallet: string;
  iat?: number;
  exp?: number;
}

// API Key authentication middleware
export const validateApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!config.auth.required) {
    return next();
  }

  const apiKey = req.header?.('X-API-Key') || (req.query.apiKey as string);

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: 'API key required',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (!config.auth.apiKeys.includes(apiKey)) {
    logger.warn('Invalid API key attempt', {
      key: apiKey.substring(0, 8) + '...',
      ip: req.ip,
    });
    res.status(401).json({
      success: false,
      error: 'Invalid API key',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  next();
};

// JWT authentication middleware
export const authenticateJWT = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.header?.('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Access token required',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret) as JWTPayload;
    req.wallet = decoded.wallet;
    req.user = {
      id: decoded.wallet,
      wallet: decoded.wallet,
    };
    next();
  } catch (error) {
    logger.warn('Invalid JWT token', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(403).json({
      success: false,
      error: 'Invalid or expired token',
      timestamp: new Date().toISOString(),
    });
  }
};

// Optional wallet extraction from query/header
export const extractWallet = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Try to get wallet from JWT first
  if (req.wallet) {
    return next();
  }

  // Fall back to wallet parameter/header for development
  const wallet =
    (req.query.wallet as string) || req.header?.('X-Wallet-Address');

  if (wallet) {
    req.wallet = wallet;
    req.user = {
      id: wallet,
      wallet: wallet,
    };
  }

  next();
};

// Generate JWT token for wallet
export const generateToken = (wallet: string): string => {
  return jwt.sign({ wallet }, config.auth.jwtSecret, { expiresIn: '24h' });
};

// Validate wallet format (Sui address)
export const isValidWallet = (wallet: string): boolean => {
  // Sui addresses are 32 bytes (64 hex chars) with 0x prefix
  const suiAddressRegex = /^0x[a-fA-F0-9]{64}$/;
  return suiAddressRegex.test(wallet);
};
