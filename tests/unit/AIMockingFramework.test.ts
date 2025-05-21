/**
 * Test for the AI Mocking Framework
 */

import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { AIService } from '../../src/services/ai/aiService';
import { AIProvider } from '../../src/types/adapters/AIModelAdapter';
import { 
  setupAIMocks, 
  teardownAIMocks, 
  MockAIProviderFactory, 
  MockErrorType, 
  RecordingMode
} from '../../src/__mocks__/ai';
import { Todo } from '../../src/types/todo';
import * as fs from 'fs';

describe('AI Mocking Framework', () => {
  // Sample todos for testing
  const sampleTodos: Todo[] = [
    {
      id: 'todo-1',
      title: 'Complete project proposal',
      description: 'Finalize the quarterly project proposal for client review',
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'todo-2',
      title: 'Schedule team meeting',
      description: 'Coordinate with team members for project kickoff',
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'todo-3',
      title: 'Research competitive products',
      description: 'Analyze market competitors for the upcoming strategy session',
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
  
  beforeAll(() => {
    // Set up the mocking framework
    setupAIMocks();
  });
  
  afterAll(() => {
    // Clean up the mocking framework
    teardownAIMocks();
  });
  
  // SECTION: Basic mocking tests
  describe('Basic Mocking', () => {
    it('should provide mock responses for summarize operation', async () => {
      const aiService = new AIService('mock-api-key');
      const summary = await aiService.summarize(sampleTodos);
      
      expect(summary).toBeTruthy();
      expect(typeof summary).toBe('string');
    });
    
    it('should provide structured mock responses for categorize operation', async () => {
      const aiService = new AIService('mock-api-key');
      const categories = await aiService.categorize(sampleTodos);
      
      expect(categories).toBeTruthy();
      expect(typeof categories).toBe('object');
      expect(Object.keys(categories).length).toBeGreaterThan(0);
    });
    
    it('should provide structured mock responses for prioritize operation', async () => {
      const aiService = new AIService('mock-api-key');
      const priorities = await aiService.prioritize(sampleTodos);
      
      expect(priorities).toBeTruthy();
      expect(typeof priorities).toBe('object');
      expect(Object.keys(priorities).length).toBeGreaterThan(0);
    });
    
    it('should provide structured mock responses for suggest operation', async () => {
      const aiService = new AIService('mock-api-key');
      const suggestions = await aiService.suggest(sampleTodos);
      
      expect(suggestions).toBeTruthy();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
    });
    
    it('should provide structured mock responses for analyze operation', async () => {
      const aiService = new AIService('mock-api-key');
      const analysis = await aiService.analyze(sampleTodos);
      
      expect(analysis).toBeTruthy();
      expect(typeof analysis).toBe('object');
      expect(Object.keys(analysis).length).toBeGreaterThan(0);
    });
  });
  
  // SECTION: Provider-specific mocking
  describe('Provider-Specific Mocking', () => {
    it('should provide XAI-specific responses', async () => {
      const aiService = new AIService('mock-api-key', AIProvider.XAI);
      const summary = await aiService.summarize(sampleTodos);
      
      expect(summary).toBeTruthy();
    });
    
    it('should provide OpenAI-specific responses', async () => {
      const aiService = new AIService('mock-api-key', AIProvider.OPENAI);
      const summary = await aiService.summarize(sampleTodos);
      
      expect(summary).toBeTruthy();
    });
    
    it('should provide Anthropic-specific responses', async () => {
      const aiService = new AIService('mock-api-key', AIProvider.ANTHROPIC);
      const summary = await aiService.summarize(sampleTodos);
      
      expect(summary).toBeTruthy();
    });
  });
  
  // SECTION: Error simulation
  describe('Error Simulation', () => {
    let aiService: AIService;
    
    beforeEach(() => {
      aiService = new AIService('mock-api-key');
    });
    
    it('should simulate authentication errors', async () => {
      // Get the mock provider and configure for authentication errors
      const mockProvider = MockAIProviderFactory.createProvider(AIProvider.XAI);
      MockAIProviderFactory.configureProvider(mockProvider, {
        errors: {
          enabled: true,
          errorType: MockErrorType.AUTHENTICATION,
          probability: 1.0
        }
      });
      
      // Override the service's provider with our configured mock
      (aiService as any).modelAdapter = mockProvider;
      
      await expect(aiService.summarize(sampleTodos)).rejects.toThrow(/401 Unauthorized/);
    });
    
    it('should simulate rate limit errors', async () => {
      // Get the mock provider and configure for rate limit errors
      const mockProvider = MockAIProviderFactory.createProvider(AIProvider.XAI);
      MockAIProviderFactory.configureProvider(mockProvider, {
        errors: {
          enabled: true,
          errorType: MockErrorType.RATE_LIMIT,
          probability: 1.0
        }
      });
      
      // Override the service's provider with our configured mock
      (aiService as any).modelAdapter = mockProvider;
      
      await expect(aiService.summarize(sampleTodos)).rejects.toThrow(/429 Too Many Requests/);
    });
    
    it('should simulate network errors', async () => {
      // Get the mock provider and configure for network errors
      const mockProvider = MockAIProviderFactory.createProvider(AIProvider.XAI);
      MockAIProviderFactory.configureProvider(mockProvider, {
        errors: {
          enabled: true,
          errorType: MockErrorType.NETWORK,
          probability: 1.0
        }
      });
      
      // Override the service's provider with our configured mock
      (aiService as any).modelAdapter = mockProvider;
      
      await expect(aiService.summarize(sampleTodos)).rejects.toThrow(/Network error/);
    });
  });
  
  // SECTION: Latency simulation
  describe('Latency Simulation', () => {
    it('should simulate response latency', async () => {
      // Get the mock provider and configure for latency
      const mockProvider = MockAIProviderFactory.createProvider(AIProvider.XAI);
      MockAIProviderFactory.configureProvider(mockProvider, {
        latency: {
          enabled: true,
          minLatencyMs: 200,
          maxLatencyMs: 300,
          jitterEnabled: false,
          timeoutProbability: 0,
          timeoutAfterMs: 30000
        }
      });
      
      const aiService = new AIService('mock-api-key');
      (aiService as any).modelAdapter = mockProvider;
      
      const startTime = Date.now();
      await aiService.summarize(sampleTodos);
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      expect(duration).toBeGreaterThanOrEqual(200);
    });
    
    it('should simulate timeouts', async () => {
      // Get the mock provider and configure for timeouts
      const mockProvider = MockAIProviderFactory.createProvider(AIProvider.XAI);
      MockAIProviderFactory.configureProvider(mockProvider, {
        latency: {
          enabled: true,
          minLatencyMs: 100,
          maxLatencyMs: 100,
          jitterEnabled: false,
          timeoutProbability: 1.0,
          timeoutAfterMs: 100
        }
      });
      
      const aiService = new AIService('mock-api-key');
      (aiService as any).modelAdapter = mockProvider;
      
      await expect(aiService.summarize(sampleTodos)).rejects.toThrow(/timed out/);
    });
  });
  
  // SECTION: Recording and replaying
  describe('Recording and Replaying', () => {
    const recordingPath = './test-recordings/test-recording.json';
    
    it('should record and replay interactions', async () => {
      // Set up recording
      const recordingProvider = MockAIProviderFactory.createProvider(AIProvider.XAI) as any;
      MockAIProviderFactory.configureProvider(recordingProvider, {
        recordingMode: RecordingMode.RECORD
      });
      
      // Use the recording provider
      const aiService = new AIService('mock-api-key');
      (aiService as any).modelAdapter = recordingProvider;
      
      // Perform operations to record
      await aiService.summarize(sampleTodos);
      await aiService.categorize(sampleTodos);
      
      // Save recordings
      recordingProvider.saveRecordings(recordingPath);
      
      // Set up replay
      const replayProvider = MockAIProviderFactory.createProvider(AIProvider.XAI) as any;
      replayProvider.loadRecordings(recordingPath);
      MockAIProviderFactory.configureProvider(replayProvider, {
        recordingMode: RecordingMode.REPLAY
      });
      
      // Use the replay provider
      const replayService = new AIService('mock-api-key');
      (replayService as any).modelAdapter = replayProvider;
      
      // The operations should work with the recorded data
      const summary = await replayService.summarize(sampleTodos);
      const categories = await replayService.categorize(sampleTodos);
      
      expect(summary).toBeTruthy();
      expect(categories).toBeTruthy();
      
      // Clean up recording file
      try {
        fs.unlinkSync(recordingPath);
      } catch (e) {
        // Ignore errors
      }
    });
  });
  
  // SECTION: Scenario-based testing
  describe('Scenario-Based Testing', () => {
    it('should use predefined error scenarios', async () => {
      // Create a provider with the authentication error scenario
      const mockProvider = MockAIProviderFactory.createProviderForScenario('authError');
      
      const aiService = new AIService('mock-api-key');
      (aiService as any).modelAdapter = mockProvider;
      
      await expect(aiService.summarize(sampleTodos)).rejects.toThrow(/401 Unauthorized/);
    });
    
    it('should use predefined response scenarios', async () => {
      // Create a provider with the minimal responses scenario
      const mockProvider = MockAIProviderFactory.createProviderForScenario('minimalResponses');
      
      const aiService = new AIService('mock-api-key');
      (aiService as any).modelAdapter = mockProvider;
      
      const summary = await aiService.summarize(sampleTodos);
      expect(summary).toBe("Todo list contains 5 work items and 3 personal tasks. Most are medium priority.");
    });
  });
});