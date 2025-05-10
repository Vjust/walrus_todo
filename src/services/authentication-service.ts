/**
 * Authentication Service
 * 
 * This service handles user authentication and session management for the Walrus Todo application.
 * It provides methods for various authentication methods including local credentials, blockchain
 * wallets, and API keys. Token generation and validation are also managed here.
 */

import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { CLIError } from '../types/error';
import { 
  PermissionUser, 
  AuthResult, 
  TokenValidationResult,
  UserRole
} from '../types/permissions';
import { Logger } from '../utils/Logger';
import { auditLogger } from '../utils/AuditLogger';
import { permissionService } from './permission-service';

// Session configuration
const DEFAULT_TOKEN_EXPIRY = 3600; // 1 hour in seconds
const DEFAULT_REFRESH_TOKEN_EXPIRY = 604800; // 7 days in seconds
const JWT_SECRET = process.env.JWT_SECRET || 'walrus-todo-default-secret';

interface StoredCredentials {
  passwordHash: string;
  salt: string;
  userId: string;
  lastUpdated: number;
}

interface ApiKey {
  key: string;
  userId: string;
  name: string;
  expiresAt?: number;
  createdAt: number;
}

interface Session {
  id: string;
  userId: string;
  refreshToken: string;
  expiresAt: number;
  createdAt: number;
  ipAddress?: string;
  userAgent?: string;
  lastActiveAt: number;
}

export class AuthenticationService {
  private static instance: AuthenticationService;
  private logger: Logger;
  private credentials: Map<string, StoredCredentials> = new Map();
  private apiKeys: Map<string, ApiKey> = new Map();
  private sessions: Map<string, Session> = new Map();
  
  private constructor() {
    this.logger = Logger.getInstance();
  }
  
  /**
   * Get singleton instance of AuthenticationService
   */
  public static getInstance(): AuthenticationService {
    if (!AuthenticationService.instance) {
      AuthenticationService.instance = new AuthenticationService();
    }
    return AuthenticationService.instance;
  }
  
