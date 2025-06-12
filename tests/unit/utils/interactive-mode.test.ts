import { jest } from '@jest/globals';
import { Readable, Writable } from 'stream';
import { InteractiveMode } from '../../../apps/cli/src/utils/interactive-mode';
import * as readline from 'readline';

// Create a properly typed mock readline interface
interface MockReadlineInterface {
  question: jest.Mock;
  close: jest.Mock;
  prompt: jest.Mock;
  setPrompt: jest.Mock;
  on: jest.Mock;
  once: jest.Mock;
  removeListener: jest.Mock;
  removeAllListeners: jest.Mock;
  pause: jest.Mock;
  resume: jest.Mock;
  write: jest.Mock;
  line: string;
  cursor: number;
  history: string[];
  historyIndex: number;
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
  terminal: boolean;
  completer?: readline.Completer;
  crlfDelay: number;
  removeHistoryDuplicates: boolean;
  escapeCodeTimeout: number;
  tabSize: number;
  signal?: AbortSignal;
}

// Mock readline module
const mockCreateInterface = jest.fn() as jest.MockedFunction<
  typeof readline.createInterface
>;

jest.mock('readline', () => ({
  createInterface: mockCreateInterface,
}));

// Create mock streams
function createMockInputStream(): Readable {
  const stream = new Readable({
    read() {},
  });
  return stream;
}

interface MockWritableStream extends Writable {
  getOutput: () => string;
  chunks: string[];
}

function createMockOutputStream(): MockWritableStream {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString());
      if (callback) callback();
    },
  }) as MockWritableStream;

  stream?.getOutput = () => chunks.join('');
  stream?.chunks = chunks;
  return stream;
}

// Helper function to create mock readline interface
function createMockReadlineInterface(
  options?: readline.ReadLineOptions
): MockReadlineInterface {
  return {
    question: jest.fn((query: string, callback: (answer: string) => void) => {
      // Simulate user input based on the query
      const responses: Record<string, string> = {
        todo: 'add "Test todo"',
        command: 'list',
        'Enter todo command': 'add "New todo"',
        'Enter command': 'help',
        'Continue?': 'yes',
        default: 'test response',
      };

      const response = Object.keys(responses as any).find(key => query.includes(key as any))
        ? responses[Object.keys(responses as any).find(key => query.includes(key as any))!]
        : responses.default;

      setTimeout(() => callback(response as any), 0);
    }),
    close: jest.fn(),
    prompt: jest.fn(),
    setPrompt: jest.fn(),
    on: jest.fn().mockReturnThis(),
    once: jest.fn().mockReturnThis(),
    removeListener: jest.fn().mockReturnThis(),
    removeAllListeners: jest.fn().mockReturnThis(),
    pause: jest.fn(),
    resume: jest.fn(),
    write: jest.fn(),
    line: '',
    cursor: 0,
    history: [],
    historyIndex: -1,
    input: options?.input || process.stdin,
    output: options?.output || process.stdout,
    terminal: true,
    completer: options?.completer,
    crlfDelay: options?.crlfDelay || 100,
    removeHistoryDuplicates: false,
    escapeCodeTimeout: 500,
    tabSize: 8,
    signal: options?.signal,
  };
}

