/**
 * Simple test for Consolidated AI Service
 * 
 * Tests only the creation of the singleton instance
 */

import { AIService, aiService } from '../../src/services/ai';

// Just test if we can import the service without errors
describe('Simple AIService Test', () => {
  it('should export a singleton instance of AIService', () => {
    expect(aiService).toBeDefined();
    expect(aiService).toBeInstanceOf(AIService);
  });
});