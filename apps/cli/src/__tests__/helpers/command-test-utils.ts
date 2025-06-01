import { Command, Config } from '@oclif/core';
import * as path from 'path';
import * as os from 'os';

/**
 * Creates a mock OCLIF config object for testing commands
 * This provides all the necessary config properties and methods that OCLIF commands expect
 */
export function createMockOCLIFConfig(): Config {
  const mockConfig = {
    name: 'waltodo',
    bin: 'waltodo',
    version: '1.0.0',
    pjson: {
      name: 'waltodo',
      version: '1.0.0',
      bin: { waltodo: './bin/run.js' },
      oclif: {
        bin: 'waltodo',
        commands: './dist/commands',
        plugins: [],
      },
    },
    root: path.join(__dirname, '../../../..'),
    dataDir: path.join(os.tmpdir(), 'waltodo-test'),
    configDir: path.join(os.tmpdir(), 'waltodo-test-config'),
    cacheDir: path.join(os.tmpdir(), 'waltodo-test-cache'),
    errlog: path.join(os.tmpdir(), 'waltodo-test-error.log'),
    plugins: new Map(),
    commands: new Map(),
    topics: new Map(),
    commandIDs: [],
    valid: true,
    arch: process.arch,
    platform: process.platform,
    shell: process.env.SHELL || '/bin/bash',
    userAgent: 'waltodo/1.0.0',
    dirname: 'waltodo',
    debug: 0,
    npmRegistry: 'https://registry.npmjs.org/',
    windows: process.platform === 'win32',

    // Mock methods that commands might call
    runHook: typeof jest !== 'undefined' && jest.fn 
      ? jest.fn().mockResolvedValue({ successes: [], failures: [] })
      : () => Promise.resolve({ successes: [], failures: [] }),
    runCommand: typeof jest !== 'undefined' && jest.fn 
      ? jest.fn().mockResolvedValue(undefined)
      : () => Promise.resolve(),
    findCommand: typeof jest !== 'undefined' && jest.fn 
      ? jest.fn().mockReturnValue(undefined)
      : () => undefined,
    findTopic: typeof jest !== 'undefined' && jest.fn 
      ? jest.fn().mockReturnValue(undefined)
      : () => undefined,
    getAllCommandIDs: typeof jest !== 'undefined' && jest.fn 
      ? jest.fn().mockReturnValue([])
      : () => [],
    load: typeof jest !== 'undefined' && jest.fn 
      ? jest.fn().mockResolvedValue(undefined)
      : () => Promise.resolve(),
    scopedEnvVar: typeof jest !== 'undefined' && jest.fn 
      ? jest.fn((key: string) => `WALTODO_${key}`)
      : (key: string) => `WALTODO_${key}`,
    scopedEnvVarKey: typeof jest !== 'undefined' && jest.fn 
      ? jest.fn((key: string) => `WALTODO_${key}`)
      : (key: string) => `WALTODO_${key}`,
    scopedEnvVarTrue: typeof jest !== 'undefined' && jest.fn 
      ? jest.fn().mockReturnValue(false)
      : () => false,
    envVarTrue: typeof jest !== 'undefined' && jest.fn 
      ? jest.fn().mockReturnValue(false)
      : () => false,

    // Additional properties that might be needed
    flexibleTaxonomy: false,
    topicSeparator: ':',

    // Event emitter methods
    on: typeof jest !== 'undefined' && jest.fn 
      ? jest.fn()
      : () => {},
    once: typeof jest !== 'undefined' && jest.fn 
      ? jest.fn()
      : () => {},
    off: typeof jest !== 'undefined' && jest.fn 
      ? jest.fn()
      : () => {},
    emit: typeof jest !== 'undefined' && jest.fn 
      ? jest.fn().mockReturnValue(true)
      : () => true,

    // Additional utility methods
    findMatches: typeof jest !== 'undefined' && jest.fn 
      ? jest.fn().mockReturnValue([])
      : () => [],
    scopedEnvVarKeys: typeof jest !== 'undefined' && jest.fn 
      ? jest.fn().mockReturnValue([])
      : () => [],
  } as any;

  return mockConfig;
}

/**
 * Initializes a command instance with proper OCLIF config for testing
 * This ensures the command has all the necessary properties and methods
 */
