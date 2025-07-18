import { jest } from '@jest/globals';
import { TransactionHelper } from '../../apps/cli/src/utils/TransactionHelper';
import { Signer } from '@mysten/sui/cryptography';
import { Logger } from '../../apps/cli/src/utils/Logger';
import {
  ValidationError,
  BlockchainError,
} from '../../apps/cli/src/types/errors/consolidated';

jest.mock('../../apps/cli/src/utils/Logger');

describe('TransactionHelper', () => {
  let mockSigner: jest.Mocked<Signer>;
  let mockLogger: jest.Mocked<Logger>;
  let helper: TransactionHelper;

  beforeEach(() => {
    mockSigner = {
      signData: jest.fn().mockResolvedValue(new Uint8Array(32)),
      toSuiAddress: jest.fn().mockReturnValue('0x123'),
      getPublicKey: jest.fn().mockReturnValue(new Uint8Array(32)),
      signTransaction: jest.fn().mockResolvedValue({
        signature: 'mock-signature',
        bytes: 'base64-encoded-bytes',
        messageBytes: new Uint8Array(64),
      }),
      signMessage: jest.fn().mockResolvedValue({
        signature: 'mock-signature',
        bytes: 'base64-encoded-bytes',
        messageBytes: new Uint8Array(64),
      }),
    } as unknown as jest.Mocked<Signer>;

    mockLogger = {
      debug: jest.fn().mockReturnValue(undefined),
      info: jest.fn().mockReturnValue(undefined),
      warn: jest.fn().mockReturnValue(undefined),
      error: jest.fn().mockReturnValue(undefined),
    } as unknown as jest.Mocked<Logger>;

    (Logger.getInstance as jest.Mock).mockReturnValue(mockLogger);

    helper = new TransactionHelper(mockSigner);
  });

  describe('Retry Logic', () => {
    it('should retry failed operations', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce('success');

      const result = await helper.executeWithRetry(operation, {
        name: 'test operation',
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    });

    it('should respect maximum retry attempts', async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new Error('Persistent error'));

      helper = new TransactionHelper(mockSigner, {
        attempts: 2,
        baseDelay: 100,
      });

      await expect(
        helper.executeWithRetry(operation, { name: 'test operation' })
      ).rejects.toThrow('Persistent error');

      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should implement exponential backoff', async () => {
      const delays: number[] = [];
      const operation = jest.fn().mockRejectedValue(new Error('Network error'));

      // Override setTimeout to capture delays
      jest.spyOn(global, 'setTimeout').mockImplementation(((
        cb: () => void,
        delay?: number
      ) => {
        delays.push(delay || 0);
        cb();
        return {} as NodeJS.Timeout;
      }) as any);

      helper = new TransactionHelper(mockSigner, {
        attempts: 3,
        baseDelay: 100,
        maxDelay: 1000,
        exponential: true,
      });

      await expect(
        helper.executeWithRetry(operation, { name: 'test operation' })
      ).rejects.toThrow('Network error');

      expect(delays).toEqual([100, 200]); // 100ms, then 200ms
    });

    it('should cap retry delay at maxDelay', () => {
      helper = new TransactionHelper(mockSigner, {
        baseDelay: 1000,
        maxDelay: 5000,
        exponential: true,
      });

      const delay = helper.getRetryDelay(5); // 5th attempt
      expect(delay).toBe(5000); // Should be capped at maxDelay
    });
  });

  describe('Transaction Validation', () => {
    it('should require signer when specified', () => {
      expect(() =>
        helper.validateTransaction({
          name: 'test transaction',
          requireSigner: true,
        })
      ).not.toThrow();

      helper = new TransactionHelper(); // No signer
      expect(() =>
        helper.validateTransaction({
          name: 'test transaction',
          requireSigner: true,
        })
      ).toThrow(ValidationError);
    });

    it('should accept custom signer', () => {
      const customSigner = {
        signData: jest.fn().mockResolvedValue(new Uint8Array(32)),
        toSuiAddress: jest.fn().mockReturnValue('0x456'),
        getPublicKey: jest.fn().mockReturnValue(new Uint8Array(32)),
        signTransaction: jest.fn().mockResolvedValue({
          signature: 'mock-signature',
          bytes: 'base64-encoded-bytes',
          messageBytes: new Uint8Array(64),
        }),
        signMessage: jest.fn().mockResolvedValue({
          signature: 'mock-signature',
          bytes: 'base64-encoded-bytes',
          messageBytes: new Uint8Array(64),
        }),
        signWithIntent: jest.fn().mockResolvedValue({
          signature: 'mock-signature',
          bytes: 'base64-encoded-bytes',
          messageBytes: new Uint8Array(64),
        }),
      } as unknown as Signer;

      helper = new TransactionHelper(); // No default signer

      expect(() =>
        helper.validateTransaction({
          name: 'test transaction',
          signer: customSigner,
          requireSigner: true,
        })
      ).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should decide retry based on error type', () => {
      // Network errors should be retried
      expect(helper.shouldRetry(new Error('network timeout'))).toBe(true);
      expect(helper.shouldRetry(new Error('connection refused'))).toBe(true);

      // Validation errors should not be retried
      expect(
        helper.shouldRetry(
          new ValidationError('Invalid input', { field: 'test_field' })
        )
      ).toBe(false);

      // Blockchain errors depend on recoverable flag
      expect(
        helper.shouldRetry(
          new BlockchainError('Tx failed', {
            operation: 'test',
            recoverable: true,
          })
        )
      ).toBe(true);

      expect(
        helper.shouldRetry(
          new BlockchainError('Tx failed', {
            operation: 'test',
            recoverable: false,
          })
        )
      ).toBe(false);
    });

    it('should include operation name in errors', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Test error'));

      await expect(
        helper.executeWithRetry(operation, {
          name: 'important operation',
        })
      ).rejects.toThrow(BlockchainError);

      await expect(
        helper.executeWithRetry(operation, {
          name: 'important operation',
        })
      ).rejects.toMatchObject({
        message: expect.stringContaining('important operation'),
      });
    });
  });

  describe('Configuration', () => {
    it('should create new instance with custom config', () => {
      const customSigner = {
        signData: jest.fn().mockResolvedValue(new Uint8Array(32)),
        toSuiAddress: jest.fn().mockReturnValue('0x789'),
        getPublicKey: jest.fn().mockReturnValue(new Uint8Array(32)),
        signTransaction: jest.fn().mockResolvedValue(new Uint8Array(64)),
      } as unknown as Signer;

      const customHelper = helper.withConfig({
        signer: customSigner,
        retry: {
          attempts: 5,
          baseDelay: 200,
        },
      });

      expect(customHelper).toBeInstanceOf(TransactionHelper);
      expect(() =>
        customHelper.validateTransaction({
          name: 'test',
          requireSigner: true,
        })
      ).not.toThrow();
    });

    it('should merge retry configurations', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Test error'));

      helper = new TransactionHelper(mockSigner, {
        attempts: 3,
        baseDelay: 100,
      });

      await expect(
        helper.executeWithRetry(operation, {
          name: 'test',
          customRetry: {
            attempts: 2, // Override attempts only
          },
        })
      ).rejects.toThrow('Test error');

      expect(operation).toHaveBeenCalledTimes(2); // Should use custom attempts
    });
  });

  describe('Integration Tests', () => {
    it('should handle concurrent operations', async () => {
      const successOperation = jest.fn().mockResolvedValue('success');
      const failOperation = jest
        .fn()
        .mockRejectedValue(new Error('Test error'));

      const results = await Promise.allSettled([
        helper.executeWithRetry(successOperation, { name: 'op1' }),
        helper.executeWithRetry(successOperation, { name: 'op2' }),
        helper.executeWithRetry(failOperation, { name: 'op3' }),
      ]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('fulfilled');
      expect(results[2].status).toBe('rejected');
    });

    it('should handle retry with validation', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce('success');

      const result = await helper.executeWithRetry(operation, {
        name: 'test operation',
        requireSigner: true, // Require signer validation
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should log retry attempts with context', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Test error'))
        .mockResolvedValueOnce('success');

      await helper.executeWithRetry(operation, {
        name: 'important operation',
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Retry attempt'),
        expect.objectContaining({
          attempt: 1,
          delay: expect.any(Number),
          error: 'Test error',
        })
      );
    });
  });
});
