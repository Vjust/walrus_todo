import { jest } from '@jest/globals';
import { 
  AIVerifierAdapter, 
  VerificationParams, 
  VerificationRecord, 
  AIActionType, 
  AIPrivacyLevel
} from '../../src/types/adapters/AIVerifierAdapter';

/**
 * Mock implementation of the AIVerifierAdapter interface for testing
 */
export class MockAIVerifierAdapter implements AIVerifierAdapter {
  private mockVerifications: VerificationRecord[] = [];
  private verificationIdCounter = 1;

  async createVerification(params: VerificationParams): Promise<VerificationRecord> {
    const verificationId = `ver-${this.verificationIdCounter++}`;
    const timestamp = Date.now();
    
    const verification: VerificationRecord = {
      id: verificationId,
      requestHash: `req-hash-${verificationId}`,
      responseHash: `resp-hash-${verificationId}`,
      user: 'mock-user',
      provider: params.provider || 'mock-provider',
      timestamp,
      verificationType: params.actionType,
      metadata: params.metadata || {}
    };

    // Store in memory for test verification
    this.mockVerifications.push(verification);
    
    return verification;
  }

  async verifyRecord(
    record: VerificationRecord, 
    request: string, 
    response: string
  ): Promise<boolean> {
    // For testing, just check if the record exists in our mock store
    return this.mockVerifications.some(v => v.id === record.id);
  }

  async listVerifications(): Promise<VerificationRecord[]> {
    return [...this.mockVerifications];
  }

  async getVerification(id: string): Promise<VerificationRecord | null> {
    const verification = this.mockVerifications.find(v => v.id === id);
    return verification || null;
  }
}

/**
 * Create a jest spy implementation of the AIVerifierAdapter
 */
export const createMockAIVerifierAdapter = () => {
  // Sample verification record for testing
  const sampleVerification: VerificationRecord = {
    id: 'ver-test-123',
    requestHash: 'req-hash-test',
    responseHash: 'resp-hash-test',
    user: 'mock-user',
    provider: 'mock-provider',
    timestamp: Date.now(),
    verificationType: AIActionType.SUMMARIZE,
    metadata: { test: 'metadata' }
  };

  const mockAdapter: AIVerifierAdapter = {
    createVerification: jest.fn().mockImplementation(async (params: VerificationParams) => ({
      id: 'ver-mock-123',
      requestHash: 'mock-req-hash',
      responseHash: 'mock-resp-hash',
      user: 'mock-user',
      provider: params.provider || 'mock-provider',
      timestamp: Date.now(),
      verificationType: params.actionType,
      metadata: params.metadata || {}
    })),
    verifyRecord: jest.fn().mockResolvedValue(true),
    listVerifications: jest.fn().mockResolvedValue([sampleVerification]),
    getVerification: jest.fn().mockImplementation(async (id: string) => {
      return id === 'ver-test-123' ? sampleVerification : null;
    })
  };

  return mockAdapter;
};