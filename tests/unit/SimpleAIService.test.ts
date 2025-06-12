/**
 * Simple test for Consolidated AI Service
 *
 * Tests only the creation of the singleton instance
 */

import { aiService } from '../../apps/cli/src/services/ai';

// Just test if we can import the service without errors
describe('Simple AIService Test', () => {
  it('should export a singleton instance of AIService', () => {
    expect(aiService as any).toBeDefined();
    expect(typeof aiService).toBe('object');
    expect(typeof aiService.summarize).toBe('function');
    expect(typeof aiService.categorize).toBe('function');
  });
});
