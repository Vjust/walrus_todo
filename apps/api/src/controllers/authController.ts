import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';
import { generateToken, isValidWallet, JWTPayload } from '../middleware/auth';

// In-memory token blacklist (in production, use Redis or similar)
const tokenBlacklist = new Set<string>();

// In-memory refresh tokens (in production, use Redis or similar)
const refreshTokens = new Map<string, { wallet: string; expiresAt: Date }>();

export const authController = {
  /**
   * Login with wallet signature
   * For now, this is a mock implementation that validates wallet format
   * In production, this would verify the actual signature using Sui SDK
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { wallet, signature, message } = req.body;

      // Validate wallet format
      if (!isValidWallet(wallet)) {
        res.status(400).json({
          success: false,
          error: 'Invalid wallet address format',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Mock signature verification
      // In production, use Sui SDK to verify the signature
      // Example: await verifyPersonalMessage(message, signature, wallet)
      const isValidSignature = await mockVerifySignature(wallet, signature, message);

      if (!isValidSignature) {
        res.status(401).json({
          success: false,
          error: 'Invalid signature',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Generate access token
      const accessToken = generateToken(wallet);

      // Generate refresh token
      const refreshToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

      refreshTokens.set(refreshToken, { wallet, expiresAt });

      logger.info('User logged in', { wallet });

      res.json({
        success: true,
        data: {
          accessToken,
          refreshToken,
          wallet,
          expiresIn: 86400, // 24 hours in seconds
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Login error', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during login',
        timestamp: new Date().toISOString(),
      });
    }
  },

  /**
   * Verify JWT token
   */
  async verify(req: Request, res: Response): Promise<void> {
    try {
      // If we reach here, the token is valid (checked by authenticateJWT middleware)
      const authHeader = req.header?.('Authorization');
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

      if (!token || tokenBlacklist.has(token)) {
        res.status(401).json({
          success: false,
          error: 'Invalid or expired token',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const decoded = jwt.decode(token) as JWTPayload;

      res.json({
        success: true,
        data: {
          valid: true,
          wallet: req.wallet,
          expiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Token verification error', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during verification',
        timestamp: new Date().toISOString(),
      });
    }
  },

  /**
   * Refresh JWT token
   */
  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      const tokenData = refreshTokens.get(refreshToken);
      if (!tokenData) {
        res.status(401).json({
          success: false,
          error: 'Invalid refresh token',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Check if refresh token is expired
      if (tokenData.expiresAt < new Date()) {
        refreshTokens.delete(refreshToken);
        res.status(401).json({
          success: false,
          error: 'Refresh token expired',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Generate new access token
      const accessToken = generateToken(tokenData.wallet);

      // Optionally rotate refresh token
      const newRefreshToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

      refreshTokens.delete(refreshToken);
      refreshTokens.set(newRefreshToken, { wallet: tokenData.wallet, expiresAt });

      logger.info('Token refreshed', { wallet: tokenData.wallet });

      res.json({
        success: true,
        data: {
          accessToken,
          refreshToken: newRefreshToken,
          wallet: tokenData.wallet,
          expiresIn: 86400, // 24 hours in seconds
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Token refresh error', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during token refresh',
        timestamp: new Date().toISOString(),
      });
    }
  },

  /**
   * Logout (invalidate token)
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.header?.('Authorization');
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

      if (token) {
        // Add token to blacklist
        tokenBlacklist.add(token);

        // Clean up expired tokens periodically
        // In production, this would be handled by Redis TTL
        setTimeout(() => {
          tokenBlacklist.delete(token);
        }, 24 * 60 * 60 * 1000); // 24 hours
      }

      logger.info('User logged out', { wallet: req.wallet });

      res.json({
        success: true,
        message: 'Logged out successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Logout error', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during logout',
        timestamp: new Date().toISOString(),
      });
    }
  },
};

/**
 * Mock signature verification
 * In production, replace with actual Sui signature verification
 */
async function mockVerifySignature(
  wallet: string,
  signature: string,
  message: string
): Promise<boolean> {
  // Mock implementation - accept any signature that matches expected format
  // In production, use Sui SDK:
  // import { verifyPersonalMessage } from '@mysten/sui.js';
  // return await verifyPersonalMessage(message, signature, wallet);
  
  // For now, just check that signature is a hex string of reasonable length
  const isHexString = /^0x[a-fA-F0-9]{128,}$/.test(signature);
  const hasValidMessage = message && message.length > 0;
  const hasValidWallet = isValidWallet(wallet);

  return isHexString && hasValidMessage && hasValidWallet;
}

// Cleanup function for expired refresh tokens
// In production, this would be handled by Redis TTL
let cleanupInterval: NodeJS.Timeout | undefined;

if (process.env.NODE_ENV !== 'test') {
  cleanupInterval = setInterval(() => {
    const now = new Date();
    for (const [token, data] of refreshTokens.entries()) {
      if (data.expiresAt < now) {
        refreshTokens.delete(token);
      }
    }
  }, 60 * 60 * 1000); // Run every hour
}

// Export cleanup function for tests
export const cleanupAuthController = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = undefined;
  }
  tokenBlacklist.clear();
  refreshTokens.clear();
};