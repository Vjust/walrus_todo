/**
 * AI Mocking Framework - Main export file
 * 
 * This framework provides comprehensive tools for mocking AI provider responses
 * in the walrus_todo project, with support for customizable response templates,
 * error simulation, latency simulation, and recording/replay capabilities.
 */

// Main components
export { MockAIProvider } from './MockAIProvider';
export { MockAIProviderFactory } from './MockAIProviderFactory';
export { MockConfigManager } from './MockConfigManager';
export { ResponseTemplateManager } from './ResponseTemplateManager';
export { ErrorSimulator } from './ErrorSimulator';
export { MockResponseRecorder } from './MockResponseRecorder';

// Provider-specific implementations
export { MockXAIProvider } from './providers/MockXAIProvider';
export { MockOpenAIProvider } from './providers/MockOpenAIProvider';
export { MockAnthropicProvider } from './providers/MockAnthropicProvider';

// Templates and scenarios
export { DefaultMockResponses } from './templates/DefaultResponses';
export { ErrorScenarios, ResponseScenarios, getScenario } from './scenarios';

// Types
export type {
  AIOperationType,
  RecordingMode,
  MockResponseTemplate,
  LatencyOptions,
  MockErrorType,
  MockErrorOptions,
  MockResponseOptions,
  RecordedInteraction,
  MockScenario
} from './types';

/**
 * A convenience function to set up the mocking framework for tests
 */
// Import the RecordingMode type for use in the function signature
import { RecordingMode } from './types';
import { AIProviderFactory } from '../../services/ai/AIProviderFactory';
import { MockAIProviderFactory } from './MockAIProviderFactory';
import { getScenario } from './scenarios';
import { MockConfigManager } from './MockConfigManager';

export function setupAIMocks(options: {
  provider?: string;
  scenarioName?: string;
  configPath?: string;
  recordingMode?: RecordingMode;
  recordingPath?: string;
} = {}): void {
  // Use the static imports
  
  // Mock the AIProviderFactory
  jest.mock('../../services/ai/AIProviderFactory', () => {
    return {
      AIProviderFactory: {
        createProvider: jest.fn().mockImplementation((config) => {
          // If a scenario is specified, use that
          if (options.scenarioName) {
            return MockAIProviderFactory.createProviderForScenario(options.scenarioName);
          }
          
          // If recording mode is set
          if (options.recordingMode === RecordingMode.RECORD) {
            return MockAIProviderFactory.createRecordingProvider(
              config.provider || options.provider,
              config.modelName,
              options.recordingPath
            );
          } else if (options.recordingMode === RecordingMode.REPLAY && options.recordingPath) {
            return MockAIProviderFactory.createReplayProvider(
              options.recordingPath,
              config.provider || options.provider,
              config.modelName
            );
          }
          
          // Otherwise create a standard mock provider
          return MockAIProviderFactory.createProvider(
            config.provider || options.provider,
            config.modelName
          );
        }),
        getDefaultProvider: jest.fn().mockImplementation(() => ({
          provider: options.provider || 'xai',
          modelName: 'mock-model'
        }))
      }
    };
  });
  
  // Set up additional mocks if needed
  // ...
}

/**
 * A convenience function to tear down mocks
 */
export function teardownAIMocks(): void {
  jest.restoreAllMocks();
  
  MockAIProviderFactory.resetAllProviders();
  MockAIProviderFactory.clearCache();
}