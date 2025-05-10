/**
 * AI Mocking Helper - Utility functions for using the AI mocking framework in tests
 */

import { 
  MockAIProviderFactory, 
  MockResponseOptions, 
  RecordingMode, 
  MockErrorType
} from '../../src/__mocks__/ai';
import { AIProvider } from '../../src/types/adapters/AIModelAdapter';
import { AIService } from '../../src/services/ai/aiService';

/**
 * Create an AIService instance with a mocked provider
 */
export function createMockAIService(
  options: {
    provider?: AIProvider;
    modelName?: string;
    mockOptions?: MockResponseOptions;
    scenarioName?: string;
    recordingMode?: RecordingMode;
    recordingPath?: string;
  } = {}
): AIService {
  let mockProvider;
  
  if (options.scenarioName) {
    // Use a predefined scenario
    mockProvider = MockAIProviderFactory.createProviderForScenario(options.scenarioName);
    if (!mockProvider) {
      throw new Error(`Unknown scenario: ${options.scenarioName}`);
    }
  } else if (options.recordingMode === RecordingMode.REPLAY && options.recordingPath) {
    // Use replay mode
    mockProvider = MockAIProviderFactory.createReplayProvider(
      options.recordingPath,
      options.provider,
      options.modelName
    );
  } else if (options.recordingMode === RecordingMode.RECORD) {
    // Use recording mode
    mockProvider = MockAIProviderFactory.createRecordingProvider(
      options.provider,
      options.modelName,
      options.recordingPath
    );
  } else {
    // Create a standard mock provider
    mockProvider = MockAIProviderFactory.createProvider(
      options.provider || AIProvider.XAI,
      options.modelName
    );
    
    // Apply custom mock options if provided
    if (options.mockOptions) {
      MockAIProviderFactory.configureProvider(mockProvider, options.mockOptions);
    }
  }
  
  // Create a service with the mock provider
  const service = new AIService('mock-api-key');
  (service as any).modelAdapter = mockProvider;
  
  return service;
}

/**
 * Configure an AIService to simulate errors
 */
export function simulateAIError(
  service: AIService,
  errorType: MockErrorType,
  probability: number = 1.0,
  errorMessage?: string
): void {
  const mockAdapter = (service as any).modelAdapter;
  
  if (!mockAdapter || typeof mockAdapter.configure !== 'function') {
    throw new Error('The service does not have a mock adapter that can be configured');
  }
  
  mockAdapter.configure({
    errors: {
      enabled: true,
      errorType,
      probability,
      errorMessage
    }
  });
}

/**
 * Configure an AIService to simulate latency
 */
export function simulateAILatency(
  service: AIService,
  minLatencyMs: number,
  maxLatencyMs: number = minLatencyMs,
  timeoutProbability: number = 0
): void {
  const mockAdapter = (service as any).modelAdapter;
  
  if (!mockAdapter || typeof mockAdapter.configure !== 'function') {
    throw new Error('The service does not have a mock adapter that can be configured');
  }
  
  mockAdapter.configure({
    latency: {
      enabled: true,
      minLatencyMs,
      maxLatencyMs,
      jitterEnabled: minLatencyMs !== maxLatencyMs,
      timeoutProbability,
      timeoutAfterMs: minLatencyMs
    }
  });
}

/**
 * Get the recorded interactions from a recording AIService
 */
export function getRecordedInteractions(service: AIService): any[] {
  const mockAdapter = (service as any).modelAdapter;
  
  if (!mockAdapter || typeof mockAdapter.getRecordedInteractions !== 'function') {
    throw new Error('The service does not have a mock adapter with recording capabilities');
  }
  
  return mockAdapter.getRecordedInteractions();
}

/**
 * Save recorded interactions to a file
 */
export function saveRecordedInteractions(service: AIService, filePath: string): boolean {
  const mockAdapter = (service as any).modelAdapter;
  
  if (!mockAdapter || typeof mockAdapter.saveRecordings !== 'function') {
    throw new Error('The service does not have a mock adapter with recording capabilities');
  }
  
  return mockAdapter.saveRecordings(filePath);
}