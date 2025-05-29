/**
 * File system mock that handles property assignment correctly
 * Fixes "Cannot set property readFileSync" errors
 */

const path = require('path');

// Mock file system state
const mockFileSystem = new Map();
const mockDirectories = new Set();

// Helper function to normalize paths
function normalizePath(filePath) {
  return path.resolve(filePath);
}

// Create mock buffer for files
function createMockBuffer(content) {
  if (typeof content === 'string') {
    return Buffer.from(content, 'utf8');
  }
  if (content instanceof Uint8Array) {
    return Buffer.from(content);
  }
  if (Buffer.isBuffer(content)) {
    return content;
  }
  // Default fallback
  return Buffer.from('mock file content');
}

// Mock fs methods
const fsMock = {
  // Synchronous methods
  readFileSync: jest.fn().mockImplementation((filePath, options) => {
    const normalizedPath = normalizePath(filePath);
    const content = mockFileSystem.get(normalizedPath);
    
    if (content !== undefined) {
      if (options === 'utf8' || (typeof options === 'object' && options.encoding === 'utf8')) {
        return content.toString();
      }
      return createMockBuffer(content);
    }
    
    // Default content based on file type
    if (filePath.includes('config.json')) {
      const defaultContent = JSON.stringify({ network: 'testnet', version: '1.0.0' });
      return options === 'utf8' || (typeof options === 'object' && options.encoding === 'utf8') ? 
        defaultContent : Buffer.from(defaultContent);
    } else if (filePath.includes('.env')) {
      const defaultContent = 'NODE_ENV=test\nSUI_NETWORK=testnet';
      return options === 'utf8' || (typeof options === 'object' && options.encoding === 'utf8') ? 
        defaultContent : Buffer.from(defaultContent);
    } else if (filePath.includes('todo') || filePath.includes('.json')) {
      const defaultContent = JSON.stringify({ id: 'test-todo', title: 'Test Todo', completed: false });
      return options === 'utf8' || (typeof options === 'object' && options.encoding === 'utf8') ? 
        defaultContent : Buffer.from(defaultContent);
    } else if (filePath.includes('.jpg') || filePath.includes('.jpeg') || filePath.includes('.png')) {
      // Mock image file
      return Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]); // JPEG header
    }
    
    // Throw ENOENT for unknown files
    const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`);
    error.code = 'ENOENT';
    error.errno = -2;
    error.path = filePath;
    throw error;
  }),

  writeFileSync: jest.fn().mockImplementation((filePath, data, options) => {
    const normalizedPath = normalizePath(filePath);
    let content = data;
    
    if (typeof data === 'string') {
      content = data;
    } else if (Buffer.isBuffer(data)) {
      content = data;
    } else if (data instanceof Uint8Array) {
      content = Buffer.from(data);
    }
    
    mockFileSystem.set(normalizedPath, content);
    
    // Create parent directory if needed
    const parentDir = path.dirname(normalizedPath);
    mockDirectories.add(parentDir);
  }),

  existsSync: jest.fn().mockImplementation((filePath) => {
    const normalizedPath = normalizePath(filePath);
    return mockFileSystem.has(normalizedPath) || mockDirectories.has(normalizedPath);
  }),

  mkdirSync: jest.fn().mockImplementation((dirPath, options) => {
    const normalizedPath = normalizePath(dirPath);
    mockDirectories.add(normalizedPath);
  }),

  readdirSync: jest.fn().mockImplementation((dirPath) => {
    const normalizedPath = normalizePath(dirPath);
    
    if (normalizedPath.includes('Todos')) {
      return ['todo1.json', 'todo2.json'];
    } else if (normalizedPath.includes('config')) {
      return ['config.json', 'wallet.json'];
    }
    return [];
  }),

  statSync: jest.fn().mockImplementation((filePath) => {
    const normalizedPath = normalizePath(filePath);
    
    if (mockFileSystem.has(normalizedPath)) {
      const content = mockFileSystem.get(normalizedPath);
      const size = Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content.toString());
      
      return {
        isFile: () => true,
        isDirectory: () => false,
        size,
        mtime: new Date(),
        birthtime: new Date(),
        mode: 0o644,
      };
    }
    
    if (mockDirectories.has(normalizedPath)) {
      return {
        isFile: () => false,
        isDirectory: () => true,
        size: 0,
        mtime: new Date(),
        birthtime: new Date(),
        mode: 0o755,
      };
    }
    
    const error = new Error(`ENOENT: no such file or directory, stat '${filePath}'`);
    error.code = 'ENOENT';
    error.errno = -2;
    error.path = filePath;
    throw error;
  }),

  lstatSync: jest.fn().mockImplementation((filePath) => {
    return fsMock.statSync(filePath);
  }),

  // Asynchronous methods (fs/promises)
  readFile: jest.fn().mockImplementation(async (filePath, options) => {
    return fsMock.readFileSync(filePath, options);
  }),

  writeFile: jest.fn().mockImplementation(async (filePath, data, options) => {
    return fsMock.writeFileSync(filePath, data, options);
  }),

  access: jest.fn().mockImplementation(async (filePath, mode) => {
    const normalizedPath = normalizePath(filePath);
    if (!mockFileSystem.has(normalizedPath) && !mockDirectories.has(normalizedPath)) {
      const error = new Error(`ENOENT: no such file or directory, access '${filePath}'`);
      error.code = 'ENOENT';
      error.errno = -2;
      error.path = filePath;
      throw error;
    }
  }),

  mkdir: jest.fn().mockImplementation(async (dirPath, options) => {
    return fsMock.mkdirSync(dirPath, options);
  }),

  readdir: jest.fn().mockImplementation(async (dirPath) => {
    return fsMock.readdirSync(dirPath);
  }),

  stat: jest.fn().mockImplementation(async (filePath) => {
    return fsMock.statSync(filePath);
  }),

  lstat: jest.fn().mockImplementation(async (filePath) => {
    return fsMock.statSync(filePath);
  }),

  // Additional helpers for tests
  constants: {
    F_OK: 0,
    R_OK: 4,
    W_OK: 2,
    X_OK: 1,
  },

  // Test utilities
  _setMockFile: (filePath, content) => {
    const normalizedPath = normalizePath(filePath);
    mockFileSystem.set(normalizedPath, content);
  },

  _setMockDirectory: (dirPath) => {
    const normalizedPath = normalizePath(dirPath);
    mockDirectories.add(normalizedPath);
  },

  _clearMocks: () => {
    mockFileSystem.clear();
    mockDirectories.clear();
    // Add some common directories
    mockDirectories.add(process.cwd());
    mockDirectories.add(path.join(process.cwd(), 'Todos'));
    mockDirectories.add(path.join(process.cwd(), 'config'));
  },

  _getMockFiles: () => {
    return Array.from(mockFileSystem.keys());
  },

  _getMockDirectories: () => {
    return Array.from(mockDirectories);
  },
};

// Initialize with common directories
fsMock._clearMocks();

module.exports = fsMock;