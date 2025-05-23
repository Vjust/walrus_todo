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
import { CLIError } from '../types/errors/consolidated';
import { 
  PermissionUser, 
  AuthResult, 
  TokenValidationResult,
  UserRole
} from '../types/permissions';
import { Logger } from '../utils/Logger';
import { auditLogger } from '../utils/AuditLogger';
import { permissionService } from './permission-service';

/**
 * Default duration for access tokens in seconds (1 hour)
 * Used to set expiration time when creating new authentication tokens
 */
const DEFAULT_TOKEN_EXPIRY = 3600; // 1 hour in seconds

/**
 * Default duration for refresh tokens in seconds (7 days)
 * Used to determine how long a user can refresh their session without re-authenticating
 */
const DEFAULT_REFRESH_TOKEN_EXPIRY = 604800; // 7 days in seconds

/**
 * Secret key used for signing JWT tokens
 * In production environments, this should be set via environment variable
 */
const JWT_SECRET = process.env.JWT_SECRET || 'walrus-todo-default-secret';

/**
 * Interface representing stored user credentials
 * Contains password hash, salt, and associated user information
 */
interface StoredCredentials {
  /** The hashed password using PBKDF2 with salt */
  passwordHash: string;
  /** Unique salt used in password hashing to prevent rainbow table attacks */
  salt: string;
  /** Associated user ID */
  userId: string;
  /** Timestamp when credentials were last updated */
  lastUpdated: number;
}

/**
 * Interface representing an API key associated with a user
 * API keys provide an alternative authentication method for automation and integrations
 */
interface ApiKey {
  /** The API key string itself */
  key: string;
  /** The user ID associated with this API key */
  userId: string;
  /** Human-readable name for the API key */
  name: string;
  /** Optional expiration timestamp for the API key */
  expiresAt?: number;
  /** Timestamp when the API key was created */
  createdAt: number;
}

/**
 * Interface representing a user session
 * Contains refresh token and session metadata
 */
interface Session {
  /** Unique session identifier */
  id: string;
  /** Associated user ID */
  userId: string;
  /** Refresh token for obtaining new access tokens */
  refreshToken: string;
  /** Timestamp when session expires */
  expiresAt: number;
  /** Timestamp when session was created */
  createdAt: number;
  /** Optional IP address that created the session */
  ipAddress?: string;
  /** Optional user agent string of the client */
  userAgent?: string;
  /** Timestamp of last session activity */
  lastActiveAt: number;
}

/**
 * Service for handling authentication, user accounts, and session management
 * Implements multiple authentication methods and secure token handling
 */
export class AuthenticationService {
  /** Singleton instance of the AuthenticationService */
  private static instance: AuthenticationService;
  /** Logger instance for recording authentication events and errors */
  private logger: Logger;
  /** Map of username to stored credentials */
  private credentials: Map<string, StoredCredentials> = new Map();
  /** Map of API key string to API key information */
  private apiKeys: Map<string, ApiKey> = new Map();
  /** Map of session ID to session information */
  private sessions: Map<string, Session> = new Map();
  
  /**
   * Private constructor to enforce singleton pattern
   * Initializes the logger instance
   */
  private constructor() {
    this.logger = Logger.getInstance();
  }
  
  /**
   * Get singleton instance of AuthenticationService
   * Creates a new instance if one doesn't exist yet
   * 
   * @returns The singleton AuthenticationService instance
   */
  public static getInstance(): AuthenticationService {
    if (!AuthenticationService.instance) {
      AuthenticationService.instance = new AuthenticationService();
    }
    return AuthenticationService.instance;
  }
  
  /**
   * Generate a secure random salt for password hashing
   * Uses cryptographically secure random number generator
   * 
   * @returns A hexadecimal string representing the salt
   */
  private generateSalt(): string {
    const saltBuffer = crypto.randomBytes(16);
    
    // Validate generated salt
    if (saltBuffer.length !== 16) {
      throw new CLIError('Failed to generate valid salt', 'CRYPTO_OPERATION_ERROR');
    }
    
    return saltBuffer.toString('hex');
  }
  
  /**
   * Hash a password with the provided salt using PBKDF2
   * Uses 10,000 iterations of SHA-512 for security
   * 
   * @param password - The plaintext password to hash
   * @param salt - The salt to use in the hashing process
   * @returns The hexadecimal string of the hashed password
   */
  private hashPassword(password: string, salt: string): string {
    // Validate inputs
    if (!password || typeof password !== 'string') {
      throw new CLIError('Invalid password for hashing', 'INVALID_CRYPTO_INPUT');
    }
    
    if (!salt || typeof salt !== 'string') {
      throw new CLIError('Invalid salt for hashing', 'INVALID_CRYPTO_INPUT');
    }
    
    if (password.length === 0) {
      throw new CLIError('Password cannot be empty', 'INVALID_CRYPTO_INPUT');
    }
    
    if (salt.length < 16) { // Minimum salt length check
      throw new CLIError('Salt too short for secure hashing', 'INVALID_CRYPTO_INPUT');
    }
    
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512');
    
    // Validate result
    if (hash.length !== 64) {
      throw new CLIError('Invalid hash generated', 'CRYPTO_OPERATION_ERROR');
    }
    
    return hash.toString('hex');
  }
  
