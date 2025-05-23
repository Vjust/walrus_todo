import { Logger, LogLevel } from '../../src/utils/Logger';
import {
  BaseError as WalrusError,
  StorageError,
  BlockchainError,
  ValidationError,
  NetworkError
} from '../../src/types/errors/consolidated';

describe('Logger', () => {
  let logger: Logger;
  let mockConsole: jest.SpyInstance[];
  let mockHandler: jest.Mock<void, [{ level: LogLevel; message: string; context?: any; error?: any }]>;

  beforeEach(() => {
    // Reset logger instance
    logger = Logger.getInstance();
    logger.clearHandlers();

    // Mock console methods
    mockConsole = (['debug', 'info', 'warn', 'error'] as const).map(level =>
      jest.spyOn(console, level as keyof Console).mockImplementation(() => {})
    );

    // Create mock handler
    mockHandler = jest.fn();
    logger.addHandler(mockHandler);
  });

  afterEach(() => {
    mockConsole.forEach(mock => mock.mockRestore());
  });

  describe('Log Levels', () => {
    it('should log at different levels', () => {
      const testMessage = 'Test message';
      const testContext = { test: 'context' };

      logger.debug(testMessage, testContext);
      logger.info(testMessage, testContext);
      logger.warn(testMessage, testContext);
      logger.error(testMessage, new Error('Test error'), testContext);

      expect(mockHandler).toHaveBeenCalledTimes(4);

      // Verify log level and message content
      const calls = mockHandler.mock.calls;
      expect(calls[0][0].level).toBe(LogLevel.DEBUG);
      expect(calls[1][0].level).toBe(LogLevel.INFO);
      expect(calls[2][0].level).toBe(LogLevel.WARN);
      expect(calls[3][0].level).toBe(LogLevel.ERROR);

      // Verify context is included
      calls.forEach(call => {
        expect(call[0].context).toEqual(testContext);
      });
    });

    it('should handle undefined context', () => {
      logger.info('Test message');
      
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.INFO,
          message: 'Test message',
          context: undefined
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should properly format WalrusError', () => {
      const error = new WalrusError('Test error', {
        code: 'TEST_ERROR',
        publicMessage: 'Public message'
      });

      logger.error('Error occurred', error);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.ERROR,
          error: expect.objectContaining({
            name: 'WalrusError',
            code: 'TEST_ERROR',
            message: 'Test error',
            publicMessage: 'Public message'
          })
        })
      );
    });

    it('should handle nested errors', () => {
      const cause = new Error('Cause error');
      const error = new StorageError('Storage error', {
        operation: 'read',
        blobId: 'test-blob',
        cause
      });

      logger.error('Error occurred', error);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            cause: 'Cause error'
          })
        })
      );
    });

    it('should handle non-Error objects', () => {
      logger.error('Error occurred', 'string error' as any);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            name: 'Error',
            code: 'UNKNOWN_ERROR',
            message: 'string error'
          })
        })
      );
    });
  });

  describe('Context Sanitization', () => {
    it('should redact sensitive information', () => {
      const sensitiveContext = {
        password: 'secret123',
        apiKey: 'key123',
        token: 'token123',
        user: {
          authToken: 'auth123',
          name: 'John'
        },
        data: {
          signature: 'sig123',
          content: 'safe content'
        }
      };

      logger.info('Test message', sensitiveContext);

      const call = mockHandler.mock.calls[0][0];
      expect(call.context).toEqual({
        password: '[REDACTED]',
        apiKey: '[REDACTED]',
        token: '[REDACTED]',
        user: {
          authToken: '[REDACTED]',
          name: 'John'
        },
        data: {
          signature: '[REDACTED]',
          content: 'safe content'
        }
      });
    });

    it('should handle nested sensitive data', () => {
      const nestedContext = {
        data: {
          user: {
            password: 'secret',
            name: 'John'
          }
        }
      };

      logger.info('Test message', nestedContext);

      expect(mockHandler.mock.calls[0][0].context).toEqual({
        data: {
          user: {
            password: '[REDACTED]',
            name: 'John'
          }
        }
      });
    });
  });

  describe('Custom Error Types', () => {
    it('should handle StorageError', () => {
      const error = new StorageError('Storage operation failed', {
        operation: 'upload',
        blobId: 'test-blob'
      });

      logger.error('Storage error', error);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'STORAGE_UPLOAD_ERROR',
            publicMessage: 'A storage operation failed'
          })
        })
      );
    });

    it('should handle BlockchainError', () => {
      const error = new BlockchainError('Transaction failed', {
        operation: 'execute',
        transactionId: 'tx123'
      });

      logger.error('Blockchain error', error);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'BLOCKCHAIN_EXECUTE_ERROR',
            publicMessage: 'A blockchain operation failed'
          })
        })
      );
    });

    it('should handle ValidationError', () => {
      const error = new ValidationError('Invalid blob size', {
        field: 'size',
        value: -1,
        constraint: 'positive'
      });

      logger.error('Validation error', error);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            publicMessage: 'Invalid value for size'
          })
        })
      );
    });

    it('should handle NetworkError', () => {
      const error = new NetworkError('Network request failed', {
        operation: 'request',
        network: 'testnet',
        recoverable: true
      });

      logger.error('Network error', error);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'NETWORK_REQUEST_ERROR',
            publicMessage: 'A network operation failed',
            shouldRetry: true
          })
        })
      );
    });
  });

  describe('Error Response Formatting', () => {
    it('should create safe public error responses', () => {
      const error = new StorageError('Internal storage error', {
        operation: 'read',
        blobId: 'sensitive-blob-id',
        recoverable: true
      });

      const publicError = error.toPublicError();

      expect(publicError).toEqual({
        code: 'STORAGE_READ_ERROR',
        message: 'A storage operation failed',
        timestamp: expect.any(String),
        shouldRetry: true
      });

      // Ensure sensitive details are not included
      expect(publicError).not.toHaveProperty('blobId');
      expect(publicError).not.toHaveProperty('stack');
    });

    it('should create detailed log entries', () => {
      const cause = new Error('Network timeout');
      const error = new NetworkError('Failed to connect', {
        operation: 'connect',
        network: 'testnet',
        recoverable: true,
        cause
      });

      const logEntry = error.toLogEntry();

      expect(logEntry).toEqual({
        name: 'NetworkError',
        code: 'NETWORK_CONNECT_ERROR',
        message: 'Failed to connect',
        publicMessage: 'A network operation failed',
        timestamp: expect.any(String),
        shouldRetry: true,
        stack: expect.any(String),
        cause: 'Network timeout'
      });
    });
  });
});