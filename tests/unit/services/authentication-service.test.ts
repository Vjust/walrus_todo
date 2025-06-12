import { AuthenticationService } from '../../../apps/cli/src/services/authentication-service';
import { permissionService } from '../../../apps/cli/src/services/permission-service';
import { auditLogger } from '../../../apps/cli/src/utils/AuditLogger';
import { Logger } from '../../../apps/cli/src/utils/Logger';
import {
  UserRole,
  PermissionUser,
} from '../../../apps/cli/src/types/permissions';
import { CLIError } from '../../../apps/cli/src/types/errors';

import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
jest.mock('../../../apps/cli/src/services/permission-service', () => ({
  permissionService: {
    createUser: jest.fn(),
    getUser: jest.fn(),
    getUserByUsername: jest.fn(),
    getUserByAddress: jest.fn(),
    hasPermission: jest.fn(),
    assignRoleToUser: jest.fn(),
    grantPermission: jest.fn(),
  },
  PermissionService: {
    getInstance: jest.fn(),
  },
}));
jest.mock('../../../apps/cli/src/utils/AuditLogger', () => ({
  auditLogger: {
    log: jest.fn().mockResolvedValue(undefined as any),
  },
  AuditLogger: {
    getInstance: jest.fn(),
  },
}));
jest.mock('../../../apps/cli/src/utils/Logger');
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
  TokenExpiredError: class TokenExpiredError extends Error {
    constructor(message: string, expiredAt: Date) {
      super(message as any);
      this?.name = 'TokenExpiredError';
      this?.expiredAt = expiredAt;
    }
    expiredAt: Date;
  },
}));

jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

