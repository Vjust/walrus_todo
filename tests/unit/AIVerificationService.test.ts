import { AIVerificationService, VerifiedAIResult } from '../../src/services/ai';
import { BlockchainAIVerificationService } from '../../src/services/ai/BlockchainAIVerificationService';
import {
  AIActionType,
  AIPrivacyLevel,
  VerificationRecord,
} from '../../src/types/adapters/AIVerifierAdapter';
import { createMockAIVerifierAdapter } from '../mocks/AIVerifierAdapter.mock';
import { createSampleTodos } from '../helpers/ai-test-utils';
import { BlockchainVerifier } from '../../src/services/ai/BlockchainVerifier';
import { SecureCredentialManager } from '../../src/services/ai/SecureCredentialManager';
import { getPermissionManager } from '../../src/services/ai/AIPermissionManager';

// Mock blockchain verifier
jest.mock('../../src/services/ai/BlockchainVerifier', () => {
  return {
    BlockchainVerifier: jest.fn().mockImplementation(() => ({
      verifyOperation: jest.fn().mockResolvedValue({
        verified: true,
        record: {
          id: 'bc-ver-123',
          actionType: 'summarize',
          requestHash: 'bc-req-hash',
          responseHash: 'bc-resp-hash',
          timestamp: Date.now(),
          provider: 'blockchain-provider',
          privacyLevel: AIPrivacyLevel.HASH_ONLY,
          metadata: {},
          signature: 'bc-mock-sig',
        },
        transactionId: 'tx-123',
        timestamp: Date.now(),
        errorMessage: null,
      }),
      getVerification: jest.fn().mockResolvedValue({
        id: 'bc-ver-123',
        actionType: 'summarize',
        requestHash: 'bc-req-hash',
        responseHash: 'bc-resp-hash',
        timestamp: Date.now(),
        provider: 'blockchain-provider',
        privacyLevel: AIPrivacyLevel.HASH_ONLY,
        metadata: {},
        signature: 'bc-mock-sig',
      }),
      listVerifications: jest.fn().mockResolvedValue([
        {
          id: 'bc-ver-123',
          actionType: 'summarize',
          requestHash: 'bc-req-hash',
          responseHash: 'bc-resp-hash',
          timestamp: Date.now(),
          provider: 'blockchain-provider',
          privacyLevel: AIPrivacyLevel.HASH_ONLY,
          metadata: {},
          signature: 'bc-mock-sig',
        },
      ]),
    })),
  };
});

// Mock proof system
jest.mock('../../src/services/ai/AIProofSystem', () => {
  return {
    AIProofSystem: jest.fn().mockImplementation(() => ({
      createProof: jest.fn().mockResolvedValue({
        proofId: 'proof-123',
        verificationId: 'bc-ver-123',
        timestamp: Date.now(),
        signature: 'proof-sig',
        hash: 'proof-hash',
      }),
      verifyProof: jest.fn().mockResolvedValue({
        isValid: true,
        verificationId: 'bc-ver-123',
        timestamp: Date.now(),
      }),
      importProof: jest.fn().mockReturnValue({
        proofId: 'proof-123',
        verificationId: 'bc-ver-123',
        timestamp: Date.now(),
        signature: 'proof-sig',
        hash: 'proof-hash',
      }),
    })),
  };
});

// Mock credential manager
jest.mock('../../src/services/ai/SecureCredentialManager', () => {
  return {
    SecureCredentialManager: jest.fn().mockImplementation(() => ({
      getCredentialObject: jest.fn().mockReturnValue({
        provider: 'xai',
        key: 'mock-api-key',
        permissionLevel: 'FULL',
      }),
    })),
    AIPermissionLevel: {
      FULL: 'FULL',
      READ_ONLY: 'READ_ONLY',
      RESTRICTED: 'RESTRICTED',
      NONE: 'NONE',
    },
  };
});

// Mock permission manager
jest.mock('../../src/services/ai/AIPermissionManager', () => {
  return {
    getPermissionManager: jest.fn().mockReturnValue({
      checkPermission: jest.fn().mockResolvedValue({
        granted: true,
        reason: null,
      }),
    }),
  };
});

