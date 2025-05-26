import { jest } from '@jest/globals';
import { Readable, Writable } from 'stream';
import { InteractiveMode } from '../../../src/utils/interactive-mode';
import { stdin as mockStdin, stdout as mockStdout } from 'process';
import * as readline from 'readline';

// Mock readline module
jest.mock('readline', () => ({
  createInterface: jest.fn().mockImplementation(options => {
    const mockRl = {
      question: jest.fn((query, callback) => {
        // Simulate user input based on the query
        const responses: Record<string, string> = {
          todo: 'add "Test todo"',
          command: 'list',
          'Enter todo command': 'add "New todo"',
          'Enter command': 'help',
          'Continue?': 'yes',
          default: 'test response',
        };

        const response = Object.keys(responses).find(key => query.includes(key))
          ? responses[Object.keys(responses).find(key => query.includes(key))!]
          : responses.default;

        setTimeout(() => callback(response), 0);
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
      input: options.input || mockStdin,
      output: options.output || mockStdout,
      terminal: true,
      completer: options.completer,
      crlfDelay: options.crlfDelay || 100,
      removeHistoryDuplicates: false,
      escapeCodeTimeout: 500,
      tabSize: 8,
      signal: undefined,
    };
    return mockRl;
  }),
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
    write(chunk, encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  }) as MockWritableStream;
  
  stream.getOutput = () => chunks.join('');
  stream.chunks = chunks;
  return stream;
}

describe('InteractiveMode', () => {
  interface MockCommandHistory {
    add: jest.Mock;
    getHistory: jest.Mock;
    clear: jest.Mock;
  }

  interface MockCommandRegistry {
    getCommands: jest.Mock;
    getAllCommands: jest.Mock;
    getCommand: jest.Mock;
    getSuggestions: jest.Mock;
  }

  let mockCommandHistory: MockCommandHistory;
  let mockCommandRegistry: MockCommandRegistry;
  let interactiveMode: InteractiveMode;
  let mockInput: Readable;
  let mockOutput: Writable;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock streams
    mockInput = createMockInputStream();
    mockOutput = createMockOutputStream();

    // Setup command history mock
    mockCommandHistory = {
      add: jest.fn(),
      getHistory: jest
        .fn()
        .mockReturnValue(['list', 'add "Previous todo"', 'help']),
      clear: jest.fn(),
    };

    // Setup command registry mock
    mockCommandRegistry = {
      getCommands: jest.fn().mockReturnValue([
        { command: 'add', description: 'Add a new todo' },
        { command: 'list', description: 'List all todos' },
        { command: 'help', description: 'Show help' },
        { command: 'exit', description: 'Exit interactive mode' },
      ]),
      getSuggestions: jest
        .fn()
        .mockReturnValue(['add "Suggested todo"', 'list --all', 'complete 1']),
      getAllCommands: jest.fn().mockReturnValue([
        { command: 'add', description: 'Add a new todo' },
        { command: 'list', description: 'List all todos' },
        { command: 'help', description: 'Show help' },
        { command: 'exit', description: 'Exit interactive mode' },
      ]),
      getCommand: jest.fn().mockImplementation((cmd: string) => {
        const commands = [
          { command: 'add', description: 'Add a new todo' },
          { command: 'list', description: 'List all todos' },
          { command: 'help', description: 'Show help' },
          { command: 'exit', description: 'Exit interactive mode' },
        ];
        return commands.find((c) => c.command === cmd);
      }),
    };

    // Mock process.stdin and process.stdout
    Object.defineProperty(process, 'stdin', {
      value: mockInput,
      writable: true,
    });
    Object.defineProperty(process, 'stdout', {
      value: mockOutput,
      writable: true,
    });

    interactiveMode = new InteractiveMode(
      mockCommandHistory,
      mockCommandRegistry
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Define a test interface to access private methods for testing
  interface TestableInteractiveMode extends InteractiveMode {
    promptUser?: () => Promise<void>;
    executeCommand?: (command: string) => Promise<void>;
    parseCommand?: (input: string) => { command: string; args: string[] };
    showHelp?: () => void;
    showHistory?: () => void;
    autocomplete?: (line: string, callback: (err: null, hits: [string[], string]) => void) => void;
    execute?: (command: string, args: string[]) => Promise<void>;
  }

  describe('start', () => {
    it('should display welcome message and start interactive prompt', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const testableMode = interactiveMode as unknown as TestableInteractiveMode;
      const promptSpy = jest.spyOn(testableMode, 'promptUser').mockImplementation();

      await interactiveMode.start();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Interactive Todo Mode')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('help')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('exit')
      );
      expect(promptSpy).toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });
  });

  describe('promptUser', () => {
    it('should process valid commands', async () => {
      const testableMode = interactiveMode as unknown as TestableInteractiveMode;
      const executeCommandSpy = jest
        .spyOn(testableMode, 'executeCommand')
        .mockResolvedValue(undefined);
      // Use the imported readline module

      // Set up mock to simulate user entering a command
      const mockRl = {
        question: jest.fn((query, callback) => {
          callback('add "Test todo"');
        }),
        close: jest.fn(),
      };
      readline.createInterface.mockReturnValue(mockRl);

      const testableMode = interactiveMode as unknown as TestableInteractiveMode;
      await testableMode.promptUser?.();

      expect(executeCommandSpy).toHaveBeenCalledWith('add "Test todo"');
      expect(mockRl.close).toHaveBeenCalled();
    });

    it('should handle exit command', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      // Use the imported readline module

      const mockRl = {
        question: jest.fn((query, callback) => {
          callback('exit');
        }),
        close: jest.fn(),
      };
      readline.createInterface.mockReturnValue(mockRl);

      const testableMode = interactiveMode as unknown as TestableInteractiveMode;
      await testableMode.promptUser?.();

      expect(consoleLogSpy).toHaveBeenCalledWith('Exiting interactive mode...');
      expect(mockRl.close).toHaveBeenCalled();
    });

    it('should handle empty input', async () => {
      const testableMode = interactiveMode as unknown as TestableInteractiveMode;
      const executeCommandSpy = jest.spyOn(
        testableMode,
        'executeCommand'
      );
      // Use the imported readline module

      const mockRl = {
        question: jest.fn((query, callback) => {
          callback('');
        }),
        close: jest.fn(),
      };
      readline.createInterface.mockReturnValue(mockRl);

      const testableMode = interactiveMode as unknown as TestableInteractiveMode;
      await testableMode.promptUser?.();

      expect(executeCommandSpy).not.toHaveBeenCalled();
      expect(mockRl.close).toHaveBeenCalled();
    });
  });

  describe('executeCommand', () => {
    it('should add command to history and execute it', async () => {
      const testableMode = interactiveMode as unknown as TestableInteractiveMode;
      const executeSpy = jest
        .spyOn(testableMode, 'execute')
        .mockResolvedValue(undefined);

      await testableMode.executeCommand?.('add "New todo"');

      expect(mockCommandHistory.add).toHaveBeenCalledWith('add "New todo"');
      expect(executeSpy).toHaveBeenCalledWith('add', ['"New todo"']);
    });

    it('should handle command parsing errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const testableMode = interactiveMode as unknown as TestableInteractiveMode;

      await testableMode.executeCommand?.('invalid command syntax');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error parsing command:',
        expect.any(Error)
      );
    });
  });

  describe('parseCommand', () => {
    it('should parse simple commands', () => {
      const testableMode = interactiveMode as unknown as TestableInteractiveMode;
      const result = testableMode.parseCommand?.('list');
      expect(result).toEqual({
        command: 'list',
        args: [],
      });
    });

    it('should parse commands with arguments', () => {
      const testableMode = interactiveMode as unknown as TestableInteractiveMode;
      const result = testableMode.parseCommand?.('add "Test todo"');
      expect(result).toEqual({
        command: 'add',
        args: ['"Test todo"'],
      });
    });

    it('should parse commands with multiple arguments', () => {
      const testableMode = interactiveMode as unknown as TestableInteractiveMode;
      const result = testableMode.parseCommand?.(
        'update 123 --title "New title"'
      );
      expect(result).toEqual({
        command: 'update',
        args: ['123', '--title', '"New title"'],
      });
    });

    it('should handle commands with special characters', () => {
      const testableMode = interactiveMode as unknown as TestableInteractiveMode;
      const result = testableMode.parseCommand?.(
        'add "Test with @#$ chars"'
      );
      expect(result).toEqual({
        command: 'add',
        args: ['"Test with @#$ chars"'],
      });
    });
  });

  describe('showHelp', () => {
    it('should display available commands', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const testableMode = interactiveMode as unknown as TestableInteractiveMode;

      testableMode.showHelp?.();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Available commands:')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('add')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('list')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('help')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('exit')
      );
      expect(mockCommandRegistry.getCommands).toHaveBeenCalled();
    });
  });

  describe('showHistory', () => {
    it('should display command history', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const testableMode = interactiveMode as unknown as TestableInteractiveMode;

      testableMode.showHistory?.();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Command history:')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('list')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('add "Previous todo"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('help')
      );
      expect(mockCommandHistory.getHistory).toHaveBeenCalled();
    });

    it('should handle empty history', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      mockCommandHistory.getHistory.mockReturnValue([]);
      const testableMode = interactiveMode as unknown as TestableInteractiveMode;

      testableMode.showHistory?.();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Command history:')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'No command history available.'
      );
    });
  });

  describe('autocomplete', () => {
    it('should provide command suggestions', () => {
      const callback = jest.fn();
      const testableMode = interactiveMode as unknown as TestableInteractiveMode;
      testableMode.autocomplete?.('ad', callback);

      expect(callback).toHaveBeenCalledWith(null, [['add'], 'ad']);
    });

    it('should handle no matches', () => {
      const callback = jest.fn();
      const testableMode = interactiveMode as unknown as TestableInteractiveMode;
      testableMode.autocomplete?.(
        'xyz',
        callback
      );

      expect(callback).toHaveBeenCalledWith(null, [[], 'xyz']);
    });

    it('should provide all commands for empty input', () => {
      const callback = jest.fn();
      const testableMode = interactiveMode as unknown as TestableInteractiveMode;
      testableMode.autocomplete?.('', callback);

      expect(callback).toHaveBeenCalled();
      const [error, [suggestions]] = callback.mock.calls[0];
      expect(error).toBeNull();
      expect(suggestions).toContain('add');
      expect(suggestions).toContain('list');
      expect(suggestions).toContain('help');
      expect(suggestions).toContain('exit');
    });
  });

  describe('error handling', () => {
    it('should handle readline interface creation errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      // Use the imported readline module

      readline.createInterface.mockImplementation(() => {
        throw new Error('Failed to create interface');
      });

      const testableMode = interactiveMode as unknown as TestableInteractiveMode;
      await testableMode.promptUser?.();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error in interactive mode:',
        expect.any(Error)
      );
    });

    it('should handle command execution errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const testableMode = interactiveMode as unknown as TestableInteractiveMode;
      jest
        .spyOn(testableMode, 'execute')
        .mockRejectedValue(new Error('Execution failed'));

      await testableMode.executeCommand?.('add "Test"');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error executing command:',
        expect.any(Error)
      );
    });
  });

  describe('stream handling', () => {
    it('should handle custom input/output streams', async () => {
      const customInput = createMockInputStream();
      const customOutput = createMockOutputStream();

      const customMode = new InteractiveMode(
        mockCommandHistory,
        mockCommandRegistry,
        { input: customInput, output: customOutput }
      );

      // Use the imported readline module
      readline.createInterface.mockClear();

      await customMode.start();

      expect(readline.createInterface).toHaveBeenCalledWith(
        expect.objectContaining({
          input: customInput,
          output: customOutput,
        })
      );
    });
  });
});
