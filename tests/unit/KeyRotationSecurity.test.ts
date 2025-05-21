import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SecureCredentialManager } from '../../src/services/ai/SecureCredentialManager';
import { AIPermissionLevel, CredentialType } from '../../src/types/adapters/AICredentialAdapter';

// Mock the fs module
jest.mock('fs', () => {
  const originalModule = jest.requireActual('fs');
  return {
    ...originalModule,
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    copyFileSync: jest.fn(),
    chmodSync: jest.fn(),
    renameSync: jest.fn(),
    unlinkSync: jest.fn(),
    statSync: jest.fn().mockReturnValue({
      mtime: { getTime: () => Date.now() }
    }),
    readdirSync: jest.fn(),
    constants: {
      COPYFILE_EXCL: 1
    }
  };
});

jest.mock('crypto', () => {
  const originalModule = jest.requireActual('crypto');
  const mockRandomUUID = jest.fn().mockReturnValue('mock-uuid');
  
  return {
    ...originalModule,
    randomBytes: jest.fn(size => Buffer.alloc(size, 'a')),
    createCipheriv: jest.fn(() => ({
      update: jest.fn().mockReturnValue(Buffer.from('encrypted')),
      final: jest.fn().mockReturnValue(Buffer.from('final'))
    })),
    createDecipheriv: jest.fn(() => ({
      update: jest.fn().mockReturnValue(Buffer.from('decrypted')),
      final: jest.fn().mockReturnValue(Buffer.from(''))
    })),
    randomUUID: mockRandomUUID
  };
});

// Mock path.join
jest.mock('path', () => {
  const originalModule = jest.requireActual('path');
  return {
    ...originalModule,
    join: jest.fn((...args) => args.join('/'))
  };
});

