// Jest setup file for API tests
import { jest } from '@jest/globals';

// Mock winston to avoid file system issues in tests
jest.mock('winston', () => {
  const mockFormat = {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    simple: jest.fn(),
    colorize: jest.fn(),
    printf: jest.fn(),
  };

  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    silly: jest.fn(),
    add: jest.fn(),
  };

  return {
    createLogger: jest.fn(() => mockLogger),
    format: mockFormat,
    transports: {
      Console: jest.fn(),
      File: jest.fn(),
    },
  };
});

// Mock fs at the global level before any modules are imported
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    stat: jest.fn(),
  },
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  stat: jest.fn((path, callback) => {
    callback(null, {
      isDirectory: () => true,
      isFile: () => false,
      size: 0,
    });
  }),
  createReadStream: jest.fn(),
  createWriteStream: jest.fn(() => ({
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
  })),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

// Mock path
jest.mock('path', () => ({
  join: jest.fn().mockImplementation((...args) => args.join('/')),
  resolve: jest.fn().mockImplementation((...args) => args.join('/')),
  basename: jest.fn().mockImplementation((path) => {
    const parts = path.split('/');
    return parts[parts.length - 1];
  }),
  dirname: jest.fn().mockImplementation((path) => {
    const parts = path.split('/');
    parts.pop();
    return parts.join('/');
  }),
  extname: jest.fn().mockImplementation((path) => {
    const parts = path.split('.');
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
  }),
}));

// Mock console methods to reduce test noise
const originalConsole = { ...console };

beforeEach(() => {
  // Restore console for each test
  Object.assign(console, originalConsole);
});

afterEach(() => {
  // Clean up timers and async operations
  jest.clearAllTimers();
  jest.useRealTimers();
});

afterAll(() => {
  // Restore original console
  Object.assign(console, originalConsole);
});

// Mock environment variables for consistent testing
process.env.NODE_ENV = 'test';
process.env.API_PORT = '3001';
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests
process.env.API_LOGGING_ENABLED = 'false';
process.env.WS_ENABLED = 'true';
process.env.API_AUTH_REQUIRED = 'false';

// Global test helpers
global.mockTodoFactory = (overrides = {}) => ({
  id: 'test-todo-id',
  title: 'Test Todo',
  description: 'Test Todo Description',
  completed: false,
  priority: 'medium' as const,
  category: 'test',
  tags: ['test'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  wallet: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  ...overrides,
});

// Global type declarations
interface TodoOverrides {
  id?: string;
  title?: string;
  description?: string;
  completed?: boolean;
  priority?: 'low' | 'medium' | 'high';
  category?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  wallet?: string;
}

interface MockTodo {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  category: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  wallet: string;
}

declare global {
  const mockTodoFactory: (overrides?: TodoOverrides) => MockTodo;
}