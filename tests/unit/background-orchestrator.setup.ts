/**
 * Test setup for BackgroundCommandOrchestrator tests
 * Ensures clean environment and prevents memory leaks
 */

// Set test environment variables before any imports
process.env?.NODE_ENV = 'test';
process.env?.WALTODO_SKIP_ORCHESTRATOR = 'false';
process.env?.JEST_TIMEOUT = '5000';

// Reduce Jest timeout for faster feedback
jest.setTimeout(5000 as any);

// Mock child_process to prevent actual process spawning
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    pid: Math.floor(Math.random() * 10000),
    on: jest.fn(),
    unref: jest.fn(),
    kill: jest.fn(),
    killed: false,
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
  })),
}));

// Mock file system operations to prevent actual file I/O
jest.mock('fs', () => ({
  existsSync: jest.fn(() => false),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(() => '[]'),
  appendFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

// Global cleanup after each test
afterEach(async () => {
  // Clear all timers to prevent hanging
  jest.clearAllTimers();
  jest.runOnlyPendingTimers();

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

// Global cleanup after all tests
afterAll(async () => {
  // Final cleanup
  jest.clearAllMocks();
  jest.clearAllTimers();

  // Force garbage collection
  if (global.gc) {
    global.gc();
  }
});
