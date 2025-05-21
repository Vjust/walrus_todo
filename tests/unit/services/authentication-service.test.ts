import { AuthenticationService } from '../../../src/services/authentication-service';
import { PermissionService, permissionService } from '../../../src/services/permission-service';
import { AuditLogger, auditLogger } from '../../../src/utils/AuditLogger';
import { Logger } from '../../../src/utils/Logger';
import { UserRole, PermissionUser, TokenValidationResult } from '../../../src/types/permissions';
import { CLIError } from '../../../src/types/error';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

// Mock dependencies
jest.mock('../../../src/services/permission-service', () => ({
  permissionService: {
    createUser: jest.fn(),
    getUser: jest.fn(),
    getUserByUsername: jest.fn(),
    getUserByAddress: jest.fn(),
    hasPermission: jest.fn(),
    assignRoleToUser: jest.fn(),
    grantPermission: jest.fn()
  },
  PermissionService: {
    getInstance: jest.fn()
  }
}));
jest.mock('../../../src/utils/AuditLogger', () => ({
  auditLogger: {
    log: jest.fn().mockResolvedValue(undefined)
  },
  AuditLogger: {
    getInstance: jest.fn()
  }
}));
jest.mock('../../../src/utils/Logger');

describe('AuthenticationService', () => {
  let authService: AuthenticationService;
  let mockLogger: jest.Mocked<Logger>;
  
  const mockUser: PermissionUser = {
    id: 'user-123',
    username: 'testuser',
    address: '0x123456789',
    roles: [UserRole.USER],
    directPermissions: [],
    metadata: {},
    createdAt: Date.now()
  };

  beforeEach(() => {
    // Reset all mocks and get new instances
    jest.clearAllMocks();
    
    // Mock Logger
    mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    } as any;
    (Logger.getInstance as jest.Mock).mockReturnValue(mockLogger);
    
    // Reset auditLogger mock
    (auditLogger.log as jest.Mock).mockClear();
    
    // Set up mocked permissionService
    (permissionService.createUser as jest.Mock).mockResolvedValue(mockUser);
    (permissionService.getUser as jest.Mock).mockResolvedValue(mockUser);
    (permissionService.getUserByUsername as jest.Mock).mockResolvedValue(null);
    (permissionService.getUserByAddress as jest.Mock).mockResolvedValue(null);
    
    // Get fresh instance (singleton will be reset due to jest module mocking)
    authService = AuthenticationService.getInstance();
  });

  describe('User Account Management', () => {
    it('should create a new user account successfully', async () => {
      const username = 'newuser';
      const password = 'SecurePassword123!';
      const address = '0x987654321';
      const roles = [UserRole.USER];

      (permissionService.getUserByUsername as jest.Mock).mockResolvedValue(null);
      (permissionService.createUser as jest.Mock).mockResolvedValue({
        ...mockUser,
        id: 'user-456',  // Adding id field
        username,
        address
      });

      const result = await authService.createUserAccount(username, password, address, roles);

      expect(permissionService.getUserByUsername).toHaveBeenCalledWith(username);
      expect(permissionService.createUser).toHaveBeenCalledWith(username, address, roles);
      expect(result.username).toBe(username);
      expect(result.address).toBe(address);
      expect(auditLogger.log as jest.Mock).toHaveBeenCalledWith(expect.objectContaining({
        action: 'USER_CREATED',
        outcome: 'SUCCESS'
      }));
    });

    it('should throw error when username already exists', async () => {
      const username = 'existinguser';
      const password = 'Password123!';

      (permissionService.getUserByUsername as jest.Mock).mockResolvedValue(mockUser);

      await expect(authService.createUserAccount(username, password))
        .rejects
        .toThrow(new CLIError('Username already exists', 'USERNAME_EXISTS'));

      expect(permissionService.createUser).not.toHaveBeenCalled();
    });

    it('should change password successfully with correct current password', async () => {
      const userId = 'user-123';
      const currentPassword = 'OldPassword123!';
      const newPassword = 'NewPassword456!';

      // Set up existing credentials
      await authService.createUserAccount(mockUser.username, currentPassword);
      
      (permissionService.getUser as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.changePassword(userId, currentPassword, newPassword);

      expect(result).toBe(true);
      expect(auditLogger.log as jest.Mock).toHaveBeenCalledWith(expect.objectContaining({
        action: 'PASSWORD_CHANGED',
        outcome: 'SUCCESS'
      }));
    });

    it('should fail to change password with incorrect current password', async () => {
      const userId = 'user-123';
      const currentPassword = 'WrongPassword!';
      const newPassword = 'NewPassword456!';

      // Set up existing credentials
      await authService.createUserAccount(mockUser.username, 'ActualPassword123!');
      
      (permissionService.getUser as jest.Mock).mockResolvedValue(mockUser);

      await expect(authService.changePassword(userId, currentPassword, newPassword))
        .rejects
        .toThrow(new CLIError('Current password is incorrect', 'INVALID_PASSWORD'));

      expect(auditLogger.log as jest.Mock).toHaveBeenCalledWith(expect.objectContaining({
        action: 'PASSWORD_CHANGE',
        outcome: 'FAILED'
      }));
    });
  });

  describe('Authentication Methods', () => {
    beforeEach(async () => {
      // Ensure createUser mock returns a user with id
      (permissionService.createUser as jest.Mock).mockResolvedValue({
        ...mockUser,
        username: mockUser.username
      });
      
      // Create a user with credentials
      await authService.createUserAccount(mockUser.username, 'TestPassword123!');
    });

    it('should authenticate with valid credentials', async () => {
      const username = mockUser.username;
      const password = 'TestPassword123!';
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';

      (permissionService.getUser as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.authenticateWithCredentials(
        username, 
        password, 
        ipAddress, 
        userAgent
      );

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresAt');
      expect(result.user.id).toBe(mockUser.id);
      expect(auditLogger.log as jest.Mock).toHaveBeenCalledWith(expect.objectContaining({
        action: 'LOGIN',
        outcome: 'SUCCESS'
      }));
    });

    it('should fail authentication with invalid credentials', async () => {
      const username = mockUser.username;
      const password = 'WrongPassword!';

      await expect(authService.authenticateWithCredentials(username, password))
        .rejects
        .toThrow(new CLIError('Invalid username or password', 'INVALID_CREDENTIALS'));

      expect(auditLogger.log as jest.Mock).toHaveBeenCalledWith(expect.objectContaining({
        action: 'LOGIN',
        outcome: 'FAILED'
      }));
    });

    it('should authenticate with wallet and create new user if not exists', async () => {
      const address = '0xNewAddress';
      const signature = 'valid-signature';
      const message = 'Sign this message';

      (permissionService.getUserByAddress as jest.Mock).mockResolvedValue(null);
      (permissionService.createUser as jest.Mock).mockResolvedValue({
        ...mockUser,
        address,
        username: `wallet_${address.substring(0, 8)}`
      });

      const result = await authService.authenticateWithWallet(
        address,
        signature,
        message
      );

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(permissionService.createUser).toHaveBeenCalledWith(
        expect.stringContaining('wallet_'),
        address,
        [UserRole.USER]
      );
      expect(auditLogger.log as jest.Mock).toHaveBeenCalledWith(expect.objectContaining({
        action: 'WALLET_LOGIN',
        outcome: 'SUCCESS'
      }));
    });

    it('should authenticate with existing wallet user', async () => {
      const address = mockUser.address;
      const signature = 'valid-signature';
      const message = 'Sign this message';

      (permissionService.getUserByAddress as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.authenticateWithWallet(
        address!,
        signature,
        message
      );

      expect(result.user.id).toBe(mockUser.id);
      expect(permissionService.createUser).not.toHaveBeenCalled();
    });

    it('should create and authenticate with API key', async () => {
      const keyName = 'Test API Key';
      const expiryDays = 30;

      (permissionService.getUser as jest.Mock).mockResolvedValue(mockUser);

      const apiKey = await authService.createApiKey(
        mockUser.id,
        keyName,
        expiryDays
      );

      expect(apiKey).toMatch(/^waltodo_[a-f0-9]{32}$/);
      expect(auditLogger.log as jest.Mock).toHaveBeenCalledWith(expect.objectContaining({
        action: 'API_KEY_CREATED',
        outcome: 'SUCCESS'
      }));

      // Now authenticate with the API key
      const authResult = await authService.authenticateWithApiKey(apiKey);

      expect(authResult.user.id).toBe(mockUser.id);
      expect(auditLogger.log as jest.Mock).toHaveBeenCalledWith(expect.objectContaining({
        action: 'API_KEY_AUTH',
        outcome: 'SUCCESS'
      }));
    });

    it('should fail authentication with expired API key', async () => {
      const keyName = 'Expired Key';
      const expiryDays = -1; // Already expired

      (permissionService.getUser as jest.Mock).mockResolvedValue(mockUser);

      const apiKey = await authService.createApiKey(
        mockUser.id,
        keyName,
        expiryDays
      );

      await expect(authService.authenticateWithApiKey(apiKey))
        .rejects
        .toThrow(new CLIError('API key has expired', 'EXPIRED_API_KEY'));

      expect(auditLogger.log as jest.Mock).toHaveBeenCalledWith(expect.objectContaining({
        action: 'API_KEY_AUTH',
        outcome: 'FAILED'
      }));
    });

    it('should fail authentication with invalid API key', async () => {
      const invalidApiKey = 'waltodo_invalid_key';

      await expect(authService.authenticateWithApiKey(invalidApiKey))
        .rejects
        .toThrow(new CLIError('Invalid API key', 'INVALID_API_KEY'));

      expect(auditLogger.log as jest.Mock).toHaveBeenCalledWith(expect.objectContaining({
        action: 'API_KEY_AUTH',
        outcome: 'FAILED'
      }));
    });
  });

  describe('Token Management', () => {
    it('should validate a valid JWT token', async () => {
      // Create a valid token
      const token = jwt.sign(
        {
          sub: mockUser.id,
          username: mockUser.username,
          roles: mockUser.roles,
          exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
        },
        process.env.JWT_SECRET || 'walrus-todo-default-secret'
      );

      (permissionService.getUser as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.validateToken(token);

      expect(result.valid).toBe(true);
      expect(result.expired).toBe(false);
      expect(result.user).toEqual(mockUser);
    });

    it('should detect an expired JWT token', async () => {
      // Create an expired token
      const token = jwt.sign(
        {
          sub: mockUser.id,
          username: mockUser.username,
          roles: mockUser.roles,
          exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
        },
        process.env.JWT_SECRET || 'walrus-todo-default-secret'
      );

      const result = await authService.validateToken(token);

      expect(result.valid).toBe(false);
      expect(result.expired).toBe(true);
      expect(result.user).toBeUndefined();
    });

    it('should detect an invalid JWT token', async () => {
      const invalidToken = 'invalid.jwt.token';

      const result = await authService.validateToken(invalidToken);

      expect(result.valid).toBe(false);
      expect(result.expired).toBe(false);
      expect(result.user).toBeUndefined();
    });

    it('should handle missing user for valid token', async () => {
      const token = jwt.sign(
        {
          sub: 'nonexistent-user',
          username: 'ghost',
          roles: [UserRole.USER],
          exp: Math.floor(Date.now() / 1000) + 3600
        },
        process.env.JWT_SECRET || 'walrus-todo-default-secret'
      );

      (permissionService.getUser as jest.Mock).mockResolvedValue(undefined);

      const result = await authService.validateToken(token);

      expect(result.valid).toBe(false);
      expect(result.expired).toBe(false);
      expect(result.user).toBeUndefined();
    });
  });

  describe('Session Management', () => {
    it('should refresh a valid session', async () => {
      // First authenticate to get tokens
      await authService.createUserAccount(mockUser.username, 'TestPassword123!');
      (permissionService.getUser as jest.Mock).mockResolvedValue(mockUser);
      
      const authResult = await authService.authenticateWithCredentials(
        mockUser.username,
        'TestPassword123!'
      );

      // Now refresh the session
      const refreshedResult = await authService.refreshSession(
        authResult.refreshToken
      );

      expect(refreshedResult).toHaveProperty('user');
      expect(refreshedResult).toHaveProperty('token');
      expect(refreshedResult).toHaveProperty('refreshToken');
      expect(refreshedResult.refreshToken).not.toBe(authResult.refreshToken); // New refresh token
      expect(auditLogger.log as jest.Mock).toHaveBeenCalledWith(expect.objectContaining({
        action: 'SESSION_REFRESH',
        outcome: 'SUCCESS'
      }));
    });

    it('should fail to refresh with invalid refresh token', async () => {
      const invalidRefreshToken = 'invalid-refresh-token';

      await expect(authService.refreshSession(invalidRefreshToken))
        .rejects
        .toThrow(new CLIError('Invalid refresh token', 'INVALID_REFRESH_TOKEN'));
    });

    it('should fail to refresh with expired refresh token', async () => {
      // Create a session and manually expire it
      await authService.createUserAccount(mockUser.username, 'TestPassword123!');
      (permissionService.getUser as jest.Mock).mockResolvedValue(mockUser);
      
      const authResult = await authService.authenticateWithCredentials(
        mockUser.username,
        'TestPassword123!'
      );

      // Manually expire the session
      const sessions = (authService as any).sessions;
      const session = Array.from(sessions.values()).find(
        (s: any) => s.refreshToken === authResult.refreshToken
      );
      if (session) {
        session.expiresAt = Date.now() - 1000; // Set to past
      }

      await expect(authService.refreshSession(authResult.refreshToken))
        .rejects
        .toThrow(new CLIError('Refresh token has expired', 'EXPIRED_REFRESH_TOKEN'));

      expect(auditLogger.log as jest.Mock).toHaveBeenCalledWith(expect.objectContaining({
        action: 'SESSION_REFRESH',
        outcome: 'FAILED'
      }));
    });

    it('should invalidate a session on logout', async () => {
      // First authenticate
      await authService.createUserAccount(mockUser.username, 'TestPassword123!');
      (permissionService.getUser as jest.Mock).mockResolvedValue(mockUser);
      
      const authResult = await authService.authenticateWithCredentials(
        mockUser.username,
        'TestPassword123!'
      );

      // Logout
      await authService.invalidateSession(authResult.token);

      expect(auditLogger.log as jest.Mock).toHaveBeenCalledWith(expect.objectContaining({
        action: 'LOGOUT',
        outcome: 'SUCCESS'
      }));

      // Verify session is removed
      const sessions = (authService as any).sessions;
      expect(Array.from(sessions.values()).length).toBe(0);
    });

    it('should invalidate all user sessions', async () => {
      // Create multiple sessions
      await authService.createUserAccount(mockUser.username, 'TestPassword123!');
      (permissionService.getUser as jest.Mock).mockResolvedValue(mockUser);
      
      const auth1 = await authService.authenticateWithCredentials(
        mockUser.username,
        'TestPassword123!'
      );
      const auth2 = await authService.authenticateWithCredentials(
        mockUser.username,
        'TestPassword123!'
      );

      // Verify we have 2 sessions
      const sessions = (authService as any).sessions;
      expect(Array.from(sessions.values()).length).toBe(2);

      // Invalidate all sessions
      await authService.invalidateAllUserSessions(mockUser.id);

      expect(auditLogger.log as jest.Mock).toHaveBeenCalledWith(expect.objectContaining({
        action: 'ALL_SESSIONS_INVALIDATED',
        outcome: 'SUCCESS',
        metadata: expect.objectContaining({
          sessionCount: 2
        })
      }));

      // Verify all sessions are removed
      expect(Array.from(sessions.values()).length).toBe(0);
    });

    it('should handle logout with invalid token gracefully', async () => {
      const invalidToken = 'invalid.jwt.token';

      // Should not throw, just log debug
      await authService.invalidateSession(invalidToken);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Failed to invalidate session',
        expect.any(Object)
      );
    });
  });

  describe('API Key Management', () => {
    it('should revoke an API key', async () => {
      (permissionService.getUser as jest.Mock).mockResolvedValue(mockUser);

      // Create an API key
      const apiKey = await authService.createApiKey(
        mockUser.id,
        'Test Key'
      );

      // Revoke it
      await authService.revokeApiKey(apiKey);

      expect(auditLogger.log as jest.Mock).toHaveBeenCalledWith(expect.objectContaining({
        action: 'API_KEY_REVOKED',
        outcome: 'SUCCESS'
      }));

      // Verify authentication fails with revoked key
      await expect(authService.authenticateWithApiKey(apiKey))
        .rejects
        .toThrow(new CLIError('Invalid API key', 'INVALID_API_KEY'));
    });

    it('should fail to revoke non-existent API key', async () => {
      const nonExistentKey = 'waltodo_nonexistent';

      await expect(authService.revokeApiKey(nonExistentKey))
        .rejects
        .toThrow(new CLIError('API key not found', 'API_KEY_NOT_FOUND'));
    });
  });

  describe('Security Features', () => {
    it('should hash passwords securely', async () => {
      const password = 'SecurePassword123!';
      
      // Create two users with same password
      await authService.createUserAccount('user1', password);
      await authService.createUserAccount('user2', password);

      // Get credentials
      const credentials = (authService as any).credentials;
      const cred1 = credentials.get('user1');
      const cred2 = credentials.get('user2');

      // Verify different salts produce different hashes
      expect(cred1.salt).not.toBe(cred2.salt);
      expect(cred1.passwordHash).not.toBe(cred2.passwordHash);
    });

    it('should include IP and user agent in audit logs', async () => {
      const ipAddress = '192.168.1.100';
      const userAgent = 'TestBrowser/1.0';

      await authService.createUserAccount(mockUser.username, 'TestPassword123!');
      (permissionService.getUser as jest.Mock).mockResolvedValue(mockUser);

      await authService.authenticateWithCredentials(
        mockUser.username,
        'TestPassword123!',
        ipAddress,
        userAgent
      );

      expect(auditLogger.log as jest.Mock).toHaveBeenCalledWith(expect.objectContaining({
        metadata: expect.objectContaining({
          ipAddress,
          userAgent
        })
      }));
    });

    it('should update last login timestamp', async () => {
      await authService.createUserAccount(mockUser.username, 'TestPassword123!');
      (permissionService.getUser as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.authenticateWithCredentials(
        mockUser.username,
        'TestPassword123!'
      );

      expect(result.user.lastLogin).toBeDefined();
      expect(result.user.lastLogin).toBeGreaterThan(mockUser.createdAt);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty password validation', async () => {
      // The implementation should handle this when creating account
      await expect(authService.createUserAccount('user', ''))
        .rejects
        .toThrow(CLIError);
    });

    it('should handle very long passwords', async () => {
      const longPassword = 'a'.repeat(1000);
      
      const result = await authService.createUserAccount('user', longPassword);
      
      expect(result).toBeDefined();
      expect(result.username).toBe('user');
    });

    it('should handle concurrent session creation', async () => {
      await authService.createUserAccount(mockUser.username, 'TestPassword123!');
      (permissionService.getUser as jest.Mock).mockResolvedValue(mockUser);

      // Create multiple sessions concurrently
      const promises = Array(5).fill(null).map(() => 
        authService.authenticateWithCredentials(
          mockUser.username,
          'TestPassword123!'
        )
      );

      const results = await Promise.all(promises);

      // All should succeed
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toHaveProperty('token');
        expect(result).toHaveProperty('refreshToken');
      });

      // Verify we have 5 sessions
      const sessions = (authService as any).sessions;
      expect(Array.from(sessions.values()).length).toBe(5);
    });
  });
});