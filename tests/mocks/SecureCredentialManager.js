const { jest } = require('@jest/globals');

// Mock SecureCredentialManager
const mockSecureCredentialManager = {
  setCredential: jest.fn().mockImplementation(async (provider, credential, type = 'API_KEY', options = {}) => {
    // Simulate encryption
    const encrypted = Buffer.from(credential).toString('base64');
    
    // Simulate file permission setting
    const filePermissions = options.filePermissions || '600';
    if (filePermissions !== '600' && filePermissions !== '644') {
      throw new Error('Invalid file permissions - must be 600 or 644');
    }
    
    // Simulate path traversal prevention
    const sanitizedProvider = provider.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    if (sanitizedProvider !== provider) {
      throw new Error('Provider name contains invalid characters');
    }
    
    return {
      id: 'mock-credential-id',
      providerName: sanitizedProvider,
      encrypted: encrypted,
      filePermissions: filePermissions,
    };
  }),
  getCredential: jest.fn().mockImplementation(provider => {
    if (
      provider === 'non-existent' ||
      provider === 'unauthorized' ||
      provider === 'expired'
    ) {
      return Promise.reject(
        new Error(`Credential not found for provider: ${provider}`)
      );
    }
    // Return decrypted credential
    return Promise.resolve('mock-api-key');
  }),
  getCredentialObject: jest.fn().mockImplementation(provider => {
    if (provider === 'non-existent' || provider === 'unauthorized') {
      return Promise.reject(
        new Error(`Credential not found for provider: ${provider}`)
      );
    }
    if (provider === 'expired') {
      return Promise.reject(
        new Error(`Credential for provider "${provider}" has expired`)
      );
    }
    return Promise.resolve({
      id: 'mock-credential-id',
      providerName: provider,
      credentialType: 'API_KEY',
      credentialValue: 'mock-api-key',
      isVerified: false,
      storageOptions: { encrypt: true },
      createdAt: Date.now(),
      permissionLevel: 'STANDARD',
    });
  }),
  hasCredential: jest.fn().mockResolvedValue(true),
  removeCredential: jest.fn().mockResolvedValue(true),
  verifyCredential: jest.fn().mockResolvedValue(true),
  updatePermissions: jest.fn().mockImplementation((provider, level) => {
    if (provider === 'non-existent') {
      return Promise.reject(new Error('Provider not found'));
    }
    if (level === 'ADMIN') {
      return Promise.reject(
        new Error('Unauthorized permission escalation attempt')
      );
    }
    return Promise.resolve({ providerName: provider, permissionLevel: level });
  }),
  generateCredentialProof: jest.fn().mockResolvedValue('mock-proof'),
  listCredentials: jest.fn().mockResolvedValue([]),
  setBlockchainAdapter: jest.fn(),
  
  // Encryption methods
  encrypt: jest.fn().mockImplementation(async (data) => {
    return Buffer.from(data).toString('base64');
  }),
  decrypt: jest.fn().mockImplementation(async (encryptedData) => {
    try {
      return Buffer.from(encryptedData, 'base64').toString();
    } catch (err) {
      throw new Error('Decryption failed - corrupted data');
    }
  }),
  
  // File security methods
  setFilePermissions: jest.fn().mockImplementation(async (filePath, permissions) => {
    if (permissions !== '600' && permissions !== '644') {
      throw new Error('Invalid file permissions');
    }
    return true;
  }),
  validateFilePath: jest.fn().mockImplementation((filePath) => {
    if (filePath.includes('..') || filePath.includes('//')) {
      throw new Error('Path traversal detected');
    }
    return true;
  }),
  
  // Access control
  checkAccess: jest.fn().mockImplementation(async (provider, userId) => {
    if (provider === 'unauthorized') {
      throw new Error('Access denied');
    }
    return true;
  }),
};

const MockSecureCredentialManagerClass = jest
  .fn()
  .mockImplementation(() => mockSecureCredentialManager);

module.exports = {
  SecureCredentialManager: MockSecureCredentialManagerClass,
  secureCredentialManager: mockSecureCredentialManager,
  default: MockSecureCredentialManagerClass,
};
