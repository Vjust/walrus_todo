import { jest } from '@jest/globals';
import { AIVerificationService } from '../../apps/cli/src/services/ai/AIVerificationService';
import { BlockchainAIVerificationService } from '../../apps/cli/src/services/ai/BlockchainAIVerificationService';
import { AIActionType } from '../../apps/cli/src/types/adapters/AIVerifierAdapter';
import { Todo } from '../../apps/cli/src/types/todo';
import {
  createMockAIVerificationService,
  createMockBlockchainAIVerificationService,
  assertReturnsPromise,
  assertVerificationSuccess,
  createMockVerificationRecord,
} from '../helpers/verification-test-utils';

describe('Verification Operations Promise Returns', () => {
  const sampleTodos: Todo[] = [
    {
      id: 'todo-1',
      title: 'Test Todo 1',
      description: 'This is a test todo',
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'todo-2',
      title: 'Test Todo 2',
      description: 'This is another test todo',
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AIVerificationService', () => {
    it('should return promises from all verification methods', async () => {
      const service = createMockAIVerificationService();

      // Test createVerification returns a promise
      assertReturnsPromise(() =>
        service.createVerification(
          AIActionType.SUMMARIZE,
          sampleTodos,
          'Test summary'
        )
      );

      // Test verifyRecord returns a promise
      const mockRecord = createMockVerificationRecord();
      assertReturnsPromise(() =>
        service.verifyRecord(mockRecord, 'request', 'response')
      );

      // Test verifyExistingOperation returns a promise
      assertReturnsPromise(() =>
        service.verifyExistingOperation('test-verification-id')
      );

      // Test createVerifiedSummary returns a promise
      assertReturnsPromise(() =>
        service.createVerifiedSummary(sampleTodos, 'Test summary')
      );

      // Test createVerifiedCategorization returns a promise
      assertReturnsPromise(() =>
        service.createVerifiedCategorization(sampleTodos, { work: ['todo-1'] })
      );

      // Test createVerifiedPrioritization returns a promise
      assertReturnsPromise(() =>
        service.createVerifiedPrioritization(sampleTodos, { 'todo-1': 1 })
      );

      // Test createVerifiedSuggestion returns a promise
      assertReturnsPromise(() =>
        service.createVerifiedSuggestion(sampleTodos, ['suggestion 1'])
      );

      // Test createVerifiedAnalysis returns a promise
      assertReturnsPromise(() =>
        service.createVerifiedAnalysis(sampleTodos, { analysis: 'result' })
      );
    });

    it('should successfully complete verification operations', async () => {
      const service = createMockAIVerificationService();

      // Test createVerification
      const verification = await assertVerificationSuccess(
        service.createVerification(
          AIActionType.SUMMARIZE,
          sampleTodos,
          'Test summary'
        ),
        'object'
      );
      expect(verification.id).toBeDefined();

      // Test verifyRecord
      const mockRecord = createMockVerificationRecord();
      const verifyResult = await assertVerificationSuccess(
        service.verifyRecord(
          mockRecord,
          JSON.stringify(sampleTodos),
          'Test summary'
        ),
        'boolean'
      );
      expect(verifyResult).toBe(true);

      // Test verifyExistingOperation
      const existsResult = await assertVerificationSuccess(
        service.verifyExistingOperation('test-verification-id'),
        'boolean'
      );
      expect(typeof existsResult).toBe('boolean');

      // Test createVerifiedSummary
      const summaryResult = await assertVerificationSuccess(
        service.createVerifiedSummary(sampleTodos, 'Test summary'),
        'object'
      );
      expect(summaryResult.result).toBe('Test summary');
      expect(summaryResult.verification).toBeDefined();
    });
  });

  describe('BlockchainAIVerificationService', () => {
    it('should return promises from all verification methods', async () => {
      const service = createMockBlockchainAIVerificationService();

      // Test createBlockchainVerification returns a promise
      assertReturnsPromise(() =>
        service.createBlockchainVerification(
          AIActionType.SUMMARIZE,
          sampleTodos,
          'Test summary'
        )
      );

      // Test createVerifiedSummary returns a promise
      assertReturnsPromise(() =>
        service.createVerifiedSummary(sampleTodos, 'Test summary')
      );

      // Test createVerifiedCategorization returns a promise
      assertReturnsPromise(() =>
        service.createVerifiedCategorization(sampleTodos, { work: ['todo-1'] })
      );

      // Test createVerifiedPrioritization returns a promise
      assertReturnsPromise(() =>
        service.createVerifiedPrioritization(sampleTodos, { 'todo-1': 1 })
      );

      // Test createVerifiedSuggestion returns a promise
      assertReturnsPromise(() =>
        service.createVerifiedSuggestion(sampleTodos, ['suggestion 1'])
      );

      // Test createVerifiedAnalysis returns a promise
      assertReturnsPromise(() =>
        service.createVerifiedAnalysis(sampleTodos, { analysis: 'result' })
      );

      // Test getVerification returns a promise
      assertReturnsPromise(() =>
        service.getVerification('test-verification-id')
      );

      // Test listVerifications returns a promise
      assertReturnsPromise(() => service.listVerifications());

      // Test generateProof returns a promise
      assertReturnsPromise(() =>
        service.generateProof(
          AIActionType.SUMMARIZE,
          JSON.stringify(sampleTodos),
          'Test summary'
        )
      );

      // Test verifyExternalProof returns a promise
      assertReturnsPromise(() =>
        service.verifyExternalProof('test-proof-id', 'test-signature', {
          request: 'test-request',
          response: 'test-response',
        })
      );

      // Test verifyProof returns a promise
      assertReturnsPromise(() =>
        service.verifyProof('test-proof-id', 'test-signature', { test: 'data' })
      );
    });

    it('should successfully complete blockchain verification operations', async () => {
      const service = createMockBlockchainAIVerificationService();

      // Test createBlockchainVerification
      const blockchainVerification = await assertVerificationSuccess(
        service.createBlockchainVerification(
          AIActionType.SUMMARIZE,
          sampleTodos,
          'Test summary'
        ),
        'object'
      );
      expect(blockchainVerification.result).toBe('Test summary');
      expect(blockchainVerification.verification).toBeDefined();
      expect(blockchainVerification.provider).toBeDefined();
      expect(blockchainVerification.verificationDate).toBeInstanceOf(Date);

      // Test createVerifiedSummary
      const summaryResult = await assertVerificationSuccess(
        service.createVerifiedSummary(sampleTodos, 'Test summary'),
        'object'
      );
      expect(summaryResult.result).toBe('Test summary');
      expect(summaryResult.verification).toBeDefined();

      // Test getVerification
      const getResult = await assertVerificationSuccess(
        service.getVerification('test-verification-id'),
        'object'
      );
      expect(getResult.verification).toBeDefined();

      // Test listVerifications
      const listResult = await assertVerificationSuccess(
        service.listVerifications(),
        'object'
      );
      expect(Array.isArray(listResult)).toBe(true);

      // Test generateProof
      const proofResult = await assertVerificationSuccess(
        service.generateProof(
          AIActionType.SUMMARIZE,
          JSON.stringify(sampleTodos),
          'Test summary'
        ),
        'object'
      );
      expect(proofResult.proofId).toBeDefined();
      expect(proofResult.signature).toBeDefined();

      // Test verifyExternalProof
      const verifyExternalResult = await assertVerificationSuccess(
        service.verifyExternalProof('test-proof-id', 'test-signature', {
          request: 'test-request',
          response: 'test-response',
        }),
        'boolean'
      );
      expect(typeof verifyExternalResult).toBe('boolean');

      // Test verifyProof
      const verifyProofResult = await assertVerificationSuccess(
        service.verifyProof('test-proof-id', 'test-signature', {
          test: 'data',
        }),
        'boolean'
      );
      expect(typeof verifyProofResult).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    it('should handle verification service initialization errors properly', async () => {
      // Test that AIVerificationService throws proper error with null adapter
      expect(() => {
        new AIVerificationService(null as any);
      }).not.toThrow(); // Constructor should not throw, but methods should handle null adapter

      // Test that methods handle undefined adapter gracefully
      const serviceWithNullAdapter = new AIVerificationService(null as any);

      await expect(async () => {
        await serviceWithNullAdapter.createVerification(
          AIActionType.SUMMARIZE,
          sampleTodos,
          'Test summary'
        );
      }).rejects.toThrow('Verifier adapter is not initialized');
    });

    it('should handle blockchain verification service initialization errors properly', () => {
      // Test that BlockchainAIVerificationService throws proper error with null verifier
      expect(() => {
        new BlockchainAIVerificationService(
          null as any,
          {} as any,
          {} as any,
          'test-provider'
        );
      }).toThrow('BlockchainVerifier is required');
    });

    it('should validate input parameters properly', async () => {
      const service = createMockAIVerificationService();

      // Test invalid todos parameter
      await expect(
        service.createVerifiedSummary(null as any, 'Test summary')
      ).rejects.toThrow('Invalid todos parameter');

      // Test invalid summary parameter
      await expect(
        service.createVerifiedSummary(sampleTodos, null as any)
      ).rejects.toThrow('Invalid summary parameter');

      const blockchainService = createMockBlockchainAIVerificationService();

      // Test invalid todos parameter in blockchain service
      await expect(
        blockchainService.createVerifiedSummary(null as any, 'Test summary')
      ).rejects.toThrow('Invalid todos parameter');

      // Test invalid summary parameter in blockchain service
      await expect(
        blockchainService.createVerifiedSummary(sampleTodos, null as any)
      ).rejects.toThrow('Invalid summary parameter');
    });
  });
});