describe('InteractiveMode', () => {
  let interactiveMode: InteractiveMode;
  let mockInput: Readable;
  let mockOutput: Writable;
  let mockRl: MockReadlineInterface;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock streams
    mockInput = createMockInputStream();
    mockOutput = createMockOutputStream();

    // Create mock readline interface
    mockRl = createMockReadlineInterface({
      input: mockInput,
      output: mockOutput,
    });
    mockCreateInterface.mockReturnValue(mockRl as any);

    // Mock process.stdin and process.stdout
    Object.defineProperty(process, 'stdin', {
      value: mockInput,
      writable: true,
    });
    Object.defineProperty(process, 'stdout', {
      value: mockOutput,
      writable: true,
    });

    interactiveMode = new InteractiveMode();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Helper function to access private methods for testing
  function getPrivateMethod(instance: InteractiveMode, methodName: string) {
    return instance[methodName]?.bind(instance as any);
  }

  describe('start', () => {
    it('should display welcome message and start interactive prompt', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Mock the prompt method to avoid hanging
      mockRl?.prompt?.mockImplementation(() => {});

      // Start interactive mode (this will call the welcome message)
      const startPromise = interactiveMode.start();

      // Trigger immediate exit to avoid hanging
      setTimeout(() => {
        mockRl?.on?.mock.calls.forEach(([event, handler]) => {
          if (event === 'line') {
            handler('exit');
          }
        });
      }, 10);

      expect(consoleLogSpy as any).toHaveBeenCalledWith(
        expect.stringContaining('Welcome to Walrus Todo Interactive Mode')
      );
      expect(consoleLogSpy as any).toHaveBeenCalledWith(
        expect.stringContaining('help')
      );
      expect(consoleLogSpy as any).toHaveBeenCalledWith(
        expect.stringContaining('exit')
      );
      expect(mockRl.prompt).toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });
  });

  describe('command handling', () => {
    it('should handle valid commands through line event', () => {
      const spawnSpy = jest
        .spyOn(require('child_process'), 'spawn')
        .mockImplementation(() => ({
          on: jest.fn((event, callback) => {
            if (event === 'exit') callback(0 as any);
          }),
        }));

      // Find the line event handler
      let lineHandler: (input: string) => void = () => {};
      mockRl?.on?.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'line') {
          lineHandler = handler;
        }
        return mockRl;
      });

      // Start the interactive mode
      interactiveMode.start();

      // Simulate user input
      lineHandler('list');

      expect(spawnSpy as any).toHaveBeenCalledWith(
        process.execPath,
        expect.arrayContaining(['list']),
        expect.any(Object as any)
      );

      spawnSpy.mockRestore();
    });

    it('should handle exit command', () => {
      let lineHandler: (input: string) => void = () => {};
      let closeHandler: () => void = () => {};

      mockRl?.on?.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'line') {
          lineHandler = handler;
        } else if (event === 'close') {
          closeHandler = handler;
        }
        return mockRl;
      });

      // Start the interactive mode
      interactiveMode.start();

      // Simulate exit command
      lineHandler('exit');

      expect(mockRl.close).toHaveBeenCalled();
    });

    it('should handle empty input', () => {
      let lineHandler: (input: string) => void = () => {};

      mockRl?.on?.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'line') {
          lineHandler = handler;
        }
        return mockRl;
      });

      // Start the interactive mode
      interactiveMode.start();

      // Simulate empty input
      lineHandler('');

      expect(mockRl.prompt).toHaveBeenCalled();
    });
  });

  describe('command execution', () => {
    it('should execute CLI commands through spawn', () => {
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'exit') callback(0 as any);
        }),
      };

      const spawnSpy = jest
        .spyOn(require('child_process'), 'spawn')
        .mockReturnValue(mockChild as any);

      let lineHandler: (input: string) => void = () => {};
      mockRl?.on?.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'line') {
          lineHandler = handler;
        }
        return mockRl;
      });

      // Start the interactive mode
      interactiveMode.start();

      // Simulate command input
      lineHandler('add "New todo"');

      expect(spawnSpy as any).toHaveBeenCalledWith(
        process.execPath,
        expect.arrayContaining(['add', '"New todo"']),
        expect.objectContaining({
          stdio: 'inherit',
          env: expect.objectContaining({ FORCE_COLOR: '1' }),
        })
      );

      spawnSpy.mockRestore();
    });

    it('should handle command errors', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'error') callback(new Error('Command failed'));
        }),
      };

      const spawnSpy = jest
        .spyOn(require('child_process'), 'spawn')
        .mockReturnValue(mockChild as any);

      let lineHandler: (input: string) => void = () => {};
      mockRl?.on?.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'line') {
          lineHandler = handler;
        }
        return mockRl;
      });

      // Start the interactive mode
      interactiveMode.start();

      // Simulate command input
      lineHandler('invalid-command');

      // Trigger error
      const errorCallback = mockChild?.on?.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];
      if (errorCallback) {
        errorCallback(new Error('Command failed'));
      }

      expect(consoleErrorSpy as any).toHaveBeenCalled();

      spawnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('command shortcuts', () => {
    it('should expand shortcuts correctly', () => {
      const spawnSpy = jest
        .spyOn(require('child_process'), 'spawn')
        .mockImplementation(() => ({
          on: jest.fn((event, callback) => {
            if (event === 'exit') callback(0 as any);
          }),
        }));

      let lineHandler: (input: string) => void = () => {};
      mockRl?.on?.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'line') {
          lineHandler = handler;
        }
        return mockRl;
      });

      // Start the interactive mode
      interactiveMode.start();

      // Test shortcut expansion
      lineHandler('l'); // Should expand to 'list'

      expect(spawnSpy as any).toHaveBeenCalledWith(
        process.execPath,
        expect.arrayContaining(['list']),
        expect.any(Object as any)
      );

      spawnSpy.mockRestore();
    });

    it('should handle commands with arguments after expansion', () => {
      const spawnSpy = jest
        .spyOn(require('child_process'), 'spawn')
        .mockImplementation(() => ({
          on: jest.fn((event, callback) => {
            if (event === 'exit') callback(0 as any);
          }),
        }));

      let lineHandler: (input: string) => void = () => {};
      mockRl?.on?.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'line') {
          lineHandler = handler;
        }
        return mockRl;
      });

      // Start the interactive mode
      interactiveMode.start();

      // Test shortcut with arguments
      lineHandler('a "Test todo"'); // Should expand to 'add "Test todo"'

      expect(spawnSpy as any).toHaveBeenCalledWith(
        process.execPath,
        expect.arrayContaining(['add', '"Test todo"']),
        expect.any(Object as any)
      );

      spawnSpy.mockRestore();
    });
  });

  describe('help command', () => {
    it('should display help when help command is entered', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      let lineHandler: (input: string) => void = () => {};
      mockRl?.on?.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'line') {
          lineHandler = handler;
        }
        return mockRl;
      });

      // Start the interactive mode
      interactiveMode.start();

      // Trigger help command
      lineHandler('help');

      expect(consoleLogSpy as any).toHaveBeenCalledWith(
        expect.stringContaining('Interactive Mode Commands')
      );
      expect(consoleLogSpy as any).toHaveBeenCalledWith(
        expect.stringContaining('add')
      );
      expect(consoleLogSpy as any).toHaveBeenCalledWith(
        expect.stringContaining('list')
      );
      expect(consoleLogSpy as any).toHaveBeenCalledWith(
        expect.stringContaining('exit')
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('list management', () => {
    it('should handle set-list command', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      let lineHandler: (input: string) => void = () => {};
      mockRl?.on?.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'line') {
          lineHandler = handler;
        }
        return mockRl;
      });

      // Start the interactive mode
      interactiveMode.start();

      // Trigger set-list command
      lineHandler('set-list work');

      expect(consoleLogSpy as any).toHaveBeenCalledWith(
        expect.stringContaining('Current list set to: work')
      );

      consoleLogSpy.mockRestore();
    });

    it('should handle current-list command', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Set a current list first
      interactiveMode.setCurrentList('test-list');

      let lineHandler: (input: string) => void = () => {};
      mockRl?.on?.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'line') {
          lineHandler = handler;
        }
        return mockRl;
      });

      // Start the interactive mode
      interactiveMode.start();

      // Trigger current-list command
      lineHandler('current-list');

      expect(consoleLogSpy as any).toHaveBeenCalledWith(
        expect.stringContaining('Current list: test-list')
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('autocomplete', () => {
    it('should be configured with completer function', () => {
      expect(mockCreateInterface as any).toHaveBeenCalledWith(
        expect.objectContaining({
          completer: expect.any(Function as any),
        })
      );
    });

    it('should provide command suggestions through completer', () => {
      // Get the completer function from the createInterface call
      const createInterfaceCall = mockCreateInterface.mock?.calls?.[0];
      const options = createInterfaceCall[0] as readline.ReadLineOptions;
      const completer = options.completer as (
        line: string
      ) => [string[], string];

      if (completer) {
        const result = completer('ad');
        expect(result as any).toEqual([['add'], 'ad']);
      }
    });

    it('should handle no matches in completer', () => {
      const createInterfaceCall = mockCreateInterface.mock?.calls?.[0];
      const options = createInterfaceCall[0] as readline.ReadLineOptions;
      const completer = options.completer as (
        line: string
      ) => [string[], string];

      if (completer) {
        const result = completer('xyz');
        expect(result[0]).toEqual([]);
        expect(result[1]).toBe('xyz');
      }
    });

    it('should provide all commands for empty input in completer', () => {
      const createInterfaceCall = mockCreateInterface.mock?.calls?.[0];
      const options = createInterfaceCall[0] as readline.ReadLineOptions;
      const completer = options.completer as (
        line: string
      ) => [string[], string];

      if (completer) {
        const result = completer('');
        expect(result[0]).toContain('add');
        expect(result[0]).toContain('list');
        expect(result[0]).toContain('help');
        expect(result[0]).toContain('exit');
      }
    });
  });

  describe('error handling', () => {
    it('should handle command execution errors gracefully', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      let lineHandler: (input: string) => void = () => {};
      mockRl?.on?.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'line') {
          lineHandler = handler;
        }
        return mockRl;
      });

      // Start the interactive mode
      interactiveMode.start();

      // Simulate an error during command processing
      try {
        lineHandler('some-command-that-throws');
      } catch {
        // Expected to catch errors
      }

      // Should continue to prompt after error
      expect(mockRl.prompt).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle clear command', () => {
      const consoleClearSpy = jest.spyOn(console, 'clear').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      let lineHandler: (input: string) => void = () => {};
      mockRl?.on?.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'line') {
          lineHandler = handler;
        }
        return mockRl;
      });

      // Start the interactive mode
      interactiveMode.start();

      // Trigger clear command
      lineHandler('clear');

      expect(consoleClearSpy as any).toHaveBeenCalled();
      expect(consoleLogSpy as any).toHaveBeenCalledWith(
        expect.stringContaining('Welcome to Walrus Todo Interactive Mode')
      );

      consoleClearSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });
  });

  describe('stream handling', () => {
    it('should use process.stdin and process.stdout by default', () => {
      expect(mockCreateInterface as any).toHaveBeenCalledWith(
        expect.objectContaining({
          input: process.stdin,
          output: process.stdout,
        })
      );
    });

    it('should configure readline interface correctly', () => {
      expect(mockCreateInterface as any).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.any(Object as any),
          output: expect.any(Object as any),
          prompt: expect.stringContaining('walrus'),
          completer: expect.any(Function as any),
        })
      );
    });
  });
});