describe('AI Verification Services', () => {
  const sampleTodos = createSampleTodos(3);

  // SECTION: Basic Verification Service
  describe('Basic Verification Service', () => {
    let verificationService: AIVerificationService;
    let mockVerifierAdapter: any;

    beforeEach(() => {
      mockVerifierAdapter = createMockAIVerifierAdapter();
      verificationService = new AIVerificationService(mockVerifierAdapter);
    });

    it('should create a verification record', async () => {
      const verification = await verificationService.createVerification(
        AIActionType.SUMMARIZE,
        sampleTodos,
        'Sample summary text',
        { todoCount: '3' },
        AIPrivacyLevel.HASH_ONLY
      );

      expect(verification).toBeDefined();
      expect(verification.id).toBeDefined();
      expect(verification.verificationType).toBe(AIActionType.SUMMARIZE);
      expect(verification.metadata).toHaveProperty('todoCount', '3');
      expect(mockVerifierAdapter.createVerification).toHaveBeenCalledTimes(1);
    });

    it('should verify a recorded operation', async () => {
      // First create a verification
      const verification = await verificationService.createVerification(
        AIActionType.SUMMARIZE,
        sampleTodos,
        'Sample summary text',
        { todoCount: '3' },
        AIPrivacyLevel.HASH_ONLY
      );

      // Then verify it
      const isValid = await verificationService.verifyRecord(
        verification,
        sampleTodos,
        'Sample summary text'
      );

      expect(isValid).toBe(true);
      expect(mockVerifierAdapter.verifyRecord).toHaveBeenCalledTimes(1);
    });

    it('should list all verifications', async () => {
      // Create a few verifications
      await verificationService.createVerification(
        AIActionType.SUMMARIZE,
        sampleTodos,
        'Sample summary text',
        { todoCount: '3' },
        AIPrivacyLevel.HASH_ONLY
      );

      await verificationService.createVerification(
        AIActionType.CATEGORIZE,
        sampleTodos,
        { work: ['todo-1'] },
        { todoCount: '3', categoryCount: '1' },
        AIPrivacyLevel.HASH_ONLY
      );

      // List verifications
      const verifications = await verificationService.listVerifications();

      expect(verifications).toBeDefined();
      expect(Array.isArray(verifications)).toBe(true);
      expect(verifications.length).toBeGreaterThan(0);
      expect(mockVerifierAdapter.listVerifications).toHaveBeenCalledTimes(1);
    });
  });

  // SECTION: Operation-specific verified results
  describe('Operation-specific Verified Results', () => {
    let verificationService: AIVerificationService;

    beforeEach(() => {
      const mockVerifierAdapter = createMockAIVerifierAdapter();
      verificationService = new AIVerificationService(mockVerifierAdapter);
    });

    it('should create a verified AI summary', async () => {
      const summary = 'This is a sample summary of todos';

      const verifiedResult = await verificationService.createVerifiedSummary(
        sampleTodos,
        summary,
        AIPrivacyLevel.HASH_ONLY
      );

      expect(verifiedResult).toBeDefined();
      expect(verifiedResult.result).toBe(summary);
      expect(verifiedResult.verification).toBeDefined();
      expect(verifiedResult.verification.actionType).toBe(
        AIActionType.SUMMARIZE
      );
      expect(verifiedResult.verification.metadata).toHaveProperty(
        'todoCount',
        '3'
      );
    });

    it('should create a verified AI categorization', async () => {
      const categories = {
        work: ['todo-1'],
        personal: ['todo-2', 'todo-3'],
      };

      const verifiedResult =
        await verificationService.createVerifiedCategorization(
          sampleTodos,
          categories,
          AIPrivacyLevel.HASH_ONLY
        );

      expect(verifiedResult).toBeDefined();
      expect(verifiedResult.result).toEqual(categories);
      expect(verifiedResult.verification).toBeDefined();
      expect(verifiedResult.verification.actionType).toBe(
        AIActionType.CATEGORIZE
      );
      expect(verifiedResult.verification.metadata).toHaveProperty(
        'todoCount',
        '3'
      );
      expect(verifiedResult.verification.metadata).toHaveProperty(
        'categoryCount',
        '2'
      );
    });

    it('should create a verified AI prioritization', async () => {
      const priorities = {
        'todo-1': 9,
        'todo-2': 5,
        'todo-3': 3,
      };

      const verifiedResult =
        await verificationService.createVerifiedPrioritization(
          sampleTodos,
          priorities,
          AIPrivacyLevel.HASH_ONLY
        );

      expect(verifiedResult).toBeDefined();
      expect(verifiedResult.result).toEqual(priorities);
      expect(verifiedResult.verification).toBeDefined();
      expect(verifiedResult.verification.actionType).toBe(
        AIActionType.PRIORITIZE
      );
      expect(verifiedResult.verification.metadata).toHaveProperty(
        'todoCount',
        '3'
      );
    });

    it('should create a verified AI suggestion', async () => {
      const suggestions = [
        'Complete documentation',
        'Schedule team meeting',
        'Prepare demo',
      ];

      const verifiedResult = await verificationService.createVerifiedSuggestion(
        sampleTodos,
        suggestions,
        AIPrivacyLevel.HASH_ONLY
      );

      expect(verifiedResult).toBeDefined();
      expect(verifiedResult.result).toEqual(suggestions);
      expect(verifiedResult.verification).toBeDefined();
      expect(verifiedResult.verification.actionType).toBe(AIActionType.SUGGEST);
      expect(verifiedResult.verification.metadata).toHaveProperty(
        'todoCount',
        '3'
      );
      expect(verifiedResult.verification.metadata).toHaveProperty(
        'suggestionCount',
        '3'
      );
    });

    it('should create a verified AI analysis', async () => {
      const analysis = {
        themes: ['work', 'planning'],
        bottlenecks: ['external dependencies'],
        timeEstimate: '5 days',
      };

      const verifiedResult = await verificationService.createVerifiedAnalysis(
        sampleTodos,
        analysis,
        AIPrivacyLevel.HASH_ONLY
      );

      expect(verifiedResult).toBeDefined();
      expect(verifiedResult.result).toEqual(analysis);
      expect(verifiedResult.verification).toBeDefined();
      expect(verifiedResult.verification.actionType).toBe(AIActionType.ANALYZE);
      expect(verifiedResult.verification.metadata).toHaveProperty(
        'todoCount',
        '3'
      );
      expect(verifiedResult.verification.metadata).toHaveProperty(
        'analysisKeys',
        'themes,bottlenecks,timeEstimate'
      );
    });
  });

  // SECTION: Blockchain Verification Service
  describe('Blockchain Verification Service', () => {
    let blockchainVerificationService: BlockchainAIVerificationService;

    beforeEach(() => {
      const blockchainVerifier = new (BlockchainVerifier as any)();
      const permissionManager = getPermissionManager();
      const credentialManager = new (SecureCredentialManager as any)(
        '/mock/keys'
      );

      blockchainVerificationService = new BlockchainAIVerificationService(
        blockchainVerifier,
        permissionManager,
        credentialManager,
        'xai'
      );
    });

    it('should create a blockchain verification', async () => {
      const result =
        await blockchainVerificationService.createBlockchainVerification(
          AIActionType.SUMMARIZE,
          sampleTodos,
          'Sample summary text',
          'xai',
          AIPrivacyLevel.HASH_ONLY,
          { todoCount: '3' }
        );

      expect(result).toBeDefined();
      expect(result.result).toBe('Sample summary text');
      expect(result.verification).toBeDefined();
      expect(result.proof).toBeDefined();
      expect(result.transactionId).toBeDefined();
      expect(result.provider).toBe('xai');
      expect(result.verificationDate).toBeInstanceOf(Date);
    });

    it('should create a verified blockchain summary', async () => {
      const summary = 'This is a blockchain verified summary';

      const result = await blockchainVerificationService.createVerifiedSummary(
        sampleTodos,
        summary,
        AIPrivacyLevel.HASH_ONLY,
        'xai'
      );

      expect(result).toBeDefined();
      expect(result.result).toBe(summary);
      expect(result.verification).toBeDefined();
      expect(result.proof).toBeDefined();
      expect(result.transactionId).toBeDefined();
    });

    it('should verify an exported proof', async () => {
      const isValid = await blockchainVerificationService.verifyExportedProof(
        'exported-proof-string'
      );

      expect(isValid).toBe(true);
    });

    it('should get a specific verification record', async () => {
      const verification =
        await blockchainVerificationService.getVerification('bc-ver-123');

      expect(verification).toBeDefined();
      expect(verification.verification).toBeDefined();
      expect(verification.provider).toBe('blockchain-provider');
    });

    it('should list all blockchain verifications', async () => {
      const verifications =
        await blockchainVerificationService.listVerifications();

      expect(verifications).toBeDefined();
      expect(Array.isArray(verifications)).toBe(true);
      expect(verifications.length).toBeGreaterThan(0);
    });
  });

  // SECTION: Privacy Levels and Access Control
  describe('Privacy Levels and Access Control', () => {
    let verificationService: AIVerificationService;

    beforeEach(() => {
      const mockVerifierAdapter = createMockAIVerifierAdapter();
      verificationService = new AIVerificationService(mockVerifierAdapter);
    });

    it('should respect different privacy levels when creating verifications', async () => {
      // Create verifications with different privacy levels
      const hashOnlyVerification = await verificationService.createVerification(
        AIActionType.SUMMARIZE,
        sampleTodos,
        'Sample summary text',
        { todoCount: '3' },
        AIPrivacyLevel.HASH_ONLY
      );

      const metadataOnlyVerification =
        await verificationService.createVerification(
          AIActionType.SUMMARIZE,
          sampleTodos,
          'Sample summary text',
          { todoCount: '3' },
          AIPrivacyLevel.METADATA_ONLY
        );

      const fullContentVerification =
        await verificationService.createVerification(
          AIActionType.SUMMARIZE,
          sampleTodos,
          'Sample summary text',
          { todoCount: '3' },
          AIPrivacyLevel.FULL_CONTENT
        );

      expect(hashOnlyVerification.privacyLevel).toBe(AIPrivacyLevel.HASH_ONLY);
      expect(metadataOnlyVerification.privacyLevel).toBe(
        AIPrivacyLevel.METADATA_ONLY
      );
      expect(fullContentVerification.privacyLevel).toBe(
        AIPrivacyLevel.FULL_CONTENT
      );
    });
  });
});