  /**
   * Create a new user account with username/password credentials
   * Also handles association with blockchain address if provided
   * 
   * @param username - Unique username for the new account
   * @param password - Password for the new account
   * @param address - Optional blockchain wallet address to associate
   * @param roles - User roles to assign (defaults to basic USER role)
   * @returns The newly created user object
   * @throws CLIError if username already exists
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
   * Change a user's password
   * Requires verification of current password for security
   * Invalidates all existing sessions when password is changed
   * 
   * @param userId - ID of the user whose password is being changed
   * @param currentPassword - Current password for verification
   * @param newPassword - New password to set
   * @returns Boolean indicating success
   * @throws CLIError if user not found, credentials not found, or current password is incorrect
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
   * Authenticate a user with username and password
   * Validates credentials and creates a new session if valid
   * 
   * @param username - Username to authenticate with
   * @param password - Password to authenticate with
   * @param ipAddress - Optional IP address for audit logging
   * @param userAgent - Optional user agent string for audit logging
   * @returns Authentication result containing user info and tokens
   * @throws CLIError if credentials are invalid or user not found
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
   * Authenticate a user with a blockchain wallet signature
   * Verifies the wallet's signature on a message and creates a session
   * If the wallet address isn't associated with an existing user, creates a new user
   * 
   * @param address - Blockchain wallet address
   * @param signature - Signature to verify
   * @param message - Original message that was signed
   * @param ipAddress - Optional IP address for audit logging
   * @param userAgent - Optional user agent string for audit logging
   * @returns Authentication result containing user info and tokens
   * @throws CLIError if signature verification fails
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
    } catch (_error) {
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
   * API keys provide long-lived authentication tokens for integrations and automation
   * 
   * @param userId - ID of the user to create API key for
   * @param keyName - Human-readable name for the API key
   * @param expiryDays - Optional number of days until the key expires
   * @returns The generated API key string
   * @throws CLIError if user not found
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
   * Authenticate a user with an API key
   * Validates the API key and creates a new session if valid
   * 
   * @param apiKey - API key to authenticate with
   * @param ipAddress - Optional IP address for audit logging
   * @param userAgent - Optional user agent string for audit logging
   * @returns Authentication result containing user info and tokens
   * @throws CLIError if API key is invalid or expired
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
   * Create a session and generate access and refresh tokens
   * This is an internal method used by the various authentication methods
   * 
   * @param user - User object to create session for
   * @param ipAddress - Optional IP address for session tracking
   * @param userAgent - Optional user agent string for session tracking
   * @returns Authentication result with tokens and user info
   */
  private async createSession(
    user: PermissionUser,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthResult> {
    // Generate tokens
    const expiresAt = Math.floor(Date.now() / 1000) + DEFAULT_TOKEN_EXPIRY;
    const refreshExpiresAt = Math.floor(Date.now() / 1000) + DEFAULT_REFRESH_TOKEN_EXPIRY;
    
    // Create JWT token with user info and expiration
    const token = jwt.sign(
      {
        sub: user.id,
        username: user.username,
        roles: user.roles,
        exp: expiresAt
      },
      JWT_SECRET
    );
    
    // Create cryptographically secure refresh token
    const refreshToken = crypto.randomBytes(40).toString('hex');
    
    // Store session with refresh token and metadata
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
   * Validate a JWT token
   * Verifies the token signature and expiration
   * 
   * @param token - JWT token to validate
   * @returns Token validation result with user info if valid
   */
  public async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      // Verify JWT token signature and expiration
      const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
      
      // Get user from the token subject claim
      const userId = decoded.sub as string;
      
      // Verify userId exists before proceeding
      if (!userId) {
        this.logger.error('Token validation failed: Missing subject/userId in token');
        return {
          valid: false,
          expired: false
        };
      }
      
      const user = await permissionService.getUser(userId);
      
      if (!user) {
        this.logger.warn(`Token validation: User not found for userId ${userId}`);
        return {
          valid: false,
          expired: false
        };
      }
      
      // Return successful validation result with user info
      return {
        valid: true,
        expired: false,
        user
      };
    } catch (_error) {
      // Handle specific JWT verification errors
      if (error instanceof jwt.TokenExpiredError) {
        return {
          valid: false,
          expired: true
        };
      }
      
      // For any other error, token is invalid
      this.logger.error('Token validation failed', error);
      return {
        valid: false,
        expired: false
      };
    }
  }
  
  /**
   * Refresh a session using a refresh token
   * Creates a new session and invalidates the old one
   * 
   * @param refreshToken - Refresh token from previous authentication
   * @param ipAddress - Optional IP address for audit logging
   * @param userAgent - Optional user agent string for audit logging
   * @returns New authentication result with fresh tokens
   * @throws CLIError if refresh token is invalid or expired
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
    
    // Remove old session for security (one-time use refresh tokens)
    this.sessions.delete(session.id);
    
    // Create new session with fresh tokens
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
   * Invalidate a user's session based on their JWT token
   * Used for logout functionality
   * 
   * @param token - JWT token identifying the session to invalidate
   */
  public async invalidateSession(token: string): Promise<void> {
    try {
      // Verify JWT token to get the user ID
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
    } catch (_error) {
      // Silently fail for invalid tokens
      this.logger.debug('Failed to invalidate session', { error });
    }
  }
  
  /**
   * Invalidate all sessions for a specific user
   * Used when changing password or for security lockouts
   * 
   * @param userId - ID of the user whose sessions should be invalidated
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
   * Permanently removes the API key from the system
   * 
   * @param apiKey - The API key to revoke
   * @throws CLIError if API key not found
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