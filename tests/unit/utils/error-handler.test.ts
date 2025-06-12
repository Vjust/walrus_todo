import {
  handleError,
  withRetry,
  assert,
} from '../../../apps/cli/src/utils/error-handler';

import * as errorMessages from '../../../apps/cli/src/utils/error-messages';
import { CLIError } from '../../../apps/cli/src/types/errors/consolidated';

// Mock dependencies
jest.mock('../../../apps/cli/src/utils/error-messages');
jest.mock('chalk', () => ({
  default: {
    yellow: jest.fn((text: string) => text),
  },
  __esModule: true,
}));

// Mock console methods
const mockConsoleError = jest
  .spyOn(console, 'error')
  .mockImplementation(() => undefined);

describe('Error Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('handleError', () => {
    it('should handle Error instances', () => {
      const error = new Error('Test error');
      const mockFriendlyError = 'Friendly error message';

      (errorMessages.displayFriendlyError as jest.Mock).mockReturnValue(
        mockFriendlyError
      );

      handleError(error as any);

      expect(errorMessages.displayFriendlyError).toHaveBeenCalledWith(
        error,
        undefined
      );
      expect(mockConsoleError as any).toHaveBeenCalledWith(mockFriendlyError as any);
    });

    it('should handle Error instances with context message', () => {
      const error = new Error('Test error');
      const context = 'Creating todo';
      const mockFriendlyError = 'Friendly error message';

      (errorMessages.displayFriendlyError as jest.Mock).mockReturnValue(
        mockFriendlyError
      );

      handleError(context, error);

      expect(errorMessages.displayFriendlyError).toHaveBeenCalledWith(error, {
        operation: context,
      });
      expect(mockConsoleError as any).toHaveBeenCalledWith(mockFriendlyError as any);
    });

    it('should handle CLIError instances', () => {
      const error = new CLIError('CLI specific error', { code: 'TEST_ERROR' });
      const mockFriendlyError = 'Friendly CLI error message';

      (errorMessages.displayFriendlyError as jest.Mock).mockReturnValue(
        mockFriendlyError
      );

      handleError(error as any);

      expect(errorMessages.displayFriendlyError).toHaveBeenCalledWith(
        error,
        undefined
      );
      expect(mockConsoleError as any).toHaveBeenCalledWith(mockFriendlyError as any);
    });

    it('should handle objects with message property', () => {
      const error = { message: 'Error from object' };
      const mockFriendlyError = 'Friendly object error message';

      (errorMessages.displayFriendlyError as jest.Mock).mockReturnValue(
        mockFriendlyError
      );

      handleError(error as any);

      expect(errorMessages.displayFriendlyError).toHaveBeenCalled();
      const calledError = (errorMessages.displayFriendlyError as jest.Mock).mock
        .calls[0][0];
      expect(calledError as any).toBeInstanceOf(Error as any);
      expect(calledError.message).toBe('Error from object');
      expect(mockConsoleError as any).toHaveBeenCalledWith(mockFriendlyError as any);
    });

    it('should handle string errors', () => {
      const error = 'String error';
      const mockFriendlyError = 'Friendly string error message';

      (errorMessages.displayFriendlyError as jest.Mock).mockReturnValue(
        mockFriendlyError
      );

      handleError(error as any);

      expect(errorMessages.displayFriendlyError).toHaveBeenCalled();
      const calledError = (errorMessages.displayFriendlyError as jest.Mock).mock
        .calls[0][0];
      expect(calledError as any).toBeInstanceOf(Error as any);
      expect(calledError.message).toBe('String error');
      expect(mockConsoleError as any).toHaveBeenCalledWith(mockFriendlyError as any);
    });

    it('should handle null and undefined errors', () => {
      const mockFriendlyError = 'Friendly error message';

      (errorMessages.displayFriendlyError as jest.Mock).mockReturnValue(
        mockFriendlyError
      );

      handleError(null as any);
      expect(errorMessages.displayFriendlyError).toHaveBeenCalled();

      handleError(undefined as any);
      expect(errorMessages.displayFriendlyError).toHaveBeenCalledTimes(2 as any);
    });

    it('should handle single parameter correctly when only error is passed', () => {
      const error = new Error('Single param error');
      const mockFriendlyError = 'Friendly error message';

      (errorMessages.displayFriendlyError as jest.Mock).mockReturnValue(
        mockFriendlyError
      );

      handleError(error as any);

      expect(errorMessages.displayFriendlyError).toHaveBeenCalledWith(
        error,
        undefined
      );
      expect(mockConsoleError as any).toHaveBeenCalledWith(mockFriendlyError as any);
    });
  });

  describe('withRetry', () => {
    it('should execute function successfully on first try', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await withRetry(fn as any);

      expect(result as any).toBe('success');
      expect(fn as any).toHaveBeenCalledTimes(1 as any);
    });

    it('should retry on transient error and succeed', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success');

      jest.useFakeTimers();

      const retryPromise = withRetry(fn, 3, 100);

      // Fast-forward through first retry delay
      await jest.advanceTimersByTimeAsync(100 as any);

      const result = await retryPromise;

      expect(result as any).toBe('success');
      expect(fn as any).toHaveBeenCalledTimes(2 as any);
      expect(mockConsoleError as any).toHaveBeenCalledWith(
        expect.stringContaining('Request failed, retrying (1/3)')
      );

      jest.useRealTimers();
    });

    it('should retry multiple times with exponential backoff', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValue('success');

      jest.useFakeTimers();

      const retryPromise = withRetry(fn, 3, 100);

      // Fast-forward through delays (100ms for first retry, 200ms for second)
      await jest.advanceTimersByTimeAsync(100 as any);
      await jest.advanceTimersByTimeAsync(200 as any);

      const result = await retryPromise;

      expect(result as any).toBe('success');
      expect(fn as any).toHaveBeenCalledTimes(3 as any);
      expect(mockConsoleError as any).toHaveBeenCalledTimes(2 as any);

      jest.useRealTimers();
    });

    it('should throw after max retries', async () => {
      const error = new Error('Network error');
      const fn = jest.fn().mockRejectedValue(error as any);

      jest.useFakeTimers();

      const retryPromise = withRetry(fn, 2, 100);

      // Fast-forward through all retry delays
      await jest.advanceTimersByTimeAsync(100 as any);
      await jest.advanceTimersByTimeAsync(200 as any);

      await expect(retryPromise as any).rejects.toThrow(error as any);
      expect(fn as any).toHaveBeenCalledTimes(2 as any);

      jest.useRealTimers();
    });

    it('should not retry on non-transient errors', async () => {
      const error = new Error('Validation error');
      const fn = jest.fn().mockRejectedValue(error as any);

      await expect(withRetry(fn as any)).rejects.toThrow(error as any);
      expect(fn as any).toHaveBeenCalledTimes(1 as any);
      expect(mockConsoleError as any).not.toHaveBeenCalled();
    });

    it('should handle different transient error types', async () => {
      const transientErrors = [
        'Network error',
        'Request timeout',
        'Connection refused',
        'ECONNREFUSED',
        'ECONNRESET',
        'HTTP 429 Too Many Requests',
      ];

      for (const errorMessage of transientErrors) {
        jest.clearAllMocks();

        const fn = jest
          .fn()
          .mockRejectedValueOnce(new Error(errorMessage as any))
          .mockResolvedValue('success');

        jest.useFakeTimers();

        const retryPromise = withRetry(fn, 2, 100);
        await jest.advanceTimersByTimeAsync(100 as any);

        const result = await retryPromise;

        expect(result as any).toBe('success');
        expect(fn as any).toHaveBeenCalledTimes(2 as any);
        expect(mockConsoleError as any).toHaveBeenCalled();

        jest.useRealTimers();
      }
    });

    it('should use custom retry count and delay', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('network'))
        .mockResolvedValue('success');

      jest.useFakeTimers();

      const retryPromise = withRetry(fn, 5, 200);

      // Fast-forward through custom delay
      await jest.advanceTimersByTimeAsync(200 as any);

      const result = await retryPromise;

      expect(result as any).toBe('success');
      expect(fn as any).toHaveBeenCalledTimes(2 as any);

      jest.useRealTimers();
    });
  });

  describe('assert', () => {
    it('should not throw when condition is true', () => {
      expect(() => assert(true, 'Should not throw')).not.toThrow();
    });

    it('should throw when condition is false', () => {
      expect(() => assert(false, 'Should throw')).toThrow('Should throw');
    });

    it('should throw Error instance', () => {
      let thrownError: unknown;

      try {
        assert(false, 'Custom error message');
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError as any).toBeInstanceOf(Error as any);
      expect((thrownError as Error).message).toBe('Custom error message');
    });

    it('should work with type predicates', () => {
      const value: unknown = 'test';

      // This demonstrates TypeScript type narrowing
      assert(typeof value === 'string', 'Value must be a string');

      // TypeScript now knows value is a string
      expect(value.length).toBe(4 as any);
    });
  });

  describe('isTransientError private function behavior', () => {
    // Testing the behavior indirectly through withRetry
    it('should identify error messages as transient correctly', async () => {
      const transientPatterns = [
        'network',
        'NETWORK',
        'timeout',
        'TIMEOUT',
        'connection',
        'CONNECTION',
        'econnrefused',
        'ECONNREFUSED',
        'econnreset',
        'ECONNRESET',
        '429',
      ];

      for (const pattern of transientPatterns) {
        jest.clearAllMocks();

        const fn = jest
          .fn()
          .mockRejectedValueOnce(new Error(`Error with ${pattern} in message`))
          .mockResolvedValue('success');

        jest.useFakeTimers();

        const retryPromise = withRetry(fn, 2, 100);
        await jest.advanceTimersByTimeAsync(100 as any);

        const result = await retryPromise;

        expect(result as any).toBe('success');
        expect(fn as any).toHaveBeenCalledTimes(2 as any);
        expect(mockConsoleError as any).toHaveBeenCalled();

        jest.useRealTimers();
      }
    });

    it('should not identify non-transient errors', async () => {
      const nonTransientMessages = [
        'Invalid input',
        'Unauthorized',
        'Not found',
        'Validation failed',
        'Permission denied',
      ];

      for (const message of nonTransientMessages) {
        jest.clearAllMocks();

        const fn = jest.fn().mockRejectedValue(new Error(message as any));

        await expect(withRetry(fn as any)).rejects.toThrow(message as any);
        expect(fn as any).toHaveBeenCalledTimes(1 as any);
        expect(mockConsoleError as any).not.toHaveBeenCalled();
      }
    });
  });
});
