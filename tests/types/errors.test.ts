import {
  BaseError as WalrusError,
  StorageError,
  BlockchainError,
  ValidationError,
  NetworkError,
} from '../../apps/cli/src/types/errors/consolidated';

describe('Error Types', () => {
  describe('WalrusError', () => {
    it('should create basic error', () => {
      const error = new WalrusError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('BaseError');
      expect(error.code).toBe('UNKNOWN_ERROR');
      expect(error.publicMessage).toBe('An unexpected error occurred');
      expect(error.shouldRetry).toBe(false);
    });

    it('should handle custom options', () => {
      const error = new WalrusError('Test error', {
        code: 'CUSTOM_ERROR',
        publicMessage: 'Public message',
        shouldRetry: true,
      });

      expect(error.code).toBe('CUSTOM_ERROR');
      expect(error.publicMessage).toBe('Public message');
      expect(error.shouldRetry).toBe(true);
    });

    it('should handle error cause', () => {
      const cause = new Error('Cause error');
      const error = new WalrusError('Test error', { cause });

      expect(error.cause).toBe(cause);
      expect(error.toLogEntry().cause).toBe('Cause error');
    });
  });

  describe('StorageError', () => {
    it('should format operation in code', () => {
      const error = new StorageError('Storage error', {
        operation: 'read',
        blobId: 'test-blob',
      });

      expect(error.code).toBe('STORAGE_READ_ERROR');
      expect(error.publicMessage).toBe('A storage operation failed');
    });

    it('should handle blob ID securely', () => {
      const error = new StorageError('Storage error', {
        operation: 'write',
        blobId: 'sensitive-id',
      });

      // blobId should not be exposed in public properties
      expect(Object.keys(error)).not.toContain('blobId');

      // blobId should not appear in public error
      const publicError = error.toPublicError();
      expect(JSON.stringify(publicError)).not.toContain('sensitive-id');
    });
  });

  describe('BlockchainError', () => {
    it('should format operation in code', () => {
      const error = new BlockchainError('Blockchain error', {
        operation: 'transaction',
        transactionId: 'tx123',
      });

      expect(error.code).toBe('BLOCKCHAIN_TRANSACTION_ERROR');
      expect(error.publicMessage).toBe('A blockchain operation failed');
    });

    it('should handle transaction ID securely', () => {
      const error = new BlockchainError('Blockchain error', {
        operation: 'execute',
        transactionId: 'sensitive-tx',
      });

      // transactionId should not be exposed in public properties
      expect(Object.keys(error)).not.toContain('transactionId');

      // transactionId should not appear in public error
      const publicError = error.toPublicError();
      expect(JSON.stringify(publicError)).not.toContain('sensitive-tx');
    });
  });

  describe('ValidationError', () => {
    it('should create field-specific message', () => {
      const error = ValidationError.forField('Validation error', 'size', {
        value: -1,
        constraint: 'positive',
      });

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.publicMessage).toBe('Invalid value for size');
    });

    it('should handle sensitive validation data', () => {
      const error = ValidationError.forField('Validation error', 'token', {
        value: 'secret-token',
        constraint: 'format',
      });

      // Value should not be exposed in public properties
      expect(Object.keys(error)).not.toContain('value');

      // Value should not appear in public error
      const publicError = error.toPublicError();
      expect(JSON.stringify(publicError)).not.toContain('secret-token');
    });
  });

  describe('NetworkError', () => {
    it('should format operation in code', () => {
      const error = new NetworkError('Network error', {
        operation: 'request',
        network: 'testnet',
        recoverable: true,
      });

      expect(error.code).toBe('NETWORK_REQUEST_ERROR');
      expect(error.publicMessage).toBe('A network operation failed');
      expect(error.shouldRetry).toBe(true);
    });

    it('should handle network details securely', () => {
      const error = new NetworkError('Network error', {
        operation: 'connect',
        network: 'private-testnet',
        recoverable: false,
      });

      // Network details should not be exposed in public properties
      expect(Object.keys(error)).not.toContain('network');

      // Network name should not appear in public error
      const publicError = error.toPublicError();
      expect(JSON.stringify(publicError)).not.toContain('private-testnet');
    });
  });

  describe('Error Chain Integration', () => {
    it('should handle chained errors', () => {
      const networkError = new NetworkError('Network failed', {
        operation: 'request',
        network: 'testnet',
      });

      const blockchainError = new BlockchainError('Transaction failed', {
        operation: 'execute',
        cause: networkError,
      });

      const storageError = new StorageError('Storage failed', {
        operation: 'write',
        blobId: 'test-blob',
        cause: blockchainError,
      });

      const logEntry = storageError.toLogEntry();
      expect(logEntry.cause).toBe('Transaction failed');
      expect(logEntry.code).toBe('STORAGE_WRITE_ERROR');
    });

    it('should preserve retry information', () => {
      const networkError = new NetworkError('Network failed', {
        operation: 'request',
        network: 'testnet',
        recoverable: true,
      });

      const storageError = new StorageError('Storage failed', {
        operation: 'write',
        blobId: 'test-blob',
        recoverable: true,
        cause: networkError,
      });

      expect(storageError.shouldRetry).toBe(true);
      expect(storageError.toPublicError().shouldRetry).toBe(true);
    });
  });

  describe('Error Response Security', () => {
    it('should not leak sensitive information in stack traces', () => {
      const error = new StorageError('Failed to store blob', {
        operation: 'write',
        blobId: 'sensitive-blob-id',
        recoverable: true,
      });

      const logEntry = error.toLogEntry();
      expect(logEntry.stack).not.toContain('sensitive-blob-id');
    });

    it('should sanitize error messages', () => {
      const error = new BlockchainError(
        'Transaction tx123 failed with key abc123',
        {
          operation: 'execute',
          transactionId: 'tx123',
        }
      );

      const publicError = error.toPublicError();
      expect(publicError.message).toBe('A blockchain operation failed');
      expect(publicError.message).not.toContain('tx123');
      expect(publicError.message).not.toContain('abc123');
    });

    it('should handle non-string sensitive data', () => {
      const error = ValidationError.forField('Validation failed', 'credentials', {
        value: { token: 'secret123', key: 'key123' },
        constraint: 'format',
      });

      const logEntry = error.toLogEntry();
      const serialized = JSON.stringify(logEntry);
      expect(serialized).not.toContain('secret123');
      expect(serialized).not.toContain('key123');
    });
  });
});
