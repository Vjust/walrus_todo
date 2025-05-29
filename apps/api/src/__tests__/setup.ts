// Jest setup file for API tests
import { jest } from '@jest/globals';

// Mock fs at the global level before any modules are imported
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
}));

// Mock path
jest.mock('path', () => ({
  join: jest.fn().mockImplementation((...args) => args.join('/')),
  resolve: jest.fn().mockImplementation((...args) => args.join('/')),
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
  content: 'Test Todo Content',
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
  content?: string;
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
  content: string;
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