  /**
   * Generate a secure salt
   */
  private generateSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  }
  
  /**
   * Hash a password with salt
   */
  private hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  }
  
  /**
   * Create a new user account with credentials
   */
  public async createUserAccount(
    username: string,
    password: string,
    address?: string,
    roles: UserRole[] = [UserRole.USER]
  ): Promise<PermissionUser> {
    // Check if username already exists
    const existingUser = await permissionService.getUserByUsername(username);
    if (existingUser) {
      throw new CLIError('Username already exists', 'USERNAME_EXISTS');
    }
    
    // Create user in permission service
    const user = await permissionService.createUser(username, address, roles);
    
    // Create credentials
    const salt = this.generateSalt();
    const passwordHash = this.hashPassword(password, salt);
    
    this.credentials.set(username, {
      passwordHash,
      salt,
      userId: user.id,
      lastUpdated: Date.now()
    });
    
    // Log user creation (without sensitive info)
    auditLogger.log({
      id: uuidv4(),
      timestamp: Date.now(),
      userId: 'system',
      action: 'USER_CREATED',
      resource: 'account',
      resourceId: user.id,
      operation: 'create',
      outcome: 'SUCCESS',
      metadata: {
        username,
        roles
      }
    });
    
    return user;
  }
  
  /**
   * Change user password
   */
  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    const user = await permissionService.getUser(userId);
    if (!user) {
      throw new CLIError('User not found', 'USER_NOT_FOUND');
    }
    
    // Get stored credentials
    const storedCreds = this.credentials.get(user.username);
    if (!storedCreds) {
      throw new CLIError('Credentials not found', 'CREDENTIALS_NOT_FOUND');
    }
    
    // Verify current password
    const currentHash = this.hashPassword(currentPassword, storedCreds.salt);
    if (currentHash !== storedCreds.passwordHash) {
      // Log failed password change
      auditLogger.log({
        id: uuidv4(),
        timestamp: Date.now(),
        userId,
        action: 'PASSWORD_CHANGE',
        resource: 'account',
        resourceId: userId,
        operation: 'update',
        outcome: 'FAILED',
        metadata: {
          reason: 'Current password verification failed'
        }
      });
      
      throw new CLIError('Current password is incorrect', 'INVALID_PASSWORD');
    }
    
    // Update password
    const salt = this.generateSalt();
    const passwordHash = this.hashPassword(newPassword, salt);
    
    this.credentials.set(user.username, {
      passwordHash,
      salt,
      userId: user.id,
      lastUpdated: Date.now()
    });
    
    // Invalidate all sessions for this user
    this.invalidateAllUserSessions(userId);
    
    // Log password change
    auditLogger.log({
      id: uuidv4(),
      timestamp: Date.now(),
      userId,
      action: 'PASSWORD_CHANGED',
      resource: 'account',
      resourceId: userId,
      operation: 'update',
      outcome: 'SUCCESS',
      metadata: {
        username: user.username
      }
    });
    
    return true;
  }
  
  /**
   * Authenticate with username and password
   */
  public async authenticateWithCredentials(
    username: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthResult> {
    // Get stored credentials
    const storedCreds = this.credentials.get(username);
    if (!storedCreds) {
      // Log failed login
      auditLogger.log({
        id: uuidv4(),
        timestamp: Date.now(),
        userId: 'anonymous',
        action: 'LOGIN',
        resource: 'account',
        operation: 'authenticate',
        outcome: 'FAILED',
        metadata: {
          username,
          reason: 'User not found',
          ipAddress,
          userAgent
        }
      });
      
      throw new CLIError('Invalid username or password', 'INVALID_CREDENTIALS');
    }
    
    // Verify password
    const passwordHash = this.hashPassword(password, storedCreds.salt);
    if (passwordHash !== storedCreds.passwordHash) {
      // Log failed login
      auditLogger.log({
        id: uuidv4(),
        timestamp: Date.now(),
        userId: 'anonymous',
        action: 'LOGIN',
        resource: 'account',
        operation: 'authenticate',
        outcome: 'FAILED',
        metadata: {
          username,
          reason: 'Invalid password',
          ipAddress,
          userAgent
        }
      });
      
      throw new CLIError('Invalid username or password', 'INVALID_CREDENTIALS');
    }
    
    // Get user from permission service
    const user = await permissionService.getUser(storedCreds.userId);
    if (!user) {
      throw new CLIError('User account inconsistency', 'USER_NOT_FOUND');
    }
    
    // Create session and tokens
    const authResult = await this.createSession(user, ipAddress, userAgent);
    
    // Log successful login
    auditLogger.log({
      id: uuidv4(),
      timestamp: Date.now(),
      userId: user.id,
      action: 'LOGIN',
      resource: 'account',
      resourceId: user.id,
      operation: 'authenticate',
      outcome: 'SUCCESS',
      metadata: {
        username: user.username,
        ipAddress,
        userAgent
      }
    });
    
    return authResult;
  }
  
  /**
   * Authenticate with blockchain wallet signature
   */
  public async authenticateWithWallet(
    address: string,
    signature: string,
    message: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthResult> {
    try {
      // Verify signature
      // Note: In a production app, would use proper signature verification
      // This is simplified for the example
      const isValidSignature = true; // Placeholder for actual verification
      
      if (!isValidSignature) {
        // Log failed login
        auditLogger.log({
          id: uuidv4(),
          timestamp: Date.now(),
          userId: 'anonymous',
          action: 'WALLET_LOGIN',
          resource: 'account',
          operation: 'authenticate',
          outcome: 'FAILED',
          metadata: {
            address,
            reason: 'Invalid signature',
            ipAddress,
            userAgent
          }
        });
        
        throw new CLIError('Invalid wallet signature', 'INVALID_SIGNATURE');
      }
      
      // Find user by address or create a new one if not found
      let user = await permissionService.getUserByAddress(address);
      
      if (!user) {
        // Create new user with wallet address
        user = await permissionService.createUser(
          `wallet_${address.substring(0, 8)}`,
          address,
          [UserRole.USER]
        );
      }
      
      // Create session and tokens
      const authResult = await this.createSession(user, ipAddress, userAgent);
      
      // Log successful login
      auditLogger.log({
        id: uuidv4(),
        timestamp: Date.now(),
        userId: user.id,
        action: 'WALLET_LOGIN',
        resource: 'account',
        resourceId: user.id,
        operation: 'authenticate',
        outcome: 'SUCCESS',
        metadata: {
          address,
          ipAddress,
          userAgent
        }
      });
      
      return authResult;
    } catch (error) {
      // Log failed login
      auditLogger.log({
        id: uuidv4(),
        timestamp: Date.now(),
        userId: 'anonymous',
        action: 'WALLET_LOGIN',
        resource: 'account',
        operation: 'authenticate',
        outcome: 'FAILED',
        metadata: {
          address,
          reason: error instanceof Error ? error.message : 'Unknown error',
          ipAddress,
          userAgent
        }
      });
      
      if (error instanceof CLIError) {
        throw error;
      }
      
      throw new CLIError(
        'Wallet authentication failed', 
        'WALLET_AUTH_FAILED'
      );
    }
  }
  
  /**
   * Create a new API key for a user
   */
  public async createApiKey(
    userId: string,
    keyName: string,
    expiryDays?: number
  ): Promise<string> {
    const user = await permissionService.getUser(userId);
    if (!user) {
      throw new CLIError('User not found', 'USER_NOT_FOUND');
    }
    
    // Generate API key
    const apiKey = `waltodo_${uuidv4().replace(/-/g, '')}`;
    
    // Calculate expiry if provided
    const expiresAt = expiryDays ? Date.now() + (expiryDays * 86400000) : undefined;
    
    // Store API key
    this.apiKeys.set(apiKey, {
      key: apiKey,
      userId: user.id,
      name: keyName,
      expiresAt,
      createdAt: Date.now()
    });
    
    // Log API key creation
    auditLogger.log({
      id: uuidv4(),
      timestamp: Date.now(),
      userId: user.id,
      action: 'API_KEY_CREATED',
      resource: 'account',
      resourceId: user.id,
      operation: 'create',
      outcome: 'SUCCESS',
      metadata: {
        keyName,
        hasExpiry: !!expiresAt
      }
    });
    
    return apiKey;
  }
  
  /**
   * Authenticate with API key
   */
  public async authenticateWithApiKey(
    apiKey: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthResult> {
    // Get API key info
    const keyInfo = this.apiKeys.get(apiKey);
    if (!keyInfo) {
      // Log failed API key authentication
      auditLogger.log({
        id: uuidv4(),
        timestamp: Date.now(),
        userId: 'anonymous',
        action: 'API_KEY_AUTH',
        resource: 'account',
        operation: 'authenticate',
        outcome: 'FAILED',
        metadata: {
          reason: 'API key not found',
          ipAddress,
          userAgent
        }
      });
      
      throw new CLIError('Invalid API key', 'INVALID_API_KEY');
    }
    
    // Check if key is expired
    if (keyInfo.expiresAt && keyInfo.expiresAt < Date.now()) {
      // Log failed API key authentication
      auditLogger.log({
        id: uuidv4(),
        timestamp: Date.now(),
        userId: keyInfo.userId,
        action: 'API_KEY_AUTH',
        resource: 'account',
        resourceId: keyInfo.userId,
        operation: 'authenticate',
        outcome: 'FAILED',
        metadata: {
          reason: 'API key expired',
          keyName: keyInfo.name,
          ipAddress,
          userAgent
        }
      });
      
      throw new CLIError('API key has expired', 'EXPIRED_API_KEY');
    }
    
    // Get user from permission service
    const user = await permissionService.getUser(keyInfo.userId);
    if (!user) {
      throw new CLIError('User account inconsistency', 'USER_NOT_FOUND');
    }
    
    // Create session and tokens
    const authResult = await this.createSession(user, ipAddress, userAgent);
    
    // Log successful API key authentication
    auditLogger.log({
      id: uuidv4(),
      timestamp: Date.now(),
      userId: user.id,
      action: 'API_KEY_AUTH',
      resource: 'account',
      resourceId: user.id,
      operation: 'authenticate',
      outcome: 'SUCCESS',
      metadata: {
        keyName: keyInfo.name,
        ipAddress,
        userAgent
      }
    });
    
    return authResult;
  }
  
  /**
   * Create a session and generate tokens
   */
  private async createSession(
    user: PermissionUser,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthResult> {
    // Generate tokens
    const expiresAt = Math.floor(Date.now() / 1000) + DEFAULT_TOKEN_EXPIRY;
    const refreshExpiresAt = Math.floor(Date.now() / 1000) + DEFAULT_REFRESH_TOKEN_EXPIRY;
    
    // Create JWT token
    const token = jwt.sign(
      {
        sub: user.id,
        username: user.username,
        roles: user.roles,
        exp: expiresAt
      },
      JWT_SECRET
    );
    
    // Create refresh token
    const refreshToken = crypto.randomBytes(40).toString('hex');
    
    // Store session
    const sessionId = uuidv4();
    this.sessions.set(sessionId, {
      id: sessionId,
      userId: user.id,
      refreshToken,
      expiresAt: refreshExpiresAt * 1000, // Convert to milliseconds
      createdAt: Date.now(),
      ipAddress,
      userAgent,
      lastActiveAt: Date.now()
    });
    
    // Update user's last login timestamp
    const updatedUser: PermissionUser = {
      ...user,
      lastLogin: Date.now()
    };
    
    // Return authentication result
    return {
      user: updatedUser,
      token,
      refreshToken,
      expiresAt: expiresAt * 1000 // Convert to milliseconds
    };
  }
  
  /**
   * Validate a token
   */
  public async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      // Verify JWT token
      const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
      
      // Get user
      const userId = decoded.sub as string;
      const user = await permissionService.getUser(userId);
      
      if (!user) {
        return {
          valid: false,
          expired: false
        };
      }
      
      // Return validation result
      return {
        valid: true,
        expired: false,
        user
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return {
          valid: false,
          expired: true
        };
      }
      
      return {
        valid: false,
        expired: false
      };
    }
  }
  
  /**
   * Refresh a session using a refresh token
   */
  public async refreshSession(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthResult> {
    // Find session by refresh token
    const session = Array.from(this.sessions.values()).find(
      s => s.refreshToken === refreshToken
    );
    
    if (!session) {
      throw new CLIError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }
    
    // Check if refresh token is expired
    if (session.expiresAt < Date.now()) {
      // Remove expired session
      this.sessions.delete(session.id);
      
      // Log failed refresh
      auditLogger.log({
        id: uuidv4(),
        timestamp: Date.now(),
        userId: session.userId,
        action: 'SESSION_REFRESH',
        resource: 'account',
        resourceId: session.userId,
        operation: 'authenticate',
        outcome: 'FAILED',
        metadata: {
          reason: 'Refresh token expired',
          sessionId: session.id,
          ipAddress,
          userAgent
        }
      });
      
      throw new CLIError('Refresh token has expired', 'EXPIRED_REFRESH_TOKEN');
    }
    
    // Get user
    const user = await permissionService.getUser(session.userId);
    if (!user) {
      throw new CLIError('User not found', 'USER_NOT_FOUND');
    }
    
    // Remove old session
    this.sessions.delete(session.id);
    
    // Create new session
    const authResult = await this.createSession(user, ipAddress, userAgent);
    
    // Log successful refresh
    auditLogger.log({
      id: uuidv4(),
      timestamp: Date.now(),
      userId: user.id,
      action: 'SESSION_REFRESH',
      resource: 'account',
      resourceId: user.id,
      operation: 'authenticate',
      outcome: 'SUCCESS',
      metadata: {
        ipAddress,
        userAgent
      }
    });
    
    return authResult;
  }
  
  /**
   * Invalidate a session
   */
  public async invalidateSession(token: string): Promise<void> {
    try {
      // Verify JWT token
      const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
      
      // Get user ID
      const userId = decoded.sub as string;
      
      // Find all sessions for this user
      const sessionIds = Array.from(this.sessions.entries())
        .filter(([_, session]) => session.userId === userId)
        .map(([id, _]) => id);
      
      // Remove sessions
      sessionIds.forEach(id => this.sessions.delete(id));
      
      // Log logout
      auditLogger.log({
        id: uuidv4(),
        timestamp: Date.now(),
        userId,
        action: 'LOGOUT',
        resource: 'account',
        resourceId: userId,
        operation: 'authenticate',
        outcome: 'SUCCESS',
        metadata: {
          sessionCount: sessionIds.length
        }
      });
    } catch (error) {
      // Silently fail for invalid tokens
      this.logger.debug('Failed to invalidate session', { error });
    }
  }
  
  /**
   * Invalidate all sessions for a user
   */
  public async invalidateAllUserSessions(userId: string): Promise<void> {
    // Find all sessions for this user
    const sessionIds = Array.from(this.sessions.entries())
      .filter(([_, session]) => session.userId === userId)
      .map(([id, _]) => id);
    
    // Remove sessions
    sessionIds.forEach(id => this.sessions.delete(id));
    
    // Log session invalidation
    auditLogger.log({
      id: uuidv4(),
      timestamp: Date.now(),
      userId,
      action: 'ALL_SESSIONS_INVALIDATED',
      resource: 'account',
      resourceId: userId,
      operation: 'authenticate',
      outcome: 'SUCCESS',
      metadata: {
        sessionCount: sessionIds.length
      }
    });
  }
  
  /**
   * Revoke an API key
   */
  public async revokeApiKey(apiKey: string): Promise<void> {
    // Get API key info
    const keyInfo = this.apiKeys.get(apiKey);
    if (!keyInfo) {
      throw new CLIError('API key not found', 'API_KEY_NOT_FOUND');
    }
    
    // Remove API key
    this.apiKeys.delete(apiKey);
    
    // Log API key revocation
    auditLogger.log({
      id: uuidv4(),
      timestamp: Date.now(),
      userId: keyInfo.userId,
      action: 'API_KEY_REVOKED',
      resource: 'account',
      resourceId: keyInfo.userId,
      operation: 'delete',
      outcome: 'SUCCESS',
      metadata: {
        keyName: keyInfo.name
      }
    });
  }
}

// Export singleton instance
export const authenticationService = AuthenticationService.getInstance();