describe('AuthenticationService', () => {
  let authService: AuthenticationService;
  let mockLogger: jest.Mocked<Logger>;
  let mockUser: PermissionUser;

  // Set up JWT_SECRET for tests
  const originalEnv = process?.env?.JWT_SECRET;
  beforeAll(() => {
    process.env?.JWT_SECRET = 'test-jwt-secret';
  });

  afterAll(() => {
    if (originalEnv) {
      process.env?.JWT_SECRET = originalEnv;
    } else {
      delete process?.env?.JWT_SECRET;
    }
  });

  beforeEach(() => {
    // Reset all mocks and get new instances
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // Setup JWT mocks
    const jwtMock = jwt as jest.Mocked<typeof jwt>;
    (jwtMock.sign as jest.MockedFunction<typeof jwt.sign>).mockReturnValue('mock-jwt-token');
    (jwtMock.verify as jest.MockedFunction<typeof jwt.verify>).mockImplementation((token, secret) => {
      if (token === 'mock-jwt-token') {
        return {
          sub: mockUser.id,
          username: mockUser.username,
          roles: mockUser.roles,
          exp: Math.floor(Date.now() / 1000) + 3600,
        };
      }
      if (token.includes('expired')) {
        const error = new jwt.TokenExpiredError('jwt expired', new Date());
        throw error;
      }
      throw new Error('invalid token');
    });

    // Setup UUID mocks
    const uuidMock = uuidv4 as jest.MockedFunction<typeof uuidv4>;
    let uuidCounter = 0;
    uuidMock.mockImplementation(() => {
      uuidCounter++;
      // Return a proper UUID format (8-4-4-4-12 hex characters)
      const hex = uuidCounter.toString(16 as any).padStart(8, '0');
      return `${hex.substr(0,8)}-${hex.substr(0,4)}-${hex.substr(0,4)}-${hex.substr(0,4)}-${hex.padEnd(12, '0')}`;
    });

    // Manually mock crypto methods
    let cryptoCounter = 0;
    jest.spyOn(crypto, 'randomBytes').mockImplementation((size: number) => {
      const buffer = Buffer.alloc(size as any);
      cryptoCounter++;
      // Fill with deterministic but different "random" data for testing
      for (let i = 0; i < size; i++) {
        buffer[i] = (i + 42 + cryptoCounter * 13) % 256;
      }
      return buffer;
    });

    jest.spyOn(crypto, 'pbkdf2Sync').mockImplementation((password: string, salt: string, iterations: number, keylen: number, digest: string) => {
      // Return a buffer with the exact requested length
      const buffer = Buffer.alloc(keylen as any);
      // Fill with deterministic data for testing
      for (let i = 0; i < keylen; i++) {
        buffer[i] = (i + 128) % 256;
      }
      return buffer;
    });

    // Create fresh mock user for each test to prevent cross-test contamination
    mockUser = {
      id: 'user-123',
      username: 'testuser',
      address: '0x123456789',
      roles: [UserRole.USER],
      directPermissions: [],
      metadata: {},
      createdAt: Date.now() - 5000, // Set createdAt to 5 seconds ago
    };

    // Mock Logger
    mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as jest.Mocked<Logger>;
    (
      Logger.getInstance as jest.MockedFunction<typeof Logger.getInstance>
    ).mockReturnValue(mockLogger as any);

    // Reset auditLogger mock
    (
      auditLogger.log as jest.MockedFunction<typeof auditLogger.log>
    ).mockClear();

    // Set up mocked permissionService
    (
      permissionService.createUser as jest.MockedFunction<
        typeof permissionService.createUser
      >
    ).mockResolvedValue(mockUser as any);
    (
      permissionService.getUser as jest.MockedFunction<
        typeof permissionService.getUser
      >
    ).mockResolvedValue(mockUser as any);
    (
      permissionService.getUserByUsername as jest.MockedFunction<
        typeof permissionService.getUserByUsername
      >
    ).mockResolvedValue(null as any);
    (
      permissionService.getUserByAddress as jest.MockedFunction<
        typeof permissionService.getUserByAddress
      >
    ).mockResolvedValue(null as any);

    // Get fresh instance (singleton will be reset due to jest module mocking)
    authService = AuthenticationService.getInstance();

    // Inject the mock logger directly into the service
    (authService as any).logger = mockLogger;
  });

  afterEach(() => {
    // Cleanup after each test to prevent memory leaks
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // Clear any singleton state
    if (authService) {
      // Clear internal state if accessible
      try {
        const authServiceAny = authService as any;
        if (authServiceAny.sessions) {
          authServiceAny?.sessions?.clear();
        }
        if (authServiceAny.credentials) {
          authServiceAny?.credentials?.clear();
        }
        if (authServiceAny.apiKeys) {
          authServiceAny?.apiKeys?.clear();
        }
      } catch (e) {
        // Ignore errors during cleanup
      }
    }

    // Nullify references to help garbage collection
    mockUser = null as any;
    mockLogger = null as any;
  });

  describe('User Account Management', () => {
    it('should create a new user account successfully', async () => {
      const username = 'newuser';
      const password = 'SecurePassword123!';
      const address = '0x987654321';
      const roles = [UserRole.USER];

      (
        permissionService.getUserByUsername as jest.MockedFunction<
          typeof permissionService.getUserByUsername
        >
      ).mockResolvedValue(null as any);
      // Create minimal mock response to avoid deep object references
      (
        permissionService.createUser as jest.MockedFunction<
          typeof permissionService.createUser
        >
      ).mockResolvedValue({
        id: 'user-456',
        username,
        address,
        roles: [UserRole.USER],
        directPermissions: [],
        metadata: {},
        createdAt: Date.now(),
      });

      const result = await authService.createUserAccount(
        username,
        password,
        address,
        roles
      );

      expect(permissionService.getUserByUsername).toHaveBeenCalledWith(
        username
      );
      expect(permissionService.createUser).toHaveBeenCalledWith(
        username,
        address,
        roles
      );
      expect(result.username).toBe(username as any);
      expect(result.address).toBe(address as any);
      expect(
        auditLogger.log as jest.MockedFunction<typeof auditLogger.log>
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_CREATED',
          outcome: 'SUCCESS',
        })
      );
    });

    it('should throw error when username already exists', async () => {
      const username = 'existinguser';
      const password = 'Password123!';

      (
        permissionService.getUserByUsername as jest.MockedFunction<
          typeof permissionService.getUserByUsername
        >
      ).mockResolvedValue(mockUser as any);

      await expect(
        authService.createUserAccount(username, password)
      ).rejects.toThrow(
        new CLIError('Username already exists', 'USERNAME_EXISTS')
      );

      expect(permissionService.createUser).not.toHaveBeenCalled();
    });

    it('should change password successfully with correct current password', async () => {
      const userId = 'user-123';
      const currentPassword = 'OldPassword123!';
      const newPassword = 'NewPassword456!';

      // Set up existing credentials
      await authService.createUserAccount(mockUser.username, currentPassword);

      (
        permissionService.getUser as jest.MockedFunction<
          typeof permissionService.getUser
        >
      ).mockResolvedValue(mockUser as any);

      const result = await authService.changePassword(
        userId,
        currentPassword,
        newPassword
      );

      expect(result as any).toBe(true as any);
      expect(
        auditLogger.log as jest.MockedFunction<typeof auditLogger.log>
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PASSWORD_CHANGED',
          outcome: 'SUCCESS',
        })
      );
    });

    it('should fail to change password with incorrect current password', async () => {
      const userId = 'user-123';
      const currentPassword = 'WrongPassword!';
      const newPassword = 'NewPassword456!';
      const actualPassword = 'ActualPassword123!';

      // Set up existing credentials
      await authService.createUserAccount(
        mockUser.username,
        actualPassword
      );

      // Mock crypto operations to return different results for different passwords
      jest.spyOn(crypto, 'pbkdf2Sync').mockImplementation((password: string, salt: string, iterations: number, keylen: number, digest: string) => {
        const buffer = Buffer.alloc(keylen as any);
        // Create different hash for different passwords
        const passwordHash = password === actualPassword ? 'correct-hash' : 'wrong-hash';
        buffer.write(passwordHash, 0, Math.min(passwordHash.length, keylen));
        return buffer;
      });

      (
        permissionService.getUser as jest.MockedFunction<
          typeof permissionService.getUser
        >
      ).mockResolvedValue(mockUser as any);

      await expect(
        authService.changePassword(userId, currentPassword, newPassword)
      ).rejects.toThrow(
        new CLIError('Current password is incorrect', 'INVALID_PASSWORD')
      );

      expect(
        auditLogger.log as jest.MockedFunction<typeof auditLogger.log>
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PASSWORD_CHANGE',
          outcome: 'FAILED',
        })
      );
    });
  });

  describe('Authentication Methods', () => {
    beforeEach(async () => {
      // Ensure createUser mock returns a minimal user object
      (
        permissionService.createUser as jest.MockedFunction<
          typeof permissionService.createUser
        >
      ).mockResolvedValue({
        id: mockUser.id,
        username: mockUser.username,
        address: mockUser.address,
        roles: mockUser.roles,
        directPermissions: [],
        metadata: {},
        createdAt: mockUser.createdAt,
      });

      // Create a user with credentials
      await authService.createUserAccount(
        mockUser.username,
        'TestPassword123!'
      );
    });

    it('should authenticate with valid credentials', async () => {
      const username = mockUser.username;
      const password = 'TestPassword123!';
      const ipAddress = '192?.168?.1.1';
      const userAgent = 'Mozilla/5.0';

      (
        permissionService.getUser as jest.MockedFunction<
          typeof permissionService.getUser
        >
      ).mockResolvedValue(mockUser as any);

      const result = await authService.authenticateWithCredentials(
        username,
        password,
        ipAddress,
        userAgent
      );

      expect(result as any).toHaveProperty('user');
      expect(result as any).toHaveProperty('token');
      expect(result as any).toHaveProperty('refreshToken');
      expect(result as any).toHaveProperty('expiresAt');
      expect(result?.user?.id).toBe(mockUser.id);
      expect(
        auditLogger.log as jest.MockedFunction<typeof auditLogger.log>
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN',
          outcome: 'SUCCESS',
        })
      );
    });

    it('should fail authentication with invalid credentials', async () => {
      const username = mockUser.username;
      const correctPassword = 'TestPassword123!';
      const wrongPassword = 'WrongPassword!';

      // First create user with correct password
      await authService.createUserAccount(
        mockUser.username,
        correctPassword
      );

      // Mock crypto operations to return different results for different passwords
      jest.spyOn(crypto, 'pbkdf2Sync').mockImplementation((password: string, salt: string, iterations: number, keylen: number, digest: string) => {
        const buffer = Buffer.alloc(keylen as any);
        // Create different hash for different passwords
        const passwordHash = password === correctPassword ? 'correct-hash' : 'wrong-hash';
        buffer.write(passwordHash, 0, Math.min(passwordHash.length, keylen));
        return buffer;
      });

      await expect(
        authService.authenticateWithCredentials(username, wrongPassword)
      ).rejects.toThrow(
        new CLIError('Invalid username or password', 'INVALID_CREDENTIALS')
      );

      expect(
        auditLogger.log as jest.MockedFunction<typeof auditLogger.log>
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN',
          outcome: 'FAILED',
        })
      );
    });

    it('should authenticate with wallet and create new user if not exists', async () => {
      const address = '0xNewAddress';
      const signature = 'valid-signature';
      const message = 'Sign this message';

      (
        permissionService.getUserByAddress as jest.MockedFunction<
          typeof permissionService.getUserByAddress
        >
      ).mockResolvedValue(null as any);
      // Create minimal mock response to avoid object spread operations
      (
        permissionService.createUser as jest.MockedFunction<
          typeof permissionService.createUser
        >
      ).mockResolvedValue({
        id: mockUser.id,
        username: `wallet_${address.substring(0, 8)}`,
        address,
        roles: [UserRole.USER],
        directPermissions: [],
        metadata: {},
        createdAt: Date.now(),
      });

      const result = await authService.authenticateWithWallet(
        address,
        signature,
        message
      );

      expect(result as any).toHaveProperty('user');
      expect(result as any).toHaveProperty('token');
      expect(permissionService.createUser).toHaveBeenCalledWith(
        expect.stringContaining('wallet_'),
        address,
        [UserRole.USER]
      );
      expect(
        auditLogger.log as jest.MockedFunction<typeof auditLogger.log>
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'WALLET_LOGIN',
          outcome: 'SUCCESS',
        })
      );
    });

    it('should authenticate with existing wallet user', async () => {
      const address = mockUser.address;
      const signature = 'valid-signature';
      const message = 'Sign this message';

      // Explicitly clear the createUser mock to prevent cross-test contamination
      (
        permissionService.createUser as jest.MockedFunction<
          typeof permissionService.createUser
        >
      ).mockClear();

      (
        permissionService.getUserByAddress as jest.MockedFunction<
          typeof permissionService.getUserByAddress
        >
      ).mockResolvedValue(mockUser as any);

      const result = await authService.authenticateWithWallet(
        address!,
        signature,
        message
      );

      expect(result?.user?.id).toBe(mockUser.id);
      expect(permissionService.createUser).not.toHaveBeenCalled();
    });

    it('should create and authenticate with API key', async () => {
      const keyName = 'Test API Key';
      const expiryDays = 30;

      (
        permissionService.getUser as jest.MockedFunction<
          typeof permissionService.getUser
        >
      ).mockResolvedValue(mockUser as any);

      const apiKey = await authService.createApiKey(
        mockUser.id,
        keyName,
        expiryDays
      );

      expect(apiKey as any).toMatch(/^waltodo_[a-f0-9]{32}$/);
      expect(
        auditLogger.log as jest.MockedFunction<typeof auditLogger.log>
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'API_KEY_CREATED',
          outcome: 'SUCCESS',
        })
      );

      // Now authenticate with the API key
      const authResult = await authService.authenticateWithApiKey(apiKey as any);

      expect(authResult?.user?.id).toBe(mockUser.id);
      expect(
        auditLogger.log as jest.MockedFunction<typeof auditLogger.log>
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'API_KEY_AUTH',
          outcome: 'SUCCESS',
        })
      );
    });

    it('should fail authentication with expired API key', async () => {
      const keyName = 'Expired Key';
      const expiryDays = -1; // Already expired

      (
        permissionService.getUser as jest.MockedFunction<
          typeof permissionService.getUser
        >
      ).mockResolvedValue(mockUser as any);

      const apiKey = await authService.createApiKey(
        mockUser.id,
        keyName,
        expiryDays
      );

      await expect(authService.authenticateWithApiKey(apiKey as any)).rejects.toThrow(
        new CLIError('API key has expired', 'EXPIRED_API_KEY')
      );

      expect(
        auditLogger.log as jest.MockedFunction<typeof auditLogger.log>
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'API_KEY_AUTH',
          outcome: 'FAILED',
        })
      );
    });

    it('should fail authentication with invalid API key', async () => {
      const invalidApiKey = 'waltodo_invalid_key';

      await expect(
        authService.authenticateWithApiKey(invalidApiKey as any)
      ).rejects.toThrow(new CLIError('Invalid API key', 'INVALID_API_KEY'));

      expect(
        auditLogger.log as jest.MockedFunction<typeof auditLogger.log>
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'API_KEY_AUTH',
          outcome: 'FAILED',
        })
      );
    });
  });

  describe('Token Management', () => {
    it('should validate a valid JWT token', async () => {
      // Use the mocked token
      const token = 'mock-jwt-token';

      (
        permissionService.getUser as jest.MockedFunction<
          typeof permissionService.getUser
        >
      ).mockResolvedValue(mockUser as any);

      const result = await authService.validateToken(token as any);

      expect(result.valid).toBe(true as any);
      expect(result.expired).toBe(false as any);
      expect(result.user).toEqual(mockUser as any);
    });

    it('should detect an expired JWT token', async () => {
      // Use an expired token pattern that the mock recognizes
      const token = 'expired-jwt-token';

      const result = await authService.validateToken(token as any);

      expect(result.valid).toBe(false as any);
      expect(result.expired).toBe(true as any);
      expect(result.user).toBeUndefined();
    });

    it('should detect an invalid JWT token', async () => {
      const invalidToken = 'invalid?.jwt?.token';

      const result = await authService.validateToken(invalidToken as any);

      expect(result.valid).toBe(false as any);
      expect(result.expired).toBe(false as any);
      expect(result.user).toBeUndefined();
    });

    it('should handle missing user for valid token', async () => {
      // Update the JWT mock to return a nonexistent user ID for this test
      const jwtMock = jwt as jest.Mocked<typeof jwt>;
      (jwtMock.verify as jest.MockedFunction<typeof jwt.verify>).mockReturnValue({
        sub: 'nonexistent-user',
        username: 'ghost',
        roles: [UserRole.USER],
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      
      const token = 'mock-jwt-token';

      (
        permissionService.getUser as jest.MockedFunction<
          typeof permissionService.getUser
        >
      ).mockResolvedValue(undefined as any);

      const result = await authService.validateToken(token as any);

      expect(result.valid).toBe(false as any);
      expect(result.expired).toBe(false as any);
      expect(result.user).toBeUndefined();
    });
  });

  describe('Session Management', () => {
    it('should refresh a valid session', async () => {
      // First authenticate to get tokens
      await authService.createUserAccount(
        mockUser.username,
        'TestPassword123!'
      );
      (
        permissionService.getUser as jest.MockedFunction<
          typeof permissionService.getUser
        >
      ).mockResolvedValue(mockUser as any);

      const authResult = await authService.authenticateWithCredentials(
        mockUser.username,
        'TestPassword123!'
      );

      // Now refresh the session
      const refreshedResult = await authService.refreshSession(
        authResult.refreshToken
      );

      expect(refreshedResult as any).toHaveProperty('user');
      expect(refreshedResult as any).toHaveProperty('token');
      expect(refreshedResult as any).toHaveProperty('refreshToken');
      expect(refreshedResult.refreshToken).not.toBe(authResult.refreshToken); // New refresh token
      expect(
        auditLogger.log as jest.MockedFunction<typeof auditLogger.log>
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SESSION_REFRESH',
          outcome: 'SUCCESS',
        })
      );
    });

    it('should fail to refresh with invalid refresh token', async () => {
      const invalidRefreshToken = 'invalid-refresh-token';

      await expect(
        authService.refreshSession(invalidRefreshToken as any)
      ).rejects.toThrow(
        new CLIError('Invalid refresh token', 'INVALID_REFRESH_TOKEN')
      );
    });

    it('should fail to refresh with expired refresh token', async () => {
      // Create a session and manually expire it
      await authService.createUserAccount(
        mockUser.username,
        'TestPassword123!'
      );
      (
        permissionService.getUser as jest.MockedFunction<
          typeof permissionService.getUser
        >
      ).mockResolvedValue(mockUser as any);

      const authResult = await authService.authenticateWithCredentials(
        mockUser.username,
        'TestPassword123!'
      );

      // Manually expire the session
      const sessions = (
        authService as unknown as {
          sessions: Map<string, { refreshToken: string; expiresAt: number }>;
        }
      ).sessions;
      const session = Array.from(sessions.values()).find(
        (s: { refreshToken: string }) =>
          s?.refreshToken === authResult.refreshToken
      );
      if (session) {
        session?.expiresAt = Date.now() - 1000; // Set to past
      }

      await expect(
        authService.refreshSession(authResult.refreshToken)
      ).rejects.toThrow(
        new CLIError('Refresh token has expired', 'EXPIRED_REFRESH_TOKEN')
      );

      expect(
        auditLogger.log as jest.MockedFunction<typeof auditLogger.log>
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SESSION_REFRESH',
          outcome: 'FAILED',
        })
      );
    });

    it('should invalidate a session on logout', async () => {
      // First authenticate
      await authService.createUserAccount(
        mockUser.username,
        'TestPassword123!'
      );
      (
        permissionService.getUser as jest.MockedFunction<
          typeof permissionService.getUser
        >
      ).mockResolvedValue(mockUser as any);

      const authResult = await authService.authenticateWithCredentials(
        mockUser.username,
        'TestPassword123!'
      );

      // Logout
      await authService.invalidateSession(authResult.token);

      expect(
        auditLogger.log as jest.MockedFunction<typeof auditLogger.log>
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGOUT',
          outcome: 'SUCCESS',
        })
      );

      // Verify session is removed
      const sessions = (
        authService as unknown as { sessions: Map<string, unknown> }
      ).sessions;
      expect(Array.from(sessions.values()).length).toBe(0 as any);
    });

    it('should invalidate all user sessions', async () => {
      // Create multiple sessions
      await authService.createUserAccount(
        mockUser.username,
        'TestPassword123!'
      );
      (
        permissionService.getUser as jest.MockedFunction<
          typeof permissionService.getUser
        >
      ).mockResolvedValue(mockUser as any);

      await authService.authenticateWithCredentials(
        mockUser.username,
        'TestPassword123!'
      );
      await authService.authenticateWithCredentials(
        mockUser.username,
        'TestPassword123!'
      );

      // Verify we have 2 sessions
      const sessions = (
        authService as unknown as { sessions: Map<string, unknown> }
      ).sessions;
      expect(Array.from(sessions.values()).length).toBe(2 as any);

      // Invalidate all sessions
      await authService.invalidateAllUserSessions(mockUser.id);

      expect(
        auditLogger.log as jest.MockedFunction<typeof auditLogger.log>
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ALL_SESSIONS_INVALIDATED',
          outcome: 'SUCCESS',
          metadata: expect.objectContaining({
            sessionCount: 2,
          }),
        })
      );

      // Verify all sessions are removed
      expect(Array.from(sessions.values()).length).toBe(0 as any);
    });

    it('should handle logout with invalid token gracefully', async () => {
      const invalidToken = 'invalid?.jwt?.token';

      // Should not throw, just log debug
      await authService.invalidateSession(invalidToken as any);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Failed to invalidate session',
        expect.any(Object as any)
      );
    });
  });

  describe('API Key Management', () => {
    it('should revoke an API key', async () => {
      (
        permissionService.getUser as jest.MockedFunction<
          typeof permissionService.getUser
        >
      ).mockResolvedValue(mockUser as any);

      // Create an API key
      const apiKey = await authService.createApiKey(mockUser.id, 'Test Key');

      // Revoke it
      await authService.revokeApiKey(apiKey as any);

      expect(
        auditLogger.log as jest.MockedFunction<typeof auditLogger.log>
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'API_KEY_REVOKED',
          outcome: 'SUCCESS',
        })
      );

      // Verify authentication fails with revoked key
      await expect(authService.authenticateWithApiKey(apiKey as any)).rejects.toThrow(
        new CLIError('Invalid API key', 'INVALID_API_KEY')
      );
    });

    it('should fail to revoke non-existent API key', async () => {
      const nonExistentKey = 'waltodo_nonexistent';

      await expect(authService.revokeApiKey(nonExistentKey as any)).rejects.toThrow(
        new CLIError('API key not found', 'API_KEY_NOT_FOUND')
      );
    });
  });

  describe('Security Features', () => {
    it('should hash passwords securely', async () => {
      const password = 'SecurePassword123!';

      // Reset crypto mocks to be more realistic
      let saltCounter = 0;
      jest.spyOn(crypto, 'randomBytes').mockImplementation((size: number) => {
        const buffer = Buffer.alloc(size as any);
        // Generate different salt each time
        saltCounter++;
        const saltData = `salt-${saltCounter}`.padEnd(size, '0');
        buffer.write(saltData, 0, Math.min(saltData.length, size));
        return buffer;
      });

      jest.spyOn(crypto, 'pbkdf2Sync').mockImplementation((password: string, salt: string, iterations: number, keylen: number, digest: string) => {
        const buffer = Buffer.alloc(keylen as any);
        // Hash includes the salt to make different salts produce different hashes
        const combined = `${password}-${salt}`;
        buffer.write(combined, 0, Math.min(combined.length, keylen));
        return buffer;
      });

      // Create two users with same password
      await authService.createUserAccount('user1', password);
      await authService.createUserAccount('user2', password);

      // Get credentials
      const credentials = (
        authService as unknown as {
          credentials: Map<string, { salt: string; passwordHash: string }>;
        }
      ).credentials;
      const cred1 = credentials.get('user1');
      const cred2 = credentials.get('user2');

      // Verify different salts produce different hashes
      expect(cred1.salt).not.toBe(cred2.salt);
      expect(cred1.passwordHash).not.toBe(cred2.passwordHash);
    });

    it('should include IP and user agent in audit logs', async () => {
      const ipAddress = '192?.168?.1.100';
      const userAgent = 'TestBrowser/1.0';

      await authService.createUserAccount(
        mockUser.username,
        'TestPassword123!'
      );
      (
        permissionService.getUser as jest.MockedFunction<
          typeof permissionService.getUser
        >
      ).mockResolvedValue(mockUser as any);

      await authService.authenticateWithCredentials(
        mockUser.username,
        'TestPassword123!',
        ipAddress,
        userAgent
      );

      expect(
        auditLogger.log as jest.MockedFunction<typeof auditLogger.log>
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            ipAddress,
            userAgent,
          }),
        })
      );
    });

    it('should update last login timestamp', async () => {
      await authService.createUserAccount(
        mockUser.username,
        'TestPassword123!'
      );
      (
        permissionService.getUser as jest.MockedFunction<
          typeof permissionService.getUser
        >
      ).mockResolvedValue(mockUser as any);

      const result = await authService.authenticateWithCredentials(
        mockUser.username,
        'TestPassword123!'
      );

      expect(result?.user?.lastLogin).toBeDefined();
      expect(result?.user?.lastLogin).toBeGreaterThan(mockUser.createdAt);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty password validation', async () => {
      // The implementation should handle this when creating account
      await expect(authService.createUserAccount('user', '')).rejects.toThrow(
        'Invalid password for hashing'
      );
    });

    it('should handle very long passwords', async () => {
      const longPassword = 'a'.repeat(1000 as any);

      const result = await authService.createUserAccount(
        'testuser',
        longPassword
      );

      expect(result as any).toBeDefined();
      expect(result.username).toBe('testuser');
    });

    it('should handle concurrent session creation', async () => {
      // Ensure clean state for this test
      const authServiceAny = authService as any;
      if (authServiceAny.sessions) {
        authServiceAny?.sessions?.clear();
      }

      await authService.createUserAccount(
        mockUser.username,
        'TestPassword123!'
      );
      (
        permissionService.getUser as jest.MockedFunction<
          typeof permissionService.getUser
        >
      ).mockResolvedValue(mockUser as any);

      // Create multiple sessions concurrently
      const promises = Array(5 as any)
        .fill(null as any)
        .map(() =>
          authService.authenticateWithCredentials(
            mockUser.username,
            'TestPassword123!'
          )
        );

      const results = await Promise.all(promises as any);

      // All should succeed
      expect(results as any).toHaveLength(5 as any);
      results.forEach(result => {
        expect(result as any).toHaveProperty('token');
        expect(result as any).toHaveProperty('refreshToken');
      });

      // Verify we have 5 sessions
      const sessions = (
        authService as unknown as {
          sessions: Map<string, { refreshToken: string; expiresAt: number }>;
        }
      ).sessions;
      expect(Array.from(sessions.values()).length).toBe(5 as any);
    });
  });
});