describe('SecureCredentialManager Key Rotation and Security', () => {
  let manager: SecureCredentialManager;
  const mockHomeDir = '/mock/home';
  const mockConfigDir = '/mock/home/.config/walrus-todo';
  const mockKeyPath = '/mock/home/.config/walrus-todo/.keyfile';
  const mockMetadataPath = '/mock/home/.config/walrus-todo/.keymetadata.json';
  const mockBackupDir = '/mock/home/.config/walrus-todo/key_backups';
  const mockCredentialsPath = '/mock/home/.config/walrus-todo/secure_credentials.enc';

  beforeEach(() => {
    // Mock environment variables
    process.env.HOME = mockHomeDir;
    
    // Mock file existence checks
    (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
      if (path === mockConfigDir) return true;
      if (path === mockKeyPath) return true;
      if (path === mockMetadataPath) return true;
      if (path === mockBackupDir) return true;
      if (path === mockCredentialsPath) return true;
      return false;
    });
    
    // Mock reading files
    (fs.readFileSync as jest.Mock).mockImplementation((path: string, encoding?: string) => {
      if (path === mockKeyPath) return Buffer.from('mockencryptionkey');
      if (path === mockMetadataPath) return JSON.stringify({
        keyId: 'test-key-id',
        createdAt: Date.now() - 1000000,
        lastRotatedAt: Date.now() - 1000000,
        version: 1,
        backupLocations: [
          {
            path: '/mock/home/.config/walrus-todo/key_backups/key_backup_test-key-id_2023-01-01',
            timestamp: Date.now() - 500000,
            metadataBackupPath: '/mock/home/.config/walrus-todo/key_backups/metadata_backup_2023-01-01.json'
          }
        ]
      });
      if (path === mockCredentialsPath) {
        const mockIv = Buffer.alloc(16, 'a');
        const mockEncrypted = Buffer.from('mockencryptedcredentials');
        return Buffer.concat([mockIv, mockEncrypted]);
      }
      return Buffer.from('');
    });
    
    // Mock directory listing
    (fs.readdirSync as jest.Mock).mockReturnValue([
      'credentials_backup_2023-01-01-00-00-00.enc',
      'credentials_backup_2023-01-02-00-00-00.enc'
    ]);

    // Create a new instance for each test
    manager = new SecureCredentialManager();
    
    // Reset mocks for clean tracking
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.HOME;
  });

  test('should initialize with existing key and metadata', () => {
    expect(fs.readFileSync).toHaveBeenCalledWith(mockKeyPath);
    expect(fs.existsSync).toHaveBeenCalledWith(mockKeyPath);
  });

  test('should successfully rotate keys', async () => {
    const result = await manager.rotateKey();
    
    // Should create a backup first
    expect(fs.copyFileSync).toHaveBeenCalled();
    
    // Should generate a new key
    expect(crypto.randomBytes).toHaveBeenCalledWith(32);
    
    // Should write the new key to disk
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      mockKeyPath,
      expect.any(Buffer),
      expect.objectContaining({ mode: 0o600 })
    );
    
    // Should update metadata
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      mockMetadataPath,
      expect.any(String),
      expect.objectContaining({ mode: 0o600 })
    );
    
    // Should re-encrypt credentials with new key
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      mockCredentialsPath,
      expect.any(Buffer),
      expect.objectContaining({ mode: 0o600 })
    );
    
    expect(result).toBe(true);
  });

  test('should validate key integrity', () => {
    const result = manager.validateKeyIntegrity();
    
    // Should perform an encryption test
    expect(crypto.createCipheriv).toHaveBeenCalled();
    expect(crypto.createDecipheriv).toHaveBeenCalled();
    
    expect(result).toBe(true);
  });

  test('should create key backups', async () => {
    await manager.rotateKey();
    
    // Should copy the key file
    expect(fs.copyFileSync).toHaveBeenCalled();
    
    // Should backup metadata
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('metadata_backup_'),
      expect.any(String),
      expect.objectContaining({ mode: 0o400 }) // Read-only
    );
    
    // Should update metadata with backup info
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      mockMetadataPath,
      expect.stringContaining('backupLocations'),
      expect.objectContaining({ mode: 0o600 })
    );
  });

  test('should restore from a backup', async () => {
    const mockBackupId = 'test-key-id';
    const result = await manager.restoreFromBackup(mockBackupId);
    
    // Should copy the backup key to the main key location
    expect(fs.copyFileSync).toHaveBeenCalled();
    
    // Should restore permissions
    expect(fs.chmodSync).toHaveBeenCalledWith(mockKeyPath, 0o600);
    
    // Should restore metadata
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      mockMetadataPath,
      expect.any(String),
      expect.objectContaining({ mode: 0o600 })
    );
    
    expect(result).toBe(true);
  });

  test('should list available backups', () => {
    const backups = manager.listKeyBackups();
    
    expect(backups).toHaveLength(1);
    expect(backups[0]).toHaveProperty('id');
    expect(backups[0]).toHaveProperty('timestamp');
    expect(backups[0]).toHaveProperty('version');
    expect(backups[0]).toHaveProperty('path');
  });

  test('should properly validate credentials for expiration', async () => {
    // Setup private method access
    const validateCredentialMethod = jest.spyOn(
      // @ts-expect-error - accessing private method
      manager,
      'validateCredential'
    );
    
    // Mock the credential
    const expiredCredential = {
      id: 'test-credential',
      providerName: 'test-provider',
      credentialType: CredentialType.API_KEY,
      credentialValue: 'api-key-value',
      metadata: {},
      isVerified: false,
      storageOptions: { encrypt: true },
      createdAt: Date.now() - 1000000,
      expiresAt: Date.now() - 1000, // Expired 1 second ago
      permissionLevel: AIPermissionLevel.STANDARD
    };
    
    // Add the credential to the manager
    // @ts-expect-error - accessing private property
    manager.credentials = {
      'test-provider': expiredCredential
    };
    
    // Expected to throw CREDENTIAL_EXPIRED error
    await expect(manager.getCredential('test-provider'))
      .rejects.toThrow('Credential for provider "test-provider" has expired');
    
    // Check if validation was called
    expect(validateCredentialMethod).toHaveBeenCalledWith(
      expiredCredential,
      'test-provider'
    );
  });

  test('should backup credentials periodically', () => {
    // Setup private method access
    const backupCredentialsMethod = jest.spyOn(
      // @ts-expect-error - accessing private method
      manager,
      'backupCredentialsIfNeeded'
    );
    
    // Trigger a save operation
    // @ts-expect-error - accessing private method
    manager.saveCredentials();
    
    // Check if backup function was called
    expect(backupCredentialsMethod).toHaveBeenCalled();
  });

  test('should clean up old backups', () => {
    // Mock more than 5 backup files
    (fs.readdirSync as jest.Mock).mockReturnValue([
      'credentials_backup_2023-01-01-00-00-00.enc',
      'credentials_backup_2023-01-02-00-00-00.enc',
      'credentials_backup_2023-01-03-00-00-00.enc',
      'credentials_backup_2023-01-04-00-00-00.enc',
      'credentials_backup_2023-01-05-00-00-00.enc',
      'credentials_backup_2023-01-06-00-00-00.enc'
    ]);
    
    // Setup private method access
    const cleanupMethod = jest.spyOn(
      // @ts-expect-error - accessing private method
      manager,
      'cleanupOldBackups'
    );
    
    // Trigger a cleanup by saving credentials
    // @ts-expect-error - accessing private method
    manager.backupCredentialsIfNeeded();
    
    // Should attempt to clean up old backups
    expect(cleanupMethod).toHaveBeenCalled();
    
    // Should delete older backups (keep only 5)
    expect(fs.unlinkSync).toHaveBeenCalled();
  });
});