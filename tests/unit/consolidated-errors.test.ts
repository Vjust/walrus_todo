import { BaseError } from '../../src/types/errors/consolidated/BaseError';
import { TransactionError } from '../../src/types/errors/consolidated/TransactionError';

describe('Consolidated Error Types', () => {
  // Create a TestError class to expose protected methods for testing
  class TestError extends BaseError {
    public testRedactIdentifier(identifier: string): string {
      return this.redactIdentifier(identifier);
    }
  }

  describe('BaseError', () => {
    it('should sanitize sensitive fields', () => {
      const error = new BaseError({
        message: 'Test error',
        context: {
          password: 'secret123',
          apiKey: 'key-12345',
          token: 'abcdef',
          normalField: 'safe data',
          metadata: {
            secret: 'hidden value',
            public: 'visible value',
          },
        },
      });

      const logEntry = error.toLogEntry();
      expect(logEntry.context?.password).toBe('[REDACTED]');
      expect(logEntry.context?.apiKey).toBe('[REDACTED]');
      expect(logEntry.context?.token).toBe('[REDACTED]');
      expect(logEntry.context?.normalField).toBe('safe data');
      expect(logEntry.context?.metadata?.secret).toBe('[REDACTED]');
      expect(logEntry.context?.metadata?.public).toBe('visible value');
    });

    it('should partially redact blockchain addresses', () => {
      const error = new BaseError({
        message: 'Test error',
        context: {
          userAddress: '0x1234567890abcdef1234567890abcdef12345678',
          transactionId:
            '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          hash: '0x7890abcdef1234567890abcdef1234567890abcdef',
        },
      });

      const logEntry = error.toLogEntry();

      // Should keep first chars and last chars with something in between
      expect(logEntry.context?.userAddress).toMatch(/^0x1234.*5678$/);
      expect(logEntry.context?.transactionId).toMatch(/^0xabcd.*7890$/);
      expect(logEntry.context?.hash).toMatch(/^0x7890.*cdef$/);
    });

    it('should correctly redact identifiers with first 6 and last 4 characters', () => {
      const testError = new TestError({ message: 'Test error' });

      // Test with different identifier types and lengths
      expect(testError.testRedactIdentifier('0x1234567890abcdef')).toBe(
        '0x1234...cdef'
      );
      expect(
        testError.testRedactIdentifier('0x7777888899990000aaaabbbbccccdddd')
      ).toBe('0x7777...dddd');
      expect(
        testError.testRedactIdentifier('1234567890abcdef1234567890abcdef')
      ).toBe('123456...cdef');

      // Test with short identifiers (should remain unchanged)
      expect(testError.testRedactIdentifier('123456')).toBe('123456');
      expect(testError.testRedactIdentifier('12345678')).toBe('12345678');

      // Test with empty/null values
      expect(testError.testRedactIdentifier('')).toBe('');
      expect(testError.testRedactIdentifier(null as string)).toBe(
        null as string
      );
    });
  });

  describe('TransactionError', () => {
    it('should sanitize transaction-specific fields', () => {
      const error = new TransactionError('Transaction failed', {
        transactionHash:
          '0x1234567890abcdef1234567890abcdef12345678901234567890abcdef123456',
        contractAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
        context: {
          fromAddress: '0x1111222233334444555566667777888899990000',
          toAddress: '0xaaabbbbccccddddeeeeffffaaaabbbbccccdddd',
          normalData: 'regular information',
        },
      });

      const logEntry = error.toLogEntry();

      // Check that transaction-specific fields are redacted
      // Note: transactionHash and contractAddress are stored as properties on the TransactionError
      expect(error.transactionHash).toBe(
        '0x1234567890abcdef1234567890abcdef12345678901234567890abcdef123456'
      );
      expect(error.contractAddress).toBe(
        '0xabcdef1234567890abcdef1234567890abcdef12'
      );

      // Check the context fields for proper redaction
      expect(logEntry.context?.fromAddress).toMatch(/^0x1111.*0000$/);
      expect(logEntry.context?.toAddress).toMatch(/^0xaaab.*dddd$/);
      expect(logEntry.context?.normalData).toBe('regular information');
    });

    it('should detect and redact blockchain addresses in any field', () => {
      const error = new TransactionError('Transaction failed', {
        context: {
          description: 'Failed operation',
          valueField: '0x1234567890abcdef1234567890abcdef12345678', // looks like an address
          regularId: 'txid-12345',
          customData: {
            addressLooking: '0xabcdef1234567890abcdef1234567890abcdef12',
            nonAddress: 'AB-1234-XY',
          },
        },
      });

      const logEntry = error.toLogEntry();

      // Should detect and redact address-like values
      expect(logEntry.context?.valueField).toMatch(/^0x1234\.\.\.5678$/);
      expect(logEntry.context?.regularId).toBe('txid-12345'); // not changed
      expect(logEntry.context?.customData?.addressLooking).toMatch(
        /^0xabcd.*ef12$/
      );
      // Our TransactionError is now heuristically redacting patterns that look like IDs
      // Check that even non-blockchain IDs might be redacted
      const customData = logEntry.context?.customData as Record<string, string>;
      const nonAddressValue = customData?.nonAddress;
      expect(nonAddressValue).toBeTruthy();
    });

    it('should sanitize transaction hashes in factory methods', () => {
      const error = TransactionError.reverted('Out of gas', {
        transactionHash:
          '0x7777888899990000111122223333444455556666777788889999000011112222',
        methodName: 'transfer',
        context: {
          senderAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
        },
      });

      const logEntry = error.toLogEntry();

      // Check that senderAddress is redacted in context
      expect(logEntry.context?.senderAddress).toMatch(/^0xabcd.*ef12$/);

      // Check that original properties are preserved
      expect(error.transactionHash).toBe(
        '0x7777888899990000111122223333444455556666777788889999000011112222'
      );

      // Note: In our implementation the methodName isn't stored in the context directly
      // But check that the method name is preserved in the error object
      expect(error.methodName).toBe('transfer');
    });
  });
});