export async function initializeCommandForTest<T extends Command>(
  CommandClass: new (...args: any[]) => T,
  argv: string[] = [],
  options: {
    config?: Config;
    mockParse?: boolean;
    parseResult?: any;
  } = {}
): Promise<T> {
  const config = options.config || createMockOCLIFConfig();

  // Create command instance with proper config
  const command = new CommandClass(argv, config);

  // Ensure the config property is set
  (command as any).config = config;

  // Mock commonly used methods
  command.log = typeof jest !== 'undefined' && typeof jest.fn === 'function'
    ? jest.fn() 
    : (..._args: any[]) => {};
  command.warn = typeof jest !== 'undefined' && typeof jest.fn === 'function'
    ? jest.fn() 
    : (input: string | Error) => input;
  (command as any).error = typeof jest !== 'undefined' && typeof jest.fn === 'function'
    ? jest.fn().mockImplementation((message: string | Error, options?: any) => {
        const error = typeof message === 'string' ? new Error(message) : message;
        if (options?.exit) {
          throw error;
        }
        console.error(error);
      })
    : (message: string | Error, options?: any) => {
        const error = typeof message === 'string' ? new Error(message) : message;
        if (options?.exit) {
          throw error;
        }
        console.error(error);
      };

  // Mock parse method if requested
  if (options.mockParse) {
    const parseMock = typeof jest !== 'undefined' && jest.fn 
      ? jest.fn().mockResolvedValue(options.parseResult || { flags: {}, args: {} })
      : () => Promise.resolve(options.parseResult || { flags: {}, args: {} });
    Object.defineProperty(command, 'parse', {
      value: parseMock,
      writable: true,
      configurable: true
    });
  }

  // Initialize the command
  try {
    await (command as any).init();
  } catch (error) {
    // Some commands might fail during init in test environment, that's okay
    console.warn('Command init failed during test setup:', error);
  }

  return command;
}

/**
 * Helper to run a command in test environment with proper setup
 */
export async function runCommandInTest<T extends Command>(
  CommandClass: new (...args: any[]) => T,
  argv: string[] = [],
  flags: Record<string, any> = {},
  args: Record<string, any> = {}
): Promise<{ command: T; output: string[]; errors: string[] }> {
  const output: string[] = [];
  const errors: string[] = [];

  const command = await initializeCommandForTest(CommandClass, argv, {
    mockParse: true,
    parseResult: { flags, args },
  });

  // Capture log output
  if (typeof jest !== 'undefined' && typeof jest.fn === 'function') {
    (command.log as jest.Mock).mockImplementation((...args: any[]) => {
      output.push(args.join(' '));
    });

    (command.warn as jest.Mock).mockImplementation((...args: any[]) => {
      errors.push(args.join(' '));
    });
  } else {
    // Fallback for non-Jest environments
    command.log = (...args: any[]) => {
      output.push(args.join(' '));
    };
    command.warn = (input: string | Error) => {
      errors.push(typeof input === 'string' ? input : input.message);
      return input;
    };
  }

  // Run the command using public API
  await (command as any).run();

  return { command, output, errors };
}

/**
 * Mock setup for BaseCommand tests
 */
export function setupBaseCommandMocks() {
  // Mock process.stdout for tests that check columns
  if (!process.stdout.columns) {
    process.stdout.columns = 80;
  }

  // Mock environment variables commonly used by commands
  process.env.NODE_ENV = 'test';
  process.env.WALRUS_TODO_CONFIG_DIR = path.join(
    os.tmpdir(),
    'waltodo-test-config'
  );

  // Mock console methods to reduce noise in tests
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  beforeEach(() => {
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });
}

/**
 * Creates a mock command instance with minimal setup for unit testing
 */
export function createMockCommand<T extends Command>(
  CommandClass: new (...args: any[]) => T,
  overrides: Partial<T> = {}
): T {
  const config = createMockOCLIFConfig();
  const command = new CommandClass([], config);

  // Set up basic mocks
  (command as any).config = config;
  command.log = jest.fn();
  command.warn = jest.fn();
  (command as any).error = jest.fn();
  const parseMock = jest.fn().mockResolvedValue({ flags: {}, args: {} });
  Object.defineProperty(command, 'parse', {
    value: parseMock,
    writable: true,
    configurable: true
  });

  // Apply any overrides
  Object.assign(command, overrides);

  return command;
}
