import {
  SpinnerManager,
  ErrorHandler,
  FlagValidator,
  RetryManager,
  Logger,
  Formatter,
} from '../cli-helpers';
import { CLIError } from '../error-handler';

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();

describe('CLI Helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SpinnerManager', () => {
    it('should create and manage spinner lifecycle', () => {
      const spinner = new SpinnerManager('Loading...');

      expect(() => spinner.start()).not.toThrow();
      expect(() => spinner.update('Updating...')).not.toThrow();
      expect(() => spinner.succeed('Success!')).not.toThrow();
      expect(() => spinner.fail('Failed!')).not.toThrow();
      expect(() => spinner.info('Info')).not.toThrow();
      expect(() => spinner.warn('Warning')).not.toThrow();
      expect(() => spinner.stop()).not.toThrow();
    });
  });

  describe('ErrorHandler', () => {
    it('should handle CLIError and rethrow', () => {
      const cliError = new CLIError('Test error', 'TEST_ERROR');

      expect(() => ErrorHandler.handle(cliError, 'test context')).toThrow(
        CLIError
      );
    });

    it('should wrap non-CLIError in CLIError', () => {
      const normalError = new Error('Normal error');

      expect(() => ErrorHandler.handle(normalError, 'test context')).toThrow(
        CLIError
      );
    });

    it('should format errors correctly', () => {
      const error = new Error('Test error');
      expect(ErrorHandler.formatError(error)).toBe('Test error');

      const stringError = 'String error';
      expect(ErrorHandler.formatError(stringError)).toBe('String error');
    });

    it('should exit process with error', () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit');
      });

      expect(() => ErrorHandler.exit('Exit message')).toThrow('Process exit');
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Exit message')
      );
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });
  });

  describe('FlagValidator', () => {
    it('should validate positive numbers', () => {
      expect(FlagValidator.validatePositiveNumber('123', 'test')).toBe(123);
      expect(() =>
        FlagValidator.validatePositiveNumber('-123', 'test')
      ).toThrow(CLIError);
      expect(() => FlagValidator.validatePositiveNumber('abc', 'test')).toThrow(
        CLIError
      );
      expect(() => FlagValidator.validatePositiveNumber('0', 'test')).toThrow(
        CLIError
      );
    });

    it('should validate non-empty strings', () => {
      expect(FlagValidator.validateNonEmpty('test', 'field')).toBe('test');
      expect(FlagValidator.validateNonEmpty('  test  ', 'field')).toBe('test');
      expect(() => FlagValidator.validateNonEmpty('', 'field')).toThrow(
        CLIError
      );
      expect(() => FlagValidator.validateNonEmpty('   ', 'field')).toThrow(
        CLIError
      );
    });

    it('should validate enums', () => {
      const validValues = ['high', 'medium', 'low'] as string[];
      expect(FlagValidator.validateEnum('high', validValues, 'priority')).toBe(
        'high'
      );
      expect(() =>
        FlagValidator.validateEnum('invalid', validValues, 'priority')
      ).toThrow(CLIError);
    });

    it('should validate paths', () => {
      expect(FlagValidator.validatePath('/valid/path', 'path')).toBe(
        '/valid/path'
      );
      expect(() => FlagValidator.validatePath('', 'path')).toThrow(CLIError);
      expect(() => FlagValidator.validatePath('   ', 'path')).toThrow(CLIError);
    });
  });

  describe('RetryManager', () => {
    it('should retry failed operations', async () => {
      let attempts = 0;
      const operation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'Success';
      });

      const result = await RetryManager.retry(operation, {
        maxAttempts: 3,
        initialDelay: 10,
      });

      expect(result).toBe('Success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw after max attempts', async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new Error('Persistent failure'));

      await expect(
        RetryManager.retry(operation, {
          maxAttempts: 2,
          initialDelay: 10,
        })
      ).rejects.toThrow('Persistent failure');

      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should call onRetry callback', async () => {
      const onRetry = jest.fn();
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValue('Success');

      await RetryManager.retry(operation, {
        maxAttempts: 2,
        initialDelay: 10,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    });
  });

  describe('Logger', () => {
    it('should log success messages', () => {
      Logger.success('Success message');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Success message')
      );
    });

    it('should log error messages', () => {
      Logger.error('Error message');
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Error message')
      );
    });

    it('should log warning messages', () => {
      Logger.warning('Warning message');
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Warning message')
      );
    });

    it('should log info messages', () => {
      Logger.info('Info message');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Info message')
      );
    });

    it('should log debug messages only when DEBUG is set', () => {
      const originalDebug = process?.env?.DEBUG;

      // Without DEBUG
      delete process?.env?.DEBUG;
      Logger.debug('Debug message');
      expect(mockConsoleLog).not.toHaveBeenCalled();

      // With DEBUG
      process.env?.DEBUG = 'true';
      Logger.debug('Debug message');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Debug message')
      );

      // Restore
      if (originalDebug) {
        process.env?.DEBUG = originalDebug;
      } else {
        delete process?.env?.DEBUG;
      }
    });

    it('should log step messages', () => {
      Logger.step(1, 5, 'Step message');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[1/5]')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Step message')
      );
    });
  });

  describe('Formatter', () => {
    it('should format tables', () => {
      const data = {
        name: 'John',
        age: 30,
        city: 'New York',
      };

      const formatted = Formatter.table(data);
      expect(formatted).toContain('name : John');
      expect(formatted).toContain('age  : 30');
      expect(formatted).toContain('city : New York');
    });

    it('should format lists', () => {
      const items = ['Item 1', 'Item 2', 'Item 3'];

      const formatted = Formatter.list(items);
      expect(formatted).toContain('• Item 1');
      expect(formatted).toContain('• Item 2');
      expect(formatted).toContain('• Item 3');

      const customBullet = Formatter.list(items, '-');
      expect(customBullet).toContain('- Item 1');
    });

    it('should format code', () => {
      const code = 'const x = 42;';
      const formatted = Formatter.code(code);
      expect(formatted).toContain(code);
    });

    it('should highlight text', () => {
      const text = 'Important';
      const formatted = Formatter.highlight(text);
      expect(formatted).toContain(text);
    });

    it('should dim text', () => {
      const text = 'Less important';
      const formatted = Formatter.dim(text);
      expect(formatted).toContain(text);
    });
  });
